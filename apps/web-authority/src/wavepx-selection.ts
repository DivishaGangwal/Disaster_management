import type { Campaign } from './types';

const WAVE_PX_STATES = new Set([
  'audio-generated',
  'decode-tested',
  'scheduled',
  'played',
  'archived',
]);

export function wavePxCampaigns(campaigns: readonly Campaign[]): Campaign[] {
  return campaigns
    .filter((campaign) => Boolean(campaign.broadcastProgram) && WAVE_PX_STATES.has(campaign.state))
    .slice()
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
}

export function selectWavePxCampaign(campaigns: readonly Campaign[], selectedId: string): Campaign | undefined {
  return campaigns.find((campaign) => campaign.campaignId === selectedId) ?? campaigns[0];
}
