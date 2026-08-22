/**
 * @dsm/validator -- the ONE validation pipeline every transport feeds.
 *
 * Invariant 4 (02-...): "All transports feed one packet validator, local store,
 * policy engine, and map projection." Tier 1 BLE, the gateway download path,
 * and Tier 2 radio all call `validate` here. There is no second pipeline.
 *
 * It returns structural validity, integrity outcome, duplicate/conflict state,
 * expiry/hop outcome, source role label, and reason codes. It does NOT update
 * the UI or perform network calls.
 */

import {
  Flags,
  MessageType,
  RejectReason,
  SESSION_CONTROL_TYPES,
  SourceClass,
  TERMINAL_TYPES,
  TIME,
  ValidationGate,
  type Packet,
  type PacketObservation,
  type RejectReasonName,
  type SourceClassValue,
  type TransportKind,
  type ValidationGateName,
} from '@dsm/contracts';
import { decodePacket, type DecodeResult } from '@dsm/codec';
import { validateSchema } from './schemas.js';

export interface ValidationContext {
  /** Seconds since the demo epoch. */
  readonly nowS: number;
  readonly transport: TransportKind;
  readonly hopCountOnArrival: number;
  /** Set true when the store already holds this packet ID with this digest. */
  readonly isKnownDuplicate: boolean;
  /** Set to the stored digest when the ID is known with DIFFERENT bytes. */
  readonly conflictingDigest?: string;
  /** Newest source sequence already applied for this stream, if any. */
  readonly knownSequence?: number;
  /** True when a terminal record for this stream has already been applied. */
  readonly streamTerminated: boolean;
  readonly storagePressure: 'ok' | 'high' | 'critical';
  readonly queueDepth: number;
  readonly maxQueueDepth: number;
  /** Region code of the loaded content pack, if any. */
  readonly regionCode?: string;
}

export interface ValidationSuccess {
  readonly ok: true;
  readonly packet: Packet;
  readonly digest: string;
  readonly totalBytes: number;
  /** The role LABEL carried by the packet. INT-005: not cryptographic proof. */
  readonly sourceLabel: SourceLabel;
  readonly isTerminal: boolean;
  readonly isSessionControl: boolean;
  /** True when this packet supersedes an earlier state for its stream. */
  readonly supersedes: boolean;
  readonly gatesPassed: readonly ValidationGateName[];
  /**
   * Gates this pipeline deliberately does NOT evaluate, deferring them to the
   * policy engine. Reported separately so diagnostics never claim a check ran
   * when it did not.
   */
  readonly gatesDeferred: readonly ValidationGateName[];
  /** Non-fatal notes for diagnostics (clock skew inside tolerance, etc.). */
  readonly warnings: readonly string[];
}

