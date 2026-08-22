/**
 * 64-BYTE FIXED TRANSPORT HEADER
 *
 * Spec: 04-BLUEPRINT section 7.2 (exact offsets), 02-... "Fixed envelope fields".
 *
 * | Off | Size | Field                  |
 * |----:|-----:|------------------------|
 * |   0 |    2 | Magic                  |
 * |   2 |    1 | Protocol version       |
 * |   3 |    1 | Message type           |
 * |   4 |    2 | Flags                  |
 * |   6 |    1 | Priority (high nibble) + severity (low nibble) |
 * |   7 |    1 | Header length          |
 * |   8 |   16 | Packet ID              |
 * |  24 |    8 | Ephemeral source ID    |
 * |  32 |    4 | Created time           |
 * |  36 |    4 | Expiry time            |
 * |  40 |    1 | Hop limit              |
 * |  41 |    1 | Hop count              |
 * |  42 |    4 | Total payload length   |
 * |  46 |    2 | Fragment index         |
 * |  48 |    2 | Fragment count         |
 * |  50 |    8 | Payload digest prefix  |
 * |  58 |    1 | Source/campaign class  |
 * |  59 |    1 | Reserved (0)           |
 * |  60 |    4 | Header CRC-32          |
 *
 * The blueprint packs priority into one byte and severity separately; we share
 * one byte at offset 6 (priority 0-7 in the high nibble, severity 0-3 in the
 * low nibble) and use offset 59 as a reserved extension byte. Both fields keep
 * their independent meaning (02-... "Priority and severity").
 *
 * Big-endian, per 04-BLUEPRINT 7.1.
 */

import { ENVELOPE, PROTOCOL_MAGIC, type PacketHeader } from '@dsm/contracts';
import { crc32, fromHex, toHex } from './integrity.js';

export const HEADER_BYTES = ENVELOPE.HEADER_BYTES;

const OFF = {
  MAGIC: 0,
  VERSION: 2,
  TYPE: 3,
  FLAGS: 4,
  PRIORITY_SEVERITY: 6,
  HEADER_LENGTH: 7,
  PACKET_ID: 8,
  SOURCE_ID: 24,
  CREATED: 32,
  EXPIRES: 36,
  HOP_LIMIT: 40,
  HOP_COUNT: 41,
  PAYLOAD_LENGTH: 42,
  FRAGMENT_INDEX: 46,
  FRAGMENT_COUNT: 48,
  DIGEST_PREFIX: 50,
  SOURCE_CLASS: 58,
  RESERVED: 59,
  CRC: 60,
} as const;

export function encodeHeader(header: PacketHeader): Uint8Array {
  const buf = new Uint8Array(HEADER_BYTES);
  const view = new DataView(buf.buffer);

  view.setUint16(OFF.MAGIC, PROTOCOL_MAGIC, false);
  buf[OFF.VERSION] = header.version & 0xff;
  buf[OFF.TYPE] = header.type & 0xff;
  view.setUint16(OFF.FLAGS, header.flags & 0xffff, false);
  buf[OFF.PRIORITY_SEVERITY] = ((header.priority & 0x0f) << 4) | (header.severity & 0x0f);
  buf[OFF.HEADER_LENGTH] = HEADER_BYTES;

  buf.set(fromHex(header.packetId), OFF.PACKET_ID);
  buf.set(fromHex(header.sourceId), OFF.SOURCE_ID);

  view.setUint32(OFF.CREATED, header.createdAt >>> 0, false);
  view.setUint32(OFF.EXPIRES, header.expiresAt >>> 0, false);
  buf[OFF.HOP_LIMIT] = header.hopLimit & 0xff;
  buf[OFF.HOP_COUNT] = header.hopCount & 0xff;
  view.setUint32(OFF.PAYLOAD_LENGTH, header.payloadLength >>> 0, false);
  view.setUint16(OFF.FRAGMENT_INDEX, header.fragmentIndex & 0xffff, false);
  view.setUint16(OFF.FRAGMENT_COUNT, header.fragmentCount & 0xffff, false);
  buf.set(fromHex(header.digestPrefix), OFF.DIGEST_PREFIX);
  buf[OFF.SOURCE_CLASS] = header.sourceClass & 0xff;
  buf[OFF.RESERVED] = 0;

  view.setUint32(OFF.CRC, crc32(buf, 0, OFF.CRC), false);
  return buf;
}

export interface HeaderDecodeResult {
  readonly header: PacketHeader;
  readonly crcValid: boolean;
  readonly magicValid: boolean;
}

/**
 * Parses the fixed header WITHOUT trusting any declared length. Callers must
 * still check payloadLength against the per-type limit before allocating
 * (02-... "Parsers must reject invalid lengths/counts before allocation").
 */
export function decodeHeader(bytes: Uint8Array): HeaderDecodeResult {
  if (bytes.length < HEADER_BYTES) throw new RangeError('buffer shorter than the fixed header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const magicValid = view.getUint16(OFF.MAGIC, false) === PROTOCOL_MAGIC;
  const storedCrc = view.getUint32(OFF.CRC, false);
  const crcValid = crc32(bytes, 0, OFF.CRC) === storedCrc;

  const prioritySeverity = bytes[OFF.PRIORITY_SEVERITY]!;

  const header: PacketHeader = {
    version: bytes[OFF.VERSION]!,
    type: bytes[OFF.TYPE]! as PacketHeader['type'],
    flags: view.getUint16(OFF.FLAGS, false),
    priority: ((prioritySeverity >> 4) & 0x0f) as PacketHeader['priority'],
    severity: (prioritySeverity & 0x0f) as PacketHeader['severity'],
    packetId: toHex(bytes.subarray(OFF.PACKET_ID, OFF.PACKET_ID + 16)),
    sourceId: toHex(bytes.subarray(OFF.SOURCE_ID, OFF.SOURCE_ID + 8)),
    sourceClass: bytes[OFF.SOURCE_CLASS]! as PacketHeader['sourceClass'],
    createdAt: view.getUint32(OFF.CREATED, false),
    expiresAt: view.getUint32(OFF.EXPIRES, false),
    hopLimit: bytes[OFF.HOP_LIMIT]!,
    hopCount: bytes[OFF.HOP_COUNT]!,
    payloadLength: view.getUint32(OFF.PAYLOAD_LENGTH, false),
    fragmentIndex: view.getUint16(OFF.FRAGMENT_INDEX, false),
    fragmentCount: view.getUint16(OFF.FRAGMENT_COUNT, false),
    digestPrefix: toHex(bytes.subarray(OFF.DIGEST_PREFIX, OFF.DIGEST_PREFIX + 8)),
  };

  return { header, crcValid, magicValid };
}

/**
 * A relay increments hop count in place and repairs the CRC. It must not touch
 * anything else (04-BLUEPRINT 7.4: relays may not rewrite packet meaning).
 */
export function incrementHopInPlace(bytes: Uint8Array): Uint8Array {
  const out = bytes.slice();
  out[OFF.HOP_COUNT] = Math.min(255, out[OFF.HOP_COUNT]! + 1);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(OFF.CRC, crc32(out, 0, OFF.CRC), false);
  return out;
}

/** Offsets exported for the golden-vector tests and the diagnostics screen. */
export const HEADER_OFFSETS = OFF;
