/**
 * Integrity primitives: CRC-32 for headers/frames, SHA-256 for payload digests.
 *
 * Spec: 02-... "Integrity" -- header integrity detects corruption before
 * parsing expensive fields; payload digest detects corrupt content and
 * packet-ID conflicts.
 *
 * DEC-019 / INT-008: this is CORRUPTION RESILIENCE, not proof of sender
 * identity. Production cryptographic authentication is future hardening.
 */

import { createHash, randomBytes } from 'node:crypto';

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i += 1) {
    crc = (CRC32_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Digest of a payload, BOUND TO ITS MESSAGE TYPE (domain separation).
 *
 * The type byte is hashed with the payload so relabelling a packet -- flipping
 * the type field and recomputing the header CRC -- invalidates the digest.
 * Without this, field keys being per-type-but-overlapping meant an SOS payload
 * could be reinterpreted under another schema (key 1 is `incidentId` in
 * SOS_CREATE and `forPacketId` in LINK_RECEIPT).
 *
 * Costs no wire bytes: the type already travels at offset 3.
 */
export function payloadDigest(bytes: Uint8Array, messageType: number): string {
  const bound = new Uint8Array(bytes.length + 1);
  bound[0] = messageType & 0xff;
  bound.set(bytes, 1);
  return sha256Hex(bound);
}

/** First 8 bytes of the type-bound payload digest -- the fast conflict check. */
export function digestPrefix(bytes: Uint8Array, messageType: number): string {
  return payloadDigest(bytes, messageType).slice(0, 16);
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hex string must have an even length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`invalid hex at offset ${i * 2}`);
    out[i] = byte;
  }
  return out;
}

/** 16-byte unpredictable packet identity (04-BLUEPRINT 7.2). */
export function newPacketId(): string {
  return toHex(randomBytes(16));
}

/** 8-byte rotating source identity. Rotate it; never derive it from an account. */
export function newSourceId(): string {
  return toHex(randomBytes(8));
}

/** Short rotating node token used in discovery advertisements. */
export function newNodeToken(): string {
  return toHex(randomBytes(4));
}
