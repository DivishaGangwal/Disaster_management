/**
 * Real fuzzer: mutates VALID packets rather than generating random noise.
 *
 * Random bytes die at the magic-byte gate and prove nothing. To reach the
 * varint reader, the field decoder, and the nested-group logic, a mutation
 * must survive the earlier gates -- so several strategies REPAIR the header
 * checksum after mutating, deliberately pushing corruption deeper.
 *
 * A finding is: an uncaught exception, a hang, or a decode that SUCCEEDS when
 * it should not.
 */

import { buildSosCreate, decodePacket, encodePacket, toEpochS, crc32 } from '../../packages/codec/dist/index.js';
import { validate } from '../../packages/validator/dist/index.js';
import {
  SourceClass, Severity, EmergencyCategory, Mobility, LocationSource, ReplyCapability, MessageType,
} from '../../packages/contracts/dist/index.js';

// Deterministic RNG so findings reproduce exactly.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(1337);
const randInt = (n) => Math.floor(rand() * n);

function seedPacket() {
  return buildSosCreate(
    { sourceId: '0011223344556677', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: 20000000 },
    {
      incidentId: 'INC-7A2C', category: EmergencyCategory.TRAPPED, severity: Severity.LIFE_CRITICAL,
      peopleTotal: 4, injured: 1, mobility: Mobility.IMMOBILE,
      location: { source: LocationSource.FRESH_GNSS, latE7: 285355000, lonE7: 771234000, accuracyM: 12, ageS: 8 },
      replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Water rising',
    },
  ).bytes;
}

/** Recompute the header checksum so the mutation survives gate 4. */
function repairCrc(b) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  view.setUint32(60, crc32(b, 0, 60), false);
  return b;
}

