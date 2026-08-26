/**
 * Codec round-trip, determinism, size-budget, and malformed-input tests.
 *
 * Spec: 03-... "Unit tests" and "Property and malformed-input tests".
 * Gate I requires golden vectors and a recorded size for every packet type.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EmergencyCategory,
  Flags,
  LocationSource,
  MessageType,
  Mobility,
  ReplyCapability,
  Severity,
  SourceClass,
  ENVELOPE,
} from '@dsm/contracts';
import { buildSosCreate, budgetClassFor } from './builders.js';
import { decodePacket, encodePacket, reencode } from './packet-codec.js';
import { decodeHeader, incrementHopInPlace } from './envelope-codec.js';
import { crc32, digestPrefix, payloadDigest } from './integrity.js';
import { FIELD_MAP_BY_TYPE } from './field-maps.js';

const ctx = { sourceId: '0011223344556677', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: 20_000_000 };

function sampleSos() {
  return buildSosCreate(ctx, {
    incidentId: 'INC-7A2C',
    category: EmergencyCategory.TRAPPED,
    severity: Severity.LIFE_CRITICAL,
    peopleTotal: 4,
    injured: 1,
    mobility: Mobility.IMMOBILE,
    location: { source: LocationSource.FRESH_GNSS, latE7: 285355000, lonE7: 771234000, accuracyM: 12, ageS: 8 },
    replyCapabilities: ReplyCapability.TIER1_BLE,
    shortNote: 'Second floor, water rising',
    language: 'en',
  });
}

test('SOS create round-trips with identical field values', () => {
  const encoded = sampleSos();
  const result = decodePacket(encoded.bytes);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.packet.header.type, MessageType.SOS_CREATE);
  assert.equal(result.packet.header.severity, Severity.LIFE_CRITICAL);
  assert.equal(result.packet.streamId, 'INC-7A2C');
  assert.equal(result.packet.sourceSequence, 1);

  const payload = result.packet.payload as Record<string, unknown>;
  assert.equal(payload['peopleTotal'], 4);
  assert.equal(payload['injured'], 1);
  assert.equal(payload['shortNote'], 'Second floor, water rising');
  assert.deepEqual(payload['location'], {
    source: LocationSource.FRESH_GNSS,
    latE7: 285355000,
    lonE7: 771234000,
    accuracyM: 12,
    ageS: 8,
  });
});

test('encoding is deterministic: same logical packet, identical bytes', () => {
  const first = sampleSos();
  const decoded = decodePacket(first.bytes);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;

  const second = reencode(decoded.packet);
  assert.deepEqual(Array.from(second.bytes), Array.from(first.bytes));
});

test('field order in the source object does not change the bytes', () => {
  const a = encodePacket({
    type: MessageType.SOS_CANCEL,
    payload: { incidentId: 'INC-1', reason: 0, terminalRetentionS: 600 },
    sourceId: ctx.sourceId,
    sourceClass: ctx.sourceClass,
    createdAt: ctx.nowS,
    ttlS: 3600,
    hopLimit: 6,
    packetId: 'aa'.repeat(16),
    streamId: 'INC-1',
  });
  const b = encodePacket({
    type: MessageType.SOS_CANCEL,
    payload: { terminalRetentionS: 600, reason: 0, incidentId: 'INC-1' },
    sourceId: ctx.sourceId,
    sourceClass: ctx.sourceClass,
    createdAt: ctx.nowS,
    ttlS: 3600,
    hopLimit: 6,
    packetId: 'aa'.repeat(16),
    streamId: 'INC-1',
  });
  assert.deepEqual(Array.from(a.bytes), Array.from(b.bytes));
});

test('a compact SOS stays inside the Bluetooth size target', () => {
  // 04-BLUEPRINT 7.7: compact SOS without note, 110-160 B.
  const compact = buildSosCreate(ctx, {
    incidentId: 'INC-1',
    category: EmergencyCategory.MEDICAL,
    severity: Severity.URGENT,
    peopleTotal: 1,
    mobility: Mobility.MOBILE,
    location: { source: LocationSource.FRESH_GNSS, latE7: 285355000, lonE7: 771234000, ageS: 3 },
    replyCapabilities: ReplyCapability.TIER1_BLE,
  });
  assert.ok(
    compact.totalBytes <= 160,
    `compact SOS was ${compact.totalBytes}B, over the 160B engineering target`,
  );
  assert.equal(compact.headerBytes, ENVELOPE.HEADER_BYTES);
});

test('terminal packets set the TERMINAL flag automatically', () => {
  const cancel = encodePacket({
    type: MessageType.SOS_CANCEL,
    payload: { incidentId: 'INC-1', reason: 1, terminalRetentionS: 600 },
    sourceId: ctx.sourceId,
    sourceClass: ctx.sourceClass,
    createdAt: ctx.nowS,
    ttlS: 3600,
    hopLimit: 6,
  });
  const decoded = decodePacket(cancel.bytes);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;
  assert.ok((decoded.packet.header.flags & Flags.TERMINAL) !== 0);
});

test('a relay may increment hop count without changing packet meaning', () => {
  const encoded = sampleSos();
  const relayed = incrementHopInPlace(encoded.bytes);

  const before = decodePacket(encoded.bytes);
  const after = decodePacket(relayed);
  assert.equal(before.ok, true);
  assert.equal(after.ok, true);
  if (!before.ok || !after.ok) return;

  assert.equal(after.packet.header.hopCount, before.packet.header.hopCount + 1);
  assert.equal(after.packet.header.packetId, before.packet.header.packetId);
  assert.equal(after.digest, before.digest);
  assert.deepEqual(after.packet.payload, before.packet.payload);
});

test('truncated input is rejected, never parsed', () => {
  const encoded = sampleSos();
  const result = decodePacket(encoded.bytes.subarray(0, 40));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'reject.too-short');
});

test('a corrupted header byte fails the CRC gate before payload work', () => {
  const encoded = sampleSos();
  const corrupt = encoded.bytes.slice();
  corrupt[10] = (corrupt[10]! ^ 0xff) & 0xff;
  const result = decodePacket(corrupt);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'reject.header-crc-failed');
});

test('a corrupted payload byte fails the digest gate', () => {
  const encoded = sampleSos();
  const corrupt = encoded.bytes.slice();
  corrupt[ENVELOPE.HEADER_BYTES + 3] = (corrupt[ENVELOPE.HEADER_BYTES + 3]! ^ 0x5a) & 0xff;
  const result = decodePacket(corrupt);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'reject.payload-digest-mismatch');
});

test('an unknown message type is refused with a reason, not a crash', () => {
  const encoded = sampleSos();
  const corrupt = encoded.bytes.slice();
  corrupt[3] = 0x09; // unassigned code
  // Repair the header CRC so we exercise the type gate rather than the CRC gate.
  const view = new DataView(corrupt.buffer, corrupt.byteOffset, corrupt.byteLength);
  view.setUint32(60, crc32(corrupt, 0, 60), false);

  const result = decodePacket(corrupt);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'reject.unknown-type');
});

test('a lying payload length is rejected before allocation', () => {
  const encoded = sampleSos();
  const corrupt = encoded.bytes.slice();
  const view = new DataView(corrupt.buffer, corrupt.byteOffset, corrupt.byteLength);
  view.setUint32(42, 3000, false);
  view.setUint32(60, crc32(corrupt, 0, 60), false);

  const result = decodePacket(corrupt);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'reject.length-over-limit');
});

test('random bytes never parse as a valid packet', () => {
  for (let i = 0; i < 200; i += 1) {
    const noise = new Uint8Array(64 + (i % 90));
    for (let j = 0; j < noise.length; j += 1) noise[j] = (i * 31 + j * 17) & 0xff;
    const result = decodePacket(noise);
    assert.equal(result.ok, false, 'structured noise must not decode');
  }
});

test('every registered message type has a field map', () => {
  for (const [name, code] of Object.entries(MessageType)) {
    assert.ok(FIELD_MAP_BY_TYPE[code], `${name} (0x${code.toString(16)}) has no field map`);
  }
});

test('header decodes to the exact blueprint offsets', () => {
  const encoded = sampleSos();
  const { header, crcValid, magicValid } = decodeHeader(encoded.bytes);
  assert.equal(magicValid, true);
  assert.equal(crcValid, true);
  assert.equal(header.packetId.length, 32);
  assert.equal(header.sourceId, ctx.sourceId);
  assert.equal(header.createdAt, ctx.nowS);
  assert.equal(header.fragmentCount, 1);
  assert.equal(header.digestPrefix, digestPrefix(encoded.bytes.subarray(ENVELOPE.HEADER_BYTES), MessageType.SOS_CREATE));
});

test('digest helpers agree with the stored prefix', () => {
  const payload = new Uint8Array([1, 2, 3, 4]);
  assert.equal(digestPrefix(payload, MessageType.SOS_CREATE), payloadDigest(payload, MessageType.SOS_CREATE).slice(0, 16));
});

test('budget classes follow the specified relative order', () => {
  assert.equal(budgetClassFor(MessageType.SOS_CREATE, Severity.LIFE_CRITICAL), 'CRITICAL');
  assert.equal(budgetClassFor(MessageType.SOS_CREATE, Severity.ASSISTANCE), 'HIGH');
  assert.equal(budgetClassFor(MessageType.HAZARD, Severity.URGENT), 'MEDIUM_HIGH');
  assert.equal(budgetClassFor(MessageType.SHELTER, Severity.INFO), 'MEDIUM');
  assert.equal(budgetClassFor(MessageType.FILE_FRAGMENT, Severity.INFO), 'LOW');
});

// --- regressions: three fail-open bugs found by tools/fuzz -------------------

test('regression: the GEO header extension survives a round trip', () => {
  // Previously the encoder wrote an empty map for any nested object with no
  // registered field map, silently discarding every geo coordinate.
  const geo = { latE7: 285355000, lonE7: 771234000, accuracyM: 12, scopeRadiusM: 500 };
  const encoded = encodePacket({
    type: MessageType.SOS_CANCEL,
    payload: { incidentId: 'INC-1', reason: 0, terminalRetentionS: 600 },
    sourceId: ctx.sourceId,
    sourceClass: ctx.sourceClass,
    createdAt: ctx.nowS,
    ttlS: 3600,
    hopLimit: 6,
    streamId: 'INC-1',
    geo,
  });
  const decoded = decodePacket(encoded.bytes);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;
  assert.deepEqual(decoded.packet.geo, geo);
});

test('RECORD_UPSERT dynamic fields encode deterministically and round-trip', () => {
  const options = {
    type: MessageType.RECORD_UPSERT,
    sourceId: ctx.sourceId,
    sourceClass: SourceClass.AUTHORITY_PROVISIONED,
    createdAt: ctx.nowS,
    ttlS: 3600,
    hopLimit: 4,
    packetId: '00112233445566778899aabbccddeeff',
  } as const;
  const first = encodePacket({ ...options, payload: { bundleId: 'B1', objectId: 'O1', recordVersion: 1, fields: { state: 2, label: 'Mumbai centre', active: true } } });
  const reordered = encodePacket({ ...options, payload: { bundleId: 'B1', objectId: 'O1', recordVersion: 1, fields: { active: true, label: 'Mumbai centre', state: 2 } } });
  assert.deepEqual(first.bytes, reordered.bytes);
  const decoded = decodePacket(first.bytes);
  assert.equal(decoded.ok, true);
  if (decoded.ok) assert.deepEqual((decoded.packet.payload as Record<string, unknown>)['fields'], { active: true, label: 'Mumbai centre', state: 2 });
});

test('RECORD_UPSERT rejects nested dynamic values and oversized key sets', () => {
  const base = { type: MessageType.RECORD_UPSERT, sourceId: ctx.sourceId, sourceClass: SourceClass.AUTHORITY_PROVISIONED, createdAt: ctx.nowS, ttlS: 3600, hopLimit: 4 } as const;
  assert.throws(() => encodePacket({ ...base, payload: { bundleId: 'B1', objectId: 'O1', recordVersion: 1, fields: { nested: { unsafe: true } } } }), /bounded scalars/);
  assert.throws(() => encodePacket({ ...base, payload: { bundleId: 'B1', objectId: 'O1', recordVersion: 1, fields: Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`key-${index}`, index])) } }), /item limit/);
});

test('regression: relabelling a packet breaks its digest', () => {
  // Field keys are per-type but overlap (key 1 is incidentId in SOS_CREATE and
  // forPacketId in LINK_RECEIPT), so the type is bound into the payload digest.
  const encoded = sampleSos();
  let accepted = 0;

  for (const code of Object.values(MessageType)) {
    if (code === MessageType.SOS_CREATE) continue;
    const relabelled = encoded.bytes.slice();
    relabelled[3] = code;
    // Repair the header CRC so the type gate, not the CRC gate, is exercised.
    const view = new DataView(relabelled.buffer, relabelled.byteOffset, relabelled.byteLength);
    view.setUint32(60, crc32(relabelled, 0, 60), false);
    if (decodePacket(relabelled).ok) accepted += 1;
  }

  assert.equal(accepted, 0, 'no relabelled packet may decode');
});

test('regression: the digest binds the message type', () => {
  const payload = new Uint8Array([1, 2, 3, 4]);
  assert.notEqual(
    payloadDigest(payload, MessageType.SOS_CREATE),
    payloadDigest(payload, MessageType.LINK_RECEIPT),
    'identical bytes under different types must digest differently',
  );
});
