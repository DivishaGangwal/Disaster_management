/**
 * RESPONDER ROUTES  (Planned — Workstream E)
 *
 * Spec: API-SCHEMA.md "Planned endpoints"
 * ROL-003 / INT-004: provisionedByDemo MUST be true.
 *   The UI must render it as "demo-provisioned", NEVER "verified".
 *
 * State changes happen by EMITTING PACKETS, never direct DB mutation
 * of incident state (API-SCHEMA.md Rules §3).
 */

import { Hono } from 'hono';
import { SourceClass, MessageType } from '@dsm/contracts';
import { buildResponderState, toEpochS } from '@dsm/codec';
import type { SqliteBackendStore } from '../store.js';
import type { OutboundService } from '../services.js';

export function responderRoutes(store: SqliteBackendStore, outbound: OutboundService) {
  const app = new Hono();

  // GET /responders
  app.get('/', (c) => {
    const rows = store['db' as never] as never;
    // Access the DB directly via the store's internal db reference
    const db = (store as unknown as { db: import('better-sqlite3').Database }).db;
    const responders = db.prepare(`
      SELECT responder_ref, capabilities_json, available, provisioned_demo
      FROM responders
      ORDER BY responder_ref
    `).all() as { responder_ref: string; capabilities_json: string; available: number; provisioned_demo: number }[];

    return c.json({
      responders: responders.map((r) => ({
        responderRef: r.responder_ref,
        capabilities: JSON.parse(r.capabilities_json) as string[],
        available: r.available === 1,
        // ROL-003 / INT-004: MUST be true; UI renders as "demo-provisioned" not "verified"
        provisionedByDemo: r.provisioned_demo === 1,
      })),
    });
  });

  // POST /responders/:ref/assign
  app.post('/:ref/assign', async (c) => {
    const responderRef = c.req.param('ref');
    const body = await c.req.json<{ incidentId?: string; dispatcherLabel?: string }>();

    const incidentId = String(body.incidentId ?? '').trim();
    const dispatcherLabel = String(body.dispatcherLabel ?? '').trim();

    if (!incidentId) return c.json({ error: 'incidentId required' }, 400);
    if (!dispatcherLabel) return c.json({ error: 'dispatcherLabel required' }, 400);
    if (dispatcherLabel.length > 48) return c.json({ error: 'dispatcherLabel too long' }, 400);

    // Verify the incident exists
    const incident = store.incidents.view(incidentId);
    if (!incident) return c.json({ error: 'unknown incident' }, 404);

    // Verify the responder exists
    const db = (store as unknown as { db: import('better-sqlite3').Database }).db;
    const responder = db.prepare('SELECT 1 FROM responders WHERE responder_ref = ?').get(responderRef);
    if (!responder) return c.json({ error: 'unknown responder' }, 404);

    // Emit a RESPONDER_ASSIGNED packet into the outbound queue.
    // State changes happen BY EMITTING PACKETS, never by mutating history (Rule 3).
    // buildResponderState: (ctx, type, incidentId, sequence, payload)
    const assignmentId = `ASG-${Date.now().toString(36).toUpperCase()}`;
    const nowMs = Date.now();
    const packet = buildResponderState(
      { sourceId: 'bacc0000bacc0001', sourceClass: SourceClass.BACKEND, nowS: toEpochS(nowMs) },
      MessageType.RESPONDER_ASSIGNED,
      incidentId,
      1,
      { assignmentId, responderRef, dispatcherLabel },
    );

    // Get the region from the gateway tokens (fall back to demo region)
    const regionCode = 'IN-DEMO-01';
    outbound.publish(regionCode, packet.packetId, packet.bytes);

    // Persist the assignment record
    db.prepare(`
      INSERT INTO assignments (assignment_id, incident_id, responder_ref, dispatcher_label, created_at_ms, packet_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(assignmentId, incidentId, responderRef, dispatcherLabel, nowMs, packet.packetId);

    return c.json({ assignmentId, packetId: packet.packetId });
  });

  return app;
}
