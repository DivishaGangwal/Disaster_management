/**
 * BACKEND HTTP SURFACE  (zero runtime dependencies, node:http only)
 *
 * Spec: 02-... "Conceptual online API obligations".
 *
 * Kept dependency-free on purpose: Workstream E can swap in Express/Fastify
 * without changing the services, and everyone else can run the backend with
 * `node` alone while that decision is still open.
 *
 * IMPORTANT: /health is what a phone's live probe hits (GTW-001). It returns an
 * `identity` string so a captive portal answering 200 cannot pass as the
 * coordination backend.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { CAMPAIGN_TRANSITIONS, GATEWAY, type CampaignState } from '@dsm/contracts';
import { BackendStore, IngestService, IncidentQueryService, OutboundService } from './services.js';
import { OperationsService, type CampaignCreateInput } from './operations.js';
import { ASSAM_SEED_VERSION, ensureAssamDemoPopulation, seedAssamDemo } from './demo-seed.js';
import { SqliteBackendStore } from './sqlite-store.js';

export const BACKEND_IDENTITY = 'dsm-backend-demo-v1';

export interface ServerOptions {
  readonly port?: number;
  readonly store?: BackendStore;
  readonly databasePath?: string;
  readonly seed?: boolean;
  readonly staticDir?: string;
  readonly operationsKey?: string;
}

export function createBackend(options: ServerOptions = {}) {
  const store = options.store ?? new SqliteBackendStore(options.databasePath ?? resolve(process.cwd(), 'data', 'assam-operations.sqlite'));
  const ingest = new IngestService(store);
  const incidents = new IncidentQueryService(store);
  const outbound = new OutboundService(store);
  const sqliteStore = store instanceof SqliteBackendStore ? store : undefined;
  const operations = sqliteStore ? new OperationsService(sqliteStore, ingest, outbound) : undefined;
  const demoMode = process.env['DSM_DEMO_MODE'] !== 'false';
  const operationsKey = options.operationsKey ?? process.env['DSM_OPERATIONS_KEY'] ?? (demoMode ? 'assam-operations-demo' : '');
  if (sqliteStore && (options.seed ?? true) && sqliteStore.responders.size === 0 && sqliteStore.packets.size === 0) {
    seedAssamDemo(sqliteStore, ingest);
  } else if (sqliteStore && (options.seed ?? true) && demoMode) {
    ensureAssamDemoPopulation(sqliteStore, ingest);
  }
  const staticDir = options.staticDir ?? resolve(process.cwd(), 'apps', 'web-authority', 'dist');

  const server = createServer((req, res) => {
    void handle(req, res).catch((error) => send(res, 500, { error: String(error) }));
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    // --- live probe (GTW-001) --------------------------------------------
    if (path === '/health') {
      return send(res, 200, { identity: BACKEND_IDENTITY, atMs: Date.now() });
    }

    if (path === '/api/session' && req.method === 'POST') {
      const operatorLabel = authorizeOperations(req, operationsKey);
      if (!operatorLabel) return send(res, 401, { error: 'A valid operations key and operator name are required.' });
      return send(res, 200, { operatorLabel, roles: ['authority-publisher', 'coordinator', 'radio-broadcaster'], regionCode: 'IN-AS' });
    }

    if (path === '/gateway/register') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
      const body = await readJson(req);
      const nodeToken = typeof body['nodeToken'] === 'string' ? body['nodeToken'].trim() : '';
      const regionCode = typeof body['regionCode'] === 'string' ? body['regionCode'].trim() : '';
      if (!nodeToken || nodeToken.length > 64 || !/^IN-[A-Z0-9-]{2,24}$/.test(regionCode)) {
        return send(res, 400, { error: 'A bounded node token and valid region code are required.' });
      }
      const gatewayToken = `GW-${nodeToken}`;
      store.registerGateway(gatewayToken, nodeToken, regionCode);
      return send(res, 200, { gatewayToken });
    }

    if (path === '/gateway/upload') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
      const body = await readJson(req);
      const gatewayToken = String(body['gatewayToken'] ?? '');
      if (!store.gatewayTokens.has(gatewayToken)) return send(res, 401, { error: 'Register this gateway before uploading.' });
      const rawItems = Array.isArray(body['items']) ? body['items'] : [];
      if (!rawItems.every(isGatewayUploadItem)) return send(res, 400, { error: 'Every upload item must contain packetId, bytesBase64 and an observation.' });
      const items = rawItems as { packetId: string; bytesBase64: string; observation: unknown }[];
      if (items.length > GATEWAY.MAX_UPLOAD_BATCH) {
        return send(res, 413, { error: 'batch over limit' });
      }
      const response = ingest.ingest(
        {
          gatewayToken,
          batchId: String(body['batchId'] ?? ''),
          items: items.map((item) => ({
            packetId: item.packetId,
            bytes: new Uint8Array(Buffer.from(item.bytesBase64, 'base64')),
            observation: item.observation as never,
          })),
        },
        Date.now(),
      );
      store.recordGatewayTransfer({ gatewayToken, direction: 'upload', regionCode: store.gatewayTokens.get(gatewayToken)!.regionCode, itemCount: items.length, atMs: Date.now() });
      return send(res, 200, response);
    }

    if (path === '/gateway/outbound') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
      const body = await readJson(req);
      const gatewayToken = String(body['gatewayToken'] ?? '');
      const gateway = store.gatewayTokens.get(gatewayToken);
      if (!gateway) return send(res, 401, { error: 'Register this gateway before polling.' });
      const regionCode = String(body['regionCode'] ?? '');
      if (gateway.regionCode !== regionCode) return send(res, 403, { error: 'Gateway is not registered for the requested region.' });
      const page = outbound.poll(
        gatewayToken,
        regionCode,
        body['cursor'] ? String(body['cursor']) : undefined,
        Math.min(Number(body['maxItems'] ?? GATEWAY.MAX_DOWNLOAD_BATCH), GATEWAY.MAX_DOWNLOAD_BATCH),
      );
      store.recordGatewayTransfer({ gatewayToken, direction: 'download', regionCode, itemCount: page.items.length, atMs: Date.now() });
      return send(res, 200, {
        items: page.items.map((item) => ({
          packetId: item.packetId,
          bytesBase64: Buffer.from(item.bytes).toString('base64'),
        })),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      });
    }

    if (path === '/gateway/outbound/ack') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
      const body = await readJson(req);
      const gatewayToken = String(body['gatewayToken'] ?? '');
      const gateway = store.gatewayTokens.get(gatewayToken);
      if (!gateway) return send(res, 401, { error: 'Register this gateway before acknowledging downloads.' });
      if (typeof body['cursor'] !== 'string' || !Array.isArray(body['packetIds'])) return send(res, 400, { error: 'A cursor and packet ID list are required.' });
      store.recordGatewayTransfer({ gatewayToken, direction: 'ack', regionCode: gateway.regionCode, itemCount: body['packetIds'].length, atMs: Date.now() });
      // The cursor is client-held; acking is what makes advancing it safe.
      return send(res, 200, { ok: true });
    }

    if ((path === '/incidents' || path === '/api/incidents') && req.method === 'GET') {
      return send(res, 200, { incidents: incidents.list() });
    }

    if ((path.startsWith('/incidents/') || path.startsWith('/api/incidents/')) && req.method === 'GET') {
      const prefix = path.startsWith('/api/') ? '/api/incidents/' : '/incidents/';
      const detail = incidents.detail(path.slice(prefix.length));
      if (!detail) return send(res, 404, { error: 'unknown incident' });
      return send(res, 200, detail);
    }

    if (path === '/api/overview' && req.method === 'GET') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      return send(res, 200, operations.overview());
    }

    if (path === '/api/responders' && req.method === 'GET') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      return send(res, 200, { responders: operations.listResponders() });
    }

    const assignMatch = path.match(/^\/api\/responders\/([^/]+)\/assign$/);
    if (assignMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      const operatorLabel = authorizeOperations(req, operationsKey);
      if (!operatorLabel) return send(res, 401, { error: 'Operator session required.' });
      const body = await readJson(req);
      const responder = operations.assignResponder(
        decodeURIComponent(assignMatch[1]!),
        String(body['incidentId'] ?? ''),
        operatorLabel,
      );
      return send(res, 200, { responder });
    }

    const responderStateMatch = path.match(/^\/api\/responders\/([^/]+)\/state$/);
    if (responderStateMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      const operatorLabel = authorizeOperations(req, operationsKey);
      if (!operatorLabel) return send(res, 401, { error: 'Operator session required.' });
      const body = await readJson(req);
      const action = body['action'];
      if (!['accepted', 'en-route', 'arrived', 'resolved'].includes(String(action))) {
        return send(res, 400, { error: 'Invalid responder action.' });
      }
      return send(res, 200, {
        responder: operations.updateResponderState(
          decodeURIComponent(responderStateMatch[1]!),
          action as 'accepted' | 'en-route' | 'arrived' | 'resolved',
          operatorLabel,
        ),
      });
    }

    if ((path === '/api/region/IN-AS/records' || path === '/api/region/IN-AS-DEMO/records') && req.method === 'GET') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      return send(res, 200, { records: operations.listRegionalRecords() });
    }

    if ((path === '/api/region/IN-AS/records' || path === '/api/region/IN-AS-DEMO/records') && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      if (!authorizeOperations(req, operationsKey)) return send(res, 401, { error: 'Operator session required.' });
      const body = await readJson(req);
      return send(res, 201, { record: operations.upsertRegionalCentre(regionalRecordInput(body)) });
    }

    const regionalMatch = path.match(/^\/api\/region\/(?:IN-AS|IN-AS-DEMO)\/records\/([^/]+)$/);
    if (regionalMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      if (!authorizeOperations(req, operationsKey)) return send(res, 401, { error: 'Operator session required.' });
      const body = await readJson(req);
      const objectId = decodeURIComponent(regionalMatch[1]!);
      const hasLocationOrIdentity = ['kind', 'name', 'district', 'latE7', 'lonE7'].some((key) => body[key] !== undefined);
      const current = operations.listRegionalRecords().find((record) => record.objectId === objectId);
      if (hasLocationOrIdentity) {
        if (!current) return send(res, 404, { error: 'unknown regional object' });
        return send(res, 200, { record: operations.upsertRegionalCentre(regionalRecordInput({ ...current, ...body, objectId })) });
      }
      return send(res, 200, { record: operations.updateRegionalRecord(objectId, String(body['state'] ?? 'unknown')) });
    }

    // District-scoped routing over the same RegionalRecord.district field the
    // /api/region/IN-AS routes already write. No new data model: this is only
    // a district-scoped view over the same records. Reads remain available to
    // the console; writes require the same operator session as IN-AS writes.
    const districtRecordsMatch = path.match(/^\/api\/districts\/([^/]+)\/records$/);
    if (districtRecordsMatch && req.method === 'GET') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      const districtId = decodeURIComponent(districtRecordsMatch[1]!);
      const records = operations.listRegionalRecords().filter((record) => record.district === districtId);
      return send(res, 200, { records });
    }

    if (districtRecordsMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      if (!authorizeOperations(req, operationsKey)) return send(res, 401, { error: 'Operator session required.' });
      const districtId = decodeURIComponent(districtRecordsMatch[1]!);
      const body = await readJson(req);
      return send(res, 201, { record: operations.upsertRegionalCentre({ ...regionalRecordInput(body), district: districtId }) });
    }

    if (path === '/api/campaigns' && req.method === 'GET') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      return send(res, 200, { campaigns: operations.listCampaigns() });
    }

    if (path === '/api/packets' && req.method === 'GET') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      return send(res, 200, { packets: operations.packetStream() });
    }

    if (path === '/api/campaigns' && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      if (!authorizeOperations(req, operationsKey)) return send(res, 401, { error: 'Operator session required.' });
      const body = await readJson(req);
      return send(res, 201, { campaign: operations.createCampaign(campaignInput(body)) });
    }

    const campaignMatch = path.match(/^\/api\/campaigns\/([^/]+)$/);
    if (campaignMatch && req.method === 'PUT') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      if (!authorizeOperations(req, operationsKey)) return send(res, 401, { error: 'Operator session required.' });
      const body = await readJson(req);
      return send(res, 200, { campaign: operations.updateCampaign(decodeURIComponent(campaignMatch[1]!), campaignInput(body)) });
    }

    const previewMatch = path.match(/^\/api\/campaigns\/([^/]+)\/preview$/);
    if (previewMatch && req.method === 'GET') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      return send(res, 200, { preview: operations.campaignPreview(decodeURIComponent(previewMatch[1]!)) });
    }

    const transitionMatch = path.match(/^\/api\/campaigns\/([^/]+)\/transition$/);
    if (transitionMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      if (!authorizeOperations(req, operationsKey)) return send(res, 401, { error: 'Operator session required.' });
      const body = await readJson(req);
      if (!isCampaignState(body['state'])) return send(res, 400, { error: 'Invalid campaign state.' });
      return send(res, 200, {
        campaign: operations.transitionCampaign(decodeURIComponent(transitionMatch[1]!), body['state']),
      });
    }

    const programMatch = path.match(/^\/api\/campaigns\/([^/]+)\/broadcast-program$/);
    if (programMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      if (!authorizeOperations(req, operationsKey)) return send(res, 401, { error: 'Operator session required.' });
      return send(res, 200, { campaign: operations.prepareBroadcastProgram(decodeURIComponent(programMatch[1]!)) });
    }

    const receptionMatch = path.match(/^\/api\/campaigns\/([^/]+)\/broadcast-reception$/);
    if (receptionMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      const operatorLabel = authorizeOperations(req, operationsKey);
      if (!operatorLabel) return send(res, 401, { error: 'Operator session required.' });
      const body = await readJson(req);
      const frames = Array.isArray(body['framesBase64'])
        ? body['framesBase64'].filter((value): value is string => typeof value === 'string')
        : [];
      return send(res, 200, {
        campaign: operations.verifyBroadcastReception(
          decodeURIComponent(receptionMatch[1]!),
          frames,
          operatorLabel,
          body['receptionTransport'] === 'tier2-mic' ? 'tier2-mic' : 'tier2-direct',
        ),
      });
    }

    const broadcastEventMatch = path.match(/^\/api\/campaigns\/([^/]+)\/broadcast-events$/);
    if (broadcastEventMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      const operatorLabel = authorizeOperations(req, operationsKey);
      if (!operatorLabel) return send(res, 401, { error: 'Operator session required.' });
      const body = await readJson(req);
      const event = body['event'];
      if (event !== 'exported' && event !== 'played') return send(res, 400, { error: 'Invalid broadcast event.' });
      return send(res, 200, {
        campaign: operations.recordBroadcastEvent(decodeURIComponent(broadcastEventMatch[1]!), event, operatorLabel),
      });
    }

    if (path === '/api/gateway-audit' && req.method === 'GET') {
      return send(res, 200, {
        gateways: [...store.gatewayTokens.entries()].map(([gatewayToken, value]) => ({ gatewayToken, ...value })),
        observations: store.observations.slice(-100).reverse(),
        transfers: store.gatewayTransfers.slice(0, 200),
        outbound: [...store.outbound.entries()].map(([regionCode, items]) => ({ regionCode, queued: items.length })),
      });
    }

    if (path === '/api/audit' && req.method === 'GET') {
      if (!sqliteStore) return send(res, 503, { error: 'operations storage unavailable' });
      return send(res, 200, { audit: sqliteStore.audit });
    }

    if (path === '/api/demo/reset' && req.method === 'POST') {
      if (!sqliteStore) return send(res, 503, { error: 'operations storage unavailable' });
      if (!authorizeOperations(req, operationsKey)) return send(res, 401, { error: 'Operator session required.' });
      if (process.env['DSM_DEMO_MODE'] === 'false') return send(res, 403, { error: 'demo reset disabled' });
      sqliteStore.resetAll();
      seedAssamDemo(sqliteStore, ingest);
      return send(res, 200, { ok: true, seedVersion: ASSAM_SEED_VERSION });
    }

    if (req.method === 'GET' && !path.startsWith('/api/') && serveStatic(res, path, staticDir)) return;

    return send(res, 404, { error: 'not found' });
  }

  return {
    server,
    store,
    ingest,
    incidents,
    outbound,
    operations,
    listen(port = options.port ?? 8787, host?: string): Promise<number> {
      return new Promise((resolve) => {
        server.listen(port, host, () => {
          const address = server.address();
          resolve(typeof address === 'object' && address ? address.port : port);
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve) => server.close(() => {
        sqliteStore?.closeDatabase();
        resolve();
      }));
    },
  };
}

function regionalRecordInput(body: Record<string, unknown>) {
  return {
    ...(typeof body['objectId'] === 'string' ? { objectId: body['objectId'] } : {}),
    kind: String(body['kind'] ?? 'shelter') as 'shelter' | 'medical' | 'food-water' | 'safe-zone',
    name: String(body['name'] ?? ''),
    district: String(body['district'] ?? ''),
    latE7: Math.round(Number(body['latE7'])),
    lonE7: Math.round(Number(body['lonE7'])),
    state: String(body['state'] ?? 'open'),
  };
}

function isGatewayUploadItem(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const observation = item['observation'];
  return typeof item['packetId'] === 'string' &&
    typeof item['bytesBase64'] === 'string' &&
    Boolean(observation && typeof observation === 'object');
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    // Bound the request BEFORE allocating more (INT-001 applies server-side too).
    if (total > GATEWAY.MAX_BATCH_BYTES * 2) throw new Error('request body over limit');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...corsHeaders(),
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,x-operations-key,x-operator-label',
  };
}

function authorizeOperations(req: IncomingMessage, expectedKey: string): string | undefined {
  const suppliedKey = req.headers['x-operations-key'];
  const suppliedLabel = req.headers['x-operator-label'];
  if (!expectedKey || typeof suppliedKey !== 'string' || typeof suppliedLabel !== 'string') return undefined;
  const expected = Buffer.from(expectedKey);
  const supplied = Buffer.from(suppliedKey);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return undefined;
  const operatorLabel = suppliedLabel.trim();
  return operatorLabel.length >= 2 && operatorLabel.length <= 48 ? operatorLabel : undefined;
}

function isCampaignState(value: unknown): value is CampaignState {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CAMPAIGN_TRANSITIONS, value);
}

function campaignInput(body: Record<string, unknown>): CampaignCreateInput {
  return {
    title: typeof body['title'] === 'string' ? body['title'] : '',
    summary: typeof body['summary'] === 'string' ? body['summary'] : '',
    ...(typeof body['severity'] === 'number' ? { severity: body['severity'] } : {}),
    ...(typeof body['category'] === 'number' ? { category: body['category'] } : {}),
    ...(typeof body['instruction'] === 'number' ? { instruction: body['instruction'] } : {}),
    ...(body['dataType'] === 'official-alert' || body['dataType'] === 'regional-record' ? { dataType: body['dataType'] } : {}),
    ...(typeof body['objectId'] === 'string' ? { objectId: body['objectId'] } : {}),
    ...(typeof body['latE7'] === 'number' ? { latE7: body['latE7'] } : {}),
    ...(typeof body['lonE7'] === 'number' ? { lonE7: body['lonE7'] } : {}),
    ...(typeof body['radiusM'] === 'number' ? { radiusM: body['radiusM'] } : {}),
    ...(body['clearLocation'] === true ? { clearLocation: true } : {}),
    ...(body['profile'] === 'audible-fast' || body['profile'] === 'audible-normal' || body['profile'] === 'ultrasound-normal'
      ? { profile: body['profile'] }
      : {}),
  };
}

function serveStatic(res: ServerResponse, path: string, staticDir: string): boolean {
  if (!existsSync(staticDir)) return false;
  const requested = path === '/' ? 'index.html' : path.replace(/^\//, '');
  const candidate = resolve(staticDir, requested);
  const safe = candidate.startsWith(resolve(staticDir));
  const file = safe && existsSync(candidate) ? candidate : resolve(staticDir, 'index.html');
  if (!existsSync(file)) return false;
  const extension = extname(file);
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };
  const body = readFileSync(file);
  res.writeHead(200, {
    'content-type': types[extension] ?? 'application/octet-stream',
    'content-length': body.byteLength,
    'cache-control': extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
  });
  res.end(body);
  return true;
}
