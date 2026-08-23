import { createHash, randomUUID } from 'node:crypto';
import {
  AlertCategory,
  ArrivalEvidence,
  Flags,
  GeometryKind,
  InstructionCode,
  LocationSource,
  MessageType,
  OperationalState,
  RouteState,
  ResolutionOutcome,
  Severity,
  SourceClass,
  messageTypeName,
  type CampaignState,
  type MapOperation,
  type PacketId,
} from '@dsm/contracts';
import { toMapOperations } from '@dsm/mapkit';
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
  Tier2Receiver,
  type CampaignHandleResolver,
  type WavePxProfileName,
} from '@dsm/tier2';
import { IngestService, OutboundService } from './services.js';
import {
  SqliteBackendStore,
  type CampaignRecord,
  type BroadcastDecodeResult,
  type BroadcastProgramRecord,
  type BroadcastEventRecord,
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
  readonly profile?: WavePxProfileName;
  readonly dataType?: 'official-alert' | 'regional-record';
  readonly objectId?: string;
  /** Broadcast point, degrees × 1e7. Both must be present to carry a location. */
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly radiusM?: number;
  readonly clearLocation?: boolean;
}

export type ResponderAction = 'accepted' | 'en-route' | 'arrived' | 'resolved';

export interface RegionalRecordInput {
  readonly objectId?: string;
  readonly kind: 'shelter' | 'medical' | 'food-water' | 'safe-zone';
  readonly name: string;
  readonly district: string;
  readonly latE7: number;
  readonly lonE7: number;
  readonly state: string;
}

/** Degrees × 1e7 bounds, matching the validator's OFFICIAL_ALERT rules. */
const LAT_E7_LIMIT = 900000000;
const LON_E7_LIMIT = 1800000000;
const MAX_RADIUS_M = 200000;

/** A location is carried only when both coordinates are present and in range. */
function campaignLocation(input: {
  latE7?: number;
  lonE7?: number;
  radiusM?: number;
}): { latE7: number; lonE7: number; radiusM: number } | undefined {
  if (typeof input.latE7 !== 'number' || typeof input.lonE7 !== 'number') return undefined;
  if (!Number.isFinite(input.latE7) || !Number.isFinite(input.lonE7)) return undefined;
  return {
    latE7: clamp(Math.round(input.latE7), -LAT_E7_LIMIT, LAT_E7_LIMIT),
    lonE7: clamp(Math.round(input.lonE7), -LON_E7_LIMIT, LON_E7_LIMIT),
    radiusM: clamp(Math.round(input.radiusM ?? 5000), 0, MAX_RADIUS_M),
  };
}

export class OperationsService {
  constructor(
    private readonly store: SqliteBackendStore,
    private readonly ingest: IngestService,
    private readonly outbound: OutboundService,
  ) {
    let migratedCampaign = false;
    for (const campaign of store.campaigns.values()) {
      if ((campaign as { packetPreview?: CampaignRecord['packetPreview'] }).packetPreview) continue;
      store.campaigns.set(campaign.campaignId, this.withPacketPreview(campaign));
      migratedCampaign = true;
    }
    if (migratedCampaign) store.saveOperations();
    for (const responder of store.responders.values()) {
      if (!responder.incidentId) continue;
      const incident = store.incidents.view(responder.incidentId);
      if (incident && !['resolved', 'cancelled', 'expired'].includes(incident.state)) continue;
      const { assignmentId: _assignmentId, incidentId: _incidentId, ...unassigned } = responder;
      store.responders.set(responder.responderRef, { ...unassigned, available: true, status: 'available', lastUpdatedAtMs: Date.now() });
      this.audit('responder.assignment-reconciled', responder.responderRef, `Released stale assignment ${responder.assignmentId ?? 'unknown'} because its incident is unavailable or terminal`);
    }
  }

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
      { sourceId: responderSourceId(responder.responderRef), sourceClass: SourceClass.RESPONDER_PROVISIONED, nowS: toEpochS(Date.now()) },
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

