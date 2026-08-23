/**
 * TIER 2 CAMPAIGN CONTRACT  --  FROZEN (Gate V)
 *
 * Spec: 02-... "Tier 2 detailed architecture", 01-... WEB-005..WEB-009,
 * T2-001..T2-013.
 *
 * DEC-007: WavePX is Tier 2 ONLY. There is no phone-to-phone acoustic path.
 * DEC-008: Tier 2 is one way. A check-in RESPONSE leaves by Tier 1 (T2-012).
 * DEC-025: editing approved content invalidates approval (WEB-007).
 */

import type { PacketId } from './envelope.js';

/** 01-... "Campaign state" + WEB-006. Any content edit after approval resets it. */
export type CampaignState =
  | 'draft'
  | 'validated'
  | 'approved'
  | 'broadcaster-ready'
  | 'audio-generated'
  | 'decode-tested'
  | 'scheduled'
  | 'played'
  | 'archived'
  | 'failed';

/** Legal transitions. The composer must not invent a shortcut. */
export const CAMPAIGN_TRANSITIONS: Readonly<Record<CampaignState, readonly CampaignState[]>> = {
  draft: ['validated', 'failed'],
  validated: ['approved', 'draft', 'failed'],
  approved: ['broadcaster-ready', 'draft'],
  'broadcaster-ready': ['audio-generated', 'draft'],
  'audio-generated': ['decode-tested', 'draft', 'failed'],
  'decode-tested': ['scheduled', 'draft', 'failed'],
  scheduled: ['played', 'draft', 'failed'],
  played: ['archived'],
  archived: [],
  failed: ['draft'],
};

/** One packet scheduled into the radio program. */
export interface CampaignItem {
  readonly packetId: PacketId;
  /** Canonical Tier 1 bytes. The Tier 2 frame is derived, never a different meaning. */
  readonly bytes: Uint8Array;
  readonly messageType: number;
  readonly priority: number;
  /** T2-006: critical items repeat more often than normal updates. */
  readonly repeats: number;
  readonly tier1Bytes: number;
  readonly tier2Bytes: number;
  readonly frameCount: number;
  readonly estimatedAudioMs: number;
}

/** T2-005: campaigns must include a compact manifest/inventory. */
export interface CampaignManifest {
  readonly campaignId: string;
  readonly campaignVersion: number;
  readonly regionCode: string;
  readonly validFromS: number;
  readonly validUntilS: number;
  /** Required pack version, so compact object IDs resolve correctly. */
  readonly requiredPackId: string;
  readonly requiredPackVersion: number;
  readonly items: readonly CampaignItem[];
  /** Interleaved order so one noise burst cannot destroy every copy of an item. */
  readonly burstSchedule: readonly { readonly packetId: PacketId; readonly repeatIndex: number }[];
  readonly totalDurationS: number;
  /** WEB-005: the byte preview the authority composer must show. */
  readonly totalTier2Bytes: number;
}

/** The reproducible artifact the broadcaster tests and plays. */
export interface RadioArtifact {
  readonly campaignId: string;
  readonly campaignVersion: number;
  readonly wavePxProfile: string;
  readonly sampleRateHz: number;
  readonly channels: number;
  readonly bitDepth: number;
  readonly durationS: number;
  /** Integrity value tying the broadcast log to the tested artifact (WEB-008). */
  readonly artifactDigest: string;
  readonly audioPath?: string;
  readonly expectedPacketIds: readonly PacketId[];
}

/** WEB-009: compares recovered packet IDs with the expected manifest. */
export interface DecodeTestResult {
  readonly campaignId: string;
  readonly artifactDigest: string;
  readonly expected: readonly PacketId[];
  readonly recovered: readonly PacketId[];
  readonly missing: readonly PacketId[];
  readonly unexpected: readonly PacketId[];
  readonly framesDetected: number;
  readonly framesValid: number;
  readonly framesCorrupt: number;
  readonly framesDuplicate: number;
  readonly passed: boolean;
  readonly testedAtMs: number;
}

/** 02-... "Receiver states". Every state is observable in diagnostics. */
export type Tier2ReceiverState =
  | 'stopped'
  | 'permission-required'
  | 'listening'
  | 'reading-direct-input'
  | 'preamble-detected'
  | 'frame-collecting'
  | 'packet-reassembling'
  | 'campaign-complete'
  | 'campaign-incomplete'
  | 'timed-out';

/** Live metrics for the Tier 2 screen (01-... screen 11). */
export interface Tier2Metrics {
  readonly state: Tier2ReceiverState;
  readonly source: 'tier2-mic' | 'tier2-direct' | null;
  readonly campaignId?: string;
  /** Compact over-air handle, available even without a preloaded manifest. */
  readonly campaignHandle?: number;
  readonly campaignVersion?: number;
  readonly framesDetected: number;
  readonly framesValid: number;
  readonly framesCorrupt: number;
  readonly framesDuplicate: number;
  readonly packetsRecovered: number;
  readonly packetsExpected?: number;
  readonly missingPacketIds: readonly PacketId[];
  readonly listenStartedAtMs?: number;
  readonly listenTimeoutMs: number;
}
