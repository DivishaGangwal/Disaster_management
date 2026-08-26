/**
 * GATEWAY SYNCHRONIZER -- mesh-to-internet and internet-to-mesh.
 *
 * Spec: 02-... "Gateway synchronizer", "Mesh-to-internet flow",
 * "Internet-to-mesh flow"; GTW-002..GTW-008; DEC-010.
 *
 * GTW-005: downloaded packets go through engine.ingest() -- the SAME validator
 * and policy path as any Bluetooth packet. There is no privileged backend
 * ingress.
 * GTW-002: uploads are priority-aware, bounded, and resumable.
 */

import {
  EventCategory,
  GATEWAY,
  type GatewayClient,
  type PacketId,
  type UploadItem,
} from '@dsm/contracts';
import type { NodeEngine } from './node-engine.js';

export interface GatewaySyncOptions {
  readonly engine: NodeEngine;
  readonly client: GatewayClient;
  readonly regionCode: string;
  readonly now: () => number;
}

export interface SyncReport {
  readonly probed: boolean;
  readonly proven: boolean;
  readonly uploaded: number;
  readonly accepted: number;
  readonly duplicates: number;
  readonly downloaded: number;
  readonly injectedIntoMesh: number;
  readonly failureReason?: string;
}

export class GatewaySynchronizer {
  private gatewayToken?: string;
  private outboundCursor?: string;
  /** Only advanced after a confirmed backend response (02-... transactions). */
  private lastConfirmedCursor?: string;
  private consecutiveFailures = 0;

  constructor(private readonly options: GatewaySyncOptions) {}

  /**
   * One full sync cycle. Safe to call when offline: it probes first and
   * degrades to a no-op without losing queued work (GTW-007).
   */
  async sync(): Promise<SyncReport> {
    const { engine, client, now } = this.options;
    const atMs = now();

    const probe = await client.probe();
    engine.setGatewayProven(probe.proven, probe.atMs);
    if (!probe.proven) {
      this.consecutiveFailures += 1;
      return {
        probed: true,
        proven: false,
        uploaded: 0,
        accepted: 0,
        duplicates: 0,
        downloaded: 0,
        injectedIntoMesh: 0,
        ...(probe.failureReason ? { failureReason: probe.failureReason } : {}),
      };
    }
    this.consecutiveFailures = 0;

    // Registration doubles as a real heartbeat. Repeating it is idempotent and
    // lets the authority console show current queue/battery data instead of a
    // guessed connection state from a seeded row or browser network icon.
    const [queueDepth, storedPackets] = await Promise.all([
      engine.packets.listRelayable(64).then((items) => items.length),
      engine.packets.count(),
    ]);
    const registration = await client.register(engine.nodeToken, this.options.regionCode, {
      ...(engine.hasMeasuredBatteryBand ? { batteryBand: engine.batteryBandValue } : {}),
      queueDepth,
      storedPackets,
    });
    this.gatewayToken = registration.gatewayToken;

    const upload = await this.uploadBatch(atMs);
    const download = await this.downloadBatch(atMs);

    return {
      probed: true,
      proven: true,
      uploaded: upload.uploaded,
      accepted: upload.accepted,
      duplicates: upload.duplicates,
      downloaded: download.downloaded,
      injectedIntoMesh: download.injected,
    };
  }

  /** Mesh-to-internet: critical packets first, then bounded normal batches. */
  private async uploadBatch(atMs: number): Promise<{ uploaded: number; accepted: number; duplicates: number }> {
    const { engine, client } = this.options;
    const custodies = await engine.packets.listUploadQueue(GATEWAY.MAX_UPLOAD_BATCH);
    if (custodies.length === 0) return { uploaded: 0, accepted: 0, duplicates: 0 };

    const items: UploadItem[] = [];
    let bytes = 0;
    for (const custody of custodies) {
      const stored = await engine.packets.get(custody.packetId);
      if (!stored) continue;
      if (bytes + stored.encoded.totalBytes > GATEWAY.MAX_BATCH_BYTES) break;
      const observations = await engine.packets.listObservations(custody.packetId);
      const first = observations[0];
      items.push({
        bytes: stored.encoded.bytes,
        packetId: custody.packetId,
        observation: {
          receivedAtMs: first?.receivedAtMs ?? stored.storedAtMs,
          transport: first?.transport ?? 'local',
          hopCountOnArrival: first?.hopCountOnArrival ?? 0,
        },
      });
      bytes += stored.encoded.totalBytes;
    }
    if (items.length === 0) return { uploaded: 0, accepted: 0, duplicates: 0 };

    // Idempotency key: a retried batch must not duplicate observations.
    const batchId = `${engine.nodeToken}-${atMs}`;
    const response = await client.upload({ gatewayToken: this.gatewayToken!, batchId, items });

    let accepted = 0;
    let duplicates = 0;
    for (const result of response.results) {
      if (result.outcome === 'accepted') accepted += 1;
      if (result.outcome === 'duplicate') duplicates += 1;

      const custody = await engine.packets.getCustody(result.packetId);
      if (custody && (result.outcome === 'accepted' || result.outcome === 'duplicate')) {
        await engine.packets.updateCustody({ ...custody, uploadState: 'uploaded' });
      }
    }

    engine.events.emit({
      category: EventCategory.GATEWAY,
      name: 'upload',
      severity: 'info',
      atMs,
      bytes,
      metrics: { items: items.length, accepted, duplicates },
    });

    return { uploaded: items.length, accepted, duplicates };
  }

  /** Internet-to-mesh: download, revalidate locally, then advertise onward. */
  private async downloadBatch(atMs: number): Promise<{ downloaded: number; injected: number }> {
    const { engine, client } = this.options;

    const response = await client.pollOutbound({
      gatewayToken: this.gatewayToken!,
      ...(this.outboundCursor ? { cursor: this.outboundCursor } : {}),
      regionCode: this.options.regionCode,
      maxItems: GATEWAY.MAX_DOWNLOAD_BATCH,
    });

    const acked: PacketId[] = [];
    let injected = 0;
    for (const item of response.items) {
      // GTW-005: exactly the same validator and policy path as Bluetooth.
      const result = await engine.ingest(item.bytes, 'gateway', { atMs });
      if (result.accepted) injected += 1;
      acked.push(item.packetId);
    }

    if (acked.length > 0 && response.nextCursor) {
      await client.ackOutbound({
        gatewayToken: this.gatewayToken!,
        cursor: response.nextCursor,
        packetIds: acked,
      });
      // Only NOW does the cursor advance.
      this.lastConfirmedCursor = response.nextCursor;
      this.outboundCursor = response.nextCursor;
    }

    engine.events.emit({
      category: EventCategory.GATEWAY,
      name: 'download',
      severity: 'info',
      atMs,
      metrics: { downloaded: response.items.length, injected },
    });

    return { downloaded: response.items.length, injected };
  }

  get cursor(): string | undefined {
    return this.lastConfirmedCursor;
  }

  get failures(): number {
    return this.consecutiveFailures;
  }
}
