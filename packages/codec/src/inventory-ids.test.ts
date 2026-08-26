/**
 * Compact inventory IDs -- the capacity fix behind HD-012.
 *
 * These tests exist because the defect they cover was invisible: single-packet
 * runs passed throughout while any node holding five packets could only name
 * four of them, and the mismatch that would break prefix matching fails SILENTLY
 * (every session re-sends everything) rather than throwing.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { LINK, SourceClass } from '@dsm/contracts';
import { buildInventory } from './builders.js';
import { decodePacket } from './packet-codec.js';
import {
  INVENTORY_ID_PREFIX_BYTES,
  packInventoryIds,
  packetIdPrefixKey,
  unpackInventoryIds,
} from './inventory-ids.js';

const ctx = { sourceId: 'aabbccdd11223344', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: 1000 };

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, i) => (i + 1).toString(16).padStart(8, '0').repeat(4).slice(0, 32));
}

function announce(list: readonly string[]) {
  return buildInventory(ctx, { idPrefixes: packInventoryIds(list), queueEpoch: 7, truncated: true });
}

test('one inventory record carries far more than the four IDs hex strings allowed', () => {
  const available = ids(60);
  const carried: string[] = [];
  for (const id of available) {
    try {
      announce([...carried, id]);
    } catch {
      break;
    }
    carried.push(id);
  }
  // The pre-fix encoding fit exactly 4. Asserting a floor rather than the exact
  // count so payload tweaks elsewhere do not make this brittle -- what must
  // never come back is the order of magnitude.
  assert.ok(carried.length >= 16, `expected >=16 IDs per inventory, fitted ${carried.length}`);
});

test('an inventory record still fits a single BLE write (HD-011)', () => {
  const record = announce(ids(21));
  assert.ok(
    record.totalBytes <= LINK.MAX_RECORD_BYTES,
    `${record.totalBytes}B exceeds the ${LINK.MAX_RECORD_BYTES}B write budget`,
  );
});

test('prefixes round-trip through the real encoder and decoder', () => {
  const list = ids(21);
  const decoded = decodePacket(announce(list).bytes);
  assert.equal(decoded.ok, true);
  assert.ok(decoded.ok);
  const payload = decoded.packet.payload as Record<string, unknown>;
  assert.deepEqual(unpackInventoryIds(payload['idPrefixes'] as Uint8Array), list.map(packetIdPrefixKey));
});

test('the truncated flag survives the wire, so a partial list is not read as complete', () => {
  const decoded = decodePacket(announce(ids(3)).bytes);
  assert.ok(decoded.ok);
  assert.equal((decoded.packet.payload as Record<string, unknown>)['truncated'], true);
});

test('what is announced and what is tested for membership are the same key', () => {
  // The one mismatch that would fail silently: announcing a prefix while the
  // forwarding gate tests a full packet ID would never match, and every session
  // would re-send every packet with no error anywhere.
  const list = ids(5);
  const announced = new Set(unpackInventoryIds(packInventoryIds(list)));
  for (const id of list) {
    assert.ok(announced.has(packetIdPrefixKey(id)), `membership key mismatch for ${id}`);
  }
});

test('a blob cut mid-entry yields the complete entries, not an exception', () => {
  // This comes off the radio. INT-001: bounded and defensive, never fatal.
  const blob = packInventoryIds(ids(4));
  const cut = blob.slice(0, blob.length - INVENTORY_ID_PREFIX_BYTES + 3);
  assert.deepEqual(unpackInventoryIds(cut), ids(3).map(packetIdPrefixKey));
});

test('distinct packet IDs keep distinct prefixes across a realistic queue', () => {
  const keys = new Set(ids(2000).map(packetIdPrefixKey));
  assert.equal(keys.size, 2000, 'prefix collision within STORAGE.MAX_STORED_PACKETS');
});
