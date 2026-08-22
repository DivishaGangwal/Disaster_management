/**
 * BACKEND DOMAIN SERVICES
 *
 * Spec: 02-... "Backend model and service boundaries", "Conceptual online API
 * obligations"; GTW-003, WEB-001.
 *
 * The backend is a COORDINATION ENHANCEMENT. It is never in the critical path
 * for local SOS creation, relay, display, or local responder action
 * (02-... "Backend and online dashboards").
 *
 * GTW-003 / WEB-001: many gateways uploading one packet produce MANY
 * OBSERVATIONS of ONE incident -- never duplicate victims.
 */

import {
  BackendDedupOutcome,
  MessageType,
  SourceClass,
  type PacketId,
  type UploadBatchRequest,
  type UploadBatchResponse,
  type UploadItemResult,
} from '@dsm/contracts';
import { buildBackendAck, decodePacket, toEpochS } from '@dsm/codec';
import { validate } from '@dsm/validator';
import { IncidentReducer, type IncidentView } from '@dsm/incident';

export interface StoredCanonicalPacket {
  readonly packetId: PacketId;
  readonly bytes: Uint8Array;
  /** Payload digest, matching @dsm/validator. Not a digest of the full frame. */
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

export interface GatewayTransfer {
  readonly gatewayToken: string;
  readonly direction: 'upload' | 'download' | 'ack';
  readonly regionCode: string;
  readonly itemCount: number;
  readonly atMs: number;
}

export class BackendStore {
  /** One canonical packet per ID. */
  readonly packets = new Map<PacketId, StoredCanonicalPacket>();
  /** Many observations per packet (GTW-003). */
  readonly observations: GatewayObservation[] = [];
  /** Idempotency: a retried batch must not create duplicate observations. */
  protected readonly seenBatches = new Set<string>();
  incidents = new IncidentReducer();
  /** Packets queued for delivery back into the mesh, per region. */
  readonly outbound = new Map<string, { packetId: PacketId; bytes: Uint8Array; seq: number }[]>();
  protected outboundSeq = 0;
  readonly gatewayTokens = new Map<string, { nodeToken: string; regionCode: string }>();
  readonly gatewayTransfers: GatewayTransfer[] = [];

  isDuplicateBatch(batchId: string): boolean {
    return this.seenBatches.has(batchId);
  }

  rememberBatch(batchId: string): void {
    this.seenBatches.add(batchId);
    this.changed();
  }

  registerGateway(gatewayToken: string, nodeToken: string, regionCode: string): void {
    this.gatewayTokens.set(gatewayToken, { nodeToken, regionCode });
    this.changed();
  }

  addObservation(observation: GatewayObservation): void {
    this.observations.push(observation);
    this.changed();
  }

  recordGatewayTransfer(transfer: GatewayTransfer): void {
    this.gatewayTransfers.unshift(transfer);
    if (this.gatewayTransfers.length > 500) this.gatewayTransfers.length = 500;
    this.changed();
  }

  putPacket(packet: StoredCanonicalPacket): void {
    this.packets.set(packet.packetId, packet);
    this.changed();
  }

  enqueueOutbound(regionCode: string, packetId: PacketId, bytes: Uint8Array): void {
    const list = this.outbound.get(regionCode) ?? [];
    if (list.some((item) => item.packetId === packetId)) return; // idempotent
    this.outboundSeq += 1;
    list.push({ packetId, bytes, seq: this.outboundSeq });
    this.outbound.set(regionCode, list);
    this.changed();
  }

  protected changed(): void {}

  snapshotCore() {
    return {
      packets: [...this.packets.values()].map((packet) => ({
        ...packet,
        bytesBase64: Buffer.from(packet.bytes).toString('base64'),
        bytes: undefined,
      })),
      observations: this.observations,
      seenBatches: [...this.seenBatches],
      outbound: [...this.outbound.entries()].map(([regionCode, items]) => ({
        regionCode,
        items: items.map((item) => ({ ...item, bytesBase64: Buffer.from(item.bytes).toString('base64'), bytes: undefined })),
      })),
      outboundSeq: this.outboundSeq,
      gatewayTokens: [...this.gatewayTokens.entries()],
      gatewayTransfers: this.gatewayTransfers,
    };
  }

