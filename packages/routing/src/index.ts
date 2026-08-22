/**
 * @dsm/routing -- relay scheduler, copy budgets, queue fairness, congestion.
 *
 * Spec: 02-... "Relay scheduler", "Routing algorithm specification",
 * "Queue fairness", "Duplicate and loop control"; REL-005, REL-007, REL-009.
 *
 * "Farthest neighbour is never the sole rule." The utility below is a bounded,
 * documented, DETERMINISTIC score with reason codes, exactly as the spec
 * requires. Weights are tunable; behaviour is not accidental.
 */

import {
  CLASS_BUDGETS,
  FRESHNESS,
  PolicyReason,
  Priority,
  SESSION,
  type CustodyRecord,
  type Packet,
  type PeerObservationRecord,
  type PolicyReasonName,
  type PriorityValue,
} from '@dsm/contracts';
import { budgetClassFor } from '@dsm/codec';

export interface RelayCandidate {
  readonly packetId: string;
  readonly packet: Packet;
  readonly custody: CustodyRecord;
}

export interface NeighborContext {
  readonly peer: PeerObservationRecord;
  /** Packet IDs the peer advertised in this session's inventory. */
  readonly peerInventory: ReadonlySet<string>;
  readonly nowMs: number;
  readonly localBatteryBand: number;
  /** Rotating token of the hop we received a packet from, to avoid bounce-back. */
  readonly previousHopByPacket: ReadonlyMap<string, string>;
}

export interface ForwardingDecision {
  readonly forward: boolean;
  /** 0..1 bounded utility. Higher is more useful. */
  readonly utility: number;
  readonly reason: PolicyReasonName;
  readonly components: Readonly<Record<string, number>>;
}

/** Documented weights. Change them here, not inline. */
export const UTILITY_WEIGHTS = {
  gatewayProven: 0.3,
  novelty: 0.2,
  urgency: 0.25,
  linkReliability: 0.1,
  age: 0.1,
  batterySuitability: 0.05,
} as const;

/**
 * REL-009: considers packet class, target, novelty, gateway availability,
 * battery, congestion, and copy overlap.
 */
export function forwardingUtility(candidate: RelayCandidate, ctx: NeighborContext): ForwardingDecision {
  const { packet, custody } = candidate;
  const header = packet.header;

  // --- Hard eligibility gates (02-... "Candidate eligibility") --------------
  if (ctx.peerInventory.has(candidate.packetId)) {
    return refuse(PolicyReason.NEIGHBOR_ALREADY_HAS);
  }
  if (custody.knownHolders.includes(ctx.peer.peerToken)) {
    return refuse(PolicyReason.NEIGHBOR_ALREADY_HAS);
  }
  if (ctx.previousHopByPacket.get(candidate.packetId) === ctx.peer.peerToken) {
    // Immediate bounce-back prevention.
    return refuse(PolicyReason.NEIGHBOR_ALREADY_HAS);
  }
  if (custody.copyBudgetRemaining <= 0) {
    return refuse(PolicyReason.COPY_BUDGET_EXHAUSTED);
  }
  if (custody.nextEligibleAtMs !== undefined && custody.nextEligibleAtMs > ctx.nowMs) {
    return refuse(PolicyReason.COOLDOWN_ACTIVE);
  }
  if (header.hopCount >= header.hopLimit) {
    return refuse(PolicyReason.COPY_BUDGET_EXHAUSTED);
  }
  if (ctx.localBatteryBand <= 0 && header.priority > Priority.RESPONSE_CONTROL) {
    return refuse(PolicyReason.BATTERY_RESTRICTED);
  }

  // --- Bounded utility -----------------------------------------------------
  const gatewayFresh =
    ctx.peer.gatewayProven && ctx.nowMs - ctx.peer.lastSeenAtMs <= FRESHNESS.GATEWAY_PROOF_S * 1000;
  const gateway = gatewayFresh && isUploadEligible(header.priority) ? 1 : 0;

  const attempts = ctx.peer.sessionsCompleted + ctx.peer.sessionsFailed;
  const reliability = attempts === 0 ? 0.5 : ctx.peer.sessionsCompleted / attempts;

  const budget = CLASS_BUDGETS[budgetClassFor(header.type, header.severity)];
  const novelty = Math.max(0, 1 - custody.copiesMade / Math.max(1, budget.copyBudget));

  // Lower priority number = more urgent.
  const urgency = 1 - header.priority / 7;

  // Older eligible packets gain weight (queue fairness).
  const ageS = Math.max(0, ctx.nowMs / 1000 - header.createdAt);
  const ttl = Math.max(1, header.expiresAt - header.createdAt);
  const age = Math.min(1, ageS / ttl);

  const battery = ctx.localBatteryBand / 3;

  const components = {
    gateway: gateway * UTILITY_WEIGHTS.gatewayProven,
    novelty: novelty * UTILITY_WEIGHTS.novelty,
    urgency: urgency * UTILITY_WEIGHTS.urgency,
    reliability: reliability * UTILITY_WEIGHTS.linkReliability,
    age: age * UTILITY_WEIGHTS.age,
    battery: battery * UTILITY_WEIGHTS.batterySuitability,
  };
  const utility = Object.values(components).reduce((a, b) => a + b, 0);

  return {
    forward: true,
    utility: Math.min(1, utility),
    reason: gateway > 0 ? PolicyReason.GATEWAY_PROVEN : PolicyReason.COPY_BUDGET_AVAILABLE,
    components,
  };
}

