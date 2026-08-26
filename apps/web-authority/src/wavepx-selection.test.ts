import assert from 'node:assert/strict';
import test from 'node:test';
import { selectWavePxCampaign, wavePxCampaigns } from './wavepx-selection.ts';
import type { Campaign } from './types';

function campaign(campaignId: string, state: string, updatedAtMs: number, prepared = true): Campaign {
  return {
    campaignId,
    campaignVersion: 1,
    title: campaignId,
    summary: 'test',
    regionCode: 'IN-MH',
    state,
    profile: 'audible-normal',
    contentRevision: 1,
    packetId: `packet-${campaignId}`,
    severity: 1,
    category: 1,
    instruction: 1,
    broadcastProgram: prepared ? {
      programId: `program-${campaignId}`,
      campaignId,
      campaignVersion: 1,
      profile: 'audible-normal',
      sampleRate: 48000,
      artifactDigest: 'digest',
      uniqueFramesBase64: ['AQ=='],
      playbackFramesBase64: ['AQ=='],
      createdAtMs: updatedAtMs,
    } : undefined,
    preview: {
      totalTier2Bytes: 1,
      totalDurationS: 1,
      budgetS: 180,
      overBudget: false,
      items: [],
      burstSchedule: [],
    },
    createdAtMs: updatedAtMs,
    updatedAtMs,
  };
}

test('WavePX lists only prepared audio artifacts, newest first', () => {
  const result = wavePxCampaigns([
    campaign('draft', 'draft', 30),
    campaign('missing-program', 'audio-generated', 40, false),
    campaign('older', 'audio-generated', 10),
    campaign('newer', 'decode-tested', 20),
  ]);

  assert.deepEqual(result.map((item) => item.campaignId), ['newer', 'older']);
});

test('WavePX keeps a valid selection and falls back when it disappears', () => {
  const campaigns = [campaign('newer', 'decode-tested', 20), campaign('older', 'audio-generated', 10)];
  assert.equal(selectWavePxCampaign(campaigns, 'older')?.campaignId, 'older');
  assert.equal(selectWavePxCampaign(campaigns, 'missing')?.campaignId, 'newer');
  assert.equal(selectWavePxCampaign([], 'missing'), undefined);
});
