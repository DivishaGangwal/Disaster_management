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