function refuse(reason: PolicyReasonName): ForwardingDecision {
  return { forward: false, utility: 0, reason, components: {} };
}

function isUploadEligible(priority: PriorityValue): boolean {
  return priority <= Priority.GENERAL_UPDATE;
}

/**
 * Builds the transfer offer for one session.
 *
 * REL-005: critical packets precede file fragments, and a reserved control
 * budget prevents a file from blocking an SOS.
 */
export function planTransfer(
  candidates: readonly RelayCandidate[],
  ctx: NeighborContext,
  options: { readonly maxRecords?: number; readonly maxBytes?: number } = {},
): {
  readonly offers: readonly { readonly candidate: RelayCandidate; readonly decision: ForwardingDecision }[];
  readonly skipped: readonly { readonly packetId: string; readonly reason: PolicyReasonName }[];
  readonly totalBytes: number;
} {
  const maxRecords = options.maxRecords ?? SESSION.MAX_RECORDS;
  const maxBytes = options.maxBytes ?? SESSION.MAX_BYTES;

  const scored: { candidate: RelayCandidate; decision: ForwardingDecision }[] = [];
  const skipped: { packetId: string; reason: PolicyReasonName }[] = [];

  for (const candidate of candidates) {
    const decision = forwardingUtility(candidate, ctx);
    if (decision.forward) scored.push({ candidate, decision });
    else skipped.push({ packetId: candidate.packetId, reason: decision.reason });
  }

  // Queue order: priority class first, then utility, then oldest.
  scored.sort((a, b) => {
    const pa = a.candidate.packet.header.priority;
    const pb = b.candidate.packet.header.priority;
    if (pa !== pb) return pa - pb;
    if (a.decision.utility !== b.decision.utility) return b.decision.utility - a.decision.utility;
    return a.candidate.packet.header.createdAt - b.candidate.packet.header.createdAt;
  });

  // Reserve capacity so files can never starve critical traffic (REL-005).
  const fileReserveRecords = Math.max(1, Math.floor(maxRecords * 0.25));
  const nonFileLimit = maxRecords - fileReserveRecords;

  const offers: { candidate: RelayCandidate; decision: ForwardingDecision }[] = [];
  let bytes = 0;
  let fileRecords = 0;
  let normalRecords = 0;

  for (const entry of scored) {
    const isFile = entry.candidate.packet.header.priority >= Priority.FILE_MANIFEST;
    const size = entry.candidate.packet.header.payloadLength + 64;

    if (bytes + size > maxBytes) {
      skipped.push({ packetId: entry.candidate.packetId, reason: PolicyReason.CONGESTION_PREEMPTED });
      continue;
    }
    if (isFile && fileRecords >= fileReserveRecords) {
      skipped.push({ packetId: entry.candidate.packetId, reason: PolicyReason.CONGESTION_PREEMPTED });
      continue;
    }
    if (!isFile && normalRecords >= nonFileLimit) {
      skipped.push({ packetId: entry.candidate.packetId, reason: PolicyReason.CONGESTION_PREEMPTED });
      continue;
    }

    offers.push(entry);
    bytes += size;
    if (isFile) fileRecords += 1;
    else normalRecords += 1;
    if (offers.length >= maxRecords) break;
  }

  return { offers, skipped, totalBytes: bytes };
}

/** Applies one successful transfer to a custody record. */
export function afterTransfer(custody: CustodyRecord, peerToken: string, nowMs: number, type: number, severity: number): CustodyRecord {
  const budget = CLASS_BUDGETS[budgetClassFor(type, severity)];
  return {
    ...custody,
    state: 'sent',
    copiesMade: custody.copiesMade + 1,
    copyBudgetRemaining: Math.max(0, custody.copyBudgetRemaining - 1),
    lastOfferedAtMs: nowMs,
    nextEligibleAtMs: nowMs + budget.retryCooldownS * 1000,
    knownHolders: custody.knownHolders.includes(peerToken)
      ? custody.knownHolders
      : [...custody.knownHolders, peerToken],
  };
}

/** Bounded exponential backoff with jitter after a failed session. */
export function backoffMs(consecutiveFailures: number, random: () => number = Math.random): number {
  const base = Math.min(SESSION.BACKOFF_MAX_MS, SESSION.BACKOFF_BASE_MS * 2 ** Math.min(10, consecutiveFailures));
  return base + Math.floor(random() * SESSION.BACKOFF_JITTER_MS);
}

/**
 * Deterministic tie-break so only one side normally initiates a connection
 * (02-... "Connection arbitration").
 */
export function shouldInitiate(localToken: string, peerToken: string): boolean {
  return localToken < peerToken;
}

export * from './session.js';