export interface ValidationFailure {
  readonly ok: false;
  readonly gate: ValidationGateName;
  readonly reason: RejectReasonName;
  readonly detail?: string;
  readonly packetId?: string;
  readonly gatesPassed: readonly ValidationGateName[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * INT-004 / INT-005: the honest vocabulary. "demo-provisioned" is never
 * "verified". The UI must render these labels, not softer synonyms.
 */
export type SourceLabel =
  | 'community-reported'
  | 'general-public'
  | 'responder-demo-provisioned'
  | 'authority-demo-provisioned'
  | 'coordinator-demo-provisioned'
  | 'coordination-backend'
  | 'radio-broadcast-demo-provisioned'
  | 'unknown-source';

export function sourceLabelFor(sourceClass: SourceClassValue, flags: number): SourceLabel {
  if ((flags & Flags.COMMUNITY_REPORTED) !== 0) return 'community-reported';
  switch (sourceClass) {
    case SourceClass.GENERAL_PUBLIC:
      return 'general-public';
    case SourceClass.RESPONDER_PROVISIONED:
      return 'responder-demo-provisioned';
    case SourceClass.AUTHORITY_PROVISIONED:
      return 'authority-demo-provisioned';
    case SourceClass.COORDINATOR_PROVISIONED:
      return 'coordinator-demo-provisioned';
    case SourceClass.BACKEND:
      return 'coordination-backend';
    case SourceClass.TIER2_BROADCAST:
      return 'radio-broadcast-demo-provisioned';
    default:
      return 'unknown-source';
  }
}

/** Human copy for each label. Nothing here may say "verified". */
export const SOURCE_LABEL_COPY: Readonly<Record<SourceLabel, string>> = {
  'community-reported': 'Community reported',
  'general-public': 'Reported by a member of the public',
  'responder-demo-provisioned': 'Responder (demo-provisioned role)',
  'authority-demo-provisioned': 'Authority (demo-provisioned role)',
  'coordinator-demo-provisioned': 'Coordinator (demo-provisioned role)',
  'coordination-backend': 'From the coordination centre',
  'radio-broadcast-demo-provisioned': 'Radio broadcast (demo-provisioned role)',
  'unknown-source': 'Unknown source',
};

/** Which source classes may create which message types (ROL-006, DEC-015). */
const AUTHORITY_ONLY: ReadonlySet<number> = new Set([
  MessageType.OFFICIAL_ALERT,
  MessageType.WEATHER_BULLETIN,
  MessageType.CHECKIN_CAMPAIGN,
  MessageType.CACHE_CATALOG,
  MessageType.CACHE_INVALIDATE,
]);

const RESPONDER_OR_AUTHORITY_ONLY: ReadonlySet<number> = new Set([
  MessageType.RESPONDER_ASSIGNED,
  MessageType.RESPONDER_ACCEPTED,
  MessageType.RESPONDER_DECLINED,
  MessageType.RESPONDER_EN_ROUTE,
  MessageType.RESPONDER_ARRIVED,
  MessageType.RESOLVED,
  MessageType.SHELTER,
  MessageType.MEDICAL_POST,
  MessageType.FOOD_WATER,
  MessageType.SAFE_ZONE,
]);

function rolePermits(type: number, sourceClass: SourceClassValue, flags: number): boolean {
  const privileged =
    sourceClass === SourceClass.AUTHORITY_PROVISIONED ||
    sourceClass === SourceClass.COORDINATOR_PROVISIONED ||
    sourceClass === SourceClass.BACKEND ||
    sourceClass === SourceClass.TIER2_BROADCAST;

  if (AUTHORITY_ONLY.has(type)) return privileged;

  if (RESPONDER_OR_AUTHORITY_ONLY.has(type)) {
    // A community-reported flag downgrades a resource record but does not forge one.
    if ((flags & Flags.COMMUNITY_REPORTED) !== 0) {
      return type === MessageType.SHELTER || type === MessageType.MEDICAL_POST || type === MessageType.FOOD_WATER;
    }
    return privileged || sourceClass === SourceClass.RESPONDER_PROVISIONED;
  }

  return true;
}

/**
 * The 15 ordered gates from 02-... "Validation pipeline". Gates 1-5 and 10-11
 * are executed by the codec (it owns structural parsing); this function runs
 * the remainder and records the full pass list for diagnostics.
 */
export function validate(bytes: Uint8Array, context: ValidationContext): ValidationResult {
  const gatesPassed: ValidationGateName[] = [];
  const warnings: string[] = [];

  // Gates 1-5, 10, 11 (structure, version, sizes, header CRC, known type,
  // payload integrity, schema decode) live in the codec.
  const decoded: DecodeResult = decodePacket(bytes);
  if (!decoded.ok) {
    return {
      ok: false,
      gate: gateForDecodeReason(decoded.reason),
      reason: decoded.reason,
      ...(decoded.detail ? { detail: decoded.detail } : {}),
      gatesPassed,
    };
  }
  gatesPassed.push(
    ValidationGate.ENVELOPE_LENGTH,
    ValidationGate.PROTOCOL_VERSION,
    ValidationGate.DECLARED_SIZES,
    ValidationGate.HEADER_INTEGRITY,
    ValidationGate.KNOWN_TYPE,
  );

  const { packet, digest, totalBytes } = decoded;
  const { header } = packet;
  const packetId = header.packetId;

  // Gate 6: packet ID and duplicate lookup.
  if (context.conflictingDigest && context.conflictingDigest !== digest) {
    return {
      ok: false,
      gate: ValidationGate.DUPLICATE_LOOKUP,
      reason: RejectReason.DIGEST_CONFLICT,
      detail: 'same packet ID, different payload digest',
      packetId,
      gatesPassed,
    };
  }
  gatesPassed.push(ValidationGate.DUPLICATE_LOOKUP);

  // Gate 7: creation, expiry, and clock-skew sanity.
  if (header.createdAt > context.nowS + TIME.MAX_FUTURE_S) {
    return {
      ok: false,
      gate: ValidationGate.CLOCK_SANITY,
      reason: RejectReason.CREATED_IN_FUTURE,
      packetId,
      gatesPassed,
    };
  }
  if (header.createdAt > context.nowS + TIME.MAX_CLOCK_SKEW_S) {
    // 02-... clock anomalies: flag, do not discard within tolerance.
    warnings.push('created-time ahead of local clock but inside tolerance');
  }
  if (header.expiresAt <= context.nowS) {
    return { ok: false, gate: ValidationGate.CLOCK_SANITY, reason: RejectReason.EXPIRED, packetId, gatesPassed };
  }
  if (header.expiresAt - header.createdAt > TIME.MAX_TTL_S) {
    return {
      ok: false,
      gate: ValidationGate.CLOCK_SANITY,
      reason: RejectReason.CLOCK_IMPLAUSIBLE,
      detail: 'TTL beyond the configured maximum',
      packetId,
      gatesPassed,
    };
  }
  gatesPassed.push(ValidationGate.CLOCK_SANITY);

  // Gate 8: hop count below hop limit.
  if (header.hopCount >= header.hopLimit) {
    return {
      ok: false,
      gate: ValidationGate.HOP_LIMIT,
      reason: RejectReason.HOP_LIMIT_EXCEEDED,
      detail: `${header.hopCount}/${header.hopLimit}`,
      packetId,
      gatesPassed,
    };
  }
  gatesPassed.push(ValidationGate.HOP_LIMIT);

  // Gate 9: fragment/reassembly limits.
  if (header.fragmentCount === 0 || header.fragmentIndex >= header.fragmentCount) {
    return {
      ok: false,
      gate: ValidationGate.FRAGMENT_LIMITS,
      reason: RejectReason.FRAGMENT_INDEX_INVALID,
      packetId,
      gatesPassed,
    };
  }
  gatesPassed.push(ValidationGate.FRAGMENT_LIMITS, ValidationGate.PAYLOAD_INTEGRITY);

  // Gate 11: type-specific schema validation.
  const schema = validateSchema(header.type, packet.payload as Record<string, unknown>);
  if (!schema.ok) {
    return {
      ok: false,
      gate: ValidationGate.SCHEMA,
      reason: schema.reason,
      detail: schema.detail,
      packetId,
      gatesPassed,
    };
  }
  gatesPassed.push(ValidationGate.SCHEMA);

  // Gate 12: source role/trust-label policy.
  if (!rolePermits(header.type, header.sourceClass, header.flags)) {
    return {
      ok: false,
      gate: ValidationGate.SOURCE_ROLE,
      reason: RejectReason.ROLE_NOT_PERMITTED,
      detail: `sourceClass ${header.sourceClass} may not create type 0x${(header.type as number).toString(16)}`,
      packetId,
      gatesPassed,
    };
  }
  gatesPassed.push(ValidationGate.SOURCE_ROLE);

  // Gates 13 and 14 are DEFERRED, not passed. Geographic relevance and user
  // preference decide display and relay, which is the policy engine's job --
  // and a packet outside the pack region is still stored so it can be carried
  // onward (02-... store-carry-forward). Reporting them as "passed" would make
  // the diagnostics screen claim a check ran when it never did.
  const gatesDeferred: ValidationGateName[] = [
    ValidationGate.GEOGRAPHIC_RELEVANCE,
    ValidationGate.USER_PREFERENCE,
  ];

  // Gate 15: battery, storage, queue, and congestion policy.
  if (context.storagePressure === 'critical' && header.priority > 1) {
    return {
      ok: false,
      gate: ValidationGate.RESOURCE_PRESSURE,
      reason: RejectReason.STORAGE_FULL,
      packetId,
      gatesPassed,
    };
  }
  if (context.queueDepth >= context.maxQueueDepth && header.priority > 2) {
    return {
      ok: false,
      gate: ValidationGate.RESOURCE_PRESSURE,
      reason: RejectReason.QUEUE_FULL,
      packetId,
      gatesPassed,
    };
  }
  gatesPassed.push(ValidationGate.RESOURCE_PRESSURE);

  const isTerminal = TERMINAL_TYPES.has(header.type) || (header.flags & Flags.TERMINAL) !== 0;

  // Latest-wins: an older sequence is retained for audit but never reactivated.
  let supersedes = false;
  if (packet.sourceSequence !== undefined && context.knownSequence !== undefined) {
    if (packet.sourceSequence > context.knownSequence) {
      supersedes = true;
    } else if (!isTerminal) {
      return {
        ok: false,
        gate: ValidationGate.SCHEMA,
        reason: RejectReason.SUPERSEDED,
        detail: `sequence ${packet.sourceSequence} <= known ${context.knownSequence}`,
        packetId,
        gatesPassed,
      };
    }
  } else if (packet.sourceSequence !== undefined) {
    supersedes = true;
  }

  if (context.streamTerminated && !isTerminal) {
    return {
      ok: false,
      gate: ValidationGate.SCHEMA,
      reason: RejectReason.TERMINAL_APPLIED,
      detail: 'stream already has a terminal record',
      packetId,
      gatesPassed,
    };
  }

  return {
    ok: true,
    packet,
    digest,
    totalBytes,
    sourceLabel: sourceLabelFor(header.sourceClass, header.flags),
    isTerminal,
    isSessionControl: SESSION_CONTROL_TYPES.has(header.type),
    supersedes,
    gatesPassed,
    gatesDeferred,
    warnings,
  };
}

function gateForDecodeReason(reason: RejectReasonName): ValidationGateName {
  switch (reason) {
    case RejectReason.TOO_SHORT:
      return ValidationGate.ENVELOPE_LENGTH;
    case RejectReason.BAD_MAGIC:
      return ValidationGate.ENVELOPE_LENGTH;
    case RejectReason.UNSUPPORTED_VERSION:
      return ValidationGate.PROTOCOL_VERSION;
    case RejectReason.LENGTH_OVER_LIMIT:
    case RejectReason.LENGTH_MISMATCH:
      return ValidationGate.DECLARED_SIZES;
    case RejectReason.HEADER_CRC_FAILED:
      return ValidationGate.HEADER_INTEGRITY;
    case RejectReason.UNKNOWN_TYPE:
      return ValidationGate.KNOWN_TYPE;
    case RejectReason.PAYLOAD_DIGEST_MISMATCH:
      return ValidationGate.PAYLOAD_INTEGRITY;
    default:
      return ValidationGate.SCHEMA;
  }
}

/** Convenience for the transport layer: build an observation for an accepted packet. */
export function observationFor(
  result: ValidationSuccess,
  transport: TransportKind,
  atMs: number,
  extras: Partial<PacketObservation> = {},
): PacketObservation {
  return {
    packetId: result.packet.header.packetId,
    transport,
    receivedAtMs: atMs,
    hopCountOnArrival: result.packet.header.hopCount,
    bytes: result.totalBytes,
    ...extras,
  };
}

export * from './schemas.js';
