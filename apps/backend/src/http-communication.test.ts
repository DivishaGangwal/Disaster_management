import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  EmergencyCategory,
  LocationSource,
  MessageType,
  Mobility,
  ReplyCapability,
  Severity,
  SourceClass,
} from '@dsm/contracts';
import { buildSosCreate, decodePacket, toEpochS } from '@dsm/codec';
import { toMapOperations } from '@dsm/mapkit';
import { BACKEND_IDENTITY, createBackend } from './server.js';

const OPERATIONS_KEY = 'communication-test-key';
const AUTH_HEADERS = {
  'content-type': 'application/json',
  'x-operations-key': OPERATIONS_KEY,
  'x-operator-label': 'Contract test operator',
};

test('live HTTP contract carries mobile SOS up and website map updates down', async () => {
  const fixture = await openFixture();
  try {
    const health = await fixture.request('/health');
    assert.equal(health.status, 200);
    assert.equal(health.body['identity'], BACKEND_IDENTITY);

    const registration = await fixture.request('/gateway/register', {
      method: 'POST',
      body: JSON.stringify({ nodeToken: 'phone-a', regionCode: 'IN-AS' }),
    });
    assert.equal(registration.status, 200);
    const gatewayToken = String(registration.body['gatewayToken']);

    const now = Date.now();
    const sos = buildSosCreate(
      { sourceId: '1111111111111111', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(now) },
      {
        incidentId: 'INC-HTTP-MOBILE',
        category: EmergencyCategory.FLOOD,
        severity: Severity.LIFE_CRITICAL,
        peopleTotal: 3,
        mobility: Mobility.LIMITED,
        location: { source: LocationSource.FRESH_GNSS, latE7: 261445000, lonE7: 917362000, accuracyM: 12, ageS: 2 },
        replyCapabilities: ReplyCapability.TIER1_BLE,
      },
    );
    const item = {
      packetId: sos.packetId,
      bytesBase64: Buffer.from(sos.bytes).toString('base64'),
      observation: { receivedAtMs: now, transport: 'tier1-ble', hopCountOnArrival: 1 },
    };

    const unknownGateway = await fixture.request('/gateway/upload', {
      method: 'POST',
      body: JSON.stringify({ gatewayToken: 'GW-unknown', batchId: 'unknown-1', items: [item] }),
    });
    assert.equal(unknownGateway.status, 401);

    const mismatched = await fixture.request('/gateway/upload', {
      method: 'POST',
      body: JSON.stringify({
        gatewayToken,
        batchId: 'mismatch-1',
        items: [{ ...item, packetId: '00000000000000000000000000000000' }],
      }),
    });
    assert.equal(mismatched.status, 200);
    assert.equal((mismatched.body['results'] as { outcome: string }[])[0]?.outcome, 'invalid');

    const upload = await fixture.request('/gateway/upload', {
      method: 'POST',
      body: JSON.stringify({ gatewayToken, batchId: 'mobile-1', items: [item] }),
    });
    assert.equal(upload.status, 200);
    assert.equal((upload.body['results'] as { outcome: string }[])[0]?.outcome, 'accepted');

    const incidents = await fixture.request('/api/incidents');
    assert.equal(incidents.status, 200);
    assert.ok((incidents.body['incidents'] as { incidentId: string }[]).some((value) => value.incidentId === 'INC-HTTP-MOBILE'));

    const firstOutbound = await fixture.request('/gateway/outbound', {
      method: 'POST',
      body: JSON.stringify({ gatewayToken, regionCode: 'IN-AS', maxItems: 32 }),
    });
    assert.equal(firstOutbound.status, 200);
    const firstItems = firstOutbound.body['items'] as { packetId: string; bytesBase64: string }[];
    assert.equal(firstItems.length, 1);
    const acknowledgement = decodePacket(Buffer.from(firstItems[0]!.bytesBase64, 'base64'));
    assert.equal(acknowledgement.ok, true);
    if (acknowledgement.ok) assert.equal(acknowledgement.packet.header.type, MessageType.BACKEND_ACKNOWLEDGEMENT);
    const firstCursor = String(firstOutbound.body['nextCursor']);

    const wrongRegion = await fixture.request('/gateway/outbound', {
      method: 'POST',
      body: JSON.stringify({ gatewayToken, regionCode: 'IN-MH', maxItems: 32 }),
    });
    assert.equal(wrongRegion.status, 403);

    const created = await fixture.request('/api/region/IN-AS/records', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        kind: 'shelter',
        name: 'HTTP contract shelter',
        district: 'Kamrup Metropolitan',
        latE7: 261500000,
        lonE7: 917500000,
        state: 'open',
      }),
    });
    assert.equal(created.status, 201);
    const record = created.body['record'] as { objectId: string };

    const mapOutbound = await fixture.request('/gateway/outbound', {
      method: 'POST',
      body: JSON.stringify({ gatewayToken, regionCode: 'IN-AS', cursor: firstCursor, maxItems: 32 }),
    });
    assert.equal(mapOutbound.status, 200);
    const mapItems = mapOutbound.body['items'] as { packetId: string; bytesBase64: string }[];
    assert.equal(mapItems.length, 1);
    const decoded = decodePacket(Buffer.from(mapItems[0]!.bytesBase64, 'base64'));
    assert.equal(decoded.ok, true);
    if (decoded.ok) {
      const operations = toMapOperations(decoded.packet, 'gateway', toEpochS(Date.now()));
      assert.equal(operations[0]?.kind, 'upsert-resource');
      assert.equal('objectId' in operations[0]! ? operations[0].objectId : undefined, record.objectId);
    }

    const ack = await fixture.request('/gateway/outbound/ack', {
      method: 'POST',
      body: JSON.stringify({
        gatewayToken,
        cursor: String(mapOutbound.body['nextCursor']),
        packetIds: mapItems.map((value) => value.packetId),
      }),
    });
    assert.equal(ack.status, 200);
  } finally {
    await fixture.close();
  }
});

