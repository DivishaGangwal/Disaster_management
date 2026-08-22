/**
 * PACKET CODEC -- the only place bytes become packets and back.
 *
 * Spec: 02-... "Packet codec". It owns encoding and precise rejection reasons.
 * It does NOT decide whether the user should see, relay, or act on a packet.
 */

import {
  DEFAULT_PRIORITY,
  ENVELOPE,
  Flags,
  MessageType,
  PROTOCOL_VERSION,
  Priority,
  RejectReason,
  SourceClass,
  TERMINAL_TYPES,
  TIME,
  isKnownMessageType,
  type EncodedPacket,
  type GeoExtension,
  type Packet,
  type PacketHeader,
  type PriorityValue,
  type RejectReasonName,
  type SeverityValue,
  type SourceClassValue,
  type StreamId,
} from '@dsm/contracts';
import { decodeHeader, encodeHeader, HEADER_BYTES } from './envelope-codec.js';
import { FIELD_MAP_BY_TYPE } from './field-maps.js';
import { decodeFields, encodeFields, type EncodeLimits } from './value-codec.js';
import { digestPrefix, newPacketId, sha256Hex } from './integrity.js';
import { maxPayloadBytesFor } from './size-limits.js';

/** Wire-level keys for the small set of envelope-adjacent fields. */
const ENVELOPE_EXTRA_FIELDS = { streamId: 250, sourceSequence: 251, geo: 252 } as const;

export interface EncodeOptions {
  readonly type: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly sourceId: string;
  readonly sourceClass: SourceClassValue;
  readonly createdAt: number;
  readonly ttlS: number;
  readonly hopLimit: number;
  readonly severity?: SeverityValue;
  readonly priority?: PriorityValue;
  readonly packetId?: string;
  readonly streamId?: StreamId;
  readonly sourceSequence?: number;
  readonly geo?: GeoExtension;
  readonly flags?: number;
  readonly hopCount?: number;
  readonly fragmentIndex?: number;
  readonly fragmentCount?: number;
}

/** Seconds since the demo epoch, from a wall-clock ms value. */
export function toEpochS(ms: number): number {
  return Math.max(0, Math.floor((ms - TIME.DEMO_EPOCH_MS) / 1000));
}

export function fromEpochS(s: number): number {
  return TIME.DEMO_EPOCH_MS + s * 1000;
}

export function encodePacket(options: EncodeOptions): EncodedPacket {
  const fieldMap = FIELD_MAP_BY_TYPE[options.type];
  if (!fieldMap) throw new Error(`no field map registered for message type 0x${options.type.toString(16)}`);

  const maxPayload = maxPayloadBytesFor(options.type);
  const limits: EncodeLimits = {
    maxBytes: maxPayload,
    maxTextBytes: 512,
    maxArrayItems: 64,
    maxDepth: 4,
  };

  // Envelope extras ride in the same deterministic field body with reserved keys,
  // so a fragment carries its stream identity without a second parser.
  const body: Record<string, unknown> = { ...options.payload };
  const extras = new Map<number, unknown>();
  if (options.streamId !== undefined) extras.set(ENVELOPE_EXTRA_FIELDS.streamId, options.streamId);
  if (options.sourceSequence !== undefined) extras.set(ENVELOPE_EXTRA_FIELDS.sourceSequence, options.sourceSequence);
  if (options.geo !== undefined) extras.set(ENVELOPE_EXTRA_FIELDS.geo, options.geo);

  const extendedMap: Record<string, number> = { ...fieldMap };
  if (extras.has(ENVELOPE_EXTRA_FIELDS.streamId)) {
    extendedMap['__streamId'] = ENVELOPE_EXTRA_FIELDS.streamId;
    body['__streamId'] = options.streamId;
  }
  if (extras.has(ENVELOPE_EXTRA_FIELDS.sourceSequence)) {
    extendedMap['__sourceSequence'] = ENVELOPE_EXTRA_FIELDS.sourceSequence;
    body['__sourceSequence'] = options.sourceSequence;
  }
  if (extras.has(ENVELOPE_EXTRA_FIELDS.geo)) {
    extendedMap['__geo'] = ENVELOPE_EXTRA_FIELDS.geo;
    body['__geo'] = options.geo;
  }

  const payloadBytes = encodeFields(body, extendedMap, limits);
  const priority = options.priority ?? DEFAULT_PRIORITY[options.type as never] ?? Priority.GENERAL_UPDATE;

  let flags = options.flags ?? 0;
  if (options.geo) flags |= Flags.LOCATION_PRESENT;
  if (TERMINAL_TYPES.has(options.type)) flags |= Flags.TERMINAL;
  if ((options.fragmentCount ?? 1) > 1) flags |= Flags.FRAGMENTED;
  if (options.sourceClass === SourceClass.AUTHORITY_PROVISIONED) flags |= Flags.PROTOTYPE_AUTHORITY;

  const header: PacketHeader = {
    version: PROTOCOL_VERSION,
    type: options.type as PacketHeader['type'],
    flags,
    priority,
    severity: options.severity ?? 0,
    packetId: options.packetId ?? newPacketId(),
    sourceId: options.sourceId,
    sourceClass: options.sourceClass,
    createdAt: options.createdAt,
    expiresAt: options.createdAt + Math.min(options.ttlS, TIME.MAX_TTL_S),
    hopLimit: options.hopLimit,
    hopCount: options.hopCount ?? 0,
    payloadLength: payloadBytes.length,
    fragmentIndex: options.fragmentIndex ?? 0,
    fragmentCount: options.fragmentCount ?? 1,
    digestPrefix: digestPrefix(payloadBytes),
  };

  const headerBytes = encodeHeader(header);
  const bytes = new Uint8Array(headerBytes.length + payloadBytes.length);
  bytes.set(headerBytes, 0);
  bytes.set(payloadBytes, headerBytes.length);

  return {
    bytes,
    packetId: header.packetId,
    headerBytes: headerBytes.length,
    payloadBytes: payloadBytes.length,
    totalBytes: bytes.length,
  };
}

