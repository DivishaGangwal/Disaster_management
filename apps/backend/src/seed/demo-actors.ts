/**
 * DEMO SEED DATA
 *
 * Pre-loads the database with demo responders and resources so the dashboards
 * have realistic data during the hackathon presentation.
 *
 * Called by:
 *   - POST /demo/reset  (clears and re-seeds)
 *   - Optionally at first startup if the responders table is empty
 *
 * ROL-003 / INT-004: provisionedByDemo must ALWAYS be 1 (true).
 * The UI must render it as "demo-provisioned", never "verified".
 */

import type Database from 'better-sqlite3';

export interface DemoResponder {
  responderRef: string;
  capabilities: string[];
  available: boolean;
}

export const DEMO_RESET_CHECKLIST = {
  region: 'IN-DEMO-01',
  responders: [
    { responderRef: 'RSP-1', capabilities: ['medical', 'first-aid'], available: true },
    { responderRef: 'RSP-2', capabilities: ['search', 'rescue'], available: true },
    { responderRef: 'RSP-3', capabilities: ['logistics', 'transport'], available: true },
    { responderRef: 'RSP-4', capabilities: ['medical', 'trauma'], available: false },
    { responderRef: 'RSP-5', capabilities: ['coordination'], available: true },
  ],
} as const;

export function seedDemoData(db: Database.Database): void {
  const insertResponder = db.prepare(`
    INSERT OR REPLACE INTO responders (responder_ref, capabilities_json, available, provisioned_demo)
    VALUES (?, ?, ?, 1)
  `);

  const seedAll = db.transaction(() => {
    for (const r of DEMO_RESET_CHECKLIST.responders) {
      insertResponder.run(r.responderRef, JSON.stringify(r.capabilities), r.available ? 1 : 0);
    }
  });

  seedAll();
}

export function clearAndReseed(db: Database.Database): void {
  const reset = db.transaction(() => {
    // Clear all dynamic data but keep the schema
    db.exec(`
      DELETE FROM observations;
      DELETE FROM packets;
      DELETE FROM seen_batches;
      DELETE FROM outbound_queue;
      DELETE FROM gateway_tokens;
      DELETE FROM assignments;
      DELETE FROM campaigns;
      DELETE FROM responders;
    `);
    seedDemoData(db);
  });
  reset();
}