test('live campaign endpoints preserve canonical bytes through WavePX and map projection', async () => {
  const fixture = await openFixture();
  try {
    const createdRecord = await fixture.request('/api/region/IN-AS/records', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        kind: 'medical',
        name: 'WavePX contract medical point',
        district: 'Nagaon',
        latE7: 263509000,
        lonE7: 926922000,
        state: 'open',
      }),
    });
    const objectId = String((createdRecord.body['record'] as { objectId: string }).objectId);

    const created = await fixture.request('/api/campaigns', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        title: 'WavePX medical update',
        summary: 'Medical point is open.',
        severity: 2,
        profile: 'audible-normal',
        dataType: 'regional-record',
        objectId,
      }),
    });
    assert.equal(created.status, 201);
    let campaign = created.body['campaign'] as Record<string, unknown>;
    const campaignId = String(campaign['campaignId']);
    assert.equal((campaign['packetPreview'] as { mapOperations: unknown[] }).mapOperations.length, 1);

    for (const state of ['validated', 'approved', 'broadcaster-ready']) {
      const transitioned = await fixture.request(`/api/campaigns/${campaignId}/transition`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ state }),
      });
      assert.equal(transitioned.status, 200);
      campaign = transitioned.body['campaign'] as Record<string, unknown>;
    }

    const prepared = await fixture.request(`/api/campaigns/${campaignId}/broadcast-program`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: '{}',
    });
    assert.equal(prepared.status, 200);
    campaign = prepared.body['campaign'] as Record<string, unknown>;
    const program = campaign['broadcastProgram'] as { uniqueFramesBase64: string[] };
    assert.ok(program.uniqueFramesBase64.length > 0);

    const reception = await fixture.request(`/api/campaigns/${campaignId}/broadcast-reception`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ framesBase64: program.uniqueFramesBase64, receptionTransport: 'tier2-direct' }),
    });
    assert.equal(reception.status, 200);
    campaign = reception.body['campaign'] as Record<string, unknown>;
    const result = campaign['decodeResult'] as { passed: boolean; canonicalMatch: boolean; mapOperations: { kind: string; objectId?: string }[] };
    assert.equal(result.passed, true);
    assert.equal(result.canonicalMatch, true);
    assert.equal(result.mapOperations[0]?.kind, 'upsert-resource');
    assert.equal(result.mapOperations[0]?.objectId, objectId);

    for (const endpoint of ['/api/overview', '/api/responders', '/api/region/IN-AS/records', '/api/campaigns', '/api/packets', '/api/gateway-audit', '/api/audit']) {
      assert.equal((await fixture.request(endpoint)).status, 200, `${endpoint} should remain readable by the console`);
    }
  } finally {
    await fixture.close();
  }
});

