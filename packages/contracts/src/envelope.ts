/**
 * UNIFIED PACKET ENVELOPE  --  FROZEN (Gate I)
 *
 * Spec: 02-... "Compact packet envelope", 04-BLUEPRINT section 7.2-7.4.
 *
 * The envelope separates what the SOURCE created (immutable) from what a
 * RELAY observed (mutable). A relay may increment hop state and add bounded
 * observations. It must never rewrite incident meaning, identity, severity,
 * or payload (04-BLUEPRINT 7.4).
 */

import type { MessageTypeCode, PriorityValue, SeverityValue, SourceClassValue } from './registry.js';

/** 16-byte packet identity, lower-case hex. Stable across every hop and transport. */
export type PacketId = string;
/** 8-byte rotating/incident-scoped source identity, lower-case hex. */
export type SourceId = string;
/** Incident or record stream identity that updates attach to. */
export type StreamId = string;
/** Compact object ID from the regional content pack, e.g. "SHL-014". */
export type ObjectId = string;

/**
 * The immutable, source-created part of a packet.
 * Identical bytes on every hop and on both transports.
 */
export interface PacketHeader {
  readonly version: number;
  readonly type: MessageTypeCode;
  /** Bitmask of registry.Flags. */
  readonly flags: number;
  readonly priority: PriorityValue;
  readonly severity: SeverityValue;
  readonly packetId: PacketId;
  readonly sourceId: SourceId;
  readonly sourceClass: SourceClassValue;
  /** Seconds since limits.TIME.DEMO_EPOCH_MS. */
  readonly createdAt: number;
  /** Absolute expiry, seconds since the demo epoch. */
  readonly expiresAt: number;
  readonly hopLimit: number;
  /** Mutable in transit: incremented by each relay. Not part of packet meaning. */
  readonly hopCount: number;
  readonly payloadLength: number;
  readonly fragmentIndex: number;
  readonly fragmentCount: number;
  /** First 8 bytes of the payload digest, lower-case hex. */
  readonly digestPrefix: string;
}

/** Optional typed header extension (04-BLUEPRINT 7.3). Included only when needed. */
export interface GeoExtension {
  /** Latitude times 1e7. */
  readonly latE7: number;
  /** Longitude times 1e7. */
  readonly lonE7: number;
  /** Reported horizontal accuracy in metres. */
  readonly accuracyM: number;
  /** Display/forwarding scope radius in metres. 0 means unscoped. */
  readonly scopeRadiusM: number;
}

/** A complete logical packet: header, optional geo scope, and typed payload. */
export interface Packet<TPayload = unknown> {
  readonly header: PacketHeader;
  readonly geo?: GeoExtension;
  /** Stream this packet belongs to (incident ID, object ID, campaign ID). */
  readonly streamId?: StreamId;
  /** Monotonic per-stream sequence. Latest-wins state selection uses this. */
  readonly sourceSequence?: number;
  readonly payload: TPayload;
}

/** The transport a packet arrived on. Never changes packet meaning. */
export type TransportKind = 'tier1-ble' | 'tier1-classic' | 'tier2-mic' | 'tier2-direct' | 'gateway' | 'local';

/**
 * Mutable relay observation. Stored SEPARATELY from the packet
 * (02-...: "Mutable relay observations ... must be stored separately").
 */
export interface PacketObservation {
  readonly packetId: PacketId;
  readonly transport: TransportKind;
  /** Rotating token of the previous hop. Never a permanent identity. */
  readonly previousHopToken?: string;
  /** Local wall-clock receive time in ms. Kept apart from header.createdAt. */
  readonly receivedAtMs: number;
  readonly hopCountOnArrival: number;
  readonly rssi?: number;
  readonly sessionId?: string;
  readonly campaignId?: string;
  readonly gatewayToken?: string;
  readonly bytes: number;
}

/** Encoded packet plus the size evidence the specs require us to record. */
export interface EncodedPacket {
  readonly bytes: Uint8Array;
  readonly packetId: PacketId;
  readonly headerBytes: number;
  readonly payloadBytes: number;
  readonly totalBytes: number;
}