  updateResponderState(responderRef: string, action: ResponderAction, operatorLabel: string): ResponderRecord {
    const responder = this.store.responders.get(responderRef);
    if (!responder) throw new Error('unknown responder');
    if (!responder.assignmentId || !responder.incidentId) throw new Error('responder has no active assignment');
    const incident = this.store.incidents.view(responder.incidentId);
    if (!incident) throw new Error('assigned incident no longer exists');

    const allowed: Record<ResponderAction, readonly ResponderRecord['status'][]> = {
      accepted: ['assigned'],
      'en-route': ['accepted'],
      arrived: ['en-route'],
      resolved: ['arrived'],
    };
    if (!allowed[action].includes(responder.status)) {
      throw new Error(`cannot move responder from ${responder.status} to ${action}`);
    }

    const messageType = action === 'accepted'
      ? MessageType.RESPONDER_ACCEPTED
      : action === 'en-route'
        ? MessageType.RESPONDER_EN_ROUTE
        : action === 'arrived'
          ? MessageType.RESPONDER_ARRIVED
          : MessageType.RESOLVED;
    const sequence = Math.max(1, incident.timeline.length + 1);
    const payload = action === 'resolved'
      ? { resolverRef: responder.responderRef, outcome: ResolutionOutcome.ASSISTED_ON_SITE, terminalRetentionS: 86_400 }
      : {
          assignmentId: responder.assignmentId,
          responderRef: responder.responderRef,
          ...(action === 'arrived' ? { evidence: ArrivalEvidence.DECLARED } : {}),
        };
    const packet = buildResponderState(
      { sourceId: COORDINATOR_SOURCE_ID, sourceClass: SourceClass.COORDINATOR_PROVISIONED, nowS: toEpochS(Date.now()) },
      messageType,
      responder.incidentId,
      sequence,
      payload,
    );
    this.publishOperationalPacket(packet.packetId, packet.bytes);
    const resolved = action === 'resolved';
    const { assignmentId: _assignmentId, incidentId: _incidentId, ...unassigned } = responder;
    const updated: ResponderRecord = resolved
      ? { ...unassigned, available: true, status: 'available', lastUpdatedAtMs: Date.now() }
      : { ...responder, status: action, lastUpdatedAtMs: Date.now() };
    this.store.responders.set(responderRef, updated);
    this.audit(`responder.${action}`, responderRef, `${operatorLabel} moved ${responder.assignmentId} to ${action}`);
    return updated;
  }

  listRegionalRecords(): readonly RegionalRecord[] {
    return [...this.store.regionalRecords.values()].sort((a, b) => a.objectId.localeCompare(b.objectId));
  }