test('all remaining web console endpoints enforce their workflow and authentication contracts', async () => {
  const fixture = await openFixture(true);
  try {
    const options = await fixture.request('/api/campaigns', { method: 'OPTIONS' });
    assert.equal(options.status, 204);

    const badSession = await fixture.request('/api/session', { method: 'POST', body: '{}' });
    assert.equal(badSession.status, 401);
    const session = await fixture.request('/api/session', { method: 'POST', headers: AUTH_HEADERS, body: '{}' });
    assert.equal(session.status, 200);
    assert.equal(session.body['regionCode'], 'IN-AS');

    const incidents = (await fixture.request('/api/incidents')).body['incidents'] as { incidentId: string }[];
    assert.ok(incidents.length > 0);
    const incidentId = incidents[0]!.incidentId;
    assert.equal((await fixture.request(`/api/incidents/${encodeURIComponent(incidentId)}`)).status, 200);
    assert.equal((await fixture.request('/api/incidents/not-present')).status, 404);

    const responders = (await fixture.request('/api/responders')).body['responders'] as { responderRef: string; available: boolean }[];
    const responder = responders.find((value) => value.available);
    assert.ok(responder);
    const assigned = await fixture.request(`/api/responders/${encodeURIComponent(responder!.responderRef)}/assign`, {
      method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({ incidentId }),
    });
    assert.equal(assigned.status, 200);
    for (const action of ['accepted', 'en-route', 'arrived', 'resolved']) {
      assert.equal((await fixture.request(`/api/responders/${encodeURIComponent(responder!.responderRef)}/state`, {
        method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({ action }),
      })).status, 200);
    }

    const records = (await fixture.request('/api/region/IN-AS/records')).body['records'] as { objectId: string; state: string; kind: string; district: string }[];
    const centre = records.find((value) => !['hazard', 'route'].includes(value.kind));
    assert.ok(centre);
    const nextState = centre!.state === 'closed' ? 'open' : 'closed';
    assert.equal((await fixture.request(`/api/region/IN-AS/records/${encodeURIComponent(centre!.objectId)}`, {
      method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({ state: nextState }),
    })).status, 200);
    assert.equal((await fixture.request(`/api/districts/${encodeURIComponent(centre!.district)}/records`)).status, 200);
    assert.equal((await fixture.request(`/api/districts/${encodeURIComponent(centre!.district)}/records`, {
      method: 'POST', body: JSON.stringify({ kind: 'shelter', name: 'Unauthorised', latE7: 260000000, lonE7: 920000000, state: 'open' }),
    })).status, 401);
    assert.equal((await fixture.request(`/api/districts/${encodeURIComponent(centre!.district)}/records`, {
      method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({ kind: 'shelter', name: 'District endpoint shelter', latE7: 260000000, lonE7: 920000000, state: 'open' }),
    })).status, 201);

    const created = await fixture.request('/api/campaigns', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ title: 'Endpoint alert', summary: 'Initial instruction.', dataType: 'official-alert', profile: 'audible-fast' }),
    });
    const campaignId = String((created.body['campaign'] as Record<string, unknown>)['campaignId']);
    assert.equal((await fixture.request(`/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ title: 'Endpoint alert v2', summary: 'Updated instruction.', dataType: 'official-alert', profile: 'audible-fast' }),
    })).status, 200);
    assert.equal((await fixture.request(`/api/campaigns/${campaignId}/preview`)).status, 200);
    for (const state of ['validated', 'approved', 'broadcaster-ready']) {
      assert.equal((await fixture.request(`/api/campaigns/${campaignId}/transition`, {
        method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({ state }),
      })).status, 200);
    }
    const prepared = await fixture.request(`/api/campaigns/${campaignId}/broadcast-program`, {
      method: 'POST', headers: AUTH_HEADERS, body: '{}',
    });
    const program = ((prepared.body['campaign'] as Record<string, unknown>)['broadcastProgram'] as { uniqueFramesBase64: string[] });
    assert.equal((await fixture.request(`/api/campaigns/${campaignId}/broadcast-reception`, {
      method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({ framesBase64: program.uniqueFramesBase64, receptionTransport: 'tier2-direct' }),
    })).status, 200);
    assert.equal((await fixture.request(`/api/campaigns/${campaignId}/broadcast-events`, {
      method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({ event: 'exported' }),
    })).status, 200);
    assert.equal((await fixture.request(`/api/campaigns/${campaignId}/broadcast-events`, {
      method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({ event: 'played' }),
    })).status, 200);

    assert.equal((await fixture.request('/api/demo/reset', { method: 'POST', headers: AUTH_HEADERS, body: '{}' })).status, 200);
    assert.equal((await fixture.request('/api/not-an-endpoint')).status, 404);
  } finally {
    await fixture.close();
  }
});

async function openFixture(seed = false) {
  const directory = mkdtempSync(join(tmpdir(), 'dsm-http-contract-'));
  const backend = createBackend({
    databasePath: join(directory, 'operations.sqlite'),
    operationsKey: OPERATIONS_KEY,
    seed,
  });
  const port = await backend.listen(0, '127.0.0.1');
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) as Record<string, unknown> : {} };
  };
  return {
    request,
    async close() {
      await backend.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
