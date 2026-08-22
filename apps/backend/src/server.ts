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
import { GATEWAY } from '@dsm/contracts';
import { BackendStore, IngestService, IncidentQueryService, OutboundService } from './services.js';

export const BACKEND_IDENTITY = 'dsm-backend-demo-v1';

export interface ServerOptions {
  readonly port?: number;
  readonly store?: BackendStore;
}

export function createBackend(options: ServerOptions = {}) {
  const store = options.store ?? new BackendStore();
  const ingest = new IngestService(store);
  const incidents = new IncidentQueryService(store);
  const outbound = new OutboundService(store);

  const server = createServer((req, res) => {
    void handle(req, res).catch((error) => send(res, 500, { error: String(error) }));
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    // --- live probe (GTW-001) --------------------------------------------
    if (path === '/health') {
      return send(res, 200, { identity: BACKEND_IDENTITY, atMs: Date.now() });
    }

    if (req.method !== 'POST' && !path.startsWith('/incidents')) {
      return send(res, 404, { error: 'not found' });
    }

    if (path === '/gateway/register') {
      const body = await readJson(req);
      const gatewayToken = `GW-${String(body['nodeToken'] ?? 'unknown')}`;
      store.gatewayTokens.set(gatewayToken, {
        nodeToken: String(body['nodeToken'] ?? ''),
        regionCode: String(body['regionCode'] ?? ''),
      });
      return send(res, 200, { gatewayToken });
    }

    if (path === '/gateway/upload') {
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
      await readJson(req);
      // The cursor is client-held; acking is what makes advancing it safe.
      return send(res, 200, { ok: true });
    }

    if (path === '/incidents') {
      return send(res, 200, { incidents: incidents.list() });
    }

    if (path.startsWith('/incidents/')) {
      const detail = incidents.detail(path.slice('/incidents/'.length));
      if (!detail) return send(res, 404, { error: 'unknown incident' });
      return send(res, 200, detail);
    }

    return send(res, 404, { error: 'not found' });
  }

  return {
    server,
    store,
    ingest,
    incidents,
    outbound,
    listen(port = options.port ?? 8787): Promise<number> {
      return new Promise((resolve) => {
        server.listen(port, () => resolve(port));
      });
    },
    close(): Promise<void> {
      return new Promise((resolve) => server.close(() => resolve()));
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
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}
