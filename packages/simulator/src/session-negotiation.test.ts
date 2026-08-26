/**
 * SESSION HELLO AND COMPACT INVENTORY -- end to end over the simulated radio.
 *
 * Covers the two defects that could not be seen from a two-phone, one-packet
 * bring-up: the hello phase advanced without ever putting a record on the wire
 * (so SessionStateMachine.negotiate() had no caller), and the inventory fit
 * exactly four IDs (HD-012) while the queue-epoch session skip (HD-013) then
 * guaranteed the fifth was never mentioned again.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EmergencyCategory,
  LocationSource,
  Mobility,
  ReplyCapability,
  Severity,
  SourceClass,
} from '@dsm/contracts';
import { buildSosCreate, toEpochS } from '@dsm/codec';
import { Scenario } from './scenario.js';

const REGION = 'IN-DEMO-01';

function twoLinkedNodes() {
  const scenario = new Scenario(REGION, { latencyMs: 10, seed: 7 });
  scenario.addNode({ name: 'a', nodeToken: 'aaaa0001', sourceId: '1111111111111111', role: 'general-public', latE7: 285355000, lonE7: 771234000 });
  scenario.addNode({ name: 'b', nodeToken: 'bbbb0002', sourceId: '2222222222222222', role: 'general-public', latE7: 285360000, lonE7: 771240000 });
  scenario.link('a', 'b');
  return scenario;
}

function sosOn(scenario: Scenario, nodeName: string, incidentId: string) {
  const node = scenario.node(nodeName);
  return buildSosCreate(
    { sourceId: node.spec.sourceId, sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(scenario.medium.clockMs) },
    {
      incidentId,
      category: EmergencyCategory.TRAPPED,
      severity: Severity.LIFE_CRITICAL,
      peopleTotal: 2,
      mobility: Mobility.IMMOBILE,
      location: { source: LocationSource.FRESH_GNSS, latE7: 285355000, lonE7: 771234000, accuracyM: 10, ageS: 5 },
      replyCapabilities: ReplyCapability.TIER1_BLE,
    },
  );
}

function events(scenario: Scenario, nodeName: string, name: string) {
  return scenario.node(nodeName).engine.events.recent(5000).filter((event) => event.name === name);
}

test('HELLO_CAPABILITY reaches the wire, in both directions', async () => {
  const scenario = twoLinkedNodes();
  await scenario.startAll();
  await scenario.node('a').engine.createLocal(sosOn(scenario, 'a', 'INC-H1'), 'INC-H1');
  await scenario.gossip(4, 300);

  for (const node of ['a', 'b']) {
    assert.ok(events(scenario, node, 'hello-announced').length > 0, `${node} never announced a hello`);
    assert.ok(events(scenario, node, 'hello-received').length > 0, `${node} never received a peer hello`);
  }
  await scenario.stopAll();
});

test('the peer capability learned at hello is persisted on the peer record', async () => {
  const scenario = twoLinkedNodes();
  await scenario.startAll();
  // A band the default (3) cannot be confused with, so this proves the value
  // travelled rather than that a default happened to match.
  scenario.node('b').engine.setBatteryBand(1);
  await scenario.node('a').engine.createLocal(sosOn(scenario, 'a', 'INC-H2'), 'INC-H2');
  await scenario.gossip(4, 300);

  const peer = await scenario.node('a').engine.peers.get('bbbb0002');
  assert.ok(peer, 'a must know b as a peer');
  assert.equal(peer!.batteryBand, 1, "b's battery band must reach a's peer record");
  assert.equal(peer!.maxRecordBytes, 244, 'the negotiated record size must be recorded');
  assert.ok(peer!.capabilitiesAtMs !== undefined, 'capability age must be recorded');
  await scenario.stopAll();
});

test('an inventory announces well past the four IDs the old encoding allowed', async () => {
  const scenario = twoLinkedNodes();
  await scenario.startAll();
  for (let i = 0; i < 12; i += 1) {
    await scenario.node('a').engine.createLocal(sosOn(scenario, 'a', `INC-N${i}`), `INC-N${i}`);
  }
  await scenario.gossip(6, 300);

  const carried = events(scenario, 'a', 'announced').map((event) => Number(event.metrics?.['carried'] ?? 0));
  assert.ok(Math.max(...carried) > 4, `every announcement was capped at ${Math.max(...carried)} IDs`);
  await scenario.stopAll();
});

test('a loaded relay still carries an SOS across three phones with no direct link', async () => {
  // Scenario A's shape, but with the carrier's queue full enough that the old
  // four-ID inventory would have described almost none of it.
  const scenario = new Scenario(REGION, { latencyMs: 10, seed: 11 });
  scenario.addNode({ name: 'victim', nodeToken: 'aaaa0001', sourceId: '1111111111111111', role: 'general-public', latE7: 285355000, lonE7: 771234000 });
  scenario.addNode({ name: 'carrier', nodeToken: 'bbbb0002', sourceId: '2222222222222222', role: 'general-public', latE7: 285360000, lonE7: 771240000 });
  scenario.addNode({ name: 'responder', nodeToken: 'cccc0003', sourceId: '3333333333333333', role: 'responder', latE7: 285370000, lonE7: 771250000 });
  scenario.link('victim', 'carrier');
  scenario.link('carrier', 'responder');
  await scenario.startAll();

  for (let i = 0; i < 15; i += 1) {
    await scenario.node('carrier').engine.createLocal(sosOn(scenario, 'carrier', `INC-L${i}`), `INC-L${i}`);
  }
  const sos = sosOn(scenario, 'victim', 'INC-L-SOS');
  await scenario.node('victim').engine.createLocal(sos, 'INC-L-SOS');
  await scenario.gossip(8, 300);

  const holders = await scenario.holdersOf(sos.packetId);
  assert.ok(holders.includes('carrier'), 'hop 1 must receive it');
  assert.ok(holders.includes('responder'), 'hop 2 must receive it through the carrier');
  await scenario.stopAll();
});