const strategies = {
  'bitflip-header': (b) => { const o = b.slice(); o[randInt(60)] ^= 1 << randInt(8); return o; },

  'bitflip-header-crc-repaired': (b) => {
    const o = b.slice(); o[randInt(60)] ^= 1 << randInt(8); return repairCrc(o);
  },

  'bitflip-payload': (b) => {
    const o = b.slice(); if (o.length <= 64) return o;
    o[64 + randInt(o.length - 64)] ^= 1 << randInt(8); return o;
  },

  truncate: (b) => b.slice(0, randInt(b.length)),

  extend: (b) => { const o = new Uint8Array(b.length + 1 + randInt(64)); o.set(b); return o; },

  /** Claim a payload far larger than reality. */
  'lie-payload-length': (b) => {
    const o = b.slice();
    new DataView(o.buffer).setUint32(42, randInt(0xffffffff), false);
    return repairCrc(o);
  },

  /** Fragment-count attack: huge counts, index beyond count. */
  'fragment-bomb': (b) => {
    const o = b.slice(); const v = new DataView(o.buffer);
    v.setUint16(46, randInt(0xffff), false);
    v.setUint16(48, randInt(0xffff), false);
    return repairCrc(o);
  },

  /** Hop count above hop limit, and absurd expiry. */
  'time-and-hop-abuse': (b) => {
    const o = b.slice(); const v = new DataView(o.buffer);
    o[40] = randInt(256); o[41] = randInt(256);
    v.setUint32(32, randInt(0xffffffff), false);
    v.setUint32(36, randInt(0xffffffff), false);
    return repairCrc(o);
  },

  /**
   * Rewrite the message type, keeping a payload that belongs to another type.
   * Skips SOS_CREATE, the seed's own type -- relabelling to itself is a no-op,
   * not a finding.
   */
  'type-confusion': (b) => {
    const codes = Object.values(MessageType).filter((c) => c !== MessageType.SOS_CREATE);
    const o = b.slice(); o[3] = codes[randInt(codes.length)]; return repairCrc(o);
  },

  /** Craft a payload of pure garbage but with a correct length + fingerprint. */
  'garbage-payload-valid-envelope': (b) => {
    const len = randInt(200);
    const payload = new Uint8Array(len);
    for (let i = 0; i < len; i++) payload[i] = randInt(256);
    const out = new Uint8Array(64 + len);
    out.set(b.subarray(0, 64));
    out.set(payload, 64);
    new DataView(out.buffer).setUint32(42, len, false);
    return repairCrc(out);
  },

  /** Deeply nested groups: does the depth limit hold? */
  'nesting-bomb': (b) => {
    const depth = 1 + randInt(30);
    const parts = [0x01]; // one field
    parts.push(0x01, 0x07); // key 1, MAP
    for (let i = 0; i < depth; i++) parts.push(0x01, 0x01, 0x07);
    parts.push(0x00);
    const payload = Uint8Array.from(parts);
    const out = new Uint8Array(64 + payload.length);
    out.set(b.subarray(0, 64)); out.set(payload, 64);
    new DataView(out.buffer).setUint32(42, payload.length, false);
    return repairCrc(out);
  },

  /** Enormous declared array / text lengths inside the payload. */
  'inner-length-bomb': (b) => {
    const tag = rand() < 0.5 ? 0x06 : 0x03; // ARRAY or TEXT
    // field count 1, key 1, tag, then a 5-byte varint length near 2^32
    const payload = Uint8Array.from([0x01, 0x01, tag, 0xff, 0xff, 0xff, 0xff, 0x0f]);
    const out = new Uint8Array(64 + payload.length);
    out.set(b.subarray(0, 64)); out.set(payload, 64);
    new DataView(out.buffer).setUint32(42, payload.length, false);
    return repairCrc(out);
  },

  /** Varint that never terminates. */
  'varint-overflow': (b) => {
    const payload = Uint8Array.from([0x01, 0x01, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    const out = new Uint8Array(64 + payload.length);
    out.set(b.subarray(0, 64)); out.set(payload, 64);
    new DataView(out.buffer).setUint32(42, payload.length, false);
    return repairCrc(out);
  },

  /** Field count claims more fields than bytes remain. */
  'field-count-lie': (b) => {
    const payload = Uint8Array.from([0x3f, 0x01, 0x00, 0x01]); // says 63 fields, gives 1
    const out = new Uint8Array(64 + payload.length);
    out.set(b.subarray(0, 64)); out.set(payload, 64);
    new DataView(out.buffer).setUint32(42, payload.length, false);
    return repairCrc(out);
  },

  /** Invalid UTF-8 inside a text field. */
  'bad-utf8': (b) => {
    const payload = Uint8Array.from([0x01, 0x01, 0x03, 0x04, 0xff, 0xfe, 0xfd, 0xfc]);
    const out = new Uint8Array(64 + payload.length);
    out.set(b.subarray(0, 64)); out.set(payload, 64);
    new DataView(out.buffer).setUint32(42, payload.length, false);
    return repairCrc(out);
  },
};

const ITERATIONS = 4000;
const findings = [];
const stats = {};

const ctx = {
  nowS: 20000100, transport: 'tier1-ble', hopCountOnArrival: 0,
  isKnownDuplicate: false, streamTerminated: false,
  storagePressure: 'ok', queueDepth: 0, maxQueueDepth: 2000,
};

for (const [name, mutate] of Object.entries(strategies)) {
  stats[name] = { runs: 0, decoded: 0, rejected: 0, threw: 0 };

  for (let i = 0; i < ITERATIONS / Object.keys(strategies).length; i++) {
    const seed = seedPacket();
    let mutated;
    try {
      mutated = mutate(seed);
    } catch (e) {
      findings.push({ name, phase: 'mutate', error: String(e) });
      continue;
    }
    stats[name].runs++;

    // --- decodePacket must never throw --------------------------------------
    let result;
    const started = Date.now();
    try {
      result = decodePacket(mutated);
    } catch (error) {
      stats[name].threw++;
      findings.push({
        name, phase: 'decodePacket', error: String(error),
        bytes: Buffer.from(mutated.subarray(0, Math.min(80, mutated.length))).toString('hex'),
      });
      continue;
    }
    if (Date.now() - started > 1000) {
      findings.push({ name, phase: 'decodePacket', error: 'took over 1s (possible hang)' });
    }

    if (result.ok) stats[name].decoded++; else stats[name].rejected++;

    // --- validate must never throw, AND must reject impossible packets -------
    let verdict;
    try {
      verdict = validate(mutated, ctx);
    } catch (error) {
      stats[name].threw++;
      findings.push({
        name, phase: 'validate', error: String(error),
        bytes: Buffer.from(mutated.subarray(0, Math.min(80, mutated.length))).toString('hex'),
      });
    }

    // --- an ACCEPTED packet must be internally consistent --------------------
    if (verdict && verdict.ok) {
      const h = verdict.packet.header;
      if (h.fragmentCount === 0 || h.fragmentIndex >= h.fragmentCount) {
        findings.push({ name, phase: 'ACCEPTED-BAD', error: `impossible fragmenting ${h.fragmentIndex}/${h.fragmentCount}` });
      }
      if (h.hopCount >= h.hopLimit) {
        findings.push({ name, phase: 'ACCEPTED-BAD', error: `hopCount ${h.hopCount} >= hopLimit ${h.hopLimit}` });
      }
      if (h.expiresAt <= ctx.nowS) {
        findings.push({ name, phase: 'ACCEPTED-BAD', error: `already expired (${h.expiresAt} <= ${ctx.nowS})` });
      }
      // Type confusion: an SOS payload accepted under a different type code.
      if (name === 'type-confusion') {
        const keys = Object.keys(verdict.packet.payload);
        findings.push({ name, phase: 'ACCEPTED-BAD', error: `type 0x${h.type.toString(16)} accepted with ${keys.length} decoded fields` });
      }
    }
  }
}

console.log('strategy                          runs  decoded  rejected  threw');
for (const [name, s] of Object.entries(stats)) {
  console.log(name.padEnd(33), String(s.runs).padStart(4), String(s.decoded).padStart(8), String(s.rejected).padStart(9), String(s.threw).padStart(6));
}

console.log('\n=== FINDINGS:', findings.length, '===');
const grouped = {};
for (const f of findings) {
  const key = `${f.name} | ${f.phase} | ${f.error.slice(0, 90)}`;
  grouped[key] = (grouped[key] ?? 0) + 1;
}
for (const [k, count] of Object.entries(grouped).sort((a, b) => b[1] - a[1])) {
  console.log(`  [x${count}] ${k}`);
}
if (findings.length) {
  console.log('\nfirst failing input:', findings[0].bytes ?? '(n/a)');
}
