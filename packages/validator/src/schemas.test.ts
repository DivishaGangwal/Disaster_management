/**
 * Gate 11 must FAIL CLOSED.
 *
 * Regression for the fuzzer finding: 12 of 33 message types had no rules
 * entry and were waved through, so an empty payload was accepted -- including
 * for RECORD_UPSERT and CONTENT_ACTIVATE, which mutate the map projection.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { MessageType } from '@dsm/contracts';
import { validateSchema } from './schemas.js';

test('no message type accepts a completely empty payload', () => {
  const accepting: string[] = [];
  for (const [name, code] of Object.entries(MessageType)) {
    if (validateSchema(code, {}).ok) accepting.push(name);
  }
  assert.deepEqual(accepting, [], 'every registered type must require its identifying fields');
});

test('an unregistered message type is refused, not waved through', () => {
  const result = validateSchema(0x09, { anything: 1 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.detail, /no schema rules registered/);
});

test('the map-mutating families require their object identity', () => {
  for (const code of [MessageType.RECORD_UPSERT, MessageType.RECORD_TOMBSTONE, MessageType.CONTENT_ACTIVATE]) {
    assert.equal(validateSchema(code, { bundleId: 'B1' }).ok, false, 'objectId must be required');
  }
  assert.equal(
    validateSchema(MessageType.RECORD_UPSERT, { bundleId: 'B1', objectId: 'O1', recordVersion: 1 }).ok,
    true,
  );
});

test('session control still requires its identifying fields', () => {
  assert.equal(validateSchema(MessageType.HELLO_CAPABILITY, {}).ok, false);
  assert.equal(validateSchema(MessageType.PACKET_REQUEST, {}).ok, false);
  assert.equal(
    validateSchema(MessageType.HELLO_CAPABILITY, { nodeToken: 'aabb0011', protocolMin: 1, protocolMax: 1 }).ok,
    true,
  );
});
