/**
 * HAZARD + ROUTE ROUTES  (Planned — Workstream E)
 *
 * Spec: API-SCHEMA.md "Planned endpoints — GET|POST /region/:regionCode/hazards|routes"
 *
 * Same pattern as resources: emits HAZARD or ROUTE_STATE packets into the
 * outbound queue. State changes happen BY EMITTING PACKETS (Rule 3).
 */

import { Hono } from 'hono';
import { SourceClass, MessageType, Severity, type SeverityValue } from '@dsm/contracts';
import { buildHazard, buildRouteState, toEpochS } from '@dsm/codec';
import type { SqliteBackendStore } from '../store.js';
import type { OutboundService } from '../services.js';

export function hazardRoutes(store: SqliteBackendStore, outbound: OutboundService) {
  const app = new Hono();
  const db = (store as unknown as { db: import('better-sqlite3').Database }).db;

  // GET /region/:regionCode/hazards
  app.get('/region/:regionCode/hazards', (c) => {
    const regionCode = c.req.param('regionCode');
    const rows = db.prepare(`
      SELECT packet_id, bytes_b64, first_seen_at_ms
      FROM packets
      WHERE message_type = ${MessageType.HAZARD}
      ORDER BY first_seen_at_ms DESC
    `).all() as { packet_id: string; bytes_b64: string; first_seen_at_ms: number }[];

    return c.json({
      regionCode,
      hazards: rows.map((r) => ({
        packetId: r.packet_id,
        firstSeenAtMs: r.first_seen_at_ms,
        bytesBase64: r.bytes_b64,
      })),
    });
  });

  // POST /region/:regionCode/hazards
  app.post('/region/:regionCode/hazards', async (c) => {
    const regionCode = c.req.param('regionCode');
    if (!regionCode || regionCode.length > 32) return c.json({ error: 'invalid regionCode' }, 400);

    const body = await c.req.json<{
      hazardId?: string;
      hazardType?: number;
      severity?: number;
      version?: number;
    }>();

    if (!body.hazardId) return c.json({ error: 'hazardId required' }, 400);

    const nowMs = Date.now();
    // buildHazard(ctx, hazardId, version, severity, payload)
    const packet = buildHazard(
      { sourceId: 'bacc0000bacc0003', sourceClass: SourceClass.BACKEND, nowS: toEpochS(nowMs) },
      body.hazardId,
      Number(body.version ?? 1),
      (body.severity ?? Severity.URGENT) as SeverityValue,
      { hazardType: body.hazardType ?? 0 },
    );
    outbound.publish(regionCode, packet.packetId, packet.bytes);
    return c.json({ packetId: packet.packetId });
  });

  // GET /region/:regionCode/routes
  app.get('/region/:regionCode/routes', (c) => {
    const regionCode = c.req.param('regionCode');
    const rows = db.prepare(`
      SELECT packet_id, bytes_b64, first_seen_at_ms
      FROM packets
      WHERE message_type = ${MessageType.ROUTE_STATE}
      ORDER BY first_seen_at_ms DESC
    `).all() as { packet_id: string; bytes_b64: string; first_seen_at_ms: number }[];

    return c.json({
      regionCode,
      routes: rows.map((r) => ({
        packetId: r.packet_id,
        firstSeenAtMs: r.first_seen_at_ms,
        bytesBase64: r.bytes_b64,
      })),
    });
  });

  // POST /region/:regionCode/routes
  app.post('/region/:regionCode/routes', async (c) => {
    const regionCode = c.req.param('regionCode');
    if (!regionCode || regionCode.length > 32) return c.json({ error: 'invalid regionCode' }, 400);

    const body = await c.req.json<{
      routeId?: string;
      state?: number;
      version?: number;
      reasonCategory?: number;
    }>();

    if (!body.routeId) return c.json({ error: 'routeId required' }, 400);

    const nowMs = Date.now();
    // buildRouteState(ctx, routeId, version, payload)
    const packet = buildRouteState(
      { sourceId: 'bacc0000bacc0003', sourceClass: SourceClass.BACKEND, nowS: toEpochS(nowMs) },
      body.routeId,
      Number(body.version ?? 1),
      { state: body.state ?? 1, reasonCategory: body.reasonCategory ?? 0 },
    );
    outbound.publish(regionCode, packet.packetId, packet.bytes);
    return c.json({ packetId: packet.packetId });
  });

  return app;
}
