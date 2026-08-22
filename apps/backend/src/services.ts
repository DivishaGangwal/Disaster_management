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
import { type IncidentView } from '@dsm/incident';
import { SqliteBackendStore as BackendStore, type GatewayObservation, type StoredCanonicalPacket } from './store.js';

export { BackendStore };

// Re-export types so existing imports from './services.js' still work
export type { StoredCanonicalPacket, GatewayObservation };

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
        maxQueueDepth: Number.MAX_SAFE_INTEGER,
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
        this.store.pushObservation(
          {
            packetId: item.packetId,
            gatewayToken: request.gatewayToken,
            receivedAtMs: item.observation.receivedAtMs,
            uploadedAtMs: nowMs,
            hopCountOnArrival: item.observation.hopCountOnArrival,
            transport: item.observation.transport,
          },
          request.batchId,
        );
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

      this.store.packets.set(item.packetId, {
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
