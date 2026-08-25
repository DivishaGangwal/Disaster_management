/**
 * NODE ENGINE -- the composition root of one participating phone.
 *
 * This is where the pipeline from 02-... is actually assembled:
 *
 *   transport/gateway/tier2 bytes
 *        -> ONE validator            (@dsm/validator)
 *        -> ONE repository           (@dsm/store)
 *        -> ONE policy engine        (@dsm/policy)   [6 independent decisions]
 *        -> incident reducer + map projection
 *        -> relay scheduler          (@dsm/routing)
 *
 * Invariant 4: "All transports feed one packet validator, local store, policy
 * engine, and map projection." That is enforced structurally here: `ingest()`
 * is the ONLY entry point, and every transport calls it.
 *
 * The mobile app consumes this class. So does the simulator. So does any test.
 * Nothing in here imports React, Expo, Android, or ggwave.
 */

import {
  CLASS_BUDGETS,
  EventCategory,
  FRESHNESS,
  MessageType,
  Priority,
  STORAGE,
  SourceClass,
  type CustodyRecord,
  type DiagnosticEvent,
  type EncodedPacket,
  type EventSink,
  type FileRepository,
  type LocalProfile,
  type MapObjectRecord,
  type MapObjectRepository,
  type Packet,
  type PacketId,
  type PacketObservation,
  type PacketRepository,
  type PeerRepository,
  type PolicyContext,
  type PolicyOutcome,
  type StoredPacket,
  type TransportKind,
} from '@dsm/contracts';
import { budgetClassFor, toEpochS } from '@dsm/codec';
import { validate, type ValidationResult } from '@dsm/validator';
import { DefaultPolicyEngine } from '@dsm/policy';
import { IncidentReducer, type IncidentView } from '@dsm/incident';
import { MapProjection, toMapOperations, type VisibleObject } from '@dsm/mapkit';
import { afterTransfer, planTransfer, type NeighborContext, type RelayCandidate } from '@dsm/routing';
import { MemoryEventSink, MemoryFileRepository, MemoryMapObjectRepository, MemoryPacketRepository, MemoryPeerRepository } from '@dsm/store';
import { FileAssembler } from './file-assembler.js';

export interface NodeEngineOptions {
  readonly profile: LocalProfile;
  readonly localSourceId: string;
  readonly nodeToken: string;
  readonly regionCode: string;
  readonly packets?: PacketRepository;
  readonly peers?: PeerRepository;
  readonly events?: EventSink;
  readonly files?: FileRepository;
  readonly mapObjects?: MapObjectRepository;
  readonly projection?: MapProjection;
  readonly displayRadiusM?: number;
  readonly now?: () => number;
  /**
   * Called once per ingest, whatever the outcome.
   *
   * Exists so a platform layer can react to the POLICY ENGINE's decision
   * instead of re-deriving one. The mobile notification path used to fire
   * off the raw transport event, which meant it notified for INVENTORY
   * records (priority RESPONSE_CONTROL) on the emergency channel roughly
   * once a minute, and re-notified for duplicates.
   *
   * The engine stays platform-agnostic: it hands over a result, it does not
   * know what a notification is.
   */
  readonly onIngested?: (result: IngestResult, transport: TransportKind) => void;
}

export interface IngestResult {
  readonly accepted: boolean;
  readonly packetId?: PacketId;
  readonly validation: ValidationResult;
  readonly policy?: PolicyOutcome;
  readonly storeOutcome?: 'inserted' | 'duplicate' | 'conflict';
  readonly incident?: IncidentView;
  readonly mapOperationsApplied: number;
}

export interface RebuiltLocalState {
  readonly maxSourceSequence: number;
  readonly activeIncidentId?: string;
}

export class NodeEngine {
  readonly packets: PacketRepository;
  readonly peers: PeerRepository;
  readonly files: FileAssembler;
  readonly events: EventSink;
  readonly mapObjects: MapObjectRepository;
  readonly projection: MapProjection;
  readonly incidents = new IncidentReducer();

  private readonly policyEngine = new DefaultPolicyEngine();
  private readonly ownIncidentIds = new Set<string>();
  private readonly previousHopByPacket = new Map<string, string>();
  private readonly now: () => number;

