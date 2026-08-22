import type { AuditRecord, Campaign, GatewayAudit, Incident, Overview, PacketStreamItem, RegionalRecord, Responder } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

export const api = {
  overview: () => request<Overview>('/api/overview'),
  incidents: async () => (await request<{ incidents: Incident[] }>('/api/incidents')).incidents,
  responders: async () => (await request<{ responders: Responder[] }>('/api/responders')).responders,
  records: async () => (await request<{ records: RegionalRecord[] }>('/api/region/IN-AS/records')).records,
  campaigns: async () => (await request<{ campaigns: Campaign[] }>('/api/campaigns')).campaigns,
  audit: async () => (await request<{ audit: AuditRecord[] }>('/api/audit')).audit,
  gateways: () => request<GatewayAudit>('/api/gateway-audit'),
  packets: async () => (await request<{ packets: PacketStreamItem[] }>('/api/packets')).packets,
  assign: async (responderRef: string, incidentId: string) =>
    (await request<{ responder: Responder }>(`/api/responders/${encodeURIComponent(responderRef)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ incidentId, dispatcherLabel: 'Assam Operations Coordinator' }),
    })).responder,
  updateRecord: async (objectId: string, state: string) =>
    (await request<{ record: RegionalRecord }>(`/api/region/IN-AS/records/${encodeURIComponent(objectId)}`, {
      method: 'POST',
      body: JSON.stringify({ state }),
    })).record,
  createCampaign: async (input: { title: string; summary: string; severity: number; profile: string; dataType: 'official-alert' | 'check-in' | 'regional-record'; objectId?: string }) =>
    (await request<{ campaign: Campaign }>('/api/campaigns', { method: 'POST', body: JSON.stringify(input) })).campaign,
  transitionCampaign: async (campaignId: string, state: string) =>
    (await request<{ campaign: Campaign }>(`/api/campaigns/${encodeURIComponent(campaignId)}/transition`, {
      method: 'POST',
      body: JSON.stringify({ state }),
    })).campaign,
  prepareBroadcast: async (campaignId: string) =>
    (await request<{ campaign: Campaign }>(`/api/campaigns/${encodeURIComponent(campaignId)}/broadcast-program`, {
      method: 'POST',
      body: '{}',
    })).campaign,
  reportReception: async (campaignId: string, framesBase64: readonly string[], receptionTransport: 'tier2-mic' | 'tier2-direct') =>
    (await request<{ campaign: Campaign }>(`/api/campaigns/${encodeURIComponent(campaignId)}/broadcast-reception`, {
      method: 'POST',
      body: JSON.stringify({ framesBase64, receiverLabel: 'Browser receiving station', receptionTransport }),
    })).campaign,
  reset: () => request<{ ok: true; seedVersion: string }>('/api/demo/reset', { method: 'POST', body: '{}' }),
};
