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
  // Demo seed disabled — backend starts empty, real data only.
  // if (sqliteStore && (options.seed ?? true) && sqliteStore.responders.size === 0 && sqliteStore.packets.size === 0) {
  //   seedAssamDemo(sqliteStore, ingest);
  // }
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

    // --- operations dashboard (served inline, no build step) -------------
    if (path === '/dashboard') {
      const html = buildDashboardHtml();
      res.writeHead(200, { ...corsHeaders(), 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(html), 'cache-control': 'no-store' });
      res.end(html);
      return;
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
    ...(body['dataType'] === 'official-alert' || body['dataType'] === 'regional-record' ? { dataType: body['dataType'] } : {}),
    ...(typeof body['objectId'] === 'string' ? { objectId: body['objectId'] } : {}),
    ...(typeof body['latE7'] === 'number' ? { latE7: body['latE7'] } : {}),
    ...(typeof body['lonE7'] === 'number' ? { lonE7: body['lonE7'] } : {}),
    ...(typeof body['radiusM'] === 'number' ? { radiusM: body['radiusM'] } : {}),
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

function buildDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Guardian — Operations Dashboard</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
  :root {
    --green: #a1d494; --green-dark: #2D5A27; --red: #FF3B30; --yellow: #FFD60A;
    --bg: #000; --bg2: #0a0a0a; --bg3: #111; --border: #222; --text: #fff; --muted: #888;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  header { display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--bg2); }
  header h1 { font-size: 20px; font-weight: 800; letter-spacing: 3px; color: var(--green); }
  header .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .status-bar { display: flex; gap: 24px; padding: 10px 24px; background: var(--bg3); border-bottom: 1px solid var(--border); font-size: 12px; font-weight: 700; letter-spacing: 1px; }
  .status-bar span { color: var(--muted); }
  .status-bar b { color: var(--green); margin-left: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; height: calc(100vh - 97px); }
  @media(max-width:900px){.grid{grid-template-columns:1fr;height:auto;}}
  .panel { border-right: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; }
  .panel:last-child { border-right: none; }
  .panel-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--bg2); }
  .panel-header h2 { font-size: 11px; font-weight: 800; letter-spacing: 2px; color: var(--muted); }
  .panel-header .count { font-size: 11px; font-weight: 700; color: var(--green); background: rgba(161,212,148,.1); padding: 2px 8px; border: 1px solid var(--green-dark); }
  .panel-body { flex: 1; overflow-y: auto; padding: 0; }
  .panel-body::-webkit-scrollbar { width: 4px; } .panel-body::-webkit-scrollbar-thumb { background: #333; }
  .incident-row { padding: 16px 20px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background .15s; }
  .incident-row:hover { background: var(--bg3); }
  .incident-row .id { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); }
  .incident-row .state { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 1px; padding: 2px 8px; border: 1px solid; margin-left: 8px; }
  .state-active { color: var(--red); border-color: var(--red); background: rgba(255,59,48,.08); }
  .state-accepted,.state-en-route { color: var(--yellow); border-color: var(--yellow); background: rgba(255,214,10,.08); }
  .state-arrived,.state-resolved { color: var(--green); border-color: var(--green); background: rgba(161,212,148,.08); }
  .state-created,.state-assigned { color: #aaa; border-color: #444; }
  .incident-row .meta { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .incident-row .loc { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #555; margin-top: 2px; }
  .packet-row { padding: 10px 20px; border-bottom: 1px solid #0e0e0e; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
  .packet-row .tag { display: inline-block; padding: 1px 6px; font-size: 10px; font-weight: 700; margin-right: 6px; }
  .tag-sos { background: rgba(255,59,48,.2); color: var(--red); }
  .tag-responder { background: rgba(161,212,148,.15); color: var(--green); }
  .tag-relay { background: rgba(255,214,10,.1); color: var(--yellow); }
  .tag-other { background: #1a1a1a; color: #666; }
  .packet-row .pid { color: #444; margin-left: 8px; }
  .packet-row .ts { float: right; color: #333; }
  .empty { padding: 40px; text-align: center; color: #333; font-size: 13px; }
  .btn { padding: 8px 18px; font-size: 11px; font-weight: 800; letter-spacing: 1px; border: 1px solid; cursor: pointer; transition: all .15s; }
  .btn-green { background: var(--green-dark); color: #fff; border-color: var(--green); }
  .btn-green:hover { background: var(--green); color: #000; }
  .btn-red { background: rgba(255,59,48,.15); color: var(--red); border-color: var(--red); }
  .btn-red:hover { background: var(--red); color: #fff; }
  .controls { display: flex; gap: 8px; align-items: center; }
  .refresh-spinner { width: 14px; height: 14px; border: 2px solid #333; border-top-color: var(--green); border-radius: 50%; animation: spin .7s linear infinite; display: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .detail-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.85); z-index: 100; align-items: center; justify-content: center; }
  .detail-overlay.open { display: flex; }
  .detail-box { background: var(--bg2); border: 1px solid var(--border); padding: 28px; max-width: 520px; width: 90%; max-height: 80vh; overflow-y: auto; }
  .detail-box h3 { font-size: 14px; font-weight: 800; letter-spacing: 2px; color: var(--green); margin-bottom: 16px; }
  .detail-box table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .detail-box td { padding: 8px 0; border-bottom: 1px solid var(--border); vertical-align: top; }
  .detail-box td:first-child { color: var(--muted); width: 40%; font-weight: 700; letter-spacing: .5px; }
  .detail-box td:last-child { font-family: 'JetBrains Mono', monospace; word-break: break-all; }
  .close-btn { float: right; background: none; border: 1px solid #333; color: #888; padding: 4px 10px; cursor: pointer; font-size: 12px; }
  .close-btn:hover { color: #fff; border-color: #fff; }
</style>
</head>
<body>
<header>
  <div class="dot"></div>
  <h1>GUARDIAN — OPERATIONS</h1>
  <div style="margin-left:auto;display:flex;gap:10px;align-items:center">
    <div class="refresh-spinner" id="spinner"></div>
    <button class="btn btn-green" onclick="refresh()">↻ REFRESH</button>
    <button class="btn btn-red" id="resetBtn" onclick="resetDemo()" style="display:none">⚠ RESET DEMO</button>
  </div>
</header>
<div class="status-bar">
  <div><span>INCIDENTS</span><b id="sbIncidents">—</b></div>
  <div><span>ACTIVE SOS</span><b id="sbActive" style="color:var(--red)">—</b></div>
  <div><span>GATEWAYS</span><b id="sbGw">—</b></div>
  <div><span>PACKETS</span><b id="sbPackets">—</b></div>
  <div><span>LAST UPDATE</span><b id="sbTime">—</b></div>
</div>
<div class="grid">
  <div class="panel">
    <div class="panel-header">
      <h2>LIVE INCIDENTS</h2>
      <div class="count" id="incCount">0</div>
    </div>
    <div class="panel-body" id="incidentList"><div class="empty">No incidents yet — waiting for SOS packets…</div></div>
  </div>
  <div class="panel">
    <div class="panel-header">
      <h2>PACKET STREAM</h2>
      <div class="count" id="pkCount">0</div>
    </div>
    <div class="panel-body" id="packetList"><div class="empty">No packets ingested yet…</div></div>
  </div>
</div>
<div class="detail-overlay" id="overlay" onclick="if(event.target===this)closeDetail()">
  <div class="detail-box">
    <button class="close-btn" onclick="closeDetail()">✕ CLOSE</button>
    <h3 id="detailTitle">INCIDENT DETAIL</h3>
    <table id="detailTable"></table>
  </div>
</div>
<script>
const BASE = window.location.origin;
let allIncidents = [];
let detail = null;

const STATE_COLORS = {
  active: 'state-active', created: 'state-created', accepted: 'state-accepted',
  'en-route': 'state-accepted', arrived: 'state-arrived', resolved: 'state-resolved',
  assigned: 'state-assigned', cancelled: 'state-created',
};

function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.round(s/60) + 'm ago';
  return Math.round(s/3600) + 'h ago';
}

function typeLabel(type) {
  if (!type) return ['UNKNOWN', 'tag-other'];
  const t = parseInt(type);
  if (t === 0x10 || t === 0x11 || t === 0x12) return ['SOS', 'tag-sos'];
  if (t >= 0x20 && t <= 0x25) return ['RESPONDER', 'tag-responder'];
  if (t >= 0x30 && t <= 0x31) return ['RECEIPT', 'tag-relay'];
  return ['0x'+t.toString(16).toUpperCase(), 'tag-other'];
}

function renderIncidents(list) {
  const el = document.getElementById('incidentList');
  document.getElementById('incCount').textContent = list.length;
  if (!list.length) { el.innerHTML = '<div class="empty">No incidents yet — waiting for SOS packets…</div>'; return; }
  el.innerHTML = list.map((inc, i) => {
    const sc = STATE_COLORS[inc.state] || 'state-created';
    const lat = inc.latE7 ? (inc.latE7/1e7).toFixed(4) : '—';
    const lon = inc.lonE7 ? (inc.lonE7/1e7).toFixed(4) : '—';
    const ago = inc.createdAtMs ? timeAgo(inc.createdAtMs) : '—';
    return '<div class="incident-row" onclick="showDetail('+i+')">' +
      '<div><span class="id">' + (inc.incidentId||'').slice(0,16) + '</span>' +
      '<span class="state ' + sc + '">' + (inc.state||'unknown').toUpperCase() + '</span></div>' +
      '<div class="meta">Category ' + (inc.category??'?') + ' · ' + (inc.peopleTotal||'?') + ' people · ' + ago + '</div>' +
      '<div class="loc">📍 ' + lat + ', ' + lon + '</div>' +
      '</div>';
  }).join('');
}

function renderPackets(list) {
  const el = document.getElementById('packetList');
  const limited = list.slice(0, 80);
  document.getElementById('pkCount').textContent = list.length;
  if (!limited.length) { el.innerHTML = '<div class="empty">No packets ingested yet…</div>'; return; }
  el.innerHTML = limited.map(p => {
    const [label, cls] = typeLabel(p.type);
    const ts = p.receivedAtMs ? new Date(p.receivedAtMs).toLocaleTimeString() : '—';
    return '<div class="packet-row"><span class="tag ' + cls + '">' + label + '</span>' +
      (p.packetId ? '<span class="pid">' + p.packetId.slice(0,12) + '…</span>' : '') +
      '<span class="ts">' + ts + '</span></div>';
  }).join('');
}

function showDetail(i) {
  const inc = allIncidents[i];
  if (!inc) return;
  document.getElementById('detailTitle').textContent = 'INCIDENT: ' + (inc.incidentId||'').slice(0,16);
  const rows = Object.entries(inc).map(([k,v]) =>
    '<tr><td>' + k + '</td><td>' + (typeof v === 'object' ? JSON.stringify(v,null,2) : String(v??'—')) + '</td></tr>'
  ).join('');
  document.getElementById('detailTable').innerHTML = rows;
  document.getElementById('overlay').classList.add('open');
}
function closeDetail() { document.getElementById('overlay').classList.remove('open'); }

async function refresh() {
  document.getElementById('spinner').style.display = 'block';
  try {
    const [incRes, pkRes, gwRes] = await Promise.all([
      fetch(BASE + '/incidents').then(r => r.json()).catch(() => ({ incidents: [] })),
      fetch(BASE + '/api/packets').then(r => r.json()).catch(() => ({ packets: [] })),
      fetch(BASE + '/api/gateway-audit').then(r => r.json()).catch(() => ({ gateways: [] })),
    ]);
    allIncidents = incRes.incidents || [];
    const packets = pkRes.packets || [];
    const gateways = gwRes.gateways || [];
    const active = allIncidents.filter(i => i.state === 'active' || i.state === 'created').length;

    document.getElementById('sbIncidents').textContent = allIncidents.length;
    document.getElementById('sbActive').textContent = active;
    document.getElementById('sbGw').textContent = gateways.length;
    document.getElementById('sbPackets').textContent = packets.length;
    document.getElementById('sbTime').textContent = new Date().toLocaleTimeString();

    renderIncidents(allIncidents);
    renderPackets(packets);

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      document.getElementById('resetBtn').style.display = '';
    }
  } catch(e) {
    console.error('Dashboard refresh error:', e);
  } finally {
    document.getElementById('spinner').style.display = 'none';
  }
}

async function resetDemo() {
  if (!confirm('Reset all demo data?')) return;
  await fetch(BASE + '/api/demo/reset', { method: 'POST' });
  await refresh();
}

// Auto-refresh every 5 seconds
refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
}

