/**
 * In-memory implementation of the persistence ports.
 *
 * WHY THIS EXISTS: every other workstream needs a working store TODAY. This
 * one satisfies @dsm/contracts ports exactly and remains the deterministic
 * simulator/test implementation. The mobile app injects the durable
 * expo-sqlite repositories through the same ports.
 *
 * It implements the real rules, not a stub:
 *  - packet ID + digest is idempotent; ID with a different digest is a conflict
 *  - custody, observations, and the packet commit together
 *  - seen-IDs survive payload eviction
 *  - eviction follows the documented order (02-... "Storage pressure")
 */

import {
  Priority,
  ACCEPTED_MIME_CATEGORIES,
  STORAGE,
  type AssembledFile,
  type CustodyRecord,
  type FileRepository,
  type FragmentRecord,
  type IncidentEventRecord,
  type IncidentRecord,
  type PacketId,
  type PacketObservation,
  type PacketRepository,
  type PeerObservationRecord,
  type PeerRepository,
  type IncidentRepository,
  type StoredPacket,
  type StreamId,
} from '@dsm/contracts';

interface Slot {
  stored: StoredPacket;
  custody: CustodyRecord;
  observations: PacketObservation[];
}

export class MemoryPacketRepository implements PacketRepository {
  private readonly slots = new Map<PacketId, Slot>();
  /** Survives payload eviction so duplicates stay suppressed (02-...). */
  private readonly seen = new Map<PacketId, { digest: string; atMs: number }>();
  private readonly fragments = new Map<string, Map<number, FragmentRecord>>();

  async insert(
    stored: StoredPacket,
    observation: PacketObservation,
    custody: CustodyRecord,
  ): Promise<'inserted' | 'duplicate' | 'conflict'> {
    const id = stored.packet.header.packetId;
    const known = this.seen.get(id);
    if (known) {
      if (known.digest !== stored.digest) return 'conflict';
      const slot = this.slots.get(id);
      if (slot) slot.observations.push(observation);
      return 'duplicate';
    }

    if (this.slots.size >= STORAGE.MAX_STORED_PACKETS) {
      await this.evictOne(stored.packet.header.priority);
    }

    // One commit: packet + custody + first observation (02-... transactions).
    this.slots.set(id, { stored, custody, observations: [observation] });
    this.seen.set(id, { digest: stored.digest, atMs: stored.storedAtMs });
    return 'inserted';
  }

  async get(packetId: PacketId): Promise<StoredPacket | undefined> {
    return this.slots.get(packetId)?.stored;
  }

  async hasSeen(packetId: PacketId): Promise<boolean> {
    return this.seen.has(packetId);
  }

  async getDigest(packetId: PacketId): Promise<string | undefined> {
    return this.seen.get(packetId)?.digest;
  }

  async addObservation(observation: PacketObservation): Promise<void> {
    this.slots.get(observation.packetId)?.observations.push(observation);
  }

  async listObservations(packetId: PacketId): Promise<readonly PacketObservation[]> {
    return this.slots.get(packetId)?.observations ?? [];
  }

  async getCustody(packetId: PacketId): Promise<CustodyRecord | undefined> {
    return this.slots.get(packetId)?.custody;
  }

  async updateCustody(record: CustodyRecord): Promise<void> {
    const slot = this.slots.get(record.packetId);
    if (slot) slot.custody = record;
  }

  async listRelayable(limit: number): Promise<readonly CustodyRecord[]> {
    const now = Date.now();
    const eligible = [...this.slots.values()].filter((slot) => {
      const c = slot.custody;
      if (c.copyBudgetRemaining <= 0) return false;
      if (c.state === 'expired' || c.state === 'invalid' || c.state === 'evicted') return false;
      if (c.nextEligibleAtMs !== undefined && c.nextEligibleAtMs > now) return false;
      return true;
    });

    // Priority first, then oldest (queue fairness: older packets gain weight).
    eligible.sort((a, b) => {
      const pa = a.stored.packet.header.priority;
      const pb = b.stored.packet.header.priority;
      if (pa !== pb) return pa - pb;
      return a.stored.packet.header.createdAt - b.stored.packet.header.createdAt;
    });
    return eligible.slice(0, limit).map((slot) => slot.custody);
  }

