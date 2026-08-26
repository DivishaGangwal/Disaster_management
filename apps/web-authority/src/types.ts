import type { CampaignState, DeploymentRegionCode, IncidentState, WebRole } from '@dsm/contracts';

export type SectionKey = 'coordinate' | 'publish' | 'campaigns' | 'wavepx' | 'network';

export interface OperatorSession {
  readonly operatorLabel: string;
  readonly operationsKey: string;
  readonly roles: readonly WebRole[];
  readonly regionCode: DeploymentRegionCode;
}

export interface Incident {
  readonly incidentId: string;
  readonly state: IncidentState;
  readonly severity: number;
  readonly category: number;
  readonly peopleTotal?: number;
  readonly injured?: number;
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly locationAccuracyM?: number;
  readonly locationAgeS?: number;
  readonly locationReportedAtS?: number;
  readonly updatedAtS: number;
  readonly observationCount: number;
  readonly assignmentId?: string;
  readonly responderRef?: string;
  readonly timeline: readonly { readonly summary: string; readonly atS: number }[];
}

export interface Responder {
  readonly responderRef: string;
  readonly name: string;
  readonly district: string;
  readonly capabilities: readonly string[];
  readonly available: boolean;
  readonly provisionedByDemo: boolean;
  readonly assignmentId?: string;
  readonly incidentId?: string;
  readonly status: 'available' | 'assigned' | 'accepted' | 'en-route' | 'arrived';
  readonly lastUpdatedAtMs: number;
}

export interface RegionalRecord {
  readonly objectId: string;
  readonly kind: string;
  readonly name: string;
  readonly district: string;
  readonly latE7: number;
  readonly lonE7: number;
  readonly state: string;
  readonly version: number;
  readonly updatedAtMs: number;
  readonly synthetic: true;
}

