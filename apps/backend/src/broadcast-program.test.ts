import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createBackend } from './server.js';

test('Assam demo seed supplies a populated, idempotent realtime command picture', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-command-picture-'));
  const databasePath = join(directory, 'operations.sqlite');
  try {
    const backend = createBackend({ databasePath });
    assert.equal(backend.incidents.list().filter((item) => item.incidentId.startsWith('INC-AS-V2-')).length, 10);
    assert.equal(backend.operations!.listResponders().length, 8);
    assert.equal(backend.operations!.listRegionalRecords().length, 17);
    assert.equal(backend.store.gatewayTokens.size, 4);
    assert.ok(backend.store.observations.length >= 10);
    await backend.close();

    const restored = createBackend({ databasePath });
    assert.equal(restored.incidents.list().filter((item) => item.incidentId.startsWith('INC-AS-V2-')).length, 10);
    assert.equal(restored.operations!.listResponders().length, 8);
    assert.equal(restored.operations!.listRegionalRecords().length, 17);
    assert.equal(restored.store.gatewayTokens.size, 4);
    await restored.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('approved campaign becomes an exact, persisted WavePX frame program', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-broadcast-'));
  const databasePath = join(directory, 'operations.sqlite');
  try {
    const backend = createBackend({ databasePath });
    const operations = backend.operations!;
    let campaign = operations.createCampaign({
      title: 'Flood warning',
      summary: 'Move to designated higher ground and follow district instructions.',
      severity: 3,
      profile: 'audible-fast',
    });
    campaign = operations.transitionCampaign(campaign.campaignId, 'validated');
    campaign = operations.transitionCampaign(campaign.campaignId, 'approved');
    campaign = operations.transitionCampaign(campaign.campaignId, 'broadcaster-ready');
    campaign = operations.prepareBroadcastProgram(campaign.campaignId);

    assert.equal(campaign.state, 'audio-generated');
    assert.ok(campaign.broadcastProgram);
    assert.ok(campaign.broadcastProgram.uniqueFramesBase64.length > 0);
    assert.ok(campaign.broadcastProgram.playbackFramesBase64.length >= campaign.broadcastProgram.uniqueFramesBase64.length);

    const incomplete = operations.verifyBroadcastReception(campaign.campaignId, [], 'Receiver B');
    assert.equal(incomplete.state, 'audio-generated');
    assert.equal(incomplete.decodeResult?.passed, false);

    const complete = operations.verifyBroadcastReception(
      campaign.campaignId,
      campaign.broadcastProgram.uniqueFramesBase64,
      'Receiver B',
    );
    assert.equal(complete.state, 'decode-tested');
    assert.equal(complete.decodeResult?.passed, true);
    assert.equal(complete.decodeResult?.receptionTransport, 'tier2-direct');
    assert.equal(complete.decodeResult?.decodedMessage?.text, 'Move to designated higher ground and follow district instructions.');
    assert.equal(complete.decodeResult?.decodedMessage?.regionCode, 'IN-AS');

    assert.throws(() => operations.recordBroadcastEvent(campaign.campaignId, 'played', 'Operator Test'), /scheduled/);
    const exported = operations.recordBroadcastEvent(campaign.campaignId, 'exported', 'Operator Test');
    assert.equal(exported.state, 'scheduled');
    assert.equal(exported.broadcastEvents?.[0]?.artifactDigest, campaign.broadcastProgram.artifactDigest);
    const played = operations.recordBroadcastEvent(campaign.campaignId, 'played', 'Operator Test');
    assert.equal(played.state, 'played');
    assert.deepEqual(played.broadcastEvents?.map((event) => event.event), ['exported', 'played']);

    const stream = operations.packetStream();
    assert.ok(stream.length >= 3);
    assert.ok(stream.every((packet) => packet.bytesHex.length === packet.totalBytes * 2));
    assert.ok(stream.some((packet) => packet.direction === 'mesh-to-internet'));
    await backend.close();

    const restored = createBackend({ databasePath, seed: false });
    const persisted = restored.operations!.listCampaigns().find((item) => item.campaignId === campaign.campaignId);
    assert.equal(persisted?.broadcastProgram?.artifactDigest, campaign.broadcastProgram.artifactDigest);
    assert.equal(persisted?.decodeResult?.passed, true);
    assert.equal(persisted?.state, 'played');
    assert.equal(persisted?.broadcastEvents?.length, 2);
    await restored.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('legacy campaigns rebuild packet preview evidence from stored canonical bytes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-legacy-campaign-'));
  const databasePath = join(directory, 'operations.sqlite');
  try {
    const backend = createBackend({ databasePath });
    const created = backend.operations!.createCampaign({ title: 'Legacy flood notice', summary: 'Move to higher ground.' });
    await backend.close();

    const database = new DatabaseSync(databasePath);
    const row = database.prepare('SELECT value FROM app_snapshot WHERE key = ?').get('operations') as { value: string };
    const snapshot = JSON.parse(row.value) as { campaigns: Array<Record<string, unknown>> };
    delete snapshot.campaigns.find((campaign) => campaign['campaignId'] === created.campaignId)?.['packetPreview'];
    database.prepare('UPDATE app_snapshot SET value = ? WHERE key = ?').run(JSON.stringify(snapshot), 'operations');
    database.close();

    const restored = createBackend({ databasePath, seed: false });
    const migrated = restored.operations!.listCampaigns().find((campaign) => campaign.campaignId === created.campaignId);
    assert.equal(migrated?.packetPreview.typeName, 'OFFICIAL_ALERT');
    assert.equal(migrated?.packetPreview.totalBytes, Buffer.from(created.packetBytesBase64, 'base64').length);
    assert.equal(migrated?.packetPreview.bytesHex.length, migrated!.packetPreview.totalBytes * 2);
    await restored.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('administrative mutations require an authenticated operator session', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-operations-auth-'));
  const backend = createBackend({ databasePath: join(directory, 'operations.sqlite'), operationsKey: 'test-operations-key' });
  try {
    const port = await backend.listen(0, '127.0.0.1');
    const base = `http://127.0.0.1:${port}`;
    const unauthorised = await fetch(`${base}/api/campaigns`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Test', summary: 'Test' }) });
    assert.equal(unauthorised.status, 401);

    const wrong = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'x-operations-key': 'wrong', 'x-operator-label': 'Operator Test' } });
    assert.equal(wrong.status, 401);
    const headers = { 'content-type': 'application/json', 'x-operations-key': 'test-operations-key', 'x-operator-label': 'Operator Test' };
    const session = await fetch(`${base}/api/session`, { method: 'POST', headers, body: '{}' });
    assert.equal(session.status, 200);
    const created = await fetch(`${base}/api/campaigns`, { method: 'POST', headers, body: JSON.stringify({ title: 'Flood notice', summary: 'Move to higher ground.' }) });
    assert.equal(created.status, 201);
  } finally {
    await backend.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('campaign text limits are enforced in UTF-8 bytes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-campaign-utf8-'));
  try {
    const backend = createBackend({ databasePath: join(directory, 'operations.sqlite') });
    assert.throws(() => backend.operations!.createCampaign({ title: 'Flood', summary: '界'.repeat(60) }), /140 UTF-8 bytes/);
    await backend.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('coordinator responder actions emit the complete incident lifecycle', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-responder-lifecycle-'));
  try {
    const backend = createBackend({ databasePath: join(directory, 'operations.sqlite') });
    const operations = backend.operations!;
    const responder = operations.listResponders().find((item) => item.available)!;
    const incident = backend.incidents.list().find((item) => !['resolved', 'cancelled', 'expired'].includes(item.state))!;
    operations.assignResponder(responder.responderRef, incident.incidentId, 'Operator Test');
    assert.equal(operations.updateResponderState(responder.responderRef, 'accepted', 'Operator Test').status, 'accepted');
    assert.equal(operations.updateResponderState(responder.responderRef, 'en-route', 'Operator Test').status, 'en-route');
    assert.equal(operations.updateResponderState(responder.responderRef, 'arrived', 'Operator Test').status, 'arrived');
    const resolved = operations.updateResponderState(responder.responderRef, 'resolved', 'Operator Test');
    assert.equal(resolved.status, 'available');
    assert.equal(resolved.available, true);
    assert.equal(backend.incidents.detail(incident.incidentId)?.incident.state, 'resolved');
    await backend.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('campaign composer emits distinct canonical alert and regional packet types', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-broadcast-types-'));
  try {
    const backend = createBackend({ databasePath: join(directory, 'operations.sqlite') });
    const operations = backend.operations!;
    const alert = operations.createCampaign({
      title: 'District evacuation notice',
      summary: 'Move to the marked assembly point and await district instructions.',
      latE7: 263501000,
      lonE7: 920003000,
      radiusM: 7500,
    });
    const regional = operations.createCampaign({
      title: 'Shelter status',
      summary: 'Broadcast the current shelter record.',
      dataType: 'regional-record',
      objectId: operations.listRegionalRecords().find((item) => item.kind === 'shelter')!.objectId,
    });

    assert.equal(alert.messageType, 0x60);
    assert.equal(alert.dataType, 'official-alert');
    assert.equal(alert.latE7, 263501000);
    assert.equal(alert.lonE7, 920003000);
    assert.equal(alert.radiusM, 7500);
    assert.equal(regional.messageType, 0x40);
    assert.equal(regional.dataType, 'regional-record');
    assert.equal(alert.packetPreview.typeName, 'OFFICIAL_ALERT');
    assert.equal(alert.packetPreview.mapOperations.length, 0, 'official instructions display without inventing a map mutation');
    assert.equal(regional.packetPreview.typeName, 'SHELTER');
    assert.deepEqual(regional.packetPreview.mapOperations.map((operation) => operation.kind), ['upsert-resource']);
    const regionalImpact = regional.packetPreview.mapOperations[0];
    if (!regionalImpact || regionalImpact.kind !== 'upsert-resource') assert.fail('expected a resource map preview');
    assert.equal(regionalImpact.objectId, regional.objectId);
    assert.equal(regional.packetPreview.bytesHex.length, regional.packetPreview.totalBytes * 2);
    assert.notEqual(alert.packetId, regional.packetId);
    assert.ok(alert.preview.totalTier2Bytes > 0);
    assert.ok(regional.preview.totalTier2Bytes > 0);
    await backend.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('reception decodes the coordinates that came back off the air, and refuses altered frames', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-broadcast-location-'));
  try {
    const backend = createBackend({ databasePath: join(directory, 'operations.sqlite') });
    const operations = backend.operations!;
    let campaign = operations.createCampaign({
      title: 'Riverbank evacuation',
      summary: 'Leave the riverbank and move to the marked assembly point.',
      severity: 3,
      latE7: 262100000,
      lonE7: 917400000,
      radiusM: 4000,
    });
    campaign = operations.transitionCampaign(campaign.campaignId, 'validated');
    campaign = operations.transitionCampaign(campaign.campaignId, 'approved');
    campaign = operations.transitionCampaign(campaign.campaignId, 'broadcaster-ready');
    campaign = operations.prepareBroadcastProgram(campaign.campaignId);
    const frames = campaign.broadcastProgram!.uniqueFramesBase64;

    const verified = operations.verifyBroadcastReception(campaign.campaignId, frames, 'Receiver B', 'tier2-mic');
    assert.equal(verified.decodeResult?.passed, true);
    assert.equal(verified.decodeResult?.canonicalMatch, true);
    assert.equal(verified.decodeResult?.reassembledPacketId, campaign.packetId);
    assert.equal(verified.decodeResult?.decodedMessage?.location?.latE7, 262100000);
    assert.equal(verified.decodeResult?.decodedMessage?.location?.lonE7, 917400000);
    assert.equal(verified.decodeResult?.decodedMessage?.location?.radiusM, 4000);
    assert.equal(verified.decodeResult?.decodedMessage?.location?.matchesApproved, true);

    // A frame whose payload byte was flipped must not pass as the approved packet.
    const tampered = frames.map((frame, index) => {
      if (index > 0) return frame;
      const bytes = Buffer.from(frame, 'base64');
      const target = bytes.length - 3;
      bytes[target] = bytes[target]! ^ 0xff;
      return bytes.toString('base64');
    });
    const rejected = operations.verifyBroadcastReception(campaign.campaignId, tampered, 'Receiver B', 'tier2-mic');
    assert.equal(rejected.decodeResult?.passed, false);
    assert.equal(rejected.decodeResult?.decodedMessage, undefined);
    await backend.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('WavePX centre packets project create, close, move, and reopen operations without a map renderer', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-centre-operations-'));
  try {
    const backend = createBackend({ databasePath: join(directory, 'operations.sqlite') });
    const operations = backend.operations!;

    const receiveCurrent = (objectId: string, title: string) => {
      let campaign = operations.createCampaign({
        title,
        summary: title,
        dataType: 'regional-record',
        objectId,
      });
      campaign = operations.transitionCampaign(campaign.campaignId, 'validated');
      campaign = operations.transitionCampaign(campaign.campaignId, 'approved');
      campaign = operations.transitionCampaign(campaign.campaignId, 'broadcaster-ready');
      campaign = operations.prepareBroadcastProgram(campaign.campaignId);
      return operations.verifyBroadcastReception(campaign.campaignId, campaign.broadcastProgram!.uniqueFramesBase64, 'Map pipeline test', 'tier2-direct');
    };

    const created = operations.upsertRegionalCentre({
      kind: 'shelter',
      name: 'Temporary River Centre',
      district: 'Nagaon',
      latE7: 263501000,
      lonE7: 926922000,
      state: 'open',
    });
    assert.match(created.objectId, /^TMP-SHL-/);
    let decoded = receiveCurrent(created.objectId, 'Create temporary centre');
    assert.equal(decoded.decodeResult?.passed, true);
    assert.deepEqual(decoded.decodeResult?.mapOperations?.map((op) => op.kind), ['upsert-resource']);
    let mapOperation = decoded.decodeResult?.mapOperations?.[0];
    if (!mapOperation || mapOperation.kind !== 'upsert-resource') assert.fail('expected a resource upsert');
    assert.equal(mapOperation.temporary, true);
    assert.equal(mapOperation.latE7, 263501000);

    operations.updateRegionalRecord(created.objectId, 'closed');
    decoded = receiveCurrent(created.objectId, 'Close temporary centre');
    mapOperation = decoded.decodeResult?.mapOperations?.[0];
    if (!mapOperation || mapOperation.kind !== 'upsert-resource') assert.fail('expected a resource upsert');
    assert.equal(mapOperation.state, 3);

    const moved = operations.upsertRegionalCentre({ objectId: created.objectId, kind: 'shelter', name: created.name, district: created.district, latE7: 263601000, lonE7: 927022000, state: 'closed' });
    decoded = receiveCurrent(moved.objectId, 'Move temporary centre');
    mapOperation = decoded.decodeResult?.mapOperations?.[0];
    if (!mapOperation || mapOperation.kind !== 'upsert-resource') assert.fail('expected a resource upsert');
    assert.equal(mapOperation.latE7, 263601000);
    assert.equal(mapOperation.lonE7, 927022000);

    operations.updateRegionalRecord(created.objectId, 'open');
    decoded = receiveCurrent(created.objectId, 'Reopen temporary centre');
    mapOperation = decoded.decodeResult?.mapOperations?.[0];
    if (!mapOperation || mapOperation.kind !== 'upsert-resource') assert.fail('expected a resource upsert');
    assert.equal(mapOperation.state, 1);
    assert.equal(mapOperation.causedByPacketId, decoded.decodeResult?.reassembledPacketId);
    await backend.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
