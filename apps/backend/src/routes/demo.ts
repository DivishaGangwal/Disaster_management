/**
 * DEMO RESET ROUTE  (Planned — non-production only)
 *
 * Spec: API-SCHEMA.md "Planned endpoints — POST /demo/reset"
 *
 * Controlled by DEMO_MODE=true environment variable.
 * Returns 403 in any other environment.
 *
 * Restores the database to the initial demo state:
 *   - Clears all packets, observations, batches, queue, tokens, assignments, campaigns
 *   - Re-seeds the demo responder roster from DEMO_RESET_CHECKLIST
 */

import { Hono } from 'hono';
import type { SqliteBackendStore } from '../store.js';
import { clearAndReseed } from '../seed/demo-actors.js';

export function demoRoutes(store: SqliteBackendStore) {
  const app = new Hono();

  // POST /demo/reset
  app.post('/reset', (c) => {
    if (process.env['DEMO_MODE'] !== 'true') {
      return c.json({ error: 'POST /demo/reset is only available in DEMO_MODE=true' }, 403);
    }

    const db = (store as unknown as { db: import('better-sqlite3').Database }).db;
    clearAndReseed(db);

    return c.json({
      ok: true,
      seededAtMs: Date.now(),
      message: 'Database cleared and demo data re-seeded. Restart the server to rebuild the in-memory incident index.',
    });
  });

  return app;
}