  private batteryBand = 3;
  private storagePressure: 'ok' | 'high' | 'critical' = 'ok';
  private coarseLocation?: { latE7: number; lonE7: number };
  private queueEpoch = 0;
  /**
   * Most urgent priority currently waiting to be relayed, advertised so a peer
   * can decide whether a session is worth opening (02-... "Highest waiting
   * priority"). LOWER is more urgent, so an empty queue is the LOWEST class --
   * this used to be hardcoded to 0, which made every node permanently claim
   * life-critical traffic.
   *
   * Maintained as a running minimum on insert and recomputed exactly in
   * maintain(), because a minimum cannot rise again on its own when the packet
   * that set it expires. Between those points the value can only be too
   * urgent, never not urgent enough, which costs an extra session rather than
   * a missed one.
   */
  private waitingPriority: number = Priority.FILE_FRAGMENT;
  /**
   * Order-independent 16-bit fingerprint of the relayable set (02-... "Compact
   * inventory hint": a low-cost probability that useful packets differ).
   *
   * This is NOT queueEpoch. The epoch says "my queue changed since you last
   * saw me" and is self-referential; two peers cannot compare epochs to learn
   * whether they hold the same packets. This digest they can compare directly.
   *
   * XOR-folded so insertion order does not matter, and recomputed in maintain()
   * because eviction happens inside the repository and cannot be XORed back
   * out. It is therefore a HINT: a mismatch is reliable, a match is probable.
   * Nothing gates a session on it today; anything that later skips work on a
   * match must account for that.
   */
  private inventoryDigest = 0;
  private gatewayProven = false;
  private gatewayProvenAtMs?: number;

  constructor(private readonly options: NodeEngineOptions) {
    this.packets = options.packets ?? new MemoryPacketRepository();
    this.peers = options.peers ?? new MemoryPeerRepository();
    this.events = options.events ?? new MemoryEventSink();
    this.mapObjects = options.mapObjects ?? new MemoryMapObjectRepository();
    this.projection = options.projection ?? new MapProjection();
    this.now = options.now ?? (() => Date.now());
    this.files = new FileAssembler(options.files ?? new MemoryFileRepository(), this.packets, this.events);
  }

  get nodeToken(): string {
    return this.options.nodeToken;
  }

  get localSourceId(): string {
    return this.options.localSourceId;
  }

  get profile(): LocalProfile {
    return this.options.profile;
  }

  get currentQueueEpoch(): number {
    return this.queueEpoch;
  }

  /** Most urgent waiting priority; Priority.FILE_FRAGMENT (7) when nothing waits. */
  get currentHighestWaitingPriority(): number {
    return this.waitingPriority;
  }

  /** 16-bit fingerprint of the relayable set. Advisory: see inventoryDigest. */
  get currentInventoryHint(): number {
    return this.inventoryDigest;
  }

  setBatteryBand(band: number): void {
    this.batteryBand = band;
  }

  setStoragePressure(pressure: 'ok' | 'high' | 'critical'): void {
    this.storagePressure = pressure;
  }

  setCoarseLocation(latE7: number, lonE7: number): void {
    this.coarseLocation = { latE7, lonE7 };
  }

  /** GTW-001: only a live probe result may set this. */
  setGatewayProven(proven: boolean, atMs: number): void {
    this.gatewayProven = proven;
    this.gatewayProvenAtMs = proven ? atMs : undefined;
    this.emit({
      category: EventCategory.GATEWAY,
      name: proven ? 'gateway-proven' : 'gateway-lost',
      severity: 'info',
      atMs,
    });
  }

  isGatewayProven(nowMs: number): boolean {
    if (!this.gatewayProven || this.gatewayProvenAtMs === undefined) return false;
    return nowMs - this.gatewayProvenAtMs <= FRESHNESS.GATEWAY_PROOF_S * 1000;
  }

  /** Registers an incident this device owns, so policy shows it in full. */
  claimIncident(incidentId: string): void {
    this.ownIncidentIds.add(incidentId);
  }