  restoreCore(snapshot: ReturnType<BackendStore['snapshotCore']>): void {
    this.packets.clear();
    this.observations.splice(0);
    this.seenBatches.clear();
    this.outbound.clear();
    this.gatewayTokens.clear();
    this.gatewayTransfers.splice(0);
    this.incidents = new IncidentReducer();
    for (const packet of snapshot.packets) {
      const { bytesBase64, ...rest } = packet;
      const stored = { ...rest, bytes: new Uint8Array(Buffer.from(bytesBase64, 'base64')) } as StoredCanonicalPacket;
      this.packets.set(stored.packetId, stored);
      const decoded = decodePacket(stored.bytes);
      if (decoded.ok) this.incidents.apply(decoded.packet, { localSourceId: 'backend' });
    }
    this.observations.push(...snapshot.observations);
    for (const batch of snapshot.seenBatches) this.seenBatches.add(batch);
    for (const entry of snapshot.outbound) {
      this.outbound.set(
        entry.regionCode,
        entry.items.map((item) => {
          const { bytesBase64, ...rest } = item;
          return { ...rest, bytes: new Uint8Array(Buffer.from(bytesBase64, 'base64')) };
        }),
      );
    }
    this.outboundSeq = snapshot.outboundSeq;
    for (const [token, value] of snapshot.gatewayTokens) this.gatewayTokens.set(token, value);
    this.gatewayTransfers.push(...(snapshot.gatewayTransfers ?? []));
  }

  readOutbound(regionCode: string, cursor: string | undefined, max: number) {
    const after = cursor ? Number.parseInt(cursor, 10) : 0;
    const list = (this.outbound.get(regionCode) ?? []).filter((item) => item.seq > after);
    const page = list.slice(0, max);
    const last = page[page.length - 1];
    return {
      items: page.map((item) => ({ packetId: item.packetId, bytes: item.bytes })),
      nextCursor: last ? String(last.seq) : cursor,
      hasMore: list.length > page.length,
    };
  }
}

export class IngestService {
  constructor(private readonly store: BackendStore) {}

  /**
   * Revalidates every uploaded packet with the SAME rules the phones use
   * (02-... "Ingestion ... Revalidates structure and integrity").
   */
  ingest(request: UploadBatchRequest, nowMs: number): UploadBatchResponse {
    // Retrying a batch is safe: a lost response may cause a duplicate
    // observation, never a duplicate packet or incident (02-...).
    const replay = this.store.isDuplicateBatch(request.batchId);
    this.store.rememberBatch(request.batchId);

    const results: UploadItemResult[] = [];

    for (const item of request.items) {
      const validation = validate(item.bytes, {
        nowS: toEpochS(nowMs),
        transport: 'gateway',
        hopCountOnArrival: item.observation.hopCountOnArrival,
        isKnownDuplicate: this.store.packets.has(item.packetId),
        ...(this.store.packets.get(item.packetId)?.digest
          ? { conflictingDigest: this.store.packets.get(item.packetId)!.digest }
          : {}),
        streamTerminated: false,
        storagePressure: 'ok',
        queueDepth: 0,
        // 02-...: "No budget may remain unlimited." Backend-side ingest bound.
        maxQueueDepth: 50_000,
      });

      if (!validation.ok) {
        results.push({
          packetId: item.packetId,
          outcome: validation.reason === 'reject.digest-conflict' ? 'conflicted' : 'invalid',
          reason: validation.reason,
        });
        continue;
      }

      const existing = this.store.packets.get(item.packetId);
      // Use the VALIDATOR's digest (payload digest). Storing a whole-packet
      // digest here would not match what `conflictingDigest` is compared
      // against, and identical re-uploads would be reported as conflicts.
      const digest = validation.digest;

      if (existing && existing.digest !== digest) {
        results.push({ packetId: item.packetId, outcome: 'conflicted', reason: 'digest mismatch' });
        continue;
      }

      if (!replay) {
        this.store.addObservation({
          packetId: item.packetId,
          gatewayToken: request.gatewayToken,
          receivedAtMs: item.observation.receivedAtMs,
          uploadedAtMs: nowMs,
          hopCountOnArrival: item.observation.hopCountOnArrival,
          transport: item.observation.transport,
        });
      }

      if (existing) {
        // GTW-003: another observation of the SAME incident.
        results.push({
          packetId: item.packetId,
          outcome: 'duplicate',
          backendReceiptId: `RCP-${item.packetId.slice(0, 8)}`,
        });
        continue;
      }

      this.store.putPacket({
        packetId: item.packetId,
        bytes: item.bytes,
        digest,
        firstSeenAtMs: nowMs,
      });
      this.store.incidents.apply(validation.packet, { localSourceId: 'backend' });

      const receiptId = `RCP-${item.packetId.slice(0, 8)}`;
      results.push({ packetId: item.packetId, outcome: 'accepted', backendReceiptId: receiptId });

      // GTW-004: the acknowledgement returns as its OWN packet, through the mesh.
      this.emitAcknowledgement(item.packetId, receiptId, validation.packet.streamId, nowMs, request.gatewayToken);
    }

    return { batchId: request.batchId, results, acceptedAtMs: nowMs };
  }

