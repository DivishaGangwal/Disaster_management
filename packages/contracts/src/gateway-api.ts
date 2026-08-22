/**
 * GATEWAY / BACKEND CONTRACT  --  FROZEN (Gate IV)
 *
 * Spec: 02-... "Conceptual online API obligations", GTW-001..GTW-008.
 *
 * GTW-001: a gateway flag requires a RECENT SUCCESSFUL LIVE PROBE. An Android
 * network icon is not proof (01-... non-negotiable decision 1).
 * GTW-008: the source UI must not show backend success until a
 * BACKEND_ACKNOWLEDGEMENT packet reaches the source phone.
 */

import type { PacketId } from './envelope.js';

/** Result of the live probe that alone may declare a gateway. */
export interface ProbeResult {
  readonly proven: boolean;
  readonly atMs: number;
  readonly latencyMs?: number;
  readonly failureReason?: string;
  /** Backend build/region identity, so a captive portal cannot pass as backend. */
  readonly backendIdentity?: string;
}

export interface UploadItem {
  /** Canonical packet bytes. The backend revalidates with the same rules. */
  readonly bytes: Uint8Array;
  readonly packetId: PacketId;
  readonly observation: {
    readonly receivedAtMs: number;
    readonly transport: string;
    readonly hopCountOnArrival: number;
  };
}

export type UploadOutcome = 'accepted' | 'duplicate' | 'conflicted' | 'expired' | 'invalid';

export interface UploadItemResult {
  readonly packetId: PacketId;
  readonly outcome: UploadOutcome;
  readonly backendReceiptId?: string;
  readonly reason?: string;
}

export interface UploadBatchRequest {
  readonly gatewayToken: string;
  /** Idempotency key: retrying the same batch must not duplicate observations. */
  readonly batchId: string;
  readonly items: readonly UploadItem[];
}

export interface UploadBatchResponse {
  readonly batchId: string;
  readonly results: readonly UploadItemResult[];
  readonly acceptedAtMs: number;
}

/** GTW-005: downloaded packets enter the same local validator and policy path. */
export interface OutboundPollRequest {
  readonly gatewayToken: string;
  /** Opaque cursor. Advances only after confirmed acknowledgement (02-...). */
  readonly cursor?: string;
  readonly regionCode: string;
  readonly maxItems: number;
}

export interface OutboundPollResponse {
  readonly items: readonly { readonly packetId: PacketId; readonly bytes: Uint8Array }[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

export interface OutboundAckRequest {
  readonly gatewayToken: string;
  readonly cursor: string;
  readonly packetIds: readonly PacketId[];
}

/** What the mobile app needs from any gateway implementation. */
export interface GatewayClient {
  probe(): Promise<ProbeResult>;
  register(nodeToken: string, regionCode: string): Promise<{ readonly gatewayToken: string }>;
  upload(request: UploadBatchRequest): Promise<UploadBatchResponse>;
  pollOutbound(request: OutboundPollRequest): Promise<OutboundPollResponse>;
  ackOutbound(request: OutboundAckRequest): Promise<void>;
}

/** Local gateway status shown on the relay/gateway screen (01-... screen 9). */
export interface GatewayStatus {
  /** 'untested' | 'unavailable' | 'probing' | 'proven' -- never "connected". */
  readonly state: 'untested' | 'unavailable' | 'probing' | 'proven';
  readonly lastProbeAtMs?: number;
  readonly lastUploadAtMs?: number;
  readonly lastDownloadAtMs?: number;
  readonly queuedForUpload: number;
  readonly uploadCursor?: string;
  readonly outboundCursor?: string;
}
