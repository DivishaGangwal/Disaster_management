/**
 * ACCEPTANCE SCENARIOS (simulated tier).
 *
 * Spec: 03-... "Required acceptance scenarios" A-K. These are the SIMULATOR
 * versions. Working rule 10 is binding: these prove the logic, they do NOT
 * substitute for real-device evidence. Scenario rows that need hardware are
 * listed in docs/STATUS.md.
 *
 * Covered here: A (three-hop), B (local responder completion), C (store-carry-
 * forward), G (Tier 2 direct/mic equivalence), H (radio-to-mesh bridge),
 * J (file never starves an SOS), K (stale markers).
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ArrivalEvidence,
  EmergencyCategory,
  FILE_TRANSFER,
  MimeCategory,
  FRESHNESS,
  LocationSource,
  MessageType,
  Mobility,
  Priority,
  ReplyCapability,
  ResolutionOutcome,
  Severity,
  SourceClass,
} from '@dsm/contracts';
import {
  buildFileFragment,
  buildFileManifest,
  buildOfficialAlert,
  buildResponderState,
  buildSosCreate,
  decodePacket,
  sha256Hex,
  toEpochS,
} from '@dsm/codec';
import { planCampaign, ManifestHandleResolver, Tier2Receiver, toTier2Frames } from '@dsm/tier2';
import { freshnessOf } from '@dsm/mapkit';
import { Scenario } from './scenario.js';

const REGION = 'IN-DEMO-01';

function scenarioWithThreeNodes() {
  const scenario = new Scenario(REGION, { latencyMs: 10, seed: 42 });
  scenario.addNode({
    name: 'victim',
    nodeToken: 'aaaa0001',
    sourceId: '1111111111111111',
    role: 'general-public',
    latE7: 285355000,
    lonE7: 771234000,
  });
  scenario.addNode({
    name: 'carrier',
    nodeToken: 'bbbb0002',
    sourceId: '2222222222222222',
    role: 'general-public',
    latE7: 285360000,
    lonE7: 771240000,
  });
  scenario.addNode({
    name: 'responder',
    nodeToken: 'cccc0003',
    sourceId: '3333333333333333',
    role: 'responder',
    latE7: 285370000,
    lonE7: 771250000,
  });
  return scenario;
}

function makeSos(scenario: Scenario, nodeName: string, incidentId: string) {
  const node = scenario.node(nodeName);
  return buildSosCreate(
    { sourceId: node.spec.sourceId, sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(scenario.medium.clockMs) },
    {
      incidentId,
      category: EmergencyCategory.TRAPPED,
      severity: Severity.LIFE_CRITICAL,
      peopleTotal: 3,
      injured: 1,
      mobility: Mobility.IMMOBILE,
      location: { source: LocationSource.FRESH_GNSS, latE7: 285355000, lonE7: 771234000, accuracyM: 10, ageS: 5 },
      replyCapabilities: ReplyCapability.TIER1_BLE,
    },
  );
}

test('scenario A: an SOS crosses three phones over Bluetooth alone', async () => {
  const scenario = scenarioWithThreeNodes();
  // A chain, not a clique: the responder is only reachable through the carrier.
  scenario.link('victim', 'carrier');
  scenario.link('carrier', 'responder');
  await scenario.startAll();

  const sos = makeSos(scenario, 'victim', 'INC-A1');
  await scenario.node('victim').engine.createLocal(sos, 'INC-A1');

  await scenario.gossip(6, 300);

  const holders = await scenario.holdersOf(sos.packetId);
  assert.ok(holders.includes('victim'), 'the source must retain its own packet');
  assert.ok(holders.includes('carrier'), 'hop 1 must receive it');
  assert.ok(holders.includes('responder'), 'hop 2 must receive it via the carrier, with no direct link');

  // The responder sees a real incident, not just bytes.
  const incident = scenario.node('responder').engine.incidents.view('INC-A1');
  assert.ok(incident, 'the responder must project an incident');
  assert.equal(incident!.severity, Severity.LIFE_CRITICAL);
  assert.equal(incident!.peopleTotal, 3);

  await scenario.stopAll();
});

test('scenario A: no server is ever contacted', async () => {
  const scenario = scenarioWithThreeNodes();
  scenario.link('victim', 'carrier');
  scenario.link('carrier', 'responder');
  await scenario.startAll();

  // No gateway is configured on any node, and none is proven.
  for (const node of scenario.nodes.values()) {
    assert.equal(node.engine.isGatewayProven(scenario.medium.clockMs), false);
  }

  const sos = makeSos(scenario, 'victim', 'INC-A2');
  await scenario.node('victim').engine.createLocal(sos, 'INC-A2');
  await scenario.gossip(6, 300);

  assert.ok((await scenario.holdersOf(sos.packetId)).includes('responder'));
  await scenario.stopAll();
});

test('scenario B: a responder accepts, arrives, and resolves with no backend', async () => {
  const scenario = scenarioWithThreeNodes();
  scenario.link('victim', 'carrier');
  scenario.link('carrier', 'responder');
  await scenario.startAll();

  const sos = makeSos(scenario, 'victim', 'INC-B1');
  await scenario.node('victim').engine.createLocal(sos, 'INC-B1');
  await scenario.gossip(6, 300);

  const responder = scenario.node('responder');
  const ctx = {
    sourceId: responder.spec.sourceId,
    sourceClass: SourceClass.RESPONDER_PROVISIONED,
    nowS: toEpochS(scenario.medium.clockMs),
  };

  const accepted = buildResponderState(ctx, MessageType.RESPONDER_ACCEPTED, 'INC-B1', 2, {
    assignmentId: 'ASG-1',
    responderRef: 'RSP-7',
  });
  await responder.engine.createLocal(accepted);

  const arrived = buildResponderState(ctx, MessageType.RESPONDER_ARRIVED, 'INC-B1', 3, {
    assignmentId: 'ASG-1',
    responderRef: 'RSP-7',
    evidence: ArrivalEvidence.DECLARED,
  });
  await responder.engine.createLocal(arrived);

  const resolved = buildResponderState(ctx, MessageType.RESOLVED, 'INC-B1', 4, {
    resolverRef: 'RSP-7',
    outcome: ResolutionOutcome.RESCUED,
    terminalRetentionS: 3600,
  });
  await responder.engine.createLocal(resolved);

  await scenario.gossip(8, 300);

  // The victim learns the outcome back through the same mesh.
  const victimView = scenario.node('victim').engine.incidents.view('INC-B1');
  assert.ok(victimView, 'the victim must have the incident');
  assert.equal(victimView!.state, 'resolved');
  assert.ok(victimView!.delivery.arrivedAtS !== undefined, 'arrival must be a separate recorded fact');
  assert.ok(victimView!.delivery.resolvedAtS !== undefined);
  // GTW-008: nothing may claim the backend received it.
  assert.equal(victimView!.delivery.backendAcceptedAtS, undefined);

  await scenario.stopAll();
});

test('scenario C: store-carry-forward across a loss of contact', async () => {
  const scenario = scenarioWithThreeNodes();
  // The carrier starts with the victim only; the responder is out of range.
  scenario.link('victim', 'carrier');
  await scenario.startAll();

  const sos = makeSos(scenario, 'victim', 'INC-C1');
  await scenario.node('victim').engine.createLocal(sos, 'INC-C1');
  await scenario.gossip(4, 300);

  let holders = await scenario.holdersOf(sos.packetId);
  assert.ok(holders.includes('carrier'), 'the carrier picks it up');
  assert.ok(!holders.includes('responder'), 'the responder is out of range and must NOT have it');

  // The carrier walks away from the victim and towards the responder.
  scenario.unlink('victim', 'carrier');
  await scenario.advance(5_000);
  scenario.link('carrier', 'responder');
  await scenario.gossip(6, 300);

  holders = await scenario.holdersOf(sos.packetId);
  assert.ok(holders.includes('responder'), 'custody survived the disconnection and moved with the carrier');

  await scenario.stopAll();
});

test('scenario J: a queued file transfer never starves an SOS', async () => {
  const scenario = scenarioWithThreeNodes();
  scenario.link('victim', 'carrier');
  await scenario.startAll();

  const victim = scenario.node('victim');
  const ctx = {
    sourceId: victim.spec.sourceId,
    sourceClass: SourceClass.GENERAL_PUBLIC,
    nowS: toEpochS(scenario.medium.clockMs),
  };

  // Queue a file first, so only priority ordering can save the SOS.
  // TEXT ONLY, and each fragment is sized to fit one BLE write.
  const size = FILE_TRANSFER.FRAGMENT_DATA_BYTES;
  const payload = new TextEncoder().encode('situation report line. '.repeat(20));
  const count = Math.ceil(payload.length / size);
  const manifest = buildFileManifest(ctx, 'FILE-1', {
    purposeCode: 1,
    mimeCategory: MimeCategory.TEXT,
    totalBytes: payload.length,
    fragmentSize: size,
    fragmentCount: count,
    digest: sha256Hex(payload),
  });
  await victim.engine.createLocal(manifest);
  for (let i = 0; i < count; i += 1) {
    const slice = payload.slice(i * size, (i + 1) * size);
    await victim.engine.createLocal(
      buildFileFragment(ctx, 'FILE-1', i, count, sha256Hex(slice).slice(0, FILE_TRANSFER.FRAGMENT_DIGEST_CHARS), slice),
    );
  }

  const sos = makeSos(scenario, 'victim', 'INC-J1');
  await victim.engine.createLocal(sos, 'INC-J1');

  const plan = await victim.engine.planSessionTransfer('bbbb0002', new Set(), scenario.medium.clockMs);
  const first = plan.offers[0];
  assert.ok(first, 'the plan must offer something');
  assert.equal(
    first!.candidate.packet.header.priority,
    Priority.EMERGENCY,
    'the SOS must be offered before any file record',
  );

  const sosPosition = plan.offers.findIndex((o) => o.candidate.packetId === sos.packetId);
  const firstFragmentPosition = plan.offers.findIndex(
    (o) => o.candidate.packet.header.type === MessageType.FILE_FRAGMENT,
  );
  assert.ok(sosPosition >= 0, 'the SOS must be in the offer list');
  if (firstFragmentPosition >= 0) {
    assert.ok(sosPosition < firstFragmentPosition, 'the SOS must precede every fragment');
  }

  await scenario.stopAll();
});

test('scenarios G and H: Tier 2 paths agree, and a Tier 2 packet bridges into Tier 1', async () => {
  const scenario = scenarioWithThreeNodes();
  // The responder is the ONLY node listening to the radio.
  scenario.link('responder', 'carrier');
  await scenario.startAll();

  const authorityCtx = {
    sourceId: '9999999999999999',
    sourceClass: SourceClass.AUTHORITY_PROVISIONED,
    nowS: toEpochS(scenario.medium.clockMs),
  };
  const alert = buildOfficialAlert(authorityCtx, 'ALT-1', 1, Severity.URGENT, {
    category: 0,
    instruction: 1,
    regionCode: REGION,
    fallbackText: 'Move to higher ground now',
  });

  const decodedAlert = decodePacket(alert.bytes);
  assert.equal(decodedAlert.ok, true);
  if (!decodedAlert.ok) return;

  const plan = planCampaign({
    campaignId: 'CMP-1',
    campaignVersion: 1,
    campaignHandle: 7,
    regionCode: REGION,
    validFromS: authorityCtx.nowS,
    validUntilS: authorityCtx.nowS + 3600,
    requiredPackId: 'PACK-DEMO',
    requiredPackVersion: 1,
    profile: 'audible-fast',
    packets: [
      {
        packetId: alert.packetId,
        bytes: alert.bytes,
        messageType: MessageType.OFFICIAL_ALERT,
        priority: decodedAlert.packet.header.priority,
        severity: decodedAlert.packet.header.severity,
      },
    ],
  });

  const frames = toTier2Frames({
    campaignHandle: 7,
    campaignVersion: 1,
    packetHandle: 1,
    messageType: MessageType.OFFICIAL_ALERT,
    priority: decodedAlert.packet.header.priority,
    severity: decodedAlert.packet.header.severity,
    canonicalPacketBytes: alert.bytes,
  });

  // --- G: the two audio paths must recover identical canonical bytes --------
  const viaMic = new Tier2Receiver(new ManifestHandleResolver(plan.manifest, 7));
  const viaDirect = new Tier2Receiver(new ManifestHandleResolver(plan.manifest, 7));

  let micBytes: Uint8Array | undefined;
  let directBytes: Uint8Array | undefined;
  for (const frame of frames) {
    const m = viaMic.accept({ bytes: frame, source: 'tier2-mic', receivedAtMs: scenario.medium.clockMs });
    if (m.packet) micBytes = m.packet.bytes;
    const d = viaDirect.accept({ bytes: frame, source: 'tier2-direct', receivedAtMs: scenario.medium.clockMs });
    if (d.packet) directBytes = d.packet.bytes;
  }

  assert.ok(micBytes, 'the microphone path must recover the packet');
  assert.ok(directBytes, 'the direct path must recover the packet');
  assert.deepEqual(
    Array.from(micBytes!),
    Array.from(directBytes!),
    'T2-004: both Tier 2 paths must yield identical canonical bytes',
  );
  assert.deepEqual(Array.from(micBytes!), Array.from(alert.bytes), 'and identical to the original Tier 1 packet');

  // The campaign manifest is an additional approval check, not a decoding
  // dependency. A device that has never seen the campaign still recovers the
  // self-describing Tier 1 packet.
  const independent = new Tier2Receiver();
  let independentBytes: Uint8Array | undefined;
  for (const frame of frames) {
    const outcome = independent.accept({ bytes: frame, source: 'tier2-mic', receivedAtMs: scenario.medium.clockMs });
    if (outcome.packet) independentBytes = outcome.packet.bytes;
  }
  assert.deepEqual(Array.from(independentBytes!), Array.from(alert.bytes), 'an offline receiver must decode without a preloaded manifest');

  // --- H: bridge the Tier 2 packet into Tier 1 -----------------------------
  const responder = scenario.node('responder');
  const ingested = await responder.engine.ingest(micBytes!, 'tier2-mic', { campaignId: 'CMP-1' });
  assert.equal(ingested.accepted, true, 'the Tier 2 packet must pass the shared validator');

  await scenario.gossip(6, 300);

  // The carrier never listened to any radio.
  const carrierHasIt = await scenario.node('carrier').engine.packets.hasSeen(alert.packetId);
  assert.equal(carrierHasIt, true, 'a non-listening peer must receive the Tier 2-origin record over Bluetooth');

  // T2-008: repetition must not re-notify.
  const repeat = viaMic.accept({ bytes: frames[0]!, source: 'tier2-mic', receivedAtMs: scenario.medium.clockMs });
  assert.equal(repeat.packet, undefined, 'a repeated frame must not produce a second application action');
  assert.ok(viaMic.metrics().framesDuplicate > 0, 'duplicates must be counted, not silently dropped');

  await scenario.stopAll();
});

test('scenario K: person markers become stale and then expire', () => {
  const nowS = 1_000_000;
  assert.equal(freshnessOf(nowS, nowS), 'live');
  assert.equal(freshnessOf(nowS - FRESHNESS.LOCATION_LIVE_S - 1, nowS), 'aging');
  assert.equal(freshnessOf(nowS - FRESHNESS.LOCATION_STALE_S - 1, nowS), 'stale');
  assert.equal(freshnessOf(nowS - FRESHNESS.LOCATION_EXPIRE_S - 1, nowS), 'expired');
});

test('a duplicate packet is observed but never acted on twice', async () => {
  const scenario = scenarioWithThreeNodes();
  scenario.link('victim', 'carrier');
  await scenario.startAll();

  const sos = makeSos(scenario, 'victim', 'INC-D1');
  const carrier = scenario.node('carrier');

  const first = await carrier.engine.ingest(sos.bytes, 'tier1-ble', { previousHopToken: 'aaaa0001' });
  assert.equal(first.storeOutcome, 'inserted');
  assert.ok(first.mapOperationsApplied > 0, 'the first copy updates the map');

  const second = await carrier.engine.ingest(sos.bytes, 'tier1-ble', { previousHopToken: 'aaaa0001' });
  assert.equal(second.storeOutcome, 'duplicate');
  assert.equal(second.mapOperationsApplied, 0, 'REL-006: the duplicate must not repeat the action');

  const observations = await carrier.engine.packets.listObservations(sos.packetId);
  assert.equal(observations.length, 2, 'but the extra observation IS recorded');

  await scenario.stopAll();
});