  async listUploadQueue(limit: number): Promise<readonly CustodyRecord[]> {
    const queued = [...this.slots.values()].filter((slot) => slot.custody.uploadState === 'queued');
    queued.sort((a, b) => a.stored.packet.header.priority - b.stored.packet.header.priority);
    return queued.slice(0, limit).map((slot) => slot.custody);
  }

  async putFragment(fragment: FragmentRecord): Promise<void> {
    let group = this.fragments.get(fragment.objectId);
    if (!group) {
      if (this.fragments.size >= STORAGE.MAX_INCOMPLETE_OBJECTS) {
        throw new Error('too many incomplete objects');
      }
      group = new Map();
      this.fragments.set(fragment.objectId, group);
    }
    if (group.size >= STORAGE.MAX_FRAGMENTS_PER_OBJECT && !group.has(fragment.index)) {
      throw new Error('fragment count over limit');
    }
    group.set(fragment.index, fragment);
  }

  async listFragments(objectId: string): Promise<readonly FragmentRecord[]> {
    const group = this.fragments.get(objectId);
    if (!group) return [];
    return [...group.values()].sort((a, b) => a.index - b.index);
  }

  async dropFragments(objectId: string): Promise<void> {
    this.fragments.delete(objectId);
  }

  async evictExpired(nowS: number): Promise<number> {
    let removed = 0;
    for (const [id, slot] of this.slots) {
      if (slot.stored.retentionUntilS <= nowS) {
        this.slots.delete(id); // seen-ID stays: it still suppresses duplicates.
        removed += 1;
      }
    }
    const cutoffMs = (nowS - STORAGE.SEEN_ID_RETENTION_S) * 1000;
    for (const [id, entry] of this.seen) {
      if (entry.atMs < cutoffMs && !this.slots.has(id)) {
        this.seen.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  async count(): Promise<number> {
    return this.slots.size;
  }

  /**
   * 02-... "Storage pressure" eviction order. Never evicts the user's own
   * active SOS, critical control, or a terminal suppression record before
   * optional data.
   */
  private async evictOne(incomingPriority: number): Promise<void> {
    const candidates = [...this.slots.values()]
      .filter((slot) => {
        const p = slot.stored.packet.header.priority;
        if (p <= Priority.RESPONSE_CONTROL) return false; // protect critical traffic
        if (slot.custody.state === 'created-locally') return false; // protect own packets
        return true;
      })
      .sort((a, b) => {
        const pa = a.stored.packet.header.priority;
        const pb = b.stored.packet.header.priority;
        if (pa !== pb) return pb - pa; // lowest priority (highest number) first
        return a.stored.storedAtMs - b.stored.storedAtMs; // then oldest
      });

    const victim = candidates[0];
    if (!victim) {
      if (incomingPriority > Priority.RESPONSE_CONTROL) throw new Error('storage full, nothing evictable');
      return;
    }
    this.slots.delete(victim.stored.packet.header.packetId);
  }
}

export class MemoryIncidentRepository implements IncidentRepository {
  private readonly incidents = new Map<StreamId, IncidentRecord>();
  private readonly events = new Map<StreamId, IncidentEventRecord[]>();

  async upsert(record: IncidentRecord): Promise<void> {
    this.incidents.set(record.incidentId, record);
  }

  async get(incidentId: StreamId): Promise<IncidentRecord | undefined> {
    return this.incidents.get(incidentId);
  }

  async list(): Promise<readonly IncidentRecord[]> {
    return [...this.incidents.values()];
  }

  async appendEvent(event: IncidentEventRecord): Promise<void> {
    const list = this.events.get(event.incidentId) ?? [];
    list.push(event);
    this.events.set(event.incidentId, list);
  }

  async listEvents(incidentId: StreamId): Promise<readonly IncidentEventRecord[]> {
    return [...(this.events.get(incidentId) ?? [])].sort((a, b) => a.atS - b.atS);
  }
}

export class MemoryPeerRepository implements PeerRepository {
  private readonly peers = new Map<string, PeerObservationRecord>();

  async observe(record: PeerObservationRecord): Promise<void> {
    this.peers.set(record.peerToken, record);
  }

  async list(nowMs: number): Promise<readonly PeerObservationRecord[]> {
    const cutoff = nowMs - STORAGE.PEER_OBSERVATION_RETENTION_S * 1000;
    return [...this.peers.values()].filter((p) => p.lastSeenAtMs >= cutoff);
  }

  async get(peerToken: string): Promise<PeerObservationRecord | undefined> {
    return this.peers.get(peerToken);
  }

  async evictStale(nowMs: number): Promise<number> {
    const cutoff = nowMs - STORAGE.PEER_OBSERVATION_RETENTION_S * 1000;
    let removed = 0;
    for (const [token, peer] of this.peers) {
      if (peer.lastSeenAtMs < cutoff) {
        this.peers.delete(token);
        removed += 1;
      }
    }
    return removed;
  }
}

/**
 * In-memory file repository.
 *
 * HACKATHON DECISION: completed objects are held in memory alongside the rest
 * of the store, not written to the filesystem. The demo maximum is 128 KB
 * (STORAGE.MAX_FILE_BYTES, FIL-007) with at most 8 incomplete objects, so the
 * ceiling is about 1 MB. A filesystem-backed implementation lands behind this
 * same interface if the demo ever needs larger objects.
 */
export class MemoryFileRepository implements FileRepository {
  private readonly files = new Map<string, AssembledFile>();

  async putManifest(file: AssembledFile): Promise<boolean> {
    // FIL-006 allow-list: text only, refused before a single fragment is
    // requested or stored.
    if (!ACCEPTED_MIME_CATEGORIES.has(file.mimeCategory)) return false;
    if (file.totalBytes > STORAGE.MAX_FILE_BYTES) return false;
    if (file.fragmentCount < 1 || file.fragmentCount > STORAGE.MAX_FRAGMENTS_PER_OBJECT) return false;

    const existing = this.files.get(file.fileId);
    // A manifest for an object already completed must not reset it.
    if (existing?.visible) return true;

    if (!existing && this.files.size >= STORAGE.MAX_INCOMPLETE_OBJECTS) return false;
    this.files.set(file.fileId, file);
    return true;
  }

  async getManifest(fileId: string): Promise<AssembledFile | undefined> {
    return this.files.get(fileId);
  }

  async markComplete(fileId: string, bytes: Uint8Array, atMs: number): Promise<void> {
    const file = this.files.get(fileId);
    if (!file) return;
    // FIL-004: visibility flips only here, after the caller validated the
    // whole-object digest. The two happen together.
    this.files.set(fileId, { ...file, bytes, visible: true, completedAtMs: atMs });
  }

  async listVisible(): Promise<readonly AssembledFile[]> {
    return [...this.files.values()].filter((f) => f.visible);
  }

  async missingFragments(fileId: string, held: readonly number[]): Promise<readonly number[]> {
    const file = this.files.get(fileId);
    if (!file) return [];
    const have = new Set(held);
    const missing: number[] = [];
    for (let i = 0; i < file.fragmentCount; i += 1) if (!have.has(i)) missing.push(i);
    return missing;
  }

  async evictExpired(nowS: number): Promise<number> {
    let removed = 0;
    for (const [id, file] of this.files) {
      if (file.expiresAtS <= nowS) {
        this.files.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}
