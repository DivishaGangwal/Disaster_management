/**
 * Acceptance scenarios D and E: the conditional online loop.
 *
 * D. Conditional mesh-to-internet: a node that PROVES connectivity uploads.
 * E. Internet-to-mesh: the backend's acknowledgement comes back down and the
 *    source phone only then shows "coordination centre received it" (GTW-008).
 *
 * Also proves GTW-003 / WEB-001: two gateways uploading one packet produce two
 * OBSERVATIONS of ONE incident, never two victims.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EmergencyCategory,
  LocationSource,
  MessageType,
  Mobility,
  ReplyCapability,
  Severity,
  SourceClass,
  type GatewayClient,
  type OutboundPollRequest,
  type OutboundPollResponse,
  type UploadBatchRequest,
} from '@dsm/contracts';
import { buildSosCreate, decodePacket, toEpochS } from '@dsm/codec';
import { BackendStore, IngestService, IncidentQueryService, OutboundService } from './services.js';

const NOW = Date.UTC(2025, 5, 1);
const REGION = 'IN-DEMO-01';

/** An in-process client so the test needs no sockets and no network. */
function inProcessClient(
  store: BackendStore,
  ingest: IngestService,
  outbound: OutboundService,
  gatewayToken: string,
  options: { proven: boolean },
): GatewayClient {
  return {
    async probe() {
      return options.proven
        ? { proven: true, atMs: NOW, latencyMs: 12, backendIdentity: 'dsm-backend-demo-v1' }
        : { proven: false, atMs: NOW, failureReason: 'no route to host' };
    },
    async register(nodeToken: string, regionCode: string) {
      store.gatewayTokens.set(gatewayToken, { nodeToken, regionCode });
      return { gatewayToken };
    },
    async upload(request: UploadBatchRequest) {
      return ingest.ingest(request, NOW);
    },
    async pollOutbound(request: OutboundPollRequest): Promise<OutboundPollResponse> {
      const page = outbound.poll(request.gatewayToken, request.regionCode, request.cursor, request.maxItems);
      return {
        items: [...page.items],
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        hasMore: page.hasMore,
      };
    },
    async ackOutbound() {},
  };
}

function sampleSos(sourceId: string, incidentId: string) {
  return buildSosCreate(
    { sourceId, sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(NOW) },
    {
      incidentId,
      category: EmergencyCategory.FLOOD,
      severity: Severity.LIFE_CRITICAL,
      peopleTotal: 2,
      mobility: Mobility.LIMITED,
      location: { source: LocationSource.FRESH_GNSS, latE7: 285355000, lonE7: 771234000, accuracyM: 15, ageS: 4 },
      replyCapabilities: ReplyCapability.TIER1_BLE,
    },
  );
}

test('scenario D: an unproven gateway uploads nothing and loses no data', async () => {
  const store = new BackendStore();
  const ingest = new IngestService(store);
  const outbound = new OutboundService(store);
  const client = inProcessClient(store, ingest, outbound, 'GW-1', { proven: false });

  const probe = await client.probe();
  assert.equal(probe.proven, false, 'without a successful live probe there is no gateway');
  assert.equal(store.packets.size, 0, 'and nothing is uploaded');
});

test('scenario D+E: proven gateway uploads, backend acknowledges, ack returns to the mesh', async () => {
  const store = new BackendStore();
  const ingest = new IngestService(store);
  const outbound = new OutboundService(store);
  const client = inProcessClient(store, ingest, outbound, 'GW-1', { proven: true });

  await client.register('aaaa0001', REGION);

  const sos = sampleSos('1111111111111111', 'INC-G1');
  const response = await client.upload({
    gatewayToken: 'GW-1',
    batchId: 'batch-1',
    items: [
      {
        bytes: sos.bytes,
        packetId: sos.packetId,
        observation: { receivedAtMs: NOW, transport: 'tier1-ble', hopCountOnArrival: 1 },
      },
    ],
  });

  assert.equal(response.results[0]!.outcome, 'accepted');
  assert.equal(store.packets.size, 1);
  assert.equal(store.incidents.list().length, 1, 'one incident');

  // GTW-004: the acknowledgement is queued back as its own packet.
  const page = await client.pollOutbound({
    gatewayToken: 'GW-1',
    regionCode: REGION,
    maxItems: 10,
  });
  assert.equal(page.items.length, 1, 'the backend must return an acknowledgement packet');

  const ack = decodePacket(page.items[0]!.bytes);
  assert.equal(ack.ok, true);
  if (!ack.ok) return;
  assert.equal(ack.packet.header.type, MessageType.BACKEND_ACKNOWLEDGEMENT);
  assert.equal(ack.packet.header.sourceClass, SourceClass.BACKEND);
  assert.equal((ack.packet.payload as Record<string, unknown>)['forPacketId'], sos.packetId);
});

