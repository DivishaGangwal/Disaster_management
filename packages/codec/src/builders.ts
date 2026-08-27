/**
 * Typed packet builders.
 *
 * These are the SUPPORTED way for the mobile app, backend, and Tier 2 tooling
 * to create packets. They apply the right default priority, TTL, hop limit,
 * and copy-budget class per family so no caller invents its own.
 */

import {
  CLASS_BUDGETS,
  Flags,
  MessageType,
  Severity,
  SourceClass,
  type ClassBudgetName,
  type EncodedPacket,
  type GeoExtension,
  type SeverityValue,
  type SourceClassValue,
  type StreamId,
} from '@dsm/contracts';
import { encodePacket, type EncodeOptions } from './packet-codec.js';

/** Copy-budget class per message type (02-... "Copy budgets by class"). */
export function budgetClassFor(messageType: number, severity: number): ClassBudgetName {
  switch (messageType) {
    case MessageType.SOS_CREATE:
    case MessageType.SOS_UPDATE:
      return severity >= Severity.LIFE_CRITICAL ? 'CRITICAL' : 'HIGH';
    case MessageType.SOS_CANCEL:
    case MessageType.RESOLVED:
    case MessageType.BACKEND_ACKNOWLEDGEMENT:
      return 'CRITICAL';
    case MessageType.RESPONDER_ASSIGNED:
    case MessageType.RESPONDER_ACCEPTED:
    case MessageType.RESPONDER_DECLINED:
    case MessageType.RESPONDER_EN_ROUTE:
    case MessageType.RESPONDER_ARRIVED:
    case MessageType.OFFICIAL_ALERT:
      return 'HIGH';
    case MessageType.HAZARD:
    case MessageType.ROUTE_STATE:
    case MessageType.RESOURCE_REQUEST:
      return 'MEDIUM_HIGH';
    case MessageType.SHELTER:
    case MessageType.MEDICAL_POST:
    case MessageType.FOOD_WATER:
    case MessageType.SAFE_ZONE:
    case MessageType.CHECKIN_CAMPAIGN:
    case MessageType.CHECKIN_RESPONSE:
      return 'MEDIUM';
    case MessageType.MESH_CHAT:
      return 'LOW_MEDIUM';
    case MessageType.FILE_MANIFEST:
    case MessageType.FILE_FRAGMENT:
    case MessageType.NETWORK_STATUS_OBSERVATION:
      return 'LOW';
    default:
      return 'LOW_MEDIUM';
  }
}

export interface BuildContext {
  readonly sourceId: string;
  readonly sourceClass: SourceClassValue;
  /** Seconds since the demo epoch. */
  readonly nowS: number;
}

function build(
  ctx: BuildContext,
  type: number,
  payload: Readonly<Record<string, unknown>>,
  extras: Partial<EncodeOptions> = {},
): EncodedPacket {
  const severity = extras.severity ?? Severity.INFO;
  const budget = CLASS_BUDGETS[budgetClassFor(type, severity)];
  return encodePacket({
    type,
    payload,
    sourceId: ctx.sourceId,
    sourceClass: ctx.sourceClass,
    createdAt: ctx.nowS,
    ttlS: budget.ttlS,
    hopLimit: budget.hopLimit,
    ...extras,
  });
}

export interface SosCreateInput {
  readonly incidentId: StreamId;
  readonly category: number;
  readonly severity: SeverityValue;
  readonly peopleTotal: number;
  readonly mobility: number;
  readonly location: Readonly<Record<string, unknown>>;
  readonly replyCapabilities: number;
  readonly injured?: number;
  readonly children?: number;
  readonly shortNote?: string;
  readonly preparedPhraseId?: number;
  readonly language?: string;
  readonly helpCategories?: readonly number[];
  readonly batteryBand?: number;
  readonly geo?: GeoExtension;
}

export function buildSosCreate(ctx: BuildContext, input: SosCreateInput): EncodedPacket {
  const { severity, geo, ...payload } = input;
  return build(ctx, MessageType.SOS_CREATE, payload, {
    severity,
    streamId: input.incidentId,
    sourceSequence: 1,
    ...(geo ? { geo } : {}),
    flags: Flags.RECEIPT_REQUESTED,
  });
}

export function buildSosUpdate(
  ctx: BuildContext,
  incidentId: StreamId,
  sequence: number,
  severity: SeverityValue,
  changed: Readonly<Record<string, unknown>>,
  geo?: GeoExtension,
): EncodedPacket {
  return build(ctx, MessageType.SOS_UPDATE, { incidentId, ...changed }, {
    severity,
    streamId: incidentId,
    sourceSequence: sequence,
    ...(geo ? { geo } : {}),
  });
}

export function buildSosCancel(
  ctx: BuildContext,
  incidentId: StreamId,
  sequence: number,
  reason: number,
  terminalRetentionS: number,
): EncodedPacket {
  return build(ctx, MessageType.SOS_CANCEL, { incidentId, reason, terminalRetentionS }, {
    streamId: incidentId,
    sourceSequence: sequence,
  });
}

export function buildResponderState(
  ctx: BuildContext,
  type: number,
  incidentId: StreamId,
  sequence: number,
  payload: Readonly<Record<string, unknown>>,
  geo?: GeoExtension,
): EncodedPacket {
  return build(ctx, type, { incidentId, ...payload }, {
    streamId: incidentId,
    sourceSequence: sequence,
    ...(geo ? { geo } : {}),
  });
}