  /**
   * THE ONE INGRESS. Tier 1 BLE, gateway downloads, and Tier 2 all land here.
   * Adding a transport must never add a second version of this method.
   */
  async ingest(
    bytes: Uint8Array,
    transport: TransportKind,
    meta: { readonly previousHopToken?: string; readonly atMs?: number; readonly campaignId?: string } = {},
  ): Promise<IngestResult> {
    const result = await this.ingestInternal(bytes, transport, meta);
    this.options.onIngested?.(result, transport);
    return result;
  }

  private async ingestInternal(
    bytes: Uint8Array,
    transport: TransportKind,
    meta: { readonly previousHopToken?: string; readonly atMs?: number; readonly campaignId?: string },
  ): Promise<IngestResult> {
    const atMs = meta.atMs ?? this.now();
    const nowS = toEpochS(atMs);

    // Pre-validation lookups the validator needs but must not perform itself.
    const peek = peekPacketId(bytes);
    const conflictingDigest = peek ? await this.packets.getDigest(peek) : undefined;
    const alreadyStored = peek ? await this.packets.hasSeen(peek) : false;

    const validation = validate(bytes, {
      nowS,
      transport,
      hopCountOnArrival: 0,
      isKnownDuplicate: alreadyStored,
      ...(conflictingDigest ? { conflictingDigest } : {}),
      streamTerminated: false,
      storagePressure: this.storagePressure,
      queueDepth: await this.packets.count(),
      maxQueueDepth: STORAGE.MAX_STORED_PACKETS,
      regionCode: this.options.regionCode,
    });

    if (!validation.ok) {
      this.emit({
        category: EventCategory.VALIDATION,
        name: 'rejected',
        severity: 'warn',
        atMs,
        reason: validation.reason,
        transport,
        bytes: bytes.length,
        ...(validation.packetId ? { packetId: validation.packetId } : {}),
        result: validation.gate,
      });
      return { accepted: false, validation, mapOperationsApplied: 0 };
    }

    const packet = validation.packet;
    const packetId = packet.header.packetId;

    this.emit({
      category: EventCategory.VALIDATION,
      name: 'accepted',
      severity: 'debug',
      atMs,
      packetId,
      packetType: packet.header.type,
      transport,
      bytes: validation.totalBytes,
      result: validation.sourceLabel,
    });

    // Six independent decisions (invariant 6).
    const policy = this.policyEngine.decide(packet, this.policyContext(transport, nowS));
    this.emit({
      category: EventCategory.POLICY,
      name: 'decided',
      severity: 'debug',
      atMs,
      packetId,
      packetType: packet.header.type,
      reason: policy.reasons.relay,
      result: `${policy.store}/${policy.display}/${policy.alert}/${policy.relay}/${policy.upload}/${policy.act}`,
    });

    let storeOutcome: 'inserted' | 'duplicate' | 'conflict' | undefined;
    if (policy.store !== 'discard') {
      const stored: StoredPacket = {
        packet,
        encoded: {
          bytes,
          packetId,
          headerBytes: 64,
          payloadBytes: packet.header.payloadLength,
          totalBytes: validation.totalBytes,
        },
        digest: validation.digest,
        storedAtMs: atMs,
        retentionUntilS: nowS + policy.retentionS,
      };
      const observation: PacketObservation = {
        packetId,
        transport,
        receivedAtMs: atMs,
        hopCountOnArrival: packet.header.hopCount,
        bytes: validation.totalBytes,
        ...(meta.previousHopToken ? { previousHopToken: meta.previousHopToken } : {}),
        ...(meta.campaignId ? { campaignId: meta.campaignId } : {}),
      };
      storeOutcome = await this.packets.insert(stored, observation, this.newCustody(packet, policy, atMs));

      if (storeOutcome === 'inserted') {
        this.queueEpoch = (this.queueEpoch + 1) & 0xffff;
        // Only packets that can actually be offered belong in the advertised
        // queue summary. A stored-but-never-relayed packet must not make this
        // node look busy to its neighbours.
        if (policy.relay !== 'never') {
          this.waitingPriority = Math.min(this.waitingPriority, packet.header.priority);
          this.inventoryDigest ^= fold16(packetId);
        }
      }
      if (storeOutcome === 'conflict') {
        // 02-... "Same packet ID/different digest: quarantine conflict."
        this.emit({
          category: EventCategory.VALIDATION,
          name: 'conflict-quarantined',
          severity: 'error',
          atMs,
          packetId,
          reason: 'reject.digest-conflict',
        });
        return { accepted: false, packetId, validation, policy, storeOutcome, mapOperationsApplied: 0 };
      }
    }

    if (meta.previousHopToken) this.previousHopByPacket.set(packetId, meta.previousHopToken);

    // A duplicate records the observation but must not repeat any action
    // (REL-006, 02-... "Duplicate packet: suppress duplicate action/display
    // while recording useful observation").
    if (storeOutcome === 'duplicate') {
      this.emit({
        category: EventCategory.POLICY,
        name: 'duplicate-suppressed',
        severity: 'debug',
        atMs,
        packetId,
        reason: 'policy.duplicate-suppressed',
      });
      return { accepted: true, packetId, validation, policy, storeOutcome, mapOperationsApplied: 0 };
    }

    // FIL-001..FIL-007: manifests and fragments go to the assembler, which
    // refuses hostile objects and flips visibility only after the whole-object
    // digest passes.
    if (packet.header.type === MessageType.FILE_MANIFEST || packet.header.type === MessageType.FILE_FRAGMENT) {
      const outcome = await this.files.accept(packet, nowS, atMs);
      this.emit({
        category: EventCategory.FILE,
        name: outcome.kind,
        severity: outcome.kind === 'integrity-failed' ? 'error' : 'debug',
        atMs,
        packetId,
      });
    }

    let mapOperationsApplied = 0;
    if (policy.act === 'apply-map' || policy.act === 'update-incident') {
      for (const operation of toMapOperations(packet, transport, nowS)) {
        const result = this.projection.apply(operation);
        if (result.applied) {
          mapOperationsApplied += 1;
          // Keep the persisted map-object mirror in lockstep with the live
          // projection so a killed-and-relaunched app has something to paint
          // before it replays the packet log (see rebuildMapFromStoredPackets).
          await this.syncPersistedMapObject(result.objectId);
        }
        this.emit({
          category: EventCategory.PROJECTION,
          name: operation.kind,
          severity: 'debug',
          atMs,
          packetId,
          reason: result.reason,
          transport,
          result: result.applied ? 'applied' : 'ignored',
        });
      }
    }

    let incident: IncidentView | undefined;
    if (policy.act === 'update-incident' || packet.header.type === MessageType.BACKEND_ACKNOWLEDGEMENT) {
      incident = this.incidents.apply(packet, {
        localSourceId: this.options.localSourceId,
        ...(meta.previousHopToken ? { viaPeerToken: meta.previousHopToken } : {}),
      });
      if (incident) {
        this.emit({
          category: EventCategory.INCIDENT,
          name: 'state',
          severity: 'info',
          atMs,
          packetId,
          incidentId: incident.incidentId,
          result: incident.state,
        });
      }
    }

    return { accepted: true, packetId, validation, policy, storeOutcome, incident, mapOperationsApplied };
  }

