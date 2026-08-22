/**
 * SQLITE-BACKED STORE
 *
 * Drop-in replacement for the old in-memory BackendStore.
 * Public API is identical — IngestService, IncidentQueryService, and
 * OutboundService need zero changes.
 *
 * Key design:
 *  - IncidentReducer stays in-memory for fast reads.
 *  - On startup, rehydrate() replays all stored packets through the reducer
 *    so incident state survives process restarts (fixes OFF-003).
 *  - packets and observations are proxied through the DB.
 *  - gatewayTokens stays as a Map (small, always reloaded on startup).
 */

import Database from 'better-sqlite3';
import { decodePacket, toEpochS } from '@dsm/codec';
import { IncidentReducer } from '@dsm/incident';
import type { PacketId } from '@dsm/contracts';

export interface StoredCanonicalPacket {
  readonly packetId: PacketId;
  readonly bytes: Uint8Array;
  readonly digest: string;
  readonly firstSeenAtMs: number;
}

export interface GatewayObservation {
  readonly packetId: PacketId;
  readonly gatewayToken: string;
  readonly receivedAtMs: number;
  readonly uploadedAtMs: number;
  readonly hopCountOnArrival: number;
  readonly transport: string;
}

// ---------------------------------------------------------------------------
// Proxied collections — same shape as the old Map/Array but backed by SQLite
// ---------------------------------------------------------------------------

class SqlitePacketMap {
  constructor(private readonly db: Database.Database) {}

  get size(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM packets').get() as { n: number };
    return row.n;
  }

  has(packetId: PacketId): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM packets WHERE packet_id = ?')
      .get(packetId);
    return row !== undefined;
  }

  get(packetId: PacketId): StoredCanonicalPacket | undefined {
    const row = this.db
      .prepare('SELECT packet_id, bytes_b64, payload_digest, first_seen_at_ms FROM packets WHERE packet_id = ?')
      .get(packetId) as { packet_id: string; bytes_b64: string; payload_digest: string; first_seen_at_ms: number } | undefined;
    if (!row) return undefined;
    return {
      packetId: row.packet_id as PacketId,
      bytes: Buffer.from(row.bytes_b64, 'base64'),
      digest: row.payload_digest,
      firstSeenAtMs: row.first_seen_at_ms,
    };
  }

  set(packetId: PacketId, value: Omit<StoredCanonicalPacket, 'packetId'> & { messageType?: number; streamId?: string }): void {
    const bytesB64 = Buffer.from(value.bytes).toString('base64');
    // Decode the packet to extract message_type and stream_id for querying
    const decoded = decodePacket(value.bytes);
    const messageType = decoded.ok ? decoded.packet.header.type : 0;
    const streamId = decoded.ok ? (decoded.packet.streamId ?? null) : null;

    this.db.prepare(`
      INSERT OR IGNORE INTO packets (packet_id, bytes_b64, payload_digest, stream_id, message_type, first_seen_at_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(packetId, bytesB64, value.digest, streamId, messageType, value.firstSeenAtMs);
  }

  *entries(): IterableIterator<[PacketId, StoredCanonicalPacket]> {
    const rows = this.db
      .prepare('SELECT packet_id, bytes_b64, payload_digest, first_seen_at_ms FROM packets ORDER BY first_seen_at_ms')
      .all() as { packet_id: string; bytes_b64: string; payload_digest: string; first_seen_at_ms: number }[];
    for (const row of rows) {
      yield [
        row.packet_id as PacketId,
        {
          packetId: row.packet_id as PacketId,
          bytes: Buffer.from(row.bytes_b64, 'base64'),
          digest: row.payload_digest,
          firstSeenAtMs: row.first_seen_at_ms,
        },
      ];
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

class SqliteObservationArray {
  constructor(private readonly db: Database.Database) {}

  get length(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM observations').get() as { n: number };
    return row.n;
  }

  push(obs: GatewayObservation & { batchId: string }): void {
    this.db.prepare(`
      INSERT INTO observations (packet_id, gateway_token, received_at_ms, uploaded_at_ms, hop_count, transport, batch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      obs.packetId,
      obs.gatewayToken,
      obs.receivedAtMs,
      obs.uploadedAtMs,
      obs.hopCountOnArrival,
      obs.transport,
      obs.batchId,
    );
  }

  filter(predicate: (obs: GatewayObservation) => boolean): GatewayObservation[] {
    return this.all().filter(predicate);
  }

  all(): GatewayObservation[] {
    const rows = this.db.prepare(`
      SELECT packet_id, gateway_token, received_at_ms, uploaded_at_ms, hop_count, transport
      FROM observations
    `).all() as { packet_id: string; gateway_token: string; received_at_ms: number; uploaded_at_ms: number; hop_count: number; transport: string }[];
    return rows.map((r) => ({
      packetId: r.packet_id as PacketId,
      gatewayToken: r.gateway_token,
      receivedAtMs: r.received_at_ms,
      uploadedAtMs: r.uploaded_at_ms,
      hopCountOnArrival: r.hop_count,
      transport: r.transport,
    }));
  }
}