export interface Campaign {
  readonly campaignId: string;
  readonly campaignVersion: number;
  readonly title: string;
  readonly summary: string;
  readonly dataType?: 'official-alert' | 'regional-record' | 'check-in';
  readonly objectId?: string;
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly radiusM?: number;
  readonly regionCode: string;
  readonly state: string;
  readonly profile: string;
  readonly contentRevision: number;
  readonly validatedRevision?: number;
  readonly approvalDigest?: string;
  readonly packetId: string;
  readonly severity: number;
  readonly category: number;
  readonly instruction: number;
  readonly packetBytesBase64: string;
  readonly messageType: number;
  readonly priority: number;
  readonly packetPreview?: {
    readonly typeName: string;
    readonly family: string;
    readonly sourceLabel: string;
    readonly payload: Record<string, unknown>;
    readonly bytesHex: string;
    readonly totalBytes: number;
    readonly mapOperations: readonly DecodedMapOperation[];
  };
  readonly broadcastProgram?: BroadcastProgram;
  readonly decodeResult?: BroadcastDecodeResult;
  readonly broadcastEvents?: readonly BroadcastEvent[];
  readonly preview: {
    readonly totalTier2Bytes: number;
    readonly totalDurationS: number;
    readonly budgetS: number;
    readonly overBudget: boolean;
    readonly items: readonly {
      readonly packetId: string;
      readonly tier1Bytes: number;
      readonly tier2Bytes: number;
      readonly frameCount: number;
      readonly repeats: number;
      readonly estimatedAudioMs: number;
    }[];
    readonly burstSchedule: readonly { readonly packetId: string; readonly repeatIndex: number }[];
  };
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface BroadcastEvent {
  readonly eventId: string;
  readonly event: 'exported' | 'played';
  readonly programId: string;
  readonly campaignVersion: number;
  readonly artifactDigest: string;
  readonly operatorLabel: string;
  readonly atMs: number;
}

export interface BroadcastProgram {
  readonly programId: string;
  readonly campaignId: string;
  readonly campaignVersion: number;
  readonly profile: 'audible-fast' | 'audible-normal' | 'ultrasound-normal';
  readonly sampleRate: 48000;
  readonly artifactDigest: string;
  readonly uniqueFramesBase64: readonly string[];
  readonly playbackFramesBase64: readonly string[];
  readonly createdAtMs: number;
}

export interface BroadcastDecodeResult {
  readonly passed: boolean;
  readonly expectedFrames: number;
  readonly recoveredFrames: number;
  readonly corruptFrames: number;
  readonly unexpectedFrames: number;
  readonly missingFrames: number;
  readonly canonicalMatch?: boolean;
  readonly reassembledPacketId?: string;
  readonly reassembledDigest?: string;
  readonly receiverLabel: string;
  readonly receptionTransport: 'tier2-mic' | 'tier2-direct';
  readonly mapOperations?: readonly DecodedMapOperation[];
  readonly decodedMessage?: DecodedBroadcastMessage;
  readonly testedAtMs: number;
}

export interface DecodedMapOperation {
  readonly kind: string;
  readonly causedByPacketId: string;
  readonly transport: string;
  readonly objectId?: string;
  readonly state?: number | string;
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly temporary?: boolean;
}

export interface DecodedBroadcastMessage {
  readonly packetId: string;
  readonly messageType: number;
  readonly alertId: string;
  readonly campaignId: string;
  readonly regionCode: string;
  readonly category: number;
  readonly instruction: number;
  readonly severity: number;
  readonly language: string;
  readonly text: string;
  readonly location?: DecodedBroadcastLocation;
  readonly typeName?: string;
  readonly payload?: Record<string, unknown>;
}

export interface DecodedBroadcastLocation {
  readonly latE7: number;
  readonly lonE7: number;
  readonly radiusM?: number;
  readonly matchesApproved: boolean;
}

export interface PacketStreamItem {
  readonly packetId: string;
  readonly type: number;
  readonly typeName: string;
  readonly family: string;
  readonly streamId?: string;
  readonly sourceId: string;
  readonly sourceClass: number;
  readonly sourceLabel: string;
  readonly priority: number;
  readonly severity: number;
  readonly flags: number;
  readonly hopCount: number;
  readonly hopLimit: number;
  readonly payloadBytes: number;
  readonly totalBytes: number;
  readonly fragmentIndex: number;
  readonly fragmentCount: number;
  readonly digest: string;
  readonly digestPrefix: string;
  readonly createdAtS: number;
  readonly expiresAtS: number;
  readonly firstSeenAtMs: number;
  readonly direction: 'mesh-to-internet' | 'internet-to-mesh' | 'radio-to-mesh' | 'mesh-local';
  readonly geo?: { readonly latE7: number; readonly lonE7: number; readonly accuracyM: number; readonly scopeRadiusM: number };
  readonly payload: Record<string, unknown>;
  readonly observations: readonly {
    readonly gatewayToken: string;
    readonly receivedAtMs: number;
    readonly uploadedAtMs: number;
    readonly hopCountOnArrival: number;
    readonly transport: string;
  }[];
  readonly outboundRegions: readonly string[];
  readonly bytesBase64: string;
  readonly bytesHex: string;
}

export interface AuditRecord {
  readonly id: string;
  readonly atMs: number;
  readonly action: string;
  readonly subject: string;
  readonly detail: string;
}

export interface GatewayAudit {
  readonly gateways: readonly {
    readonly gatewayToken: string;
    readonly nodeToken: string;
    readonly regionCode: string;
    readonly lastSeenAtMs?: number;
    readonly telemetry?: { readonly batteryBand?: number; readonly queueDepth: number; readonly storedPackets: number };
  }[];
  readonly observations: readonly {
    readonly packetId: string;
    readonly gatewayToken: string;
    readonly receivedAtMs: number;
    readonly uploadedAtMs: number;
    readonly hopCountOnArrival: number;
    readonly transport: string;
  }[];
  readonly outbound: readonly { readonly regionCode: string; readonly queued: number }[];
  readonly transfers: readonly { readonly gatewayToken: string; readonly direction: 'upload' | 'download' | 'ack'; readonly regionCode: string; readonly itemCount: number; readonly atMs: number }[];
}

export interface Overview {
  readonly region: { readonly code: string; readonly name: string; readonly synthetic: true };
  readonly counts: {
    readonly activeIncidents: number;
    readonly availableResponders: number;
    readonly outboundPackets: number;
    readonly approvedCampaigns: number;
  };
  readonly latestAudit: readonly AuditRecord[];
}