  /** Local packet creation. OFF-002: durable BEFORE the UI claims success. */
  async createLocal(encoded: EncodedPacket, incidentId?: string): Promise<IngestResult> {
    if (incidentId) this.claimIncident(incidentId);
    const result = await this.ingest(encoded.bytes, 'local', { atMs: this.now() });
    this.emit({
      category: EventCategory.CUSTODY,
      name: 'created-locally',
      severity: 'info',
      atMs: this.now(),
      packetId: encoded.packetId,
      bytes: encoded.totalBytes,
    });
    return result;
  }

  /** Builds the relay plan for one peer session. */
  async planSessionTransfer(
    peerToken: string,
    peerInventory: ReadonlySet<string>,
    nowMs: number,
  ): Promise<ReturnType<typeof planTransfer>> {
    const peer = (await this.peers.get(peerToken)) ?? {
      peerToken,
      lastSeenAtMs: nowMs,
      gatewayProven: false,
      queueEpoch: 0,
      sessionsCompleted: 0,
      sessionsFailed: 0,
    };

    const custodies = await this.packets.listRelayable(64);
    const candidates: RelayCandidate[] = [];
    for (const custody of custodies) {
      const stored = await this.packets.get(custody.packetId);
      if (!stored) continue;
      candidates.push({ packetId: custody.packetId, packet: stored.packet, custody });
    }

    const ctx: NeighborContext = {
      peer,
      peerInventory,
      nowMs,
      localBatteryBand: this.batteryBand,
      previousHopByPacket: this.previousHopByPacket,
    };
    return planTransfer(candidates, ctx);
  }

