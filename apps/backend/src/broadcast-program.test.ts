import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createBackend } from './server.js';

test('approved campaign becomes an exact, persisted ggwave frame program', async () => {
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

    const stream = operations.packetStream();
    assert.ok(stream.length >= 3);
    assert.ok(stream.every((packet) => packet.bytesHex.length === packet.totalBytes * 2));
    assert.ok(stream.some((packet) => packet.direction === 'mesh-to-internet'));
    await backend.close();

    const restored = createBackend({ databasePath, seed: false });
    const persisted = restored.operations!.listCampaigns().find((item) => item.campaignId === campaign.campaignId);
    assert.equal(persisted?.broadcastProgram?.artifactDigest, campaign.broadcastProgram.artifactDigest);
    assert.equal(persisted?.decodeResult?.passed, true);
    await restored.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('campaign composer emits distinct canonical check-in and regional packet types', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-broadcast-types-'));
  try {
    const backend = createBackend({ databasePath: join(directory, 'operations.sqlite') });
    const operations = backend.operations!;
    const checkin = operations.createCampaign({
      title: 'District safety check',
      summary: 'Report safe, medical need, trapped, or water need.',
      dataType: 'check-in',
    });
    const regional = operations.createCampaign({
      title: 'Shelter status',
      summary: 'Broadcast the current shelter record.',
      dataType: 'regional-record',
      objectId: operations.listRegionalRecords().find((item) => item.kind === 'shelter')!.objectId,
    });

    assert.equal(checkin.messageType, 0x70);
    assert.equal(checkin.dataType, 'check-in');
    assert.equal(regional.messageType, 0x40);
    assert.equal(regional.dataType, 'regional-record');
    assert.notEqual(checkin.packetId, regional.packetId);
    assert.ok(checkin.preview.totalTier2Bytes > 0);
    assert.ok(regional.preview.totalTier2Bytes > 0);
    await backend.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
