/**
 * @dsm/gateway-client -- opportunistic internet, never assumed.
 *
 * Spec: 02-... "Gateway synchronizer"; GTW-001..GTW-008; DEC-009, DEC-010.
 *
 * GTW-001: a gateway flag requires a RECENT SUCCESSFUL LIVE PROBE. An Android
 * network icon proves nothing -- a captive portal returns 200 for anything, so
 * the probe checks for the backend's own identity string.
 *
 * GTW-007: losing connectivity degrades to ordinary relay WITHOUT data loss.
 */

import {
  FRESHNESS,
  GATEWAY,
  type GatewayClient,
  type GatewayStatus,
  type OutboundAckRequest,
  type OutboundPollRequest,
  type OutboundPollResponse,
  type PacketId,
  type ProbeResult,
  type UploadBatchRequest,
  type UploadBatchResponse,
} from '@dsm/contracts';

export interface HttpLike {
  (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }): Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>;
}

export interface HttpGatewayOptions {
  readonly baseUrl: string;
  readonly fetchImpl?: HttpLike;
  readonly probeTimeoutMs?: number;
  /** Expected backend identity. A captive portal cannot forge this. */
  readonly expectedIdentity?: string;
}

export class HttpGatewayClient implements GatewayClient {
  private readonly fetchImpl: HttpLike;

  constructor(private readonly options: HttpGatewayOptions) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as HttpLike);
  }

  /**
   * The LIVE PROBE. This is the only thing that may declare a gateway.
   * A network icon, a "connected" Wi-Fi state, or a successful DNS lookup
   * is not proof (01-... non-negotiable decision 1).
   */
  async probe(): Promise<ProbeResult> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.probeTimeoutMs ?? GATEWAY.PROBE_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(`${this.options.baseUrl}/health`, { signal: controller.signal });
      if (!response.ok) {
        return { proven: false, atMs: Date.now(), failureReason: `http ${response.status}` };
      }
      const body = (await response.json()) as { identity?: string };
      if (this.options.expectedIdentity && body.identity !== this.options.expectedIdentity) {
        // Captive portals answer 200 with their own page. Identity mismatch
        // means we are NOT talking to the coordination backend.
        return { proven: false, atMs: Date.now(), failureReason: 'backend identity mismatch' };
      }
      return {
        proven: true,
        atMs: Date.now(),
        latencyMs: Date.now() - startedAt,
        ...(body.identity ? { backendIdentity: body.identity } : {}),
      };
    } catch (error) {
      return { proven: false, atMs: Date.now(), failureReason: String(error) };
    } finally {
      clearTimeout(timeout);
    }
  }

  async register(nodeToken: string, regionCode: string): Promise<{ gatewayToken: string }> {
    const response = await this.post('/gateway/register', { nodeToken, regionCode });
    return response as { gatewayToken: string };
  }

  async upload(request: UploadBatchRequest): Promise<UploadBatchResponse> {
    const wire = {
      gatewayToken: request.gatewayToken,
      batchId: request.batchId,
      items: request.items.map((item) => ({
        packetId: item.packetId,
        bytesBase64: base64(item.bytes),
        observation: item.observation,
      })),
    };
    return (await this.post('/gateway/upload', wire)) as UploadBatchResponse;
  }

  async pollOutbound(request: OutboundPollRequest): Promise<OutboundPollResponse> {
    const raw = (await this.post('/gateway/outbound', request)) as {
      items: { packetId: PacketId; bytesBase64: string }[];
      nextCursor?: string;
      hasMore: boolean;
    };
    return {
      items: raw.items.map((item) => ({ packetId: item.packetId, bytes: unbase64(item.bytesBase64) })),
      ...(raw.nextCursor ? { nextCursor: raw.nextCursor } : {}),
      hasMore: raw.hasMore,
    };
  }

  async ackOutbound(request: OutboundAckRequest): Promise<void> {
    await this.post('/gateway/outbound/ack', request);
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`gateway ${path} failed with ${response.status}`);
    return response.json();
  }
}

/**
 * Tracks proven-gateway state with an expiry. A stale proof is NOT a gateway
 * (FRESHNESS.GATEWAY_PROOF_S), so the UI can never show a permanent green tick.
 */
export class GatewayStateTracker {
  private status: GatewayStatus = { state: 'untested', queuedForUpload: 0 };

  recordProbe(result: ProbeResult): GatewayStatus {
    this.status = {
      ...this.status,
      state: result.proven ? 'proven' : 'unavailable',
      lastProbeAtMs: result.atMs,
    };
    return this.status;
  }

  markProbing(): GatewayStatus {
    this.status = { ...this.status, state: 'probing' };
    return this.status;
  }

  /** Expires the proof so gateway features disappear safely (DEC-009). */
  current(nowMs: number): GatewayStatus {
    if (this.status.state !== 'proven') return this.status;
    const lastProbe = this.status.lastProbeAtMs ?? 0;
    if (nowMs - lastProbe > FRESHNESS.GATEWAY_PROOF_S * 1000) {
      this.status = { ...this.status, state: 'untested' };
    }
    return this.status;
  }

  recordUpload(atMs: number, cursor?: string): void {
    this.status = { ...this.status, lastUploadAtMs: atMs, ...(cursor ? { uploadCursor: cursor } : {}) };
  }

  /** 02-...: "A gateway cursor advances only after confirmed backend response." */
  recordDownload(atMs: number, cursor?: string): void {
    this.status = { ...this.status, lastDownloadAtMs: atMs, ...(cursor ? { outboundCursor: cursor } : {}) };
  }

  setQueueDepth(depth: number): void {
    this.status = { ...this.status, queuedForUpload: depth };
  }
}

function base64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function unbase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export { base64 as encodeBase64, unbase64 as decodeBase64 };
