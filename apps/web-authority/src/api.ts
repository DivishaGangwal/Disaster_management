import { DEPLOYMENT, type CampaignState } from '@dsm/contracts';
import type { AuditRecord, Campaign, GatewayAudit, Incident, OperatorSession, Overview, PacketStreamItem, RegionalRecord, Responder } from './types';

export interface CampaignDraftInput {
  readonly title: string;
  readonly summary: string;
  readonly severity: number;
  readonly category?: number;
  readonly instruction?: number;
  readonly profile: string;
  readonly dataType: 'official-alert' | 'regional-record' | 'check-in';
  readonly objectId?: string;
  /** Degrees × 1e7. Sent only when the operator selected a broadcast point. */
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly radiusM?: number;
  readonly clearLocation?: boolean;
}

export interface RegionalCentreInput {
  readonly objectId?: string;
  readonly kind: 'shelter' | 'medical' | 'food-water' | 'safe-zone';
  readonly name: string;
  readonly district: string;
  readonly latE7: number;
  readonly lonE7: number;
  readonly state: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = storedSession();
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(session ? { 'x-operations-key': session.operationsKey, 'x-operator-label': session.operatorLabel } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    if (response.status === 401) window.sessionStorage.removeItem(SESSION_KEY);
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return body;
}

const SESSION_KEY = 'dsm-operator-session';
const REGIONAL_RECORDS_PATH = `/api/region/${DEPLOYMENT.regionCode}/records`;

function storedSession(): OperatorSession | undefined {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as OperatorSession : undefined;
  } catch {
    return undefined;
  }
}

export const api = {
  storedSession,
  authenticate: async (operatorLabel: string, operationsKey: string) => {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-operations-key': operationsKey, 'x-operator-label': operatorLabel },
      body: '{}',
    });
    const body = await response.json() as Omit<OperatorSession, 'operationsKey'> & { error?: string };
    if (!response.ok) throw new Error(body.error ?? 'Operator sign-in failed.');
    const session: OperatorSession = { ...body, operationsKey };
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },
  signOut: () => window.sessionStorage.removeItem(SESSION_KEY),
  overview: () => request<Overview>('/api/overview'),
  incidents: async () => (await request<{ incidents: Incident[] }>('/api/incidents')).incidents,
  responders: async () => (await request<{ responders: Responder[] }>('/api/responders')).responders,
  records: async () => (await request<{ records: RegionalRecord[] }>(REGIONAL_RECORDS_PATH)).records,
  campaigns: async () => (await request<{ campaigns: Campaign[] }>('/api/campaigns')).campaigns,
  audit: async () => (await request<{ audit: AuditRecord[] }>('/api/audit')).audit,
  gateways: () => request<GatewayAudit>('/api/gateway-audit'),
  packets: async () => (await request<{ packets: PacketStreamItem[] }>('/api/packets')).packets,
  assign: async (responderRef: string, incidentId: string) =>
    (await request<{ responder: Responder }>(`/api/responders/${encodeURIComponent(responderRef)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ incidentId }),
    })).responder,
  updateResponder: async (responderRef: string, action: 'accepted' | 'en-route' | 'arrived' | 'resolved') =>
    (await request<{ responder: Responder }>(`/api/responders/${encodeURIComponent(responderRef)}/state`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    })).responder,
  updateRecord: async (objectId: string, state: string) =>
    (await request<{ record: RegionalRecord }>(`${REGIONAL_RECORDS_PATH}/${encodeURIComponent(objectId)}`, {
      method: 'POST',
      body: JSON.stringify({ state }),
    })).record,
  upsertCentre: async (input: RegionalCentreInput) =>
    (await request<{ record: RegionalRecord }>(input.objectId ? `${REGIONAL_RECORDS_PATH}/${encodeURIComponent(input.objectId)}` : REGIONAL_RECORDS_PATH, {
      method: 'POST',
      body: JSON.stringify(input),
    })).record,
  createCampaign: async (input: CampaignDraftInput) =>
    (await request<{ campaign: Campaign }>('/api/campaigns', { method: 'POST', body: JSON.stringify(input) })).campaign,
  updateCampaign: async (campaignId: string, input: CampaignDraftInput) =>
    (await request<{ campaign: Campaign }>(`/api/campaigns/${encodeURIComponent(campaignId)}`, { method: 'PUT', body: JSON.stringify(input) })).campaign,
  transitionCampaign: async (campaignId: string, state: CampaignState) =>
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
      body: JSON.stringify({ framesBase64, receptionTransport }),
    })).campaign,
  recordBroadcastEvent: async (campaignId: string, event: 'exported' | 'played') =>
    (await request<{ campaign: Campaign }>(`/api/campaigns/${encodeURIComponent(campaignId)}/broadcast-events`, {
      method: 'POST',
      body: JSON.stringify({ event }),
    })).campaign,
  reset: () => request<{ ok: true; seedVersion: string }>('/api/operations/reset', { method: 'POST', body: '{}' }),
};
