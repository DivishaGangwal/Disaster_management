/**
 * BACKEND HTTP SURFACE  (Hono router on node:http)
 *
 * Spec: 02-... "Conceptual online API obligations".
 *
 * Hono replaces the hand-rolled router for cleaner route matching and
 * typed request handling, while the service layer (IngestService, etc.)
 * remains unchanged.
 *
 * IMPORTANT: /health is what a phone's live probe hits (GTW-001). It must
 * return the exact `identity` string so a captive portal cannot pass as
 * the coordination backend.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { Database } from 'better-sqlite3';
import { GATEWAY } from '@dsm/contracts';
import { decodePacket } from '@dsm/codec';
import { SqliteBackendStore } from './store.js';
import { IngestService, IncidentQueryService, OutboundService } from './services.js';
import { responderRoutes } from './routes/responders.js';
import { resourceRoutes } from './routes/resources.js';
import { hazardRoutes } from './routes/hazards.js';
import { campaignRoutes } from './routes/campaigns.js';
import { demoRoutes } from './routes/demo.js';

export const BACKEND_IDENTITY = 'dsm-backend-demo-v1';

export interface ServerOptions {
  readonly port?: number;
  readonly db: Database;
}

export function createBackend(options: ServerOptions) {
  const store = new SqliteBackendStore(options.db);
  const ingest = new IngestService(store);
  const incidents = new IncidentQueryService(store);
  const outbound = new OutboundService(store);

  const app = new Hono();

  // ── Middleware: CORS for web dashboards ─────────────────────────────────
  app.use('*', async (c, next) => {
    await next();
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
  });
  app.options('*', (c) => c.body(null, 204));

  // ── 1. GET /health ── live probe (GTW-001) ──────────────────────────────
  app.get('/health', (c) =>
    c.json({ identity: BACKEND_IDENTITY, atMs: Date.now() }),
  );

  // ── 2. POST /gateway/register ────────────────────────────────────────────
  app.post('/gateway/register', async (c) => {
    const body = await c.req.json<{ nodeToken?: string; regionCode?: string }>();
    const nodeToken = String(body.nodeToken ?? 'unknown');
    const regionCode = String(body.regionCode ?? '');
    if (nodeToken.length > 8 || !/^[0-9a-f]{8}$/.test(nodeToken)) {
      return c.json({ error: 'invalid nodeToken' }, 400);
    }
    if (regionCode.length === 0 || regionCode.length > 32) {
      return c.json({ error: 'invalid regionCode' }, 400);
    }
    const gatewayToken = `GW-${nodeToken}`;
    store.registerGateway(gatewayToken, nodeToken, regionCode);
    return c.json({ gatewayToken });
  });

  // ── 3. POST /gateway/upload ── mesh → internet ────────────────────────────
  app.post('/gateway/upload', async (c) => {
    const body = await c.req.json<{
      gatewayToken?: string;
      batchId?: string;
      items?: { packetId: string; bytesBase64: string; observation: unknown }[];
    }>();
    const items = body.items ?? [];
    if (items.length > GATEWAY.MAX_UPLOAD_BATCH) {
      return c.json({ error: 'batch over limit' }, 413);
    }
    const response = ingest.ingest(
      {
        gatewayToken: String(body.gatewayToken ?? ''),
        batchId: String(body.batchId ?? ''),
        items: items.map((item) => ({
          packetId: item.packetId,
          bytes: new Uint8Array(Buffer.from(item.bytesBase64, 'base64')),
          observation: item.observation as never,
        })),
      },
      Date.now(),
    );
    return c.json(response);
  });

  // ── 4. POST /gateway/outbound ── internet → mesh ──────────────────────────
  app.post('/gateway/outbound', async (c) => {
    const body = await c.req.json<{
      gatewayToken?: string;
      regionCode?: string;
      cursor?: string;
      maxItems?: number;
    }>();
    const page = outbound.poll(
      String(body.gatewayToken ?? ''),
      String(body.regionCode ?? ''),
      body.cursor ? String(body.cursor) : undefined,
      Math.min(Number(body.maxItems ?? GATEWAY.MAX_DOWNLOAD_BATCH), GATEWAY.MAX_DOWNLOAD_BATCH),
    );
    return c.json({
      items: page.items.map((item) => ({
        packetId: item.packetId,
        bytesBase64: Buffer.from(item.bytes).toString('base64'),
      })),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    });
  });

  // ── 5. POST /gateway/outbound/ack ─────────────────────────────────────────
  app.post('/gateway/outbound/ack', async (c) => {
    // The client's cursor advances only after this succeeds (02-...).
    await c.req.json(); // consume body
    return c.json({ ok: true });
  });

  // ── 6. GET /incidents ─────────────────────────────────────────────────────
  app.get('/incidents', (c) =>
    c.json({ incidents: incidents.list() }),
  );

  // ── 7. GET /incidents/:incidentId ────────────────────────────────────────
  app.get('/incidents/:incidentId', (c) => {
    const detail = incidents.detail(c.req.param('incidentId'));
    if (!detail) return c.json({ error: 'unknown incident' }, 404);
    return c.json(detail);
  });

  // ── Planned endpoints (Workstream E) ─────────────────────────────────────
  app.route('/responders', responderRoutes(store, outbound));
  app.route('/', resourceRoutes(store, outbound));
  app.route('/', hazardRoutes(store, outbound));
  app.route('/campaigns', campaignRoutes(store, outbound));
  app.route('/demo', demoRoutes(store));

  return {
    app,
    store,
    ingest,
    incidents,
    outbound,
    listen(port = options.port ?? 8787): Promise<number> {
      return new Promise((resolve) => {
        serve({ fetch: app.fetch, port }, () => resolve(port));
      });
    },
  };
}