export function buildLinkReceipt(
  ctx: BuildContext,
  forPacketId: string,
  digestPrefixHex: string,
  receivingNodeToken: string,
  result: number,
): EncodedPacket {
  return build(ctx, MessageType.LINK_RECEIPT, {
    forPacketId,
    digestPrefix: digestPrefixHex,
    receivingNodeToken,
    result,
  });
}

export function buildBackendAck(
  ctx: BuildContext,
  forPacketId: string,
  backendReceiptId: string,
  dedupOutcome: number,
  incidentId?: StreamId,
): EncodedPacket {
  return build(
    ctx,
    MessageType.BACKEND_ACKNOWLEDGEMENT,
    { forPacketId, backendReceiptId, dedupOutcome, ...(incidentId ? { incidentId } : {}) },
    { ...(incidentId ? { streamId: incidentId } : {}) },
  );
}

export function buildResourceRecord(
  ctx: BuildContext,
  type: number,
  objectId: string,
  version: number,
  payload: Readonly<Record<string, unknown>>,
): EncodedPacket {
  return build(ctx, type, { objectId, ...payload }, { streamId: objectId, sourceSequence: version });
}

export function buildHazard(
  ctx: BuildContext,
  hazardId: StreamId,
  version: number,
  severity: SeverityValue,
  payload: Readonly<Record<string, unknown>>,
): EncodedPacket {
  return build(ctx, MessageType.HAZARD, { hazardId, ...payload }, {
    severity,
    streamId: hazardId,
    sourceSequence: version,
  });
}

export function buildRouteState(
  ctx: BuildContext,
  routeId: string,
  version: number,
  payload: Readonly<Record<string, unknown>>,
): EncodedPacket {
  return build(ctx, MessageType.ROUTE_STATE, { routeId, ...payload }, {
    streamId: routeId,
    sourceSequence: version,
  });
}

export function buildOfficialAlert(
  ctx: BuildContext,
  alertId: StreamId,
  version: number,
  severity: SeverityValue,
  payload: Readonly<Record<string, unknown>>,
): EncodedPacket {
  if (ctx.sourceClass !== SourceClass.AUTHORITY_PROVISIONED && ctx.sourceClass !== SourceClass.BACKEND) {
    // ROL-006 / DEC-015: general-public sources cannot create official alerts.
    throw new Error('OFFICIAL_ALERT requires an authority-provisioned source class');
  }
  return build(ctx, MessageType.OFFICIAL_ALERT, { alertId, ...payload }, {
    severity,
    streamId: alertId,
    sourceSequence: version,
  });
}

export function buildCheckinCampaign(
  ctx: BuildContext,
  campaignId: StreamId,
  payload: Readonly<Record<string, unknown>>,
): EncodedPacket {
  return build(ctx, MessageType.CHECKIN_CAMPAIGN, { campaignId, ...payload }, { streamId: campaignId });
}

export function buildCheckinResponse(
  ctx: BuildContext,
  campaignId: StreamId,
  payload: Readonly<Record<string, unknown>>,
): EncodedPacket {
  return build(ctx, MessageType.CHECKIN_RESPONSE, { campaignId, ...payload }, { streamId: campaignId });
}

export function buildResourceRequest(
  ctx: BuildContext,
  requestId: StreamId,
  payload: Readonly<Record<string, unknown>>,
): EncodedPacket {
  return build(ctx, MessageType.RESOURCE_REQUEST, { requestId, ...payload }, { streamId: requestId });
}

export function buildMeshChat(
  ctx: BuildContext,
  conversationId: StreamId,
  payload: Readonly<Record<string, unknown>>,
): EncodedPacket {
  return build(ctx, MessageType.MESH_CHAT, { conversationId, ...payload }, {
    streamId: conversationId,
    flags: Flags.RECEIPT_REQUESTED,
  });
}

export function buildFileManifest(
  ctx: BuildContext,
  fileId: string,
  payload: Readonly<Record<string, unknown>>,
): EncodedPacket {
  return build(ctx, MessageType.FILE_MANIFEST, { fileId, ...payload }, { streamId: fileId });
}

export function buildFileFragment(
  ctx: BuildContext,
  fileId: string,
  fragmentIndex: number,
  fragmentCount: number,
  fragmentDigest: string,
  data: Uint8Array,
): EncodedPacket {
  return build(ctx, MessageType.FILE_FRAGMENT, { fileId, fragmentIndex, fragmentDigest, data }, {
    streamId: fileId,
    fragmentIndex,
    fragmentCount,
  });
}

export function buildHello(ctx: BuildContext, payload: Readonly<Record<string, unknown>>): EncodedPacket {
  return build(ctx, MessageType.HELLO_CAPABILITY, payload);
}

export function buildInventory(ctx: BuildContext, payload: Readonly<Record<string, unknown>>): EncodedPacket {
  return build(ctx, MessageType.INVENTORY, payload);
}

export function buildPacketRequest(ctx: BuildContext, payload: Readonly<Record<string, unknown>>): EncodedPacket {
  return build(ctx, MessageType.PACKET_REQUEST, payload);
}
