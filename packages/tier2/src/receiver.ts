/**
 * TIER 2 RECEIVER STATE MACHINE
 *
 * Spec: 02-... "Receiver states"; 01-... screen 11; T2-002..T2-011.
 *
 * DEC-008 / T2-008: one way, duplicates suppressed.
 * T2-004: the microphone path and the direct clean-audio path produce the SAME
 * packet identities and payload meanings. The only difference is the `source`
 * field in the metrics -- which is exactly what the equivalence test asserts.
 *
 * The receiver never touches the map. It reassembles frames into canonical
 * packet bytes and hands them to the shared validator (invariant 4).
 */

import {
  TIER2,
  Tier2Reason,
  type PacketId,
  type Tier2Metrics,
  type Tier2ReceiverState,
  type Tier2RawFrame,
} from '@dsm/contracts';
import { decodePacket } from '@dsm/codec';
import { decodeTier2Frame, type Tier2Frame } from './frame-codec.js';

/** Resolves a compact 16-bit handle back to the full packet identity. */
export interface CampaignHandleResolver {
  readonly campaignId: string;
  readonly campaignVersion: number;
  readonly campaignHandle: number;
  resolvePacketId(handle: number): PacketId | undefined;
  /** Every packet the manifest promises, for the completeness report. */
  expectedPacketIds(): readonly PacketId[];
  /**
   * Confirms that self-describing canonical bytes agree with the manifest.
   * The resolver must never add a header or otherwise create packet meaning.
   */
  verifyPacketBytes(handle: number, canonicalBytes: Uint8Array): boolean;
}

export interface RecoveredPacket {
  readonly packetId: PacketId;
  /** Canonical Tier 1 bytes: identical to what Bluetooth would have carried. */
  readonly bytes: Uint8Array;
  readonly source: 'tier2-mic' | 'tier2-direct';
  readonly recoveredAtMs: number;
}

export type Tier2Listener = (packet: RecoveredPacket) => void;

interface Assembly {
  readonly fragmentCount: number;
  readonly parts: Map<number, Uint8Array>;
  readonly firstSeenMs: number;
}

export class Tier2Receiver {
  private state: Tier2ReceiverState = 'stopped';
  private source: 'tier2-mic' | 'tier2-direct' | null = null;
  private listenStartedAtMs?: number;

  private framesDetected = 0;
  private framesValid = 0;
  private framesCorrupt = 0;
  private framesDuplicate = 0;

  /** A packet handle is only unique inside one campaign version. */
  private readonly assemblies = new Map<string, Assembly>();
  private readonly recovered = new Set<PacketId>();
  private readonly seenFrameKeys = new Set<string>();
  private readonly listeners = new Set<Tier2Listener>();

  constructor(private resolver?: CampaignHandleResolver) {}

  setResolver(resolver: CampaignHandleResolver): void {
    this.resolver = resolver;
  }

  /** T2-002: explicit, permissioned, visible, and time-bounded. */
  startListening(source: 'tier2-mic' | 'tier2-direct', nowMs: number): void {
    this.source = source;
    this.listenStartedAtMs = nowMs;
    this.state = source === 'tier2-mic' ? 'listening' : 'reading-direct-input';
  }

  stop(): void {
    this.state = 'stopped';
    this.source = null;
  }

  /** Enforces the bounded listen window (no unlimited microphone capture). */
  tick(nowMs: number): void {
    if (this.state === 'stopped' || this.listenStartedAtMs === undefined) return;
    if (nowMs - this.listenStartedAtMs >= TIER2.MICROPHONE_TIMEOUT_MS) {
      this.state = this.recovered.size > 0 ? this.completenessState() : 'timed-out';
      this.source = null;
    }
  }

  /** Feed one raw frame from either audio path. */
  accept(raw: Tier2RawFrame): { readonly reason: string; readonly packet?: RecoveredPacket } {
    this.framesDetected += 1;
    if (this.state === 'stopped') this.startListening(raw.source, raw.receivedAtMs);
    if (this.state === 'listening' || this.state === 'reading-direct-input') {
      this.state = 'preamble-detected';
    }

    const decoded = decodeTier2Frame(raw.bytes);
    if (!decoded.ok) {
      this.framesCorrupt += 1;
      // T2-007: a failed frame is absent, never partially applied.
      return { reason: Tier2Reason.FRAME_CORRUPT };
    }

    const frame = decoded.frame;
    const key = `${frame.campaignHandle}:${frame.campaignVersion}:${frame.packetHandle}:${frame.fragmentIndex}`;
    if (this.seenFrameKeys.has(key)) {
      this.framesDuplicate += 1;
      // T2-008 / repetition: observations increase, actions stay idempotent.
      return { reason: Tier2Reason.FRAME_DUPLICATE };
    }
    this.seenFrameKeys.add(key);
    this.framesValid += 1;
    this.state = 'frame-collecting';

    const packet = this.assemble(frame, raw);
    if (!packet) return { reason: Tier2Reason.PACKET_INCOMPLETE };

    return { reason: Tier2Reason.PACKET_REASSEMBLED, packet };
  }