  updateRegionalRecord(objectId: string, state: string): RegionalRecord {
    const current = this.store.regionalRecords.get(objectId);
    if (!current) throw new Error('unknown regional object');
    const allowedStates = current.kind === 'hazard' ? ['active', 'watch', 'cleared'] : current.kind === 'route' ? ['open', 'restricted', 'blocked'] : ['open', 'full', 'closed', 'damaged'];
    if (!allowedStates.includes(state)) throw new Error(`invalid ${current.kind} state`);
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
              location: resourceLocation(current.latE7, current.lonE7),
              fallbackLabel: bounded(current.name, 64),
              lastConfirmedS: toEpochS(Date.now()),
            });
    this.publishOperationalPacket(packet.packetId, packet.bytes);
    const updated: RegionalRecord = { ...current, state, version, updatedAtMs: Date.now() };
    this.store.regionalRecords.set(objectId, updated);
    this.audit('region.updated', objectId, `${current.name} set to ${state}`);
    return updated;
  }

  /**
   * Creates or moves a centre and publishes the resulting canonical resource
   * packet. The map renderer is deliberately not involved: phones, gateways,
   * and Tier 2 receivers all derive the same operation from these bytes.
   */
  upsertRegionalCentre(input: RegionalRecordInput): RegionalRecord {
    const name = utf8Bounded(input.name, 64, 'centre name');
    const district = utf8Bounded(input.district, 64, 'district');
    if (!name || !district) throw new Error('centre name and district are required');
    if (!Number.isInteger(input.latE7) || Math.abs(input.latE7) > LAT_E7_LIMIT) throw new Error('invalid centre latitude');
    if (!Number.isInteger(input.lonE7) || Math.abs(input.lonE7) > LON_E7_LIMIT) throw new Error('invalid centre longitude');
    const allowedStates = ['open', 'full', 'closed', 'damaged'];
    if (!allowedStates.includes(input.state)) throw new Error('invalid centre state');

    const current = input.objectId ? this.store.regionalRecords.get(input.objectId) : undefined;
    if (input.objectId && !current) throw new Error('unknown regional object');
    if (current && (current.kind === 'hazard' || current.kind === 'route')) throw new Error('only centres can be moved with this operation');
    const objectId = current?.objectId ?? temporaryCentreId(input.kind);
    const version = (current?.version ?? 0) + 1;
    const updated: RegionalRecord = {
      objectId,
      kind: input.kind,
      name,
      district,
      latE7: input.latE7,
      lonE7: input.lonE7,
      state: input.state,
      version,
      updatedAtMs: Date.now(),
      synthetic: true,
    };
    const context = {
      sourceId: AUTHORITY_SOURCE_ID,
      sourceClass: SourceClass.AUTHORITY_PROVISIONED as 3,
      nowS: toEpochS(updated.updatedAtMs),
    };
    const packet = buildRegionalBroadcast(context, updated);
    this.publishOperationalPacket(packet.packetId, packet.bytes);
    this.store.regionalRecords.set(objectId, updated);
    this.audit(current ? 'region.centre-moved' : 'region.centre-created', objectId, `${name} published at ${input.latE7},${input.lonE7} as ${input.state}`);
    return updated;
  }

  listCampaigns(): readonly CampaignRecord[] {
    return [...this.store.campaigns.values()].map((campaign) => this.withPacketPreview(campaign)).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }

  campaignPreview(campaignId: string): CampaignRecord['preview'] {
    return this.requireCampaign(campaignId).preview;
  }

  createCampaign(input: CampaignCreateInput): CampaignRecord {
    const campaignId = `CMP-AS-${Date.now().toString(36).toUpperCase()}`;
    const campaign = this.buildCampaign({
      campaignId,
      campaignVersion: 1,
      title: utf8Bounded(input.title || 'Assam public alert', 72, 'campaign title'),
      summary: utf8Bounded(input.summary || 'Await official instructions.', 140, 'public instruction'),
      severity: clamp(input.severity ?? Severity.URGENT, 0, 3),
      category: clamp(input.category ?? AlertCategory.WEATHER, 0, 6),
      instruction: clamp(input.instruction ?? InstructionCode.MOVE_TO_HIGHER_GROUND, 0, 7),
      profile: input.profile ?? 'audible-normal',
      dataType: input.dataType ?? 'official-alert',
      objectId: input.objectId,
      location: campaignLocation(input),
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
    const dataType = input.dataType ?? current.dataType ?? 'official-alert';
    const updated = this.buildCampaign({
      campaignId,
      campaignVersion: current.campaignVersion + 1,
      title: utf8Bounded(input.title || current.title, 72, 'campaign title'),
      summary: utf8Bounded(input.summary || current.summary, 140, 'public instruction'),
      severity: clamp(input.severity ?? current.severity, 0, 3),
      category: clamp(input.category ?? AlertCategory.WEATHER, 0, 6),
      instruction: clamp(input.instruction ?? InstructionCode.MOVE_TO_HIGHER_GROUND, 0, 7),
      profile: input.profile ?? current.profile,
      dataType,
      ...(dataType === 'regional-record' ? { objectId: input.objectId ?? current.objectId } : {}),
      location: dataType === 'regional-record' || input.clearLocation
        ? undefined
        : campaignLocation({
            latE7: input.latE7 ?? current.latE7,
            lonE7: input.lonE7 ?? current.lonE7,
            radiusM: input.radiusM ?? current.radiusM,
          }),
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
      canonicalPacketBytes: packet,
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
    const framesComplete = missingFrames === 0 && corruptFrames === 0 && unexpectedFrames === 0;

    // The frame tally alone only proves bytes arrived. Reassemble them through
    // the same Tier 2 receiver a phone runs, then decode what came back --
    // never the stored copy -- so the reported meaning is the recovered meaning.
    const reassembly = reassembleFromFrames(current, framesBase64, receptionTransport);
    const canonicalMatch = reassembly?.canonicalMatch === true;

    const result: BroadcastDecodeResult = {
      passed: framesComplete && canonicalMatch,
      expectedFrames: expected.size,
      recoveredFrames: recovered.size,
      corruptFrames,
      unexpectedFrames,
      missingFrames,
      canonicalMatch,
      ...(reassembly ? { reassembledPacketId: reassembly.packetId, reassembledDigest: reassembly.digest } : {}),
      receiverLabel: bounded(receiverLabel || 'Web receiving station', 48),
      receptionTransport,
      ...(reassembly?.mapOperations ? { mapOperations: reassembly.mapOperations } : {}),
      ...(reassembly?.decodedMessage ? { decodedMessage: reassembly.decodedMessage } : {}),
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
      `${result.receiverLabel} recovered ${result.recoveredFrames}/${result.expectedFrames} frames; corrupt ${result.corruptFrames}; unexpected ${result.unexpectedFrames}; canonical packet ${result.canonicalMatch ? 'rebuilt byte-identical' : 'not rebuilt'}`,
    );
    return updated;
  }

  recordBroadcastEvent(campaignId: string, event: 'exported' | 'played', operatorLabel: string): CampaignRecord {
    const current = this.requireCampaign(campaignId);
    const program = current.broadcastProgram;
    if (!program || !current.decodeResult?.passed) throw new Error('campaign must pass exact decode testing first');
    if (event === 'exported' && current.state !== 'decode-tested' && current.state !== 'scheduled') {
      throw new Error('only a decode-tested campaign can be exported');
    }
    if (event === 'played' && current.state !== 'scheduled') {
      throw new Error('campaign must be scheduled before playback');
    }
    const nextState = event === 'exported' && current.state === 'decode-tested'
      ? transitionCampaign(current.state, 'scheduled')
      : event === 'played'
        ? transitionCampaign(current.state, 'played')
        : current.state;
    const broadcastEvent: BroadcastEventRecord = {
      eventId: randomUUID(),
      event,
      programId: program.programId,
      campaignVersion: current.campaignVersion,
      artifactDigest: program.artifactDigest,
      operatorLabel: bounded(operatorLabel, 48),
      atMs: Date.now(),
    };
    const updated: CampaignRecord = {
      ...current,
      state: nextState,
      broadcastEvents: [...(current.broadcastEvents ?? []), broadcastEvent],
      updatedAtMs: broadcastEvent.atMs,
    };
    this.store.campaigns.set(campaignId, updated);
    this.audit(
      `campaign.${event}`,
      campaignId,
      `${broadcastEvent.operatorLabel} ${event} ${program.programId} v${program.campaignVersion} · SHA-256 ${program.artifactDigest}`,
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
    profile: WavePxProfileName;
    dataType: 'official-alert' | 'regional-record';
    objectId?: string;
    location?: { latE7: number; lonE7: number; radiusM: number };
    contentRevision: number;
    state: CampaignState;
    createdAtMs: number;
  }): CampaignRecord {
    const now = Date.now();
    const context = { sourceId: AUTHORITY_SOURCE_ID, sourceClass: SourceClass.AUTHORITY_PROVISIONED as 3, nowS: toEpochS(now) };
    const selectedRecord = input.objectId ? this.store.regionalRecords.get(input.objectId) : undefined;
    if (input.dataType === 'regional-record' && !selectedRecord) throw new Error('select a known regional record');
    const packet = input.dataType === 'regional-record' && selectedRecord
      ? buildRegionalBroadcast(context, selectedRecord)
      : buildOfficialAlert(context, `ALT-${input.campaignId.slice(4)}`, input.campaignVersion, input.severity as 0 | 1 | 2 | 3, {
        category: input.category,
        instruction: input.instruction,
        regionCode: REGION_CODE,
        // The operator-selected point travels inside the same canonical packet
        // the radio carries, so Tier 2 reception proves the coordinates too.
        ...(input.location ? { latE7: input.location.latE7, lonE7: input.location.lonE7, radiusM: input.location.radiusM } : {}),
        validFromS: toEpochS(now),
        validUntilS: toEpochS(now + 6 * 60 * 60 * 1000),
        fallbackText: input.summary,
        language: 'en',
        campaignId: input.campaignId,
      });
    const decoded = decodePacket(packet.bytes);
    if (!decoded.ok) throw new Error(`campaign packet failed local decode: ${decoded.reason}`);
    const packetMapOperations = toMapOperations(decoded.packet, 'tier2-direct', toEpochS(now));
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
      dataType: input.dataType,
      ...(input.objectId ? { objectId: input.objectId } : {}),
      ...(input.location ? { latE7: input.location.latE7, lonE7: input.location.lonE7, radiusM: input.location.radiusM } : {}),
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
      packetPreview: {
        typeName: messageTypeName(decoded.packet.header.type) ?? `TYPE_${decoded.packet.header.type}`,
        family: packetFamily(decoded.packet.header.type),
        sourceLabel: sourceClassLabel(decoded.packet.header.sourceClass),
        payload: jsonSafe(decoded.packet.payload) as Record<string, unknown>,
        bytesHex: Buffer.from(packet.bytes).toString('hex'),
        totalBytes: packet.bytes.length,
        mapOperations: packetMapOperations,
      },
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
    return this.withPacketPreview(campaign);
  }

  /** Rebuild evidence added after the first campaign schema shipped. */
  private withPacketPreview(campaign: CampaignRecord): CampaignRecord {
    const existing = (campaign as { packetPreview?: CampaignRecord['packetPreview'] }).packetPreview;
    if (existing) return campaign;
    const bytes = Buffer.from(campaign.packetBytesBase64, 'base64');
    const decoded = decodePacket(bytes);
    if (!decoded.ok) {
      return {
        ...campaign,
        packetPreview: {
          typeName: messageTypeName(campaign.messageType) ?? `TYPE_${campaign.messageType}`,
          family: packetFamily(campaign.messageType),
          sourceLabel: 'Stored authority packet',
          payload: { migrationError: decoded.reason },
          bytesHex: bytes.toString('hex'),
          totalBytes: bytes.length,
          mapOperations: [],
        },
      };
    }
    return {
      ...campaign,
      packetPreview: {
        typeName: messageTypeName(decoded.packet.header.type) ?? `TYPE_${decoded.packet.header.type}`,
        family: packetFamily(decoded.packet.header.type),
        sourceLabel: sourceClassLabel(decoded.packet.header.sourceClass),
        payload: jsonSafe(decoded.packet.payload) as Record<string, unknown>,
        bytesHex: bytes.toString('hex'),
        totalBytes: bytes.length,
        mapOperations: toMapOperations(decoded.packet, 'tier2-direct', toEpochS(campaign.updatedAtMs)),
      },
    };
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

function buildRegionalBroadcast(context: { sourceId: string; sourceClass: 3; nowS: number }, record: RegionalRecord) {
  if (record.kind === 'hazard') return buildHazard(context, record.objectId, record.version, Severity.URGENT, { hazardType: 1, geometryKind: GeometryKind.CACHED_REFERENCE, cachedGeometryRef: record.objectId, fallbackLabel: bounded(record.name, 64) });
  if (record.kind === 'route') return buildRouteState(context, record.objectId, record.version, { state: record.state === 'blocked' ? RouteState.BLOCKED : record.state === 'restricted' ? RouteState.RESTRICTED : RouteState.OPEN, fallbackInstruction: bounded(`${record.name}: ${record.state}`, 80) });
  return buildResourceRecord(context, resourceMessageType(record.kind), record.objectId, record.version, {
    state: resourceState(record.state),
    location: resourceLocation(record.latE7, record.lonE7),
    fallbackLabel: bounded(record.name, 64),
    lastConfirmedS: context.nowS,
  });
}

function resourceLocation(latE7: number, lonE7: number) {
  // USER_PIN means an operator-selected coordinate; authority is established
  // independently by the signed/provisioned packet source class.
  return { source: LocationSource.USER_PIN, latE7, lonE7, accuracyM: 0, ageS: 0 };
}

function temporaryCentreId(kind: RegionalRecordInput['kind']): string {
  const prefix = ({ shelter: 'SHL', medical: 'MED', 'food-water': 'FWD', 'safe-zone': 'SFZ' })[kind];
  return `TMP-${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

function digestCampaign(campaign: CampaignRecord): string {
  return createHash('sha256')
    .update(`${campaign.campaignId}:${campaign.campaignVersion}:${campaign.contentRevision}:${campaign.packetId}`)
    .digest('hex');
}

function bounded(value: string, max: number): string {
  return [...value.trim()].slice(0, max).join('');
}

function utf8Bounded(value: string, maxBytes: number, label: string): string {
  const normalized = value.trim();
  if (Buffer.byteLength(normalized, 'utf8') > maxBytes) throw new Error(`${label} exceeds ${maxBytes} UTF-8 bytes`);
  return normalized;
}

function responderSourceId(responderRef: string): string {
  return createHash('sha256').update(`responder:${responderRef}`).digest('hex').slice(0, 16);
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

/**
 * T2-004: the recovered packet must BE the approved packet, not a lookalike.
 *
 * Frames go through the real `Tier2Receiver`, the campaign's canonical header
 * rebuilds the Tier 1 bytes, and the result is compared byte-for-byte against
 * what the authority approved. Only then is the payload decoded for display,
 * so every field shown here -- coordinates included -- came off the air.
 */
function reassembleFromFrames(
  campaign: CampaignRecord,
  framesBase64: readonly string[],
  source: 'tier2-mic' | 'tier2-direct',
): {
  readonly packetId: string;
  readonly canonicalMatch: boolean;
  readonly digest: string;
  readonly mapOperations?: readonly MapOperation[];
  readonly decodedMessage?: NonNullable<BroadcastDecodeResult['decodedMessage']>;
} | undefined {
  const approved = new Uint8Array(Buffer.from(campaign.packetBytesBase64, 'base64'));
  const resolver: CampaignHandleResolver = {
    campaignId: campaign.campaignId,
    campaignVersion: campaign.campaignVersion,
    campaignHandle: campaign.campaignVersion,
    resolvePacketId: (handle) => (handle === 1 ? (campaign.packetId as PacketId) : undefined),
    expectedPacketIds: () => [campaign.packetId as PacketId],
    verifyPacketBytes: (handle, canonicalBytes) =>
      handle === 1 &&
      canonicalBytes.length === approved.length &&
      canonicalBytes.every((byte, index) => byte === approved[index]),
  };

  const receiver = new Tier2Receiver(resolver);
  const nowMs = Date.now();
  receiver.startListening(source, nowMs);
  let rebuilt: Uint8Array | undefined;
  for (const value of framesBase64) {
    const outcome = receiver.accept({ bytes: new Uint8Array(Buffer.from(value, 'base64')), source, receivedAtMs: nowMs });
    if (outcome.packet) rebuilt = outcome.packet.bytes;
  }
  receiver.stop();
  if (!rebuilt) return undefined;

  const canonicalMatch = rebuilt.length === approved.length && rebuilt.every((byte, index) => byte === approved[index]);
  const digest = createHash('sha256').update(Buffer.from(rebuilt)).digest('hex');
  const decoded = decodePacket(rebuilt);
  return {
    packetId: decoded.ok ? decoded.packet.header.packetId : campaign.packetId,
    canonicalMatch,
    digest,
    // A packet that fails to decode is reported as absent meaning, never as
    // the stored draft's meaning.
    ...(canonicalMatch && decoded.ok
      ? {
          decodedMessage: decodedCampaignMessage(campaign, decoded.packet.header.packetId, decoded.packet.header.type, decoded.packet.payload as Record<string, unknown>),
          mapOperations: toMapOperations(decoded.packet, source, toEpochS(Date.now())),
        }
      : {}),
  };
}

function decodedCampaignMessage(
  campaign: CampaignRecord,
  packetId: string,
  messageType: number,
  payload: Record<string, unknown>,
): NonNullable<BroadcastDecodeResult['decodedMessage']> {
  const latE7 = payload['latE7'];
  const lonE7 = payload['lonE7'];
  const hasLocation = typeof latE7 === 'number' && typeof lonE7 === 'number';
  return {
    packetId,
    messageType,
    alertId: String(payload['alertId'] ?? `ALT-${campaign.campaignId}`),
    campaignId: String(payload['campaignId'] ?? campaign.campaignId),
    regionCode: String(payload['regionCode'] ?? campaign.regionCode),
    category: Number(payload['category'] ?? campaign.category ?? 0),
    instruction: Number(payload['instruction'] ?? campaign.instruction ?? 0),
    severity: campaign.severity,
    language: String(payload['language'] ?? 'en'),
    text: String(payload['fallbackText'] ?? campaign.summary),
    ...(hasLocation
      ? {
          location: {
            latE7,
            lonE7,
            ...(typeof payload['radiusM'] === 'number' ? { radiusM: payload['radiusM'] } : {}),
            // True only when the recovered point equals the approved point.
            matchesApproved: campaign.latE7 === latE7 && campaign.lonE7 === lonE7,
          },
        }
      : {}),
    typeName: messageTypeName(messageType) ?? `TYPE_${messageType}`,
    payload: jsonSafe(payload) as Record<string, unknown>,
  };
}