export type DecodeResult =
  | { readonly ok: true; readonly packet: Packet; readonly digest: string; readonly totalBytes: number }
  | { readonly ok: false; readonly reason: RejectReasonName; readonly detail?: string };

/**
 * Structural parse only. Every failure returns a precise reason code; nothing
 * throws into the transport layer.
 */
export function decodePacket(bytes: Uint8Array): DecodeResult {
  if (bytes.length < HEADER_BYTES) return { ok: false, reason: RejectReason.TOO_SHORT };
  if (bytes.length > ENVELOPE.MAX_TOTAL_BYTES) return { ok: false, reason: RejectReason.LENGTH_OVER_LIMIT };

  let decoded;
  try {
    decoded = decodeHeader(bytes);
  } catch {
    return { ok: false, reason: RejectReason.TOO_SHORT };
  }

  if (!decoded.magicValid) return { ok: false, reason: RejectReason.BAD_MAGIC };
  if (!decoded.crcValid) return { ok: false, reason: RejectReason.HEADER_CRC_FAILED };

  const header = decoded.header;
  if (header.version !== PROTOCOL_VERSION) {
    return { ok: false, reason: RejectReason.UNSUPPORTED_VERSION, detail: `v${header.version}` };
  }
  if (!isKnownMessageType(header.type)) {
    return { ok: false, reason: RejectReason.UNKNOWN_TYPE, detail: `0x${(header.type as number).toString(16)}` };
  }

  const maxPayload = maxPayloadBytesFor(header.type);
  if (header.payloadLength > maxPayload) {
    return { ok: false, reason: RejectReason.LENGTH_OVER_LIMIT, detail: `${header.payloadLength}>${maxPayload}` };
  }
  if (HEADER_BYTES + header.payloadLength !== bytes.length) {
    return { ok: false, reason: RejectReason.LENGTH_MISMATCH };
  }

  const payloadBytes = bytes.subarray(HEADER_BYTES);
  if (digestPrefix(payloadBytes) !== header.digestPrefix) {
    return { ok: false, reason: RejectReason.PAYLOAD_DIGEST_MISMATCH };
  }

  const fieldMap = FIELD_MAP_BY_TYPE[header.type];
  if (!fieldMap) return { ok: false, reason: RejectReason.UNKNOWN_TYPE };

  const extendedMap: Record<string, number> = {
    ...fieldMap,
    __streamId: ENVELOPE_EXTRA_FIELDS.streamId,
    __sourceSequence: ENVELOPE_EXTRA_FIELDS.sourceSequence,
    __geo: ENVELOPE_EXTRA_FIELDS.geo,
  };

  let fields: Record<string, unknown>;
  try {
    fields = decodeFields(payloadBytes, extendedMap, {
      maxBytes: maxPayload,
      maxTextBytes: 512,
      maxArrayItems: 64,
      maxDepth: 4,
    });
  } catch (error) {
    return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: String(error) };
  }

  const streamId = fields['__streamId'] as StreamId | undefined;
  const sourceSequence = fields['__sourceSequence'] as number | undefined;
  const geo = fields['__geo'] as GeoExtension | undefined;
  delete fields['__streamId'];
  delete fields['__sourceSequence'];
  delete fields['__geo'];

  const packet: Packet = {
    header,
    ...(geo ? { geo } : {}),
    ...(streamId !== undefined ? { streamId } : {}),
    ...(sourceSequence !== undefined ? { sourceSequence } : {}),
    payload: fields,
  };

  return { ok: true, packet, digest: sha256Hex(payloadBytes), totalBytes: bytes.length };
}

/** Re-encode a decoded packet to canonical bytes. Used to prove determinism. */
export function reencode(packet: Packet): EncodedPacket {
  return encodePacket({
    type: packet.header.type,
    payload: packet.payload as Record<string, unknown>,
    sourceId: packet.header.sourceId,
    sourceClass: packet.header.sourceClass,
    createdAt: packet.header.createdAt,
    ttlS: packet.header.expiresAt - packet.header.createdAt,
    hopLimit: packet.header.hopLimit,
    hopCount: packet.header.hopCount,
    severity: packet.header.severity,
    priority: packet.header.priority,
    packetId: packet.header.packetId,
    flags: packet.header.flags,
    fragmentIndex: packet.header.fragmentIndex,
    fragmentCount: packet.header.fragmentCount,
    ...(packet.streamId !== undefined ? { streamId: packet.streamId } : {}),
    ...(packet.sourceSequence !== undefined ? { sourceSequence: packet.sourceSequence } : {}),
    ...(packet.geo !== undefined ? { geo: packet.geo } : {}),
  });
}

export { MessageType };
