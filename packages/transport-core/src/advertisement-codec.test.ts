/**
 * The advertisement must fit a REAL BLE PDU and must leak nothing.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { ADVERTISEMENT, BLE_IDENTIFIERS } from '@dsm/contracts';
import { buildDiscoverySummary, CapabilityBit } from './index.js';
import {
  ADVERTISEMENT_BYTES,
  buildAdvertisingPdu,
  decodeAdvertisement,
  encodeAdvertisement,
} from './advertisement-codec.js';

const summary = buildDiscoverySummary({
  nodeToken: 'aabb0011',
  queueEpoch: 4242,
  highestWaitingPriority: 0,
  inventoryHint: 0xbeef,
  gatewayProven: true,
  gatewayFreshnessClass: 0,
  acceptingConnections: true,
  capabilityBits: CapabilityBit.GATT_SERVER | CapabilityBit.GATT_CLIENT | CapabilityBit.GATEWAY_CAPABLE,
});

test('the advertisement round-trips exactly', () => {
  const decoded = decodeAdvertisement(encodeAdvertisement(summary));
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;
  assert.deepEqual(decoded.summary, summary);
});

test('the payload fits the usable budget', () => {
  assert.ok(
    ADVERTISEMENT_BYTES <= ADVERTISEMENT.MAX_BYTES,
    `payload is ${ADVERTISEMENT_BYTES}B, over the ${ADVERTISEMENT.MAX_BYTES}B budget`,
  );
});

test('the COMPLETE advertising PDU fits 31 bytes, including mandatory AD overhead', () => {
  // This is the assertion that was missing: the old 26-byte budget ignored the
  // 3-byte Flags element and the 4-byte manufacturer header, so 26 + 7 = 33
  // would not have fitted a real PDU at all.
  const pdu = buildAdvertisingPdu(summary);
  assert.ok(pdu.length <= ADVERTISEMENT.PDU_BYTES, `PDU is ${pdu.length}B, over 31B`);

  assert.equal(
    ADVERTISEMENT.MAX_BYTES,
    ADVERTISEMENT.PDU_BYTES - ADVERTISEMENT.FLAGS_ELEMENT_BYTES - ADVERTISEMENT.MANUFACTURER_HEADER_BYTES,
    'the budget must equal what is actually left after AD overhead',
  );
});

test('the PDU is a well-formed AD structure', () => {
  const pdu = buildAdvertisingPdu(summary);

  // Element 1: Flags. [len=2][type=0x01][LE General Discoverable | BR/EDR n/a]
  assert.equal(pdu[0], 0x02);
  assert.equal(pdu[1], 0x01);
  assert.equal(pdu[2], 0x06);

  // Element 2: [len][type=0xff][company lo][company hi][payload...]
  // The length byte excludes itself, so it must equal the rest of the element.
  assert.equal(pdu[3], pdu.length - 4, 'length byte must cover type + company id + payload');
  assert.equal(pdu[4], 0xff, 'AD type must be manufacturer-specific data');
  assert.equal(pdu[5], BLE_IDENTIFIERS.COMPANY_ID & 0xff, 'company id is little-endian');
  assert.equal(pdu[6], (BLE_IDENTIFIERS.COMPANY_ID >> 8) & 0xff);
  assert.equal(pdu[7], BLE_IDENTIFIERS.ADVERTISEMENT_MAGIC, 'our payload starts with the magic byte');
});

test('foreign 0xffff manufacturer data is ignored via the magic byte', () => {
  const foreign = new Uint8Array(ADVERTISEMENT_BYTES);
  foreign[0] = 0x01; // some other developer also using the test company id
  const decoded = decodeAdvertisement(foreign);
  assert.equal(decoded.ok, false);
  if (decoded.ok) return;
  assert.equal(decoded.reason, 'bad-magic');
});

test('a truncated advertisement is refused, not half-parsed', () => {
  const short = encodeAdvertisement(summary).subarray(0, 6);
  const decoded = decodeAdvertisement(short);
  assert.equal(decoded.ok, false);
});

test('02-...: the advertisement cannot carry identifying content', () => {
  // Structural guarantee: DiscoverySummary has no field for a name, phone
  // number, note, coordinate, incident ID or permanent account ID, so the
  // encoder has nothing to leak. This asserts the shape has not grown one.
  const allowed = new Set([
    'protocolMajor',
    'protocolMinor',
    'nodeToken',
    'capabilityBits',
    'queueEpoch',
    'highestWaitingPriority',
    'inventoryHint',
    'gatewayProven',
    'gatewayFreshnessClass',
    'acceptingConnections',
  ]);
  for (const key of Object.keys(summary)) {
    assert.ok(allowed.has(key), `unexpected advertisement field "${key}" -- check it leaks nothing`);
  }
});

test('an SOS packet could never fit in an advertisement', () => {
  // The point of the whole design: advertisements announce, connections carry.
  const smallestSos = 115;
  assert.ok(
    smallestSos > ADVERTISEMENT.PDU_BYTES,
    'if this ever became false the transport design should be revisited',
  );
});
