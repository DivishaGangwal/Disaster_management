import { createHash, randomUUID } from 'node:crypto';
import {
  AlertCategory,
  ENVELOPE,
  Flags,
  GeometryKind,
  InstructionCode,
  MessageType,
  OperationalState,
  RouteState,
  Severity,
  SourceClass,
  messageTypeName,
  type CampaignState,
} from '@dsm/contracts';
import {
  buildHazard,
  buildOfficialAlert,
  buildResponderState,
  buildResourceRecord,
  buildRouteState,
  decodePacket,
  toEpochS,
} from '@dsm/codec';
import {
  contentEdited,
  decodeTier2Frame,
  planCampaign,
  toTier2Frames,
  transitionCampaign,
  type GgwaveProfileName,
} from '@dsm/tier2';
import { IngestService, OutboundService } from './services.js';
import {
  SqliteBackendStore,
  type CampaignRecord,
  type BroadcastDecodeResult,
  type BroadcastProgramRecord,
  type RegionalRecord,
  type ResponderRecord,
} from './sqlite-store.js';

export const REGION_CODE = 'IN-AS';
const AUTHORITY_SOURCE_ID = 'a55a0ff1ce000001';
const COORDINATOR_SOURCE_ID = 'c00d1a7000000001';

export interface CampaignCreateInput {
  readonly title: string;
  readonly summary: string;
  readonly severity?: number;
  readonly category?: number;
  readonly instruction?: number;
  readonly profile?: GgwaveProfileName;
}

export class OperationsService {
  constructor(
    private readonly store: SqliteBackendStore,
    private readonly ingest: IngestService,
    private readonly outbound: OutboundService,
  ) {}

  overview() {
    const incidents = this.store.incidents.list();
    const campaigns = [...this.store.campaigns.values()];
    return {
      region: { code: REGION_CODE, name: 'Assam State Operations Region', synthetic: true },
      counts: {
        activeIncidents: incidents.filter((item) => !['resolved', 'cancelled', 'expired'].includes(item.state)).length,
        availableResponders: [...this.store.responders.values()].filter((item) => item.available).length,
        outboundPackets: [...this.store.outbound.values()].reduce((sum, items) => sum + items.length, 0),
        approvedCampaigns: campaigns.filter((item) => ['approved', 'broadcaster-ready', 'audio-generated', 'decode-tested', 'scheduled', 'played', 'archived'].includes(item.state)).length,
      },
      latestAudit: this.store.audit.slice(0, 8),
    };
  }

  packetStream() {
    const outboundByPacket = new Map<string, string[]>();
    for (const [regionCode, items] of this.store.outbound) {
      for (const item of items) {
        const regions = outboundByPacket.get(item.packetId) ?? [];
        regions.push(regionCode);
        outboundByPacket.set(item.packetId, regions);
      }
    }
    return [...this.store.packets.values()]
      .map((stored) => {
        const decoded = decodePacket(stored.bytes);
        if (!decoded.ok) return undefined;
        const packet = decoded.packet;
        const observations = this.store.observations.filter((item) => item.packetId === stored.packetId);
        const outboundRegions = outboundByPacket.get(stored.packetId) ?? [];
        const tier2Origin = (packet.header.flags & Flags.TIER2_ORIGIN) !== 0;
        const direction = tier2Origin
          ? 'radio-to-mesh'
          : observations.length > 0 && [SourceClass.GENERAL_PUBLIC, SourceClass.RESPONDER_PROVISIONED].includes(packet.header.sourceClass as 1 | 2)
            ? 'mesh-to-internet'
            : outboundRegions.length > 0
              ? 'internet-to-mesh'
              : 'mesh-local';
        return {
          packetId: stored.packetId,
          type: packet.header.type,
          typeName: messageTypeName(packet.header.type) ?? `TYPE_${packet.header.type}`,
          family: packetFamily(packet.header.type),
          streamId: packet.streamId,
          sourceId: packet.header.sourceId,
          sourceClass: packet.header.sourceClass,
          sourceLabel: sourceClassLabel(packet.header.sourceClass),
          priority: packet.header.priority,
          severity: packet.header.severity,
          flags: packet.header.flags,
          hopCount: Math.max(packet.header.hopCount, ...observations.map((item) => item.hopCountOnArrival), 0),
          hopLimit: packet.header.hopLimit,
          payloadBytes: packet.header.payloadLength,
          totalBytes: stored.bytes.length,
          fragmentIndex: packet.header.fragmentIndex,
          fragmentCount: packet.header.fragmentCount,
          digest: stored.digest,
          digestPrefix: packet.header.digestPrefix,
          createdAtS: packet.header.createdAt,
          expiresAtS: packet.header.expiresAt,
          firstSeenAtMs: stored.firstSeenAtMs,
          direction,
          geo: packet.geo,
          payload: jsonSafe(packet.payload),
          observations,
          outboundRegions,
          bytesBase64: Buffer.from(stored.bytes).toString('base64'),
          bytesHex: Buffer.from(stored.bytes).toString('hex'),
        };
      })
      .filter((item) => item !== undefined)
      .sort((a, b) => b.firstSeenAtMs - a.firstSeenAtMs);
  }

