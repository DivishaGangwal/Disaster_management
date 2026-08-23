/**
 * Integrity primitives: CRC-32 for headers/frames, SHA-256 for payload digests.
 *
 * Spec: 02-... "Integrity" -- header integrity detects corruption before
 * parsing expensive fields; payload digest detects corrupt content and
 * packet-ID conflicts.
 *
 * DEC-019 / INT-008: this is CORRUPTION RESILIENCE, not proof of sender
 * identity. Production cryptographic authentication is future hardening.
 *
 * NOTE: No `node:crypto` — this file runs in React Native (Hermes engine)
 * which does NOT have the Node standard library. SHA-256 is pure-JS;
 * random bytes use globalThis.crypto.getRandomValues (available in Hermes,
 * browsers, and Node.js >= 19).
 */

// ---------------------------------------------------------------------------
// CRC-32
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Pure-JS SHA-256 (FIPS 180-4). No Node or browser crypto API needed.
// ---------------------------------------------------------------------------

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const padLen = ((data.length + 8) & ~63) + 64 - data.length;
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(w[i - 15]!, 7) ^ rotr32(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr32(w[i - 2]!, 17) ^ rotr32(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i]! + w[i]!) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false); outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false); outView.setUint32(28, h7, false);
  return out;
}

export function sha256Hex(bytes: Uint8Array): string {
  return toHex(sha256Bytes(bytes));
}

/**
 * Digest of a payload, BOUND TO ITS MESSAGE TYPE (domain separation).
 *
 * The type byte is hashed with the payload so relabelling a packet — flipping
 * the type field and recomputing the header CRC — invalidates the digest.
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

/** First 8 bytes of the type-bound payload digest — the fast conflict check. */
export function digestPrefix(bytes: Uint8Array, messageType: number): string {
  return payloadDigest(bytes, messageType).slice(0, 16);
}

// ---------------------------------------------------------------------------
// Hex helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Random IDs — use Web Crypto API (Hermes, browsers, Node >= 19)
// ---------------------------------------------------------------------------

function getRandomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.crypto as any).getRandomValues(buf);
  return buf;
}

/** 16-byte unpredictable packet identity (04-BLUEPRINT 7.2). */
export function newPacketId(): string {
  return toHex(getRandomBytes(16));
}

/** 8-byte rotating source identity. Rotate it; never derive it from an account. */
export function newSourceId(): string {
  return toHex(getRandomBytes(8));
}

/** Short rotating node token used in discovery advertisements. */
export function newNodeToken(): string {
  return toHex(getRandomBytes(4));
}