  async recordTransfer(packetId: PacketId, peerToken: string, nowMs: number): Promise<void> {
    const custody = await this.packets.getCustody(packetId);
    const stored = await this.packets.get(packetId);
    if (!custody || !stored) return;
    await this.packets.updateCustody(
      afterTransfer(custody, peerToken, nowMs, stored.packet.header.type, stored.packet.header.severity),
    );
    this.emit({
      category: EventCategory.TRANSFER,
      name: 'record-sent',
      severity: 'debug',
      atMs: nowMs,
      packetId,
      peerToken,
      bytes: stored.encoded.totalBytes,
    });
  }

  /** Packet IDs this node can offer, for the inventory phase. */
  async inventoryIds(limit = 48): Promise<readonly string[]> {
    const custodies = await this.packets.listRelayable(limit);
    return custodies.map((c) => c.packetId);
  }

  /** Housekeeping: expiry, peer eviction, incident expiry, queue summary. */
  async maintain(nowMs: number): Promise<{ evicted: number; peersEvicted: number; incidentsExpired: number }> {
    const nowS = toEpochS(nowMs);
    const evicted = await this.packets.evictExpired(nowS);
    const peersEvicted = await this.peers.evictStale(nowMs);
    const incidentsExpired = this.incidents.expireOlderThan(nowS, CLASS_BUDGETS.HIGH.ttlS).length;
    await this.recomputeQueueSummary();
    return { evicted, peersEvicted, incidentsExpired };
  }

  /**
   * Rebuilds the advertised queue summary exactly, from the relayable set.
   *
   * The incremental updates on insert are one-directional -- a running minimum
   * cannot rise, and an XOR cannot be undone for a packet the repository
   * evicted without telling us which. This is the correction point, and it
   * runs on the housekeeping pass that already walks storage.
   */
  async recomputeQueueSummary(): Promise<void> {
    const custodies = await this.packets.listRelayable(STORAGE.MAX_STORED_PACKETS);
    let priority: number = Priority.FILE_FRAGMENT;
    let digest = 0;
    for (const custody of custodies) {
      const stored = await this.packets.get(custody.packetId);
      if (!stored) continue;
      priority = Math.min(priority, stored.packet.header.priority);
      digest ^= fold16(custody.packetId);
    }
    this.waitingPriority = priority;
    this.inventoryDigest = digest;
  }

  /**
   * Rebuilds the map projection from every packet already held in storage,
   * then overwrites the persisted map-object mirror with the result.
   *
   * Called once at startup, after the caller has already painted whatever
   * was in that persisted mirror for a fast first render (mapObjects.list()
   * predates this call and is not read here). The packet log stays the one
   * source of truth (02-... "packet-to-map operation matrix"); this just
   * re-derives it deterministically and reconciles the mirror so it can
   * never permanently drift.
   */
  async rebuildMapFromStoredPackets(nowMs: number): Promise<RebuiltLocalState> {
    const nowS = toEpochS(nowMs);
    const stored = await this.packets.listAll();
    let maxSourceSequence = 0;
    for (const item of stored) {
      if (item.packet.header.sourceId === this.options.localSourceId) {
        maxSourceSequence = Math.max(maxSourceSequence, item.packet.sourceSequence ?? 0);
        if (
          item.packet.streamId &&
          (item.packet.header.type === MessageType.SOS_CREATE ||
            item.packet.header.type === MessageType.SOS_UPDATE ||
            item.packet.header.type === MessageType.SOS_CANCEL)
        ) {
          this.claimIncident(item.packet.streamId);
        }
      }
      this.incidents.apply(item.packet, { localSourceId: this.options.localSourceId });
      const observations = await this.packets.listObservations(item.packet.header.packetId);
      const transport = observations[0]?.transport ?? 'local';
      for (const operation of toMapOperations(item.packet, transport as TransportKind, nowS)) {
        this.projection.apply(operation);
      }
    }
    const visible = this.projection.visible(nowS);
    await this.mapObjects.replaceAll(visible.map(toMapObjectRecord));
    const active = this.incidents
      .list()
      .filter((incident) => incident.ownedLocally && !['resolved', 'cancelled', 'expired'].includes(incident.state))
      .sort((left, right) => right.updatedAtS - left.updatedAtS)[0];
    return {
      maxSourceSequence,
      ...(active ? { activeIncidentId: active.incidentId } : {}),
    };
  }