  private assemble(frame: Tier2Frame, raw: Tier2RawFrame): RecoveredPacket | undefined {
    const assemblyKey = `${frame.campaignHandle}:${frame.campaignVersion}:${frame.packetHandle}`;
    const assembly = this.assemblies.get(assemblyKey) ?? {
      fragmentCount: frame.fragmentCount,
      parts: new Map<number, Uint8Array>(),
      firstSeenMs: raw.receivedAtMs,
    };
    assembly.parts.set(frame.fragmentIndex, frame.payload);
    this.assemblies.set(assemblyKey, assembly);

    if (assembly.parts.size < assembly.fragmentCount) return undefined;

    this.state = 'packet-reassembling';
    let total = 0;
    for (const part of assembly.parts.values()) total += part.length;
    const canonicalBytes = new Uint8Array(total);
    let offset = 0;
    for (let i = 0; i < assembly.fragmentCount; i += 1) {
      const part = assembly.parts.get(i);
      if (!part) return undefined;
      canonicalBytes.set(part, offset);
      offset += part.length;
    }

    const decoded = decodePacket(canonicalBytes);
    if (!decoded.ok) return undefined;
    const packetId = decoded.packet.header.packetId;
    if (
      decoded.packet.header.type !== frame.messageType ||
      decoded.packet.header.priority !== frame.priority ||
      decoded.packet.header.severity !== frame.severity
    ) return undefined;
    const expectedPacketId = this.resolver?.resolvePacketId(frame.packetHandle);
    if (expectedPacketId !== undefined && expectedPacketId !== packetId) return undefined;
    if (this.resolver && !this.resolver.verifyPacketBytes(frame.packetHandle, canonicalBytes)) return undefined;

    this.assemblies.delete(assemblyKey);

    if (this.recovered.has(packetId)) {
      this.framesDuplicate += 1;
      return undefined; // already applied; repetition must not re-notify
    }
    this.recovered.add(packetId);
    this.state = this.completenessState();

    const packet: RecoveredPacket = {
      packetId,
      bytes: canonicalBytes,
      source: raw.source,
      recoveredAtMs: raw.receivedAtMs,
    };
    for (const listener of this.listeners) listener(packet);
    return packet;
  }

  private completenessState(): Tier2ReceiverState {
    const expected = this.resolver?.expectedPacketIds() ?? [];
    if (expected.length === 0) return 'campaign-incomplete';
    const missing = expected.filter((id) => !this.recovered.has(id));
    return missing.length === 0 ? 'campaign-complete' : 'campaign-incomplete';
  }

  addListener(listener: Tier2Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** T2-011 / 01-... screen 11: the numbers the diagnostics screen renders. */
  metrics(): Tier2Metrics {
    const expected = this.resolver?.expectedPacketIds() ?? [];
    return {
      state: this.state,
      source: this.source,
      ...(this.resolver ? { campaignId: this.resolver.campaignId, campaignVersion: this.resolver.campaignVersion } : {}),
      framesDetected: this.framesDetected,
      framesValid: this.framesValid,
      framesCorrupt: this.framesCorrupt,
      framesDuplicate: this.framesDuplicate,
      packetsRecovered: this.recovered.size,
      ...(expected.length > 0 ? { packetsExpected: expected.length } : {}),
      // T2: never fabricate missing map changes; list them honestly.
      missingPacketIds: expected.filter((id) => !this.recovered.has(id)),
      ...(this.listenStartedAtMs !== undefined ? { listenStartedAtMs: this.listenStartedAtMs } : {}),
      listenTimeoutMs: TIER2.MICROPHONE_TIMEOUT_MS,
    };
  }

  recoveredPacketIds(): readonly PacketId[] {
    return [...this.recovered];
  }

  reset(): void {
    this.framesDetected = 0;
    this.framesValid = 0;
    this.framesCorrupt = 0;
    this.framesDuplicate = 0;
    this.assemblies.clear();
    this.recovered.clear();
    this.seenFrameKeys.clear();
    this.state = 'stopped';
    this.source = null;
    this.listenStartedAtMs = undefined;
  }
}
