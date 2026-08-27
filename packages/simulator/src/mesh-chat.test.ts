import assert from 'node:assert/strict';
import test from 'node:test';

import { MessageType, SourceClass } from '@dsm/contracts';
import { buildMeshChat, decodePacket, toEpochS } from '@dsm/codec';
import { Scenario } from './scenario.js';

test('addressed chat is validated, stored, and carried across an intermediate mesh phone', async () => {
  const scenario = new Scenario('IN-DEMO-01', { latencyMs: 10, seed: 19 });
  scenario.addNode({ name: 'sender', nodeToken: 'aaaa0001', sourceId: '1111111111111111', role: 'general-public' });
  scenario.addNode({ name: 'carrier', nodeToken: 'bbbb0002', sourceId: '2222222222222222', role: 'general-public' });
  scenario.addNode({ name: 'recipient', nodeToken: 'cccc0003', sourceId: '3333333333333333', role: 'general-public' });
  scenario.link('sender', 'carrier');
  scenario.link('carrier', 'recipient');
  await scenario.startAll();

  const packet = buildMeshChat(
    { sourceId: '1111111111111111', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(scenario.medium.clockMs) },
    'chat:aaaa0001:cccc0003',
    { senderNodeToken: 'aaaa0001', recipientNodeToken: 'cccc0003', senderLabel: 'Asha', text: 'Shared a location', location: { source: 1, latE7: 261440000, lonE7: 916860000, accuracyM: 12, ageS: 2 } },
  );
  const created = await scenario.node('sender').engine.createLocal(packet);
  assert.equal(created.accepted, true);
  assert.equal(created.storeOutcome, 'inserted');
  assert.ok(packet.totalBytes <= 244, `chat record was ${packet.totalBytes}B, over negotiated Bluetooth record size`);

  await scenario.gossip(8, 300);
  assert.deepEqual(await scenario.holdersOf(packet.packetId), ['sender', 'carrier', 'recipient']);
  const received = await scenario.node('recipient').engine.packets.get(packet.packetId);
  assert.ok(received);
  const decoded = decodePacket(received!.encoded.bytes);
  assert.equal(decoded.ok, true);
  if (decoded.ok) {
    assert.equal(decoded.packet.header.type, MessageType.MESH_CHAT);
    assert.ok(decoded.packet.header.hopCount >= 2, `recipient should observe multi-hop evidence, got ${decoded.packet.header.hopCount}`);
    assert.equal((decoded.packet.payload as Record<string, unknown>)['recipientNodeToken'], 'cccc0003');
    assert.equal((decoded.packet.payload as Record<string, unknown>)['text'], 'Shared a location');
    assert.deepEqual((decoded.packet.payload as Record<string, unknown>)['location'], { source: 1, latE7: 261440000, lonE7: 916860000, accuracyM: 12, ageS: 2 });
  }
  const marker = scenario.node('recipient').engine.projection.get('PEER-aaaa0001');
  assert.equal(marker?.label, "Asha's shared location");
  assert.equal(marker?.latE7, 261440000);
  await scenario.stopAll();
});

test('a user-initiated peer sync delivers a newly queued chat without waiting for another gossip round', async () => {
  const scenario = new Scenario('IN-DEMO-01', { latencyMs: 10, seed: 21 });
  scenario.addNode({ name: 'sender', nodeToken: 'aaaa0001', sourceId: '1111111111111111', role: 'general-public' });
  scenario.addNode({ name: 'recipient', nodeToken: 'bbbb0002', sourceId: '2222222222222222', role: 'general-public' });
  scenario.link('sender', 'recipient');
  await scenario.startAll();
  await scenario.gossip(2, 100);

  const packet = buildMeshChat(
    { sourceId: '1111111111111111', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(scenario.medium.clockMs) },
    'chat:aaaa0001:bbbb0002',
    { senderNodeToken: 'aaaa0001', recipientNodeToken: 'bbbb0002', senderLabel: 'Asha', text: 'Need water' },
  );
  await scenario.node('sender').engine.createLocal(packet);
  await scenario.node('sender').relay.refreshAdvertisement();
  const opened = await scenario.node('sender').relay.syncPeerNow('bbbb0002');
  await scenario.advance(100);

  assert.equal(opened, true);
  assert.deepEqual(await scenario.holdersOf(packet.packetId), ['sender', 'recipient']);
  await scenario.stopAll();
});
