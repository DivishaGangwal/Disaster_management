/**
 * CAMPAIGN BUILDER  --  authority side of Tier 2.
 *
 * Spec: 02-... "Authority campaign planning", "Repetition and deduplication";
 * WEB-005 (byte preview), WEB-006 (state machine), T2-006 (critical repeats).
 *
 * "A campaign that exceeds the configured judging duration must be reduced by
 * removing verbosity, using compact IDs/deltas, or lowering noncritical
 * repetition. It must not hide the overrun." -- so `plan()` returns the
 * overrun explicitly rather than silently truncating.
 */

import {
  CAMPAIGN_TRANSITIONS,
  Priority,
  TIER2,
  type CampaignItem,
  type CampaignManifest,
  type CampaignState,
  type PacketId,
} from '@dsm/contracts';
import { ENVELOPE } from '@dsm/contracts';
import { toTier2Frames, TIER2_OVERHEAD_BYTES } from './frame-codec.js';

/** ggwave throughput assumption. Measure and update; never leave it implicit. */
export const GGWAVE_PROFILES = {
  'audible-fast': { bytesPerSecond: 16, label: 'Audible fast' },
  'audible-normal': { bytesPerSecond: 8, label: 'Audible normal' },
  'ultrasound-normal': { bytesPerSecond: 8, label: 'Ultrasound normal' },
} as const;

export type GgwaveProfileName = keyof typeof GGWAVE_PROFILES;

export interface CampaignInput {
  readonly campaignId: string;
  readonly campaignVersion: number;
  readonly campaignHandle: number;
  readonly regionCode: string;
  readonly validFromS: number;
  readonly validUntilS: number;
  readonly requiredPackId: string;
  readonly requiredPackVersion: number;
  readonly profile: GgwaveProfileName;
  readonly packets: readonly {
    readonly packetId: PacketId;
    /** Canonical Tier 1 bytes. Tier 2 derives from these; it never diverges. */
    readonly bytes: Uint8Array;
    readonly messageType: number;
    readonly priority: number;
    readonly severity: number;
  }[];
}

export interface CampaignPlan {
  readonly manifest: CampaignManifest;
  /** True when the campaign exceeds the judging duration budget. */
  readonly overBudget: boolean;
  readonly budgetS: number;
  /** Handle -> full packet ID, the receiver's resolution table. */
  readonly handleTable: ReadonlyMap<number, PacketId>;
}

/** T2-006: critical items repeat more frequently than normal updates. */
function repeatsFor(priority: number): number {
  if (priority <= Priority.AUTHORITY_CRITICAL) return TIER2.MIN_CRITICAL_REPEATS;
  if (priority <= Priority.OPERATIONAL) return 2;
  return TIER2.MIN_NORMAL_REPEATS;
}

export function planCampaign(input: CampaignInput): CampaignPlan {
  if (input.packets.length > TIER2.MAX_CAMPAIGN_PACKETS) {
    throw new RangeError(`campaign has ${input.packets.length} packets, over ${TIER2.MAX_CAMPAIGN_PACKETS}`);
  }

  const bytesPerSecond = GGWAVE_PROFILES[input.profile].bytesPerSecond;
  const handleTable = new Map<number, PacketId>();
  const items: CampaignItem[] = [];

  input.packets.forEach((packet, index) => {
    const handle = index + 1;
    handleTable.set(handle, packet.packetId);

    const payload = packet.bytes.subarray(ENVELOPE.HEADER_BYTES);
    const frames = toTier2Frames({
      campaignHandle: input.campaignHandle,
      campaignVersion: input.campaignVersion,
      packetHandle: handle,
      messageType: packet.messageType,
      priority: packet.priority,
      severity: packet.severity,
      payload,
    });

    const tier2Bytes = frames.reduce((sum, f) => sum + f.length, 0);
    items.push({
      packetId: packet.packetId,
      bytes: packet.bytes,
      messageType: packet.messageType,
      priority: packet.priority,
      repeats: repeatsFor(packet.priority),
      tier1Bytes: packet.bytes.length,
      tier2Bytes,
      frameCount: frames.length,
      estimatedAudioMs: Math.ceil((tier2Bytes / bytesPerSecond) * 1000),
    });
  });

  const schedule = interleave(items);
  const totalDurationS = Math.ceil(
    items.reduce((sum, item) => sum + (item.estimatedAudioMs / 1000) * item.repeats, 0),
  );
  const totalTier2Bytes = items.reduce((sum, item) => sum + item.tier2Bytes * item.repeats, 0);

  const manifest: CampaignManifest = {
    campaignId: input.campaignId,
    campaignVersion: input.campaignVersion,
    regionCode: input.regionCode,
    validFromS: input.validFromS,
    validUntilS: input.validUntilS,
    requiredPackId: input.requiredPackId,
    requiredPackVersion: input.requiredPackVersion,
    items,
    burstSchedule: schedule,
    totalDurationS,
    totalTier2Bytes,
  };

  return {
    manifest,
    overBudget: totalDurationS > TIER2.MAX_CAMPAIGN_DURATION_S,
    budgetS: TIER2.MAX_CAMPAIGN_DURATION_S,
    handleTable,
  };
}

/**
 * 02-...: "Interleave campaign content so a short noise burst does not destroy
 * every copy of one critical item." Round-robin by repeat index, priority
 * first within each round.
 */
function interleave(items: readonly CampaignItem[]): readonly { packetId: PacketId; repeatIndex: number }[] {
  const maxRepeats = items.reduce((max, item) => Math.max(max, item.repeats), 0);
  const schedule: { packetId: PacketId; repeatIndex: number }[] = [];
  for (let round = 0; round < maxRepeats; round += 1) {
    const thisRound = items.filter((item) => item.repeats > round).sort((a, b) => a.priority - b.priority);
    for (const item of thisRound) schedule.push({ packetId: item.packetId, repeatIndex: round });
  }
  return schedule;
}

/** WEB-006 / WEB-007: any content edit after approval returns to draft. */
export function transitionCampaign(from: CampaignState, to: CampaignState): CampaignState {
  if (!CAMPAIGN_TRANSITIONS[from].includes(to)) {
    throw new Error(`illegal campaign transition ${from} -> ${to}`);
  }
  return to;
}

export function contentEdited(state: CampaignState): CampaignState {
  // DEC-025: altering approved content invalidates approval.
  const approvedOrLater: readonly CampaignState[] = [
    'approved',
    'broadcaster-ready',
    'audio-generated',
    'decode-tested',
    'scheduled',
  ];
  return approvedOrLater.includes(state) ? 'draft' : state;
}

export { TIER2_OVERHEAD_BYTES };