// ---------------------------------------------------------------------------
// SqliteBackendStore — same public API as the old BackendStore
// ---------------------------------------------------------------------------

export class SqliteBackendStore {
  readonly packets: SqlitePacketMap;
  readonly observations: SqliteObservationArray;
  readonly incidents: IncidentReducer;
  readonly gatewayTokens = new Map<string, { nodeToken: string; regionCode: string }>();

  readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.packets = new SqlitePacketMap(db);
    this.observations = new SqliteObservationArray(db);
    this.incidents = new IncidentReducer();
    this.rehydrate();
  }

  /**
   * Replays all stored packets through the IncidentReducer on startup so that
   * incident state is correct after a process restart (fixes OFF-003).
   */
  private rehydrate(): void {
    // Also reload gateway tokens
    const tokenRows = this.db.prepare(`
      SELECT gateway_token, node_token, region_code FROM gateway_tokens
    `).all() as { gateway_token: string; node_token: string; region_code: string }[];
    for (const row of tokenRows) {
      this.gatewayTokens.set(row.gateway_token, { nodeToken: row.node_token, regionCode: row.region_code });
    }

    // Replay packets into IncidentReducer in insertion order
    const packetRows = this.db.prepare(`
      SELECT bytes_b64 FROM packets ORDER BY first_seen_at_ms ASC
    `).all() as { bytes_b64: string }[];

    for (const row of packetRows) {
      const bytes = Buffer.from(row.bytes_b64, 'base64');
      const decoded = decodePacket(bytes);
      if (decoded.ok) {
        this.incidents.apply(decoded.packet, { localSourceId: 'backend' });
      }
    }
  }

  // ------------------------------------------------------------------
  // Idempotency (seen_batches table)
  // ------------------------------------------------------------------

  isDuplicateBatch(batchId: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM seen_batches WHERE batch_id = ?').get(batchId);
    return row !== undefined;
  }

  rememberBatch(batchId: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO seen_batches (batch_id, seen_at_ms) VALUES (?, ?)
    `).run(batchId, Date.now());
  }

  // ------------------------------------------------------------------
  // Gateway token persistence
  // ------------------------------------------------------------------

  registerGateway(gatewayToken: string, nodeToken: string, regionCode: string): void {
    this.gatewayTokens.set(gatewayToken, { nodeToken, regionCode });
    this.db.prepare(`
      INSERT OR REPLACE INTO gateway_tokens (gateway_token, node_token, region_code, registered_at)
      VALUES (?, ?, ?, ?)
    `).run(gatewayToken, nodeToken, regionCode, Date.now());
  }

  // ------------------------------------------------------------------
  // Outbound queue
  // ------------------------------------------------------------------

  enqueueOutbound(regionCode: string, packetId: PacketId, bytes: Uint8Array): void {
    const bytesB64 = Buffer.from(bytes).toString('base64');
    // INSERT OR IGNORE: idempotent — same packet cannot be queued twice per region
    this.db.prepare(`
      INSERT OR IGNORE INTO outbound_queue (region_code, packet_id, bytes_b64, queued_at_ms)
      VALUES (?, ?, ?, ?)
    `).run(regionCode, packetId, bytesB64, Date.now());
  }

  readOutbound(regionCode: string, cursor: string | undefined, max: number) {
    const after = cursor ? Number.parseInt(cursor, 10) : 0;
    const rows = this.db.prepare(`
      SELECT seq, packet_id, bytes_b64
      FROM outbound_queue
      WHERE region_code = ? AND seq > ?
      ORDER BY seq ASC
      LIMIT ?
    `).all(regionCode, after, max + 1) as { seq: number; packet_id: string; bytes_b64: string }[];

    const hasMore = rows.length > max;
    const page = rows.slice(0, max);
    const last = page[page.length - 1];

    return {
      items: page.map((r) => ({
        packetId: r.packet_id as PacketId,
        bytes: Buffer.from(r.bytes_b64, 'base64') as unknown as Uint8Array,
      })),
      nextCursor: last ? String(last.seq) : cursor,
      hasMore,
    };
  }

  // ------------------------------------------------------------------
  // Observation helper (adds batchId that the old array push didn't need)
  // ------------------------------------------------------------------

  pushObservation(obs: GatewayObservation, batchId: string): void {
    (this.observations as SqliteObservationArray).push({ ...obs, batchId });
  }
}
