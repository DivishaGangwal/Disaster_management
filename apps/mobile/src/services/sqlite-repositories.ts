import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import {
  STORAGE,
  Priority,
  type AssembledFile,
  type CustodyRecord,
  type FileRepository,
  type FragmentRecord,
  type MapObjectRecord,
  type MapObjectRepository,
  type ObjectId,
  type PacketId,
  type PacketObservation,
  type PacketRepository,
  type PeerObservationRecord,
  type PeerRepository,
  type StoredPacket,
} from '@dsm/contracts';
import { decodePacket } from '@dsm/codec';

type PacketRow = {
  packet_id: string;
  bytes_b64: string;
  digest: string;
  stored_at_ms: number;
  retention_until_s: number;
  custody_json: string;
};

/** Durable repositories shared by the engine; all writes are parameterized. */
export async function openMobileRepositories(name = 'disaster-sos-mesh.sqlite') {
  const database = await openDatabaseAsync(name);
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS seen_packets(packet_id TEXT PRIMARY KEY, digest TEXT NOT NULL, seen_at_ms INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS packets(packet_id TEXT PRIMARY KEY, bytes_b64 TEXT NOT NULL, digest TEXT NOT NULL, stored_at_ms INTEGER NOT NULL, retention_until_s INTEGER NOT NULL, custody_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS observations(id INTEGER PRIMARY KEY AUTOINCREMENT, packet_id TEXT NOT NULL, body_json TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS observations_packet_idx ON observations(packet_id);
    CREATE TABLE IF NOT EXISTS fragments(object_id TEXT NOT NULL, fragment_index INTEGER NOT NULL, body_json TEXT NOT NULL, PRIMARY KEY(object_id, fragment_index));
    CREATE TABLE IF NOT EXISTS peers(peer_token TEXT PRIMARY KEY, body_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assembled_files(file_id TEXT PRIMARY KEY, body_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS map_objects(object_id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL, state INTEGER, lat_e7 INTEGER, lon_e7 INTEGER, as_of_s INTEGER NOT NULL, provenance TEXT NOT NULL);
  `);
  return {
    database,
    packets: new SQLitePacketRepository(database),
    peers: new SQLitePeerRepository(database),
    files: new SQLiteFileRepository(database),
    mapObjects: new SQLiteMapObjectRepository(database),
  };
}

export class SQLitePacketRepository implements PacketRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async insert(stored: StoredPacket, observation: PacketObservation, custody: CustodyRecord) {
    const packetId = stored.packet.header.packetId;
    const known = await this.database.getFirstAsync<{ digest: string }>('SELECT digest FROM seen_packets WHERE packet_id = ?', packetId);
    if (known) {
      if (known.digest !== stored.digest) return 'conflict' as const;
      if (await this.get(packetId)) await this.addObservation(observation);
      return 'duplicate' as const;
    }
    if (await this.count() >= STORAGE.MAX_STORED_PACKETS) {
      await this.evictExpired(Math.floor(Date.now() / 1000));
      if (await this.count() >= STORAGE.MAX_STORED_PACKETS) await this.evictOne(stored.packet.header.priority);
    }
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('INSERT INTO seen_packets(packet_id,digest,seen_at_ms) VALUES(?,?,?)', packetId, stored.digest, stored.storedAtMs);
      await transaction.runAsync(
        'INSERT INTO packets(packet_id,bytes_b64,digest,stored_at_ms,retention_until_s,custody_json) VALUES(?,?,?,?,?,?)',
        packetId,
        bytesToBase64(stored.encoded.bytes),
        stored.digest,
        stored.storedAtMs,
        stored.retentionUntilS,
        JSON.stringify(custody),
      );
      await transaction.runAsync('INSERT INTO observations(packet_id,body_json) VALUES(?,?)', packetId, JSON.stringify(observation));
    });
    return 'inserted' as const;
  }

  async get(packetId: PacketId): Promise<StoredPacket | undefined> {
    const row = await this.database.getFirstAsync<PacketRow>('SELECT * FROM packets WHERE packet_id = ?', packetId);
    if (!row) return undefined;
    const bytes = base64ToBytes(row.bytes_b64);
    const decoded = decodePacket(bytes);
    if (!decoded.ok) return undefined;
    return {
      packet: decoded.packet,
      encoded: { packetId, bytes, headerBytes: 64, payloadBytes: decoded.packet.header.payloadLength, totalBytes: bytes.length },
      digest: row.digest,
      storedAtMs: row.stored_at_ms,
      retentionUntilS: row.retention_until_s,
    };
  }

  async hasSeen(packetId: PacketId) { return Boolean(await this.database.getFirstAsync('SELECT 1 FROM seen_packets WHERE packet_id = ?', packetId)); }
  async getDigest(packetId: PacketId) { return (await this.database.getFirstAsync<{ digest: string }>('SELECT digest FROM seen_packets WHERE packet_id = ?', packetId))?.digest; }
  async listAll(): Promise<readonly StoredPacket[]> {
    const rows = await this.database.getAllAsync<PacketRow>('SELECT * FROM packets ORDER BY stored_at_ms');
    const out: StoredPacket[] = [];
    for (const row of rows) {
      const bytes = base64ToBytes(row.bytes_b64);
      const decoded = decodePacket(bytes);
      if (!decoded.ok) continue;
      out.push({
        packet: decoded.packet,
        encoded: { packetId: row.packet_id, bytes, headerBytes: 64, payloadBytes: decoded.packet.header.payloadLength, totalBytes: bytes.length },
        digest: row.digest,
        storedAtMs: row.stored_at_ms,
        retentionUntilS: row.retention_until_s,
      });
    }
    return out;
  }
  async addObservation(observation: PacketObservation) { await this.database.runAsync('INSERT INTO observations(packet_id,body_json) VALUES(?,?)', observation.packetId, JSON.stringify(observation)); }
  async listObservations(packetId: PacketId) { return (await this.database.getAllAsync<{ body_json: string }>('SELECT body_json FROM observations WHERE packet_id = ? ORDER BY id', packetId)).map((row) => JSON.parse(row.body_json) as PacketObservation); }
  async getCustody(packetId: PacketId) { const row = await this.database.getFirstAsync<{ custody_json: string }>('SELECT custody_json FROM packets WHERE packet_id = ?', packetId); return row ? JSON.parse(row.custody_json) as CustodyRecord : undefined; }
  async updateCustody(record: CustodyRecord) { await this.database.runAsync('UPDATE packets SET custody_json = ? WHERE packet_id = ?', JSON.stringify(record), record.packetId); }

  async listRelayable(limit: number) {
    const rows = await this.database.getAllAsync<PacketRow>('SELECT * FROM packets ORDER BY stored_at_ms');
    const now = Date.now();
    return rows.map((row) => JSON.parse(row.custody_json) as CustodyRecord)
      .filter((item) => item.copyBudgetRemaining > 0 && !['expired', 'invalid', 'evicted'].includes(item.state) && (item.nextEligibleAtMs ?? 0) <= now)
      .slice(0, limit);
  }

  async listUploadQueue(limit: number) {
    const rows = await this.database.getAllAsync<PacketRow>('SELECT * FROM packets ORDER BY stored_at_ms');
    return rows.map((row) => JSON.parse(row.custody_json) as CustodyRecord).filter((item) => item.uploadState === 'queued').slice(0, limit);
  }

  async putFragment(fragment: FragmentRecord) {
    await this.database.runAsync(
      'INSERT OR REPLACE INTO fragments(object_id,fragment_index,body_json) VALUES(?,?,?)',
      fragment.objectId,
      fragment.index,
      JSON.stringify({ ...fragment, bytes: bytesToBase64(fragment.bytes) }),
    );
  }
  async listFragments(objectId: string) {
    return (await this.database.getAllAsync<{ body_json: string }>('SELECT body_json FROM fragments WHERE object_id = ? ORDER BY fragment_index', objectId)).map((row) => {
      const parsed = JSON.parse(row.body_json) as Omit<FragmentRecord, 'bytes'> & { bytes: string };
      return { ...parsed, bytes: base64ToBytes(parsed.bytes) };
    });
  }
  async dropFragments(objectId: string) { await this.database.runAsync('DELETE FROM fragments WHERE object_id = ?', objectId); }
  async evictExpired(nowS: number) {
    const packetResult = await this.database.runAsync('DELETE FROM packets WHERE retention_until_s <= ?', nowS);
    const seenCutoff = (nowS - STORAGE.SEEN_ID_RETENTION_S) * 1000;
    const seenResult = await this.database.runAsync('DELETE FROM seen_packets WHERE seen_at_ms < ? AND packet_id NOT IN (SELECT packet_id FROM packets)', seenCutoff);
    return packetResult.changes + seenResult.changes;
  }
  async count() { return (await this.database.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM packets'))?.value ?? 0; }

  private async evictOne(incomingPriority: number) {
    const rows = await this.database.getAllAsync<PacketRow>('SELECT * FROM packets ORDER BY stored_at_ms');
    const candidates = rows.flatMap((row) => {
      const decoded = decodePacket(base64ToBytes(row.bytes_b64));
      if (!decoded.ok) return [];
      const custody = JSON.parse(row.custody_json) as CustodyRecord;
      if (decoded.packet.header.priority <= Priority.RESPONSE_CONTROL || custody.state === 'created-locally') return [];
      return [{ row, priority: decoded.packet.header.priority }];
    }).sort((left, right) => right.priority - left.priority || left.row.stored_at_ms - right.row.stored_at_ms);
    const victim = candidates[0];
    if (!victim) {
      if (incomingPriority > Priority.RESPONSE_CONTROL) throw new Error('storage full, nothing evictable');
      return;
    }
    // Keep seen_packets so a later replay is still suppressed as a duplicate.
    await this.database.runAsync('DELETE FROM packets WHERE packet_id = ?', victim.row.packet_id);
  }
}

export class SQLitePeerRepository implements PeerRepository {
  constructor(private readonly database: SQLiteDatabase) {}
  async observe(record: PeerObservationRecord) { await this.database.runAsync('INSERT OR REPLACE INTO peers(peer_token,body_json) VALUES(?,?)', record.peerToken, JSON.stringify(record)); }
  async list(nowMs: number) { const cutoff = nowMs - STORAGE.PEER_OBSERVATION_RETENTION_S * 1000; return (await this.database.getAllAsync<{ body_json: string }>('SELECT body_json FROM peers')).map((row) => JSON.parse(row.body_json) as PeerObservationRecord).filter((row) => row.lastSeenAtMs >= cutoff && row.lastSeenAtMs <= nowMs); }
  async get(peerToken: string) { const row = await this.database.getFirstAsync<{ body_json: string }>('SELECT body_json FROM peers WHERE peer_token = ?', peerToken); return row ? JSON.parse(row.body_json) as PeerObservationRecord : undefined; }
  async evictStale(nowMs: number) { const result = await this.database.runAsync('DELETE FROM peers WHERE CAST(json_extract(body_json, "$.lastSeenAtMs") AS INTEGER) < ?', nowMs - STORAGE.PEER_OBSERVATION_RETENTION_S * 1000); return result.changes; }
}

export class SQLiteFileRepository implements FileRepository {
  constructor(private readonly database: SQLiteDatabase) {}
  async putManifest(file: AssembledFile) {
    if (file.totalBytes > STORAGE.MAX_FILE_BYTES || file.fragmentCount > STORAGE.MAX_FRAGMENTS_PER_OBJECT) return false;
    await this.write(file);
    return true;
  }
  async getManifest(fileId: string) { const row = await this.database.getFirstAsync<{ body_json: string }>('SELECT body_json FROM assembled_files WHERE file_id = ?', fileId); return row ? decodeFile(row.body_json) : undefined; }
  async markComplete(fileId: string, bytes: Uint8Array, atMs: number) { const file = await this.getManifest(fileId); if (file) await this.write({ ...file, bytes, visible: true, completedAtMs: atMs }); }
  async listVisible() { return (await this.database.getAllAsync<{ body_json: string }>('SELECT body_json FROM assembled_files')).map((row) => decodeFile(row.body_json)).filter((file) => file.visible); }
  async missingFragments(fileId: string, held: readonly number[]) { const file = await this.getManifest(fileId); if (!file) return []; const have = new Set(held); return Array.from({ length: file.fragmentCount }, (_, index) => index).filter((index) => !have.has(index)); }
  async evictExpired(nowS: number) { const rows = await this.database.getAllAsync<{ file_id: string; body_json: string }>('SELECT file_id,body_json FROM assembled_files'); const expired = rows.filter((row) => decodeFile(row.body_json).expiresAtS <= nowS); for (const row of expired) await this.database.runAsync('DELETE FROM assembled_files WHERE file_id = ?', row.file_id); return expired.length; }
  private async write(file: AssembledFile) { await this.database.runAsync('INSERT OR REPLACE INTO assembled_files(file_id,body_json) VALUES(?,?)', file.fileId, JSON.stringify({ ...file, ...(file.bytes ? { bytes: bytesToBase64(file.bytes) } : {}) })); }
}

type MapObjectRow = {
  object_id: string;
  kind: string;
  label: string;
  state: number | null;
  lat_e7: number | null;
  lon_e7: number | null;
  as_of_s: number;
  provenance: string;
};

/** Persisted mirror of the live map projection. See MapObjectRepository. */
export class SQLiteMapObjectRepository implements MapObjectRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async upsert(record: MapObjectRecord) {
    await this.database.runAsync(
      'INSERT OR REPLACE INTO map_objects(object_id,kind,label,state,lat_e7,lon_e7,as_of_s,provenance) VALUES(?,?,?,?,?,?,?,?)',
      record.objectId,
      record.kind,
      record.label,
      record.state ?? null,
      record.latE7 ?? null,
      record.lonE7 ?? null,
      record.asOfS,
      record.provenance,
    );
  }

  async remove(objectId: ObjectId) {
    await this.database.runAsync('DELETE FROM map_objects WHERE object_id = ?', objectId);
  }

  async list(): Promise<readonly MapObjectRecord[]> {
    const rows = await this.database.getAllAsync<MapObjectRow>('SELECT * FROM map_objects');
    return rows.map(rowToMapObjectRecord);
  }

  async replaceAll(records: readonly MapObjectRecord[]) {
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('DELETE FROM map_objects');
      for (const record of records) {
        await transaction.runAsync(
          'INSERT INTO map_objects(object_id,kind,label,state,lat_e7,lon_e7,as_of_s,provenance) VALUES(?,?,?,?,?,?,?,?)',
          record.objectId,
          record.kind,
          record.label,
          record.state ?? null,
          record.latE7 ?? null,
          record.lonE7 ?? null,
          record.asOfS,
          record.provenance,
        );
      }
    });
  }
}

function rowToMapObjectRecord(row: MapObjectRow): MapObjectRecord {
  return {
    objectId: row.object_id,
    kind: row.kind,
    label: row.label,
    ...(row.state !== null ? { state: row.state } : {}),
    ...(row.lat_e7 !== null ? { latE7: row.lat_e7 } : {}),
    ...(row.lon_e7 !== null ? { lonE7: row.lon_e7 } : {}),
    asOfS: row.as_of_s,
    provenance: row.provenance,
  };
}

function decodeFile(json: string): AssembledFile {
  const parsed = JSON.parse(json) as Omit<AssembledFile, 'bytes'> & { bytes?: string };
  const { bytes, ...file } = parsed;
  return { ...file, ...(bytes ? { bytes: base64ToBytes(bytes) } : {}) };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
