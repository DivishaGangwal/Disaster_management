/**
 * DATABASE CONNECTION + SCHEMA MIGRATIONS
 *
 * Opens (or creates) a local SQLite file and runs all CREATE TABLE IF NOT EXISTS
 * migrations on startup in a single transaction. Idempotent — safe to run on
 * every startup.
 *
 * Pass ':memory:' as dbPath in tests for a clean in-memory database.
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';

let _db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (_db) return _db;
  const resolved = dbPath ?? join(process.cwd(), 'dsm.db');
  _db = new Database(resolved);
  // WAL mode: readers don't block writers and vice-versa.
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  runMigrations(_db);
  return _db;
}

/** For tests: create a fresh isolated in-memory database. */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    -- Gateway registrations
    CREATE TABLE IF NOT EXISTS gateway_tokens (
      gateway_token  TEXT PRIMARY KEY,
      node_token     TEXT NOT NULL,
      region_code    TEXT NOT NULL,
      registered_at  INTEGER NOT NULL
    );

    -- Canonical packets (one row per packet ID, first-writer wins)
    CREATE TABLE IF NOT EXISTS packets (
      packet_id         TEXT PRIMARY KEY,
      bytes_b64         TEXT NOT NULL,
      payload_digest    TEXT NOT NULL,
      stream_id         TEXT,
      message_type      INTEGER NOT NULL,
      first_seen_at_ms  INTEGER NOT NULL
    );

    -- Gateway observations: many per packet (GTW-003 / WEB-001)
    CREATE TABLE IF NOT EXISTS observations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      packet_id       TEXT NOT NULL,
      gateway_token   TEXT NOT NULL,
      received_at_ms  INTEGER NOT NULL,
      uploaded_at_ms  INTEGER NOT NULL,
      hop_count       INTEGER NOT NULL,
      transport       TEXT NOT NULL,
      batch_id        TEXT NOT NULL
    );

    -- Idempotency: a retried batch must not create duplicate observations
    CREATE TABLE IF NOT EXISTS seen_batches (
      batch_id    TEXT PRIMARY KEY,
      seen_at_ms  INTEGER NOT NULL
    );

    -- Outbound queue: packets waiting to be downloaded by a gateway
    CREATE TABLE IF NOT EXISTS outbound_queue (
      seq          INTEGER PRIMARY KEY AUTOINCREMENT,
      region_code  TEXT NOT NULL,
      packet_id    TEXT NOT NULL,
      bytes_b64    TEXT NOT NULL,
      queued_at_ms INTEGER NOT NULL
    );
    -- Idempotent: same packet cannot be queued twice for the same region
    CREATE UNIQUE INDEX IF NOT EXISTS idx_outbound_region_packet
      ON outbound_queue(region_code, packet_id);

    -- Demo-provisioned responders (Planned: Workstream E)
    CREATE TABLE IF NOT EXISTS responders (
      responder_ref      TEXT PRIMARY KEY,
      capabilities_json  TEXT NOT NULL,
      available          INTEGER NOT NULL DEFAULT 1,
      provisioned_demo   INTEGER NOT NULL DEFAULT 1
    );

    -- Responder-to-incident assignments (Planned: Workstream E)
    CREATE TABLE IF NOT EXISTS assignments (
      assignment_id    TEXT PRIMARY KEY,
      incident_id      TEXT NOT NULL,
      responder_ref    TEXT NOT NULL,
      dispatcher_label TEXT NOT NULL,
      created_at_ms    INTEGER NOT NULL,
      packet_id        TEXT
    );

    -- Tier 2 broadcast campaigns (Planned: Workstream E/F)
    CREATE TABLE IF NOT EXISTS campaigns (
      campaign_id      TEXT PRIMARY KEY,
      region_code      TEXT NOT NULL,
      state            TEXT NOT NULL DEFAULT 'draft',
      content_hash     TEXT NOT NULL,
      manifest_json    TEXT NOT NULL,
      created_at_ms    INTEGER NOT NULL,
      validated_at_ms  INTEGER,
      approved_at_ms   INTEGER,
      validated_hash   TEXT
    );
  `);
}
