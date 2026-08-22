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
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { GATEWAY } from '@dsm/contracts';
import { BackendStore, IngestService, IncidentQueryService, OutboundService } from './services.js';
import { OperationsService, type CampaignCreateInput } from './operations.js';
import { ASSAM_SEED_VERSION, seedAssamDemo } from './demo-seed.js';
import { SqliteBackendStore } from './sqlite-store.js';

export const BACKEND_IDENTITY = 'dsm-backend-demo-v1';

export interface ServerOptions {
  readonly port?: number;
  readonly store?: BackendStore;
  readonly databasePath?: string;
  readonly seed?: boolean;
  readonly staticDir?: string;
}

export function createBackend(options: ServerOptions = {}) {
  const store = options.store ?? new SqliteBackendStore(options.databasePath ?? resolve(process.cwd(), 'data', 'assam-operations.sqlite'));
  const ingest = new IngestService(store);
  const incidents = new IncidentQueryService(store);
  const outbound = new OutboundService(store);
  const sqliteStore = store instanceof SqliteBackendStore ? store : undefined;
  const operations = sqliteStore ? new OperationsService(sqliteStore, ingest, outbound) : undefined;
  if (sqliteStore && (options.seed ?? true) && sqliteStore.responders.size === 0 && sqliteStore.packets.size === 0) {
    seedAssamDemo(sqliteStore, ingest);
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

    if (path === '/gateway/register') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
      const body = await readJson(req);
      const gatewayToken = `GW-${String(body['nodeToken'] ?? 'unknown')}`;
      store.registerGateway(gatewayToken, String(body['nodeToken'] ?? ''), String(body['regionCode'] ?? ''));
      return send(res, 200, { gatewayToken });
    }

    if (path === '/gateway/upload') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
      const body = await readJson(req);
      const items = (body['items'] as { packetId: string; bytesBase64: string; observation: unknown }[]) ?? [];
      if (items.length > GATEWAY.MAX_UPLOAD_BATCH) {
        return send(res, 413, { error: 'batch over limit' });
      }
      const response = ingest.ingest(
        {
          gatewayToken: String(body['gatewayToken'] ?? ''),
          batchId: String(body['batchId'] ?? ''),
          items: items.map((item) => ({
            packetId: item.packetId,
            bytes: new Uint8Array(Buffer.from(item.bytesBase64, 'base64')),
            observation: item.observation as never,
          })),
        },
        Date.now(),
      );
      return send(res, 200, response);
    }

    if (path === '/gateway/outbound') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
      const body = await readJson(req);
      const page = outbound.poll(
        String(body['gatewayToken'] ?? ''),
        String(body['regionCode'] ?? ''),
        body['cursor'] ? String(body['cursor']) : undefined,
        Math.min(Number(body['maxItems'] ?? GATEWAY.MAX_DOWNLOAD_BATCH), GATEWAY.MAX_DOWNLOAD_BATCH),
      );
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
      await readJson(req);
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
      const body = await readJson(req);
      const responder = operations.assignResponder(
        decodeURIComponent(assignMatch[1]!),
        String(body['incidentId'] ?? ''),
        String(body['dispatcherLabel'] ?? 'Assam Operations Coordinator'),
      );
      return send(res, 200, { responder });
    }

    if ((path === '/api/region/IN-AS/records' || path === '/api/region/IN-AS-DEMO/records') && req.method === 'GET') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      return send(res, 200, { records: operations.listRegionalRecords() });
    }

    const regionalMatch = path.match(/^\/api\/region\/(?:IN-AS|IN-AS-DEMO)\/records\/([^/]+)$/);
    if (regionalMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      const body = await readJson(req);
      return send(res, 200, {
        record: operations.updateRegionalRecord(decodeURIComponent(regionalMatch[1]!), String(body['state'] ?? 'unknown')),
      });
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
      const body = await readJson(req);
      return send(res, 201, { campaign: operations.createCampaign(campaignInput(body)) });
    }

    const campaignMatch = path.match(/^\/api\/campaigns\/([^/]+)$/);
    if (campaignMatch && req.method === 'PUT') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      const body = await readJson(req);
      return send(res, 200, { campaign: operations.updateCampaign(decodeURIComponent(campaignMatch[1]!), campaignInput(body)) });
    }

    const transitionMatch = path.match(/^\/api\/campaigns\/([^/]+)\/transition$/);
    if (transitionMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      const body = await readJson(req);
      return send(res, 200, {
        campaign: operations.transitionCampaign(decodeURIComponent(transitionMatch[1]!), String(body['state'] ?? 'draft') as never),
      });
    }

    const programMatch = path.match(/^\/api\/campaigns\/([^/]+)\/broadcast-program$/);
    if (programMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      return send(res, 200, { campaign: operations.prepareBroadcastProgram(decodeURIComponent(programMatch[1]!)) });
    }

    const receptionMatch = path.match(/^\/api\/campaigns\/([^/]+)\/broadcast-reception$/);
    if (receptionMatch && req.method === 'POST') {
      if (!operations) return send(res, 503, { error: 'operations storage unavailable' });
      const body = await readJson(req);
      const frames = Array.isArray(body['framesBase64'])
        ? body['framesBase64'].filter((value): value is string => typeof value === 'string')
        : [];
      return send(res, 200, {
        campaign: operations.verifyBroadcastReception(
          decodeURIComponent(receptionMatch[1]!),
          frames,
          String(body['receiverLabel'] ?? 'Web receiving station'),
          body['receptionTransport'] === 'tier2-mic' ? 'tier2-mic' : 'tier2-direct',
        ),
      });
    }

    if (path === '/api/gateway-audit' && req.method === 'GET') {
      return send(res, 200, {
        gateways: [...store.gatewayTokens.entries()].map(([gatewayToken, value]) => ({ gatewayToken, ...value })),
        observations: store.observations.slice(-100).reverse(),
        outbound: [...store.outbound.entries()].map(([regionCode, items]) => ({ regionCode, queued: items.length })),
      });
    }

    if (path === '/api/audit' && req.method === 'GET') {
      if (!sqliteStore) return send(res, 503, { error: 'operations storage unavailable' });
      return send(res, 200, { audit: sqliteStore.audit });
    }

    if (path === '/api/demo/reset' && req.method === 'POST') {
      if (!sqliteStore) return send(res, 503, { error: 'operations storage unavailable' });
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
    listen(port = options.port ?? 8787): Promise<number> {
      return new Promise((resolve) => {
        server.listen(port, () => resolve(port));
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
    'access-control-allow-headers': 'content-type',
  };
}

function campaignInput(body: Record<string, unknown>): CampaignCreateInput {
  return {
    title: typeof body['title'] === 'string' ? body['title'] : '',
    summary: typeof body['summary'] === 'string' ? body['summary'] : '',
    ...(typeof body['severity'] === 'number' ? { severity: body['severity'] } : {}),
    ...(body['dataType'] === 'official-alert' || body['dataType'] === 'check-in' || body['dataType'] === 'regional-record' ? { dataType: body['dataType'] } : {}),
    ...(typeof body['objectId'] === 'string' ? { objectId: body['objectId'] } : {}),
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