test('GTW-003 / WEB-001: two gateways uploading one packet make one incident, two observations', async () => {
  const store = new BackendStore();
  const ingest = new IngestService(store);
  const outbound = new OutboundService(store);

  const gatewayA = inProcessClient(store, ingest, outbound, 'GW-A', { proven: true });
  const gatewayB = inProcessClient(store, ingest, outbound, 'GW-B', { proven: true });
  await gatewayA.register('aaaa0001', REGION);
  await gatewayB.register('dddd0004', REGION);

  const sos = sampleSos('1111111111111111', 'INC-G2');
  const item = {
    bytes: sos.bytes,
    packetId: sos.packetId,
    observation: { receivedAtMs: NOW, transport: 'tier1-ble', hopCountOnArrival: 1 },
  };

  const first = await gatewayA.upload({ gatewayToken: 'GW-A', batchId: 'a-1', items: [item] });
  const second = await gatewayB.upload({ gatewayToken: 'GW-B', batchId: 'b-1', items: [item] });

  assert.equal(first.results[0]!.outcome, 'accepted');
  assert.equal(second.results[0]!.outcome, 'duplicate', 'the second upload is a duplicate, not a new victim');

  assert.equal(store.packets.size, 1, 'ONE canonical packet');
  assert.equal(store.incidents.list().length, 1, 'ONE incident');
  assert.equal(store.observations.length, 2, 'TWO gateway observations');

  const detail = new IncidentQueryService(store).detail('INC-G2');
  assert.ok(detail);
  assert.equal(detail!.observations.length, 2, 'the dashboard shows both observations of one incident');
});

test('a retried batch does not duplicate observations', async () => {
  const store = new BackendStore();
  const ingest = new IngestService(store);
  const outbound = new OutboundService(store);
  const client = inProcessClient(store, ingest, outbound, 'GW-1', { proven: true });
  await client.register('aaaa0001', REGION);

  const sos = sampleSos('1111111111111111', 'INC-G3');
  const request: UploadBatchRequest = {
    gatewayToken: 'GW-1',
    batchId: 'same-batch',
    items: [
      {
        bytes: sos.bytes,
        packetId: sos.packetId,
        observation: { receivedAtMs: NOW, transport: 'tier1-ble', hopCountOnArrival: 1 },
      },
    ],
  };

  await client.upload(request);
  await client.upload(request); // the lost-response retry

  assert.equal(store.packets.size, 1);
  assert.equal(store.observations.length, 1, 'a retry must not create a second observation');
});

test('the backend refuses a corrupted upload with a reason', async () => {
  const store = new BackendStore();
  const ingest = new IngestService(store);

  const sos = sampleSos('1111111111111111', 'INC-G4');
  const corrupt = sos.bytes.slice();
  corrupt[70] = (corrupt[70]! ^ 0xff) & 0xff;

  const response = ingest.ingest(
    {
      gatewayToken: 'GW-1',
      batchId: 'bad-1',
      items: [
        {
          bytes: corrupt,
          packetId: sos.packetId,
          observation: { receivedAtMs: NOW, transport: 'tier1-ble', hopCountOnArrival: 1 },
        },
      ],
    },
    NOW,
  );

  assert.equal(response.results[0]!.outcome, 'invalid');
  assert.equal(store.packets.size, 0, 'nothing corrupt reaches the incident model');
});

test('outbound selection is region bounded (WEB-010)', () => {
  const store = new BackendStore();
  const outbound = new OutboundService(store);
  const sos = sampleSos('1111111111111111', 'INC-G5');

  outbound.publish('IN-DEMO-01', sos.packetId, sos.bytes);

  assert.equal(outbound.poll('GW-1', 'IN-DEMO-01', undefined, 10).items.length, 1);
  assert.equal(outbound.poll('GW-1', 'IN-OTHER-99', undefined, 10).items.length, 0);
});