  /** Write-through for one changed object, called from ingest()'s apply loop. */
  private async syncPersistedMapObject(objectId: string | undefined): Promise<void> {
    if (!objectId) return;
    const visible = this.projection.get(objectId);
    if (!visible || visible.tombstoned) {
      await this.mapObjects.remove(objectId);
      return;
    }
    await this.mapObjects.upsert(toMapObjectRecord(visible));
  }

  private policyContext(transport: TransportKind, nowS: number): PolicyContext {
    return {
      role: this.options.profile.role,
      localSourceId: this.options.localSourceId,
      ownIncidentIds: this.ownIncidentIds,
      transport,
      nowS,
      ...(this.coarseLocation ? { coarseLocation: this.coarseLocation } : {}),
      displayRadiusM: this.options.displayRadiusM ?? 5000,
      regionCode: this.options.regionCode,
      batteryBand: this.batteryBand as PolicyContext['batteryBand'],
      storagePressure: this.storagePressure,
      queueDepth: 0,
      packRegionKnown: true,
      nonCriticalAlertsEnabled: true,
    };
  }

  private newCustody(packet: Packet, policy: PolicyOutcome, atMs: number): CustodyRecord {
    const budget = CLASS_BUDGETS[budgetClassFor(packet.header.type, packet.header.severity)];
    const isOwn = packet.header.sourceId === this.options.localSourceId;
    return {
      packetId: packet.header.packetId,
      state: isOwn ? 'created-locally' : 'stored',
      copyBudgetRemaining: policy.relay === 'never' ? 0 : budget.copyBudget,
      copiesMade: 0,
      knownHolders: [],
      uploadState:
        policy.upload === 'never'
          ? 'not-eligible'
          : packet.header.sourceClass === SourceClass.BACKEND
            ? 'not-eligible'
            : 'queued',
      linkReceiptCount: 0,
      lastOfferedAtMs: atMs,
    };
  }

  private emit(event: DiagnosticEvent): void {
    this.events.emit(event);
  }
}

/** Reads the packet ID from raw bytes without a full parse (offset 8, 16 bytes). */
function peekPacketId(bytes: Uint8Array): string | undefined {
  if (bytes.length < 24) return undefined;
  let out = '';
  for (let i = 8; i < 24; i += 1) out += bytes[i]!.toString(16).padStart(2, '0');
  return out;
}

/**
 * Folds a packet ID into 16 bits for the advertised inventory hint.
 *
 * FNV-1a over the lower-case hex identity. It must be deterministic across
 * nodes -- two phones folding the same ID have to get the same number, or the
 * hint is noise -- so it deliberately depends on nothing but the string.
 */
function fold16(packetId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < packetId.length; i += 1) {
    hash ^= packetId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 16) ^ hash) & 0xffff;
}

/** Flattens a VisibleObject to the shape MapObjectRepository persists. */
function toMapObjectRecord(object: VisibleObject): MapObjectRecord {
  return {
    objectId: object.objectId,
    kind: object.kind,
    label: object.label,
    ...(object.state !== undefined ? { state: object.state } : {}),
    ...(object.latE7 !== undefined ? { latE7: object.latE7 } : {}),
    ...(object.lonE7 !== undefined ? { lonE7: object.lonE7 } : {}),
    asOfS: object.asOfS,
    provenance: object.provenance,
  };
}

export { Priority, MessageType };
