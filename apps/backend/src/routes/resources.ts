/**
 * RESOURCE ROUTES  (Planned — Workstream E)
 *
 * Spec: API-SCHEMA.md "Planned endpoints — GET|POST /region/:regionCode/resources"
 *
 * GET  → active resource override packets stored in this backend
 * POST → emits a SHELTER / HOSPITAL_OR_MEDICAL_POST / FOOD_WATER / SAFE_ZONE packet
 *        into the outbound queue (internet → mesh).
 *
 * Body carries a STABLE COMPACT OBJECT ID — never a full record.
 * State changes happen by EMITTING PACKETS (Rule 3).
 */

import { Hono } from 'hono';
import { SourceClass, MessageType } from '@dsm/contracts';
import { buildResourceRecord, toEpochS } from '@dsm/codec';
import type { SqliteBackendStore } from '../store.js';
import type { OutboundService } from '../services.js';

// message_type values for resource packet types (from @dsm/contracts MessageType)
const RESOURCE_MESSAGE_TYPES: Record<string, number> = {
  SHELTER: MessageType.SHELTER,
  MEDICAL_POST: MessageType.MEDICAL_POST,
  FOOD_WATER: MessageType.FOOD_WATER,
  SAFE_ZONE: MessageType.SAFE_ZONE,
};

const ALLOWED_TYPES = Object.keys(RESOURCE_MESSAGE_TYPES) as (keyof typeof RESOURCE_MESSAGE_TYPES)[];

export function resourceRoutes(store: SqliteBackendStore, outbound: OutboundService) {
  const app = new Hono();
  const db = (store as unknown as { db: import('better-sqlite3').Database }).db;

  // GET /region/:regionCode/resources
  app.get('/region/:regionCode/resources', (c) => {
    const regionCode = c.req.param('regionCode');
    const typeValues = Object.values(RESOURCE_MESSAGE_TYPES).join(',');
    const rows = db.prepare(`
      SELECT packet_id, bytes_b64, first_seen_at_ms, message_type
      FROM packets
      WHERE message_type IN (${typeValues})
      ORDER BY first_seen_at_ms DESC
    `).all() as { packet_id: string; bytes_b64: string; first_seen_at_ms: number; message_type: number }[];

    return c.json({
      regionCode,
      resources: rows.map((r) => ({
        packetId: r.packet_id,
        messageType: r.message_type,
        firstSeenAtMs: r.first_seen_at_ms,
        bytesBase64: r.bytes_b64,
      })),
    });
  });

  // POST /region/:regionCode/resources
  app.post('/region/:regionCode/resources', async (c) => {
    const regionCode = c.req.param('regionCode');
    if (!regionCode || regionCode.length > 32) {
      return c.json({ error: 'invalid regionCode' }, 400);
    }

    const body = await c.req.json<{
      objectId?: string;
      type?: string;
      operationalState?: number;
      version?: number;
    }>();

    const objectId = String(body.objectId ?? '').trim();
    const resourceType = String(body.type ?? '').toUpperCase();

    if (!objectId) return c.json({ error: 'objectId required' }, 400);
    if (!ALLOWED_TYPES.includes(resourceType)) {
      return c.json({ error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` }, 400);
    }

    const msgType = RESOURCE_MESSAGE_TYPES[resourceType]!;
    const version = Number(body.version ?? 1);
    const nowMs = Date.now();

    // buildResourceRecord(ctx, type, objectId, version, payload)
    const packet = buildResourceRecord(
      { sourceId: 'bacc0000bacc0002', sourceClass: SourceClass.BACKEND, nowS: toEpochS(nowMs) },
      msgType,
      objectId,
      version,
      { operationalState: body.operationalState ?? 1 },
    );

    outbound.publish(regionCode, packet.packetId, packet.bytes);

    return c.json({ packetId: packet.packetId, type: resourceType, objectId });
  });

  return app;
}