  private emitAcknowledgement(
    forPacketId: PacketId,
    receiptId: string,
    incidentId: string | undefined,
    nowMs: number,
    gatewayToken: string,
  ): void {
    const region = this.store.gatewayTokens.get(gatewayToken)?.regionCode ?? 'UNKNOWN';
    const ack = buildBackendAck(
      { sourceId: 'bacc0000bacc0000', sourceClass: SourceClass.BACKEND, nowS: toEpochS(nowMs) },
      forPacketId,
      receiptId,
      BackendDedupOutcome.ACCEPTED_NEW,
      incidentId,
    );
    this.store.enqueueOutbound(region, ack.packetId, ack.bytes);
  }
}

export class IncidentQueryService {
  constructor(private readonly store: BackendStore) {}

  /** WEB-001: ONE deduplicated incident with MANY observations. */
  list(): readonly (IncidentView & { readonly observationCount: number })[] {
    return this.store.incidents.list().map((incident) => ({
      ...incident,
      observationCount: this.observationsForIncident(incident.incidentId).length,
    }));
  }

  detail(incidentId: string) {
    const incident = this.store.incidents.view(incidentId);
    if (!incident) return undefined;
    return { incident, observations: this.observationsForIncident(incidentId) };
  }

  private observationsForIncident(incidentId: string): readonly GatewayObservation[] {
    const packetIds = new Set<PacketId>();
    for (const [id, stored] of this.store.packets) {
      const decoded = decodePacket(stored.bytes);
      if (decoded.ok && decoded.packet.streamId === incidentId) packetIds.add(id);
    }
    return this.store.observations.filter((o) => packetIds.has(o.packetId));
  }
}

/** Outbound selection is region and relevance bounded (WEB-010). */
export class OutboundService {
  constructor(private readonly store: BackendStore) {}

  poll(gatewayToken: string, regionCode: string, cursor: string | undefined, max: number) {
    return this.store.readOutbound(regionCode, cursor, max);
  }

  /**
   * Publishes an authority record into the mesh (internet-to-mesh).
   * The dashboard calls this; it never writes phone state directly.
   */
  publish(regionCode: string, packetId: PacketId, bytes: Uint8Array): void {
    const decoded = decodePacket(bytes);
    if (!decoded.ok) throw new Error(`refusing to publish an invalid packet: ${decoded.reason}`);
    if (decoded.packet.header.type === MessageType.FILE_FRAGMENT) {
      throw new Error('file fragments are requested, never pushed');
    }
    this.store.enqueueOutbound(regionCode, packetId, bytes);
  }
}