  listResponders(): readonly ResponderRecord[] {
    return [...this.store.responders.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  assignResponder(responderRef: string, incidentId: string, dispatcherLabel: string): ResponderRecord {
    const responder = this.store.responders.get(responderRef);
    if (!responder) throw new Error('unknown responder');
    if (!responder.available) throw new Error('responder is not available');
    if (!this.store.incidents.view(incidentId)) throw new Error('unknown incident');
    const assignmentId = `ASG-${Date.now().toString(36).toUpperCase()}`;
    const sequence = Math.max(1, (this.store.incidents.view(incidentId)?.timeline.length ?? 0) + 1);
    const packet = buildResponderState(
      { sourceId: COORDINATOR_SOURCE_ID, sourceClass: SourceClass.COORDINATOR_PROVISIONED, nowS: toEpochS(Date.now()) },
      MessageType.RESPONDER_ASSIGNED,
      incidentId,
      sequence,
      { assignmentId, responderRef, dispatcherLabel: bounded(dispatcherLabel, 48) },
    );
    this.publishOperationalPacket(packet.packetId, packet.bytes);
    const updated: ResponderRecord = {
      ...responder,
      available: false,
      assignmentId,
      incidentId,
      status: 'assigned',
      lastUpdatedAtMs: Date.now(),
    };
    this.store.responders.set(responderRef, updated);
    this.audit('responder.assigned', responderRef, `${assignmentId} assigned to ${incidentId}`);
    return updated;
  }

  listRegionalRecords(): readonly RegionalRecord[] {
    return [...this.store.regionalRecords.values()].sort((a, b) => a.objectId.localeCompare(b.objectId));
  }

  updateRegionalRecord(objectId: string, state: string): RegionalRecord {
    const current = this.store.regionalRecords.get(objectId);
    if (!current) throw new Error('unknown regional object');
    const version = current.version + 1;
    const context = {
      sourceId: AUTHORITY_SOURCE_ID,
      sourceClass: SourceClass.AUTHORITY_PROVISIONED,
      nowS: toEpochS(Date.now()),
    };
    const numericState = resourceState(state);
    const packet =
      current.kind === 'hazard'
        ? buildHazard(context, current.objectId, version, Severity.URGENT, {
            hazardType: 1,
            geometryKind: GeometryKind.CACHED_REFERENCE,
            cachedGeometryRef: current.objectId,
            fallbackLabel: bounded(current.name, 64),
          })
        : current.kind === 'route'
          ? buildRouteState(context, current.objectId, version, {
              state: state === 'blocked' ? RouteState.BLOCKED : state === 'restricted' ? RouteState.RESTRICTED : RouteState.OPEN,
              fallbackInstruction: bounded(`${current.name}: ${state}`, 80),
            })
          : buildResourceRecord(context, resourceMessageType(current.kind), current.objectId, version, {
              state: numericState,
              fallbackLabel: bounded(current.name, 64),
              lastConfirmedS: toEpochS(Date.now()),
            });
    this.publishOperationalPacket(packet.packetId, packet.bytes);
    const updated: RegionalRecord = { ...current, state, version, updatedAtMs: Date.now() };
    this.store.regionalRecords.set(objectId, updated);
    this.audit('region.updated', objectId, `${current.name} set to ${state}`);
    return updated;
  }

  listCampaigns(): readonly CampaignRecord[] {
    return [...this.store.campaigns.values()].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }

  createCampaign(input: CampaignCreateInput): CampaignRecord {
    const campaignId = `CMP-AS-${Date.now().toString(36).toUpperCase()}`;
    const campaign = this.buildCampaign({
      campaignId,
      campaignVersion: 1,
      title: bounded(input.title || 'Assam public alert', 72),
      summary: bounded(input.summary || 'Await official instructions.', 140),
      severity: clamp(input.severity ?? Severity.URGENT, 0, 3),
      category: clamp(input.category ?? AlertCategory.WEATHER, 0, 6),
      instruction: clamp(input.instruction ?? InstructionCode.MOVE_TO_HIGHER_GROUND, 0, 7),
      profile: input.profile ?? 'audible-normal',
      contentRevision: 1,
      state: 'draft',
      createdAtMs: Date.now(),
    });
    this.store.campaigns.set(campaignId, campaign);
    this.audit('campaign.created', campaignId, `Draft v${campaign.campaignVersion} created`);
    return campaign;
  }

  updateCampaign(campaignId: string, input: CampaignCreateInput): CampaignRecord {
    const current = this.requireCampaign(campaignId);
    const state = contentEdited(current.state);
    const updated = this.buildCampaign({
      campaignId,
      campaignVersion: current.campaignVersion + 1,
      title: bounded(input.title || current.title, 72),
      summary: bounded(input.summary || current.summary, 140),
      severity: clamp(input.severity ?? current.severity, 0, 3),
      category: clamp(input.category ?? AlertCategory.WEATHER, 0, 6),
      instruction: clamp(input.instruction ?? InstructionCode.MOVE_TO_HIGHER_GROUND, 0, 7),
      profile: input.profile ?? current.profile,
      contentRevision: current.contentRevision + 1,
      state,
      createdAtMs: current.createdAtMs,
    });
    this.store.campaigns.set(campaignId, updated);
    this.audit('campaign.edited', campaignId, `Content changed; campaign returned to ${state}`);
    return updated;
  }

  transitionCampaign(campaignId: string, requested: CampaignState): CampaignRecord {
    const current = this.requireCampaign(campaignId);
    if (requested === 'validated' && current.preview.overBudget) throw new Error('campaign exceeds duration budget');
    const next = transitionCampaign(current.state, requested);
    const approvalDigest = requested === 'approved' ? digestCampaign(current) : current.approvalDigest;
    const updated: CampaignRecord = {
      ...current,
      state: next,
      ...(requested === 'validated' ? { validatedRevision: current.contentRevision } : {}),
      ...(approvalDigest ? { approvalDigest } : {}),
      updatedAtMs: Date.now(),
    };
    if (requested === 'approved' && current.validatedRevision !== current.contentRevision) {
      throw new Error('content changed since validation');
    }
    this.store.campaigns.set(campaignId, updated);
    this.audit(`campaign.${requested}`, campaignId, `Campaign transitioned ${current.state} → ${requested}`);
    return updated;
  }

  prepareBroadcastProgram(campaignId: string): CampaignRecord {
    const current = this.requireCampaign(campaignId);
    if (current.state !== 'broadcaster-ready' && current.state !== 'audio-generated' && current.state !== 'decode-tested') {
      throw new Error('campaign must be accepted by the broadcast desk first');
    }
    if (current.broadcastProgram) return current;

    const packet = new Uint8Array(Buffer.from(current.packetBytesBase64, 'base64'));
    const frames = toTier2Frames({
      campaignHandle: current.campaignVersion,
      campaignVersion: current.campaignVersion,
      packetHandle: 1,
      messageType: current.messageType,
      priority: current.priority,
      severity: current.severity,
      payload: packet.subarray(ENVELOPE.HEADER_BYTES),
    });
    const uniqueFramesBase64 = frames.map((frame) => Buffer.from(frame).toString('base64'));
    const repeats = current.preview.items[0]?.repeats ?? 1;
    const playbackFramesBase64 = Array.from({ length: repeats }, () => uniqueFramesBase64).flat();
    const artifactDigest = createHash('sha256')
      .update(Buffer.concat(playbackFramesBase64.map((value) => Buffer.from(value, 'base64'))))
      .digest('hex');
    const program: BroadcastProgramRecord = {
      programId: `PGM-${artifactDigest.slice(0, 12).toUpperCase()}`,
      campaignId: current.campaignId,
      campaignVersion: current.campaignVersion,
      profile: current.profile,
      sampleRate: 48000,
      artifactDigest,
      uniqueFramesBase64,
      playbackFramesBase64,
      createdAtMs: Date.now(),
    };
    const nextState = current.state === 'broadcaster-ready'
      ? transitionCampaign(current.state, 'audio-generated')
      : current.state;
    const updated: CampaignRecord = { ...current, state: nextState, broadcastProgram: program, updatedAtMs: Date.now() };
    this.store.campaigns.set(campaignId, updated);
    this.audit('campaign.audio-generated', campaignId, `${program.programId} prepared · ${playbackFramesBase64.length} acoustic frames · ${artifactDigest}`);
    return updated;
  }

  verifyBroadcastReception(
    campaignId: string,
    framesBase64: readonly string[],
    receiverLabel: string,
    receptionTransport: 'tier2-mic' | 'tier2-direct' = 'tier2-direct',
  ): CampaignRecord {
    const current = this.requireCampaign(campaignId);
    const program = current.broadcastProgram;
    if (!program) throw new Error('broadcast program has not been prepared');
    if (framesBase64.length > 128) throw new Error('received frame list is over limit');

    const expected = new Set(program.uniqueFramesBase64);
    const recovered = new Set<string>();
    let corruptFrames = 0;
    let unexpectedFrames = 0;
    for (const value of framesBase64) {
      const bytes = new Uint8Array(Buffer.from(value, 'base64'));
      const decoded = decodeTier2Frame(bytes);
      if (!decoded.ok) {
        corruptFrames += 1;
        continue;
      }
      const canonical = Buffer.from(bytes).toString('base64');
      if (expected.has(canonical)) recovered.add(canonical);
      else unexpectedFrames += 1;
    }
    const missingFrames = [...expected].filter((value) => !recovered.has(value)).length;
    const result: BroadcastDecodeResult = {
      passed: missingFrames === 0 && corruptFrames === 0 && unexpectedFrames === 0,
      expectedFrames: expected.size,
      recoveredFrames: recovered.size,
      corruptFrames,
      unexpectedFrames,
      missingFrames,
      receiverLabel: bounded(receiverLabel || 'Web receiving station', 48),
      receptionTransport,
      ...(missingFrames === 0 && corruptFrames === 0 && unexpectedFrames === 0
        ? { decodedMessage: decodedCampaignMessage(current) }
        : {}),
      testedAtMs: Date.now(),
    };
    const nextState = result.passed && current.state === 'audio-generated'
      ? transitionCampaign(current.state, 'decode-tested')
      : current.state;
    const updated: CampaignRecord = { ...current, state: nextState, decodeResult: result, updatedAtMs: Date.now() };
    this.store.campaigns.set(campaignId, updated);
    this.audit(
      result.passed ? 'campaign.decode-tested' : 'campaign.decode-failed',
      campaignId,
      `${result.receiverLabel} recovered ${result.recoveredFrames}/${result.expectedFrames} frames; corrupt ${result.corruptFrames}; unexpected ${result.unexpectedFrames}`,
    );
    return updated;
  }

  private buildCampaign(input: {
    campaignId: string;
    campaignVersion: number;
    title: string;
    summary: string;
    severity: number;
    category: number;
    instruction: number;
    profile: GgwaveProfileName;
    contentRevision: number;
    state: CampaignState;
    createdAtMs: number;
  }): CampaignRecord {
    const now = Date.now();
    const packet = buildOfficialAlert(
      { sourceId: AUTHORITY_SOURCE_ID, sourceClass: SourceClass.AUTHORITY_PROVISIONED, nowS: toEpochS(now) },
      `ALT-${input.campaignId.slice(4)}`,
      input.campaignVersion,
      input.severity as 0 | 1 | 2 | 3,
      {
        category: input.category,
        instruction: input.instruction,
        regionCode: REGION_CODE,
        validFromS: toEpochS(now),
        validUntilS: toEpochS(now + 6 * 60 * 60 * 1000),
        fallbackText: input.summary,
        language: 'en',
        campaignId: input.campaignId,
      },
    );
    const decoded = decodePacket(packet.bytes);
    if (!decoded.ok) throw new Error(`campaign packet failed local decode: ${decoded.reason}`);
    const plan = planCampaign({
      campaignId: input.campaignId,
      campaignVersion: input.campaignVersion,
      campaignHandle: input.campaignVersion,
      regionCode: REGION_CODE,
      validFromS: toEpochS(now),
      validUntilS: toEpochS(now + 6 * 60 * 60 * 1000),
      requiredPackId: 'PACK-AS-OPS',
      requiredPackVersion: 1,
      profile: input.profile,
      packets: [{
        packetId: packet.packetId,
        bytes: packet.bytes,
        messageType: decoded.packet.header.type,
        priority: decoded.packet.header.priority,
        severity: decoded.packet.header.severity,
      }],
    });
    return {
      campaignId: input.campaignId,
      campaignVersion: input.campaignVersion,
      title: input.title,
      summary: input.summary,
      regionCode: REGION_CODE,
      state: input.state,
      profile: input.profile,
      contentRevision: input.contentRevision,
      packetId: packet.packetId,
      packetBytesBase64: Buffer.from(packet.bytes).toString('base64'),
      messageType: decoded.packet.header.type,
      priority: decoded.packet.header.priority,
      severity: decoded.packet.header.severity,
      category: input.category,
      instruction: input.instruction,
      preview: {
        totalTier2Bytes: plan.manifest.totalTier2Bytes,
        totalDurationS: plan.manifest.totalDurationS,
        budgetS: plan.budgetS,
        overBudget: plan.overBudget,
        items: plan.manifest.items.map((item) => ({
          packetId: item.packetId,
          tier1Bytes: item.tier1Bytes,
          tier2Bytes: item.tier2Bytes,
          frameCount: item.frameCount,
          repeats: item.repeats,
          estimatedAudioMs: item.estimatedAudioMs,
        })),
        burstSchedule: plan.manifest.burstSchedule,
      },
      createdAtMs: input.createdAtMs,
      updatedAtMs: now,
    };
  }

  private publishOperationalPacket(packetId: string, bytes: Uint8Array): void {
    const batchId = `OPS-${randomUUID()}`;
    const response = this.ingest.ingest(
      {
        gatewayToken: 'GW-ASSAM-OPS',
        batchId,
        items: [{ packetId, bytes, observation: { receivedAtMs: Date.now(), transport: 'gateway', hopCountOnArrival: 0 } }],
      },
      Date.now(),
    );
    if (!response.results.some((result) => result.outcome === 'accepted' || result.outcome === 'duplicate')) {
      throw new Error(response.results[0]?.reason ?? 'packet rejected');
    }
    this.outbound.publish(REGION_CODE, packetId, bytes);
  }

  private requireCampaign(campaignId: string): CampaignRecord {
    const campaign = this.store.campaigns.get(campaignId);
    if (!campaign) throw new Error('unknown campaign');
    return campaign;
  }

  private audit(action: string, subject: string, detail: string): void {
    this.store.recordAudit({ id: randomUUID(), atMs: Date.now(), action, subject, detail });
  }
}

function resourceMessageType(kind: RegionalRecord['kind']): number {
  if (kind === 'shelter') return MessageType.SHELTER;
  if (kind === 'medical') return MessageType.MEDICAL_POST;
  if (kind === 'food-water') return MessageType.FOOD_WATER;
  if (kind === 'safe-zone') return MessageType.SAFE_ZONE;
  throw new Error(`unsupported resource kind ${kind}`);
}

function resourceState(state: string): number {
  if (state === 'open') return OperationalState.OPEN;
  if (state === 'full') return OperationalState.FULL;
  if (state === 'closed') return OperationalState.CLOSED;
  if (state === 'damaged') return OperationalState.DAMAGED;
  return OperationalState.UNKNOWN;
}

function digestCampaign(campaign: CampaignRecord): string {
  return createHash('sha256')
    .update(`${campaign.campaignId}:${campaign.campaignVersion}:${campaign.contentRevision}:${campaign.packetId}`)
    .digest('hex');
}

function bounded(value: string, max: number): string {
  return [...value.trim()].slice(0, max).join('');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function packetFamily(type: number): string {
  if (type >= 0x10 && type <= 0x12) return 'Emergency';
  if (type >= 0x20 && type <= 0x25) return 'Response';
  if (type >= 0x30 && type <= 0x31) return 'Receipt';
  if (type >= 0x40 && type <= 0x43) return 'Resource';
  if (type >= 0x50 && type <= 0x51) return 'Hazard and route';
  if (type >= 0x60 && type <= 0x61) return 'Authority';
  if (type >= 0x70 && type <= 0x71) return 'Check-in';
  if (type === 0x80) return 'Request';
  if (type >= 0x90 && type <= 0x94) return 'Content';
  if (type >= 0xa0 && type <= 0xa1) return 'File';
  return 'Network control';
}

function sourceClassLabel(value: number): string {
  return ['Unknown', 'General public', 'Responder', 'Authority', 'Coordinator', 'Backend', 'Tier 2 broadcast'][value] ?? `Source ${value}`;
}

function jsonSafe(value: unknown): unknown {
  if (value instanceof Uint8Array) return { bytesBase64: Buffer.from(value).toString('base64'), byteLength: value.length };
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function decodedCampaignMessage(campaign: CampaignRecord): NonNullable<BroadcastDecodeResult['decodedMessage']> {
  const decoded = decodePacket(new Uint8Array(Buffer.from(campaign.packetBytesBase64, 'base64')));
  const payload = decoded.ok ? decoded.packet.payload as Record<string, unknown> : {};
  return {
    packetId: campaign.packetId,
    messageType: campaign.messageType,
    alertId: String(payload['alertId'] ?? `ALT-${campaign.campaignId}`),
    campaignId: String(payload['campaignId'] ?? campaign.campaignId),
    regionCode: String(payload['regionCode'] ?? campaign.regionCode),
    category: Number(payload['category'] ?? campaign.category ?? 0),
    instruction: Number(payload['instruction'] ?? campaign.instruction ?? 0),
    severity: campaign.severity,
    language: String(payload['language'] ?? 'en'),
    text: String(payload['fallbackText'] ?? campaign.summary),
  };
}
