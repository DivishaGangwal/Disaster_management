/**
 * Type-specific schema validation (pipeline gate 11).
 *
 * Spec: 02-... "No field controlled by an incoming packet may cause unlimited
 * allocation, arbitrary file access, arbitrary navigation, or execution."
 *
 * Each rule is declarative so Workstream C can extend a family without
 * touching the pipeline.
 */

import {
  FIELD_LIMITS,
  MessageType,
  RejectReason,
  type RejectReasonName,
} from '@dsm/contracts';

export type SchemaResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: RejectReasonName; readonly detail: string };

type Rule =
  | { readonly kind: 'required'; readonly field: string }
  | { readonly kind: 'int'; readonly field: string; readonly min: number; readonly max: number }
  | { readonly kind: 'text'; readonly field: string; readonly maxBytes: number }
  | { readonly kind: 'id'; readonly field: string; readonly maxBytes: number }
  | { readonly kind: 'array'; readonly field: string; readonly maxItems: number }
  | { readonly kind: 'location'; readonly field: string };

const encoder = new TextEncoder();

/** IDs are compact opaque tokens. Reject anything path-like or command-like. */
const SAFE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

const LOCATION_RULES: readonly Rule[] = [
  { kind: 'int', field: 'source', min: 0, max: 4 },
  { kind: 'int', field: 'latE7', min: -900000000, max: 900000000 },
  { kind: 'int', field: 'lonE7', min: -1800000000, max: 1800000000 },
  { kind: 'int', field: 'accuracyM', min: 0, max: 100000 },
  { kind: 'int', field: 'ageS', min: 0, max: 86400 },
];

const RULES: Readonly<Record<number, readonly Rule[]>> = {
  [MessageType.SOS_CREATE]: [
    { kind: 'required', field: 'incidentId' },
    { kind: 'id', field: 'incidentId', maxBytes: 32 },
    { kind: 'required', field: 'category' },
    { kind: 'int', field: 'category', min: 0, max: 7 },
    { kind: 'required', field: 'peopleTotal' },
    { kind: 'int', field: 'peopleTotal', min: 0, max: FIELD_LIMITS.MAX_PEOPLE_TOTAL },
    { kind: 'int', field: 'injured', min: 0, max: FIELD_LIMITS.MAX_INJURED },
    { kind: 'int', field: 'children', min: 0, max: FIELD_LIMITS.MAX_CHILDREN },
    { kind: 'int', field: 'mobility', min: 0, max: 4 },
    { kind: 'location', field: 'location' },
    { kind: 'text', field: 'shortNote', maxBytes: FIELD_LIMITS.SHORT_NOTE_BYTES },
    { kind: 'text', field: 'language', maxBytes: FIELD_LIMITS.LANGUAGE_TAG_BYTES },
    { kind: 'array', field: 'helpCategories', maxItems: FIELD_LIMITS.MAX_HELP_CATEGORIES },
    { kind: 'int', field: 'batteryBand', min: 0, max: 3 },
  ],
  [MessageType.SOS_UPDATE]: [
    { kind: 'required', field: 'incidentId' },
    { kind: 'id', field: 'incidentId', maxBytes: 32 },
    { kind: 'int', field: 'category', min: 0, max: 7 },
    { kind: 'int', field: 'peopleTotal', min: 0, max: FIELD_LIMITS.MAX_PEOPLE_TOTAL },
    { kind: 'int', field: 'injured', min: 0, max: FIELD_LIMITS.MAX_INJURED },
    { kind: 'int', field: 'mobility', min: 0, max: 4 },
    { kind: 'location', field: 'location' },
    { kind: 'text', field: 'shortNote', maxBytes: FIELD_LIMITS.SHORT_NOTE_BYTES },
  ],
  [MessageType.SOS_CANCEL]: [
    { kind: 'required', field: 'incidentId' },
    { kind: 'id', field: 'incidentId', maxBytes: 32 },
    { kind: 'int', field: 'reason', min: 0, max: 4 },
    { kind: 'int', field: 'terminalRetentionS', min: 0, max: 86400 },
  ],
  [MessageType.RESPONDER_ASSIGNED]: [
    { kind: 'required', field: 'incidentId' },
    { kind: 'id', field: 'incidentId', maxBytes: 32 },
    { kind: 'required', field: 'assignmentId' },
    { kind: 'id', field: 'assignmentId', maxBytes: 32 },
    { kind: 'id', field: 'responderRef', maxBytes: 32 },
    { kind: 'text', field: 'dispatcherLabel', maxBytes: FIELD_LIMITS.LABEL_BYTES },
  ],
  [MessageType.RESPONDER_EN_ROUTE]: [
    { kind: 'required', field: 'incidentId' },
    { kind: 'id', field: 'incidentId', maxBytes: 32 },
    { kind: 'location', field: 'location' },
    { kind: 'int', field: 'etaBandMin', min: 0, max: 600 },
  ],
  [MessageType.RESPONDER_ARRIVED]: [
    { kind: 'required', field: 'incidentId' },
    { kind: 'int', field: 'evidence', min: 0, max: 1 },
  ],
  [MessageType.RESOLVED]: [
    { kind: 'required', field: 'incidentId' },
    { kind: 'int', field: 'outcome', min: 0, max: 5 },
    { kind: 'int', field: 'terminalRetentionS', min: 0, max: 86400 },
  ],
  [MessageType.LINK_RECEIPT]: [
    { kind: 'required', field: 'forPacketId' },
    { kind: 'id', field: 'forPacketId', maxBytes: 32 },
    { kind: 'int', field: 'result', min: 0, max: 3 },
  ],
  [MessageType.BACKEND_ACKNOWLEDGEMENT]: [
    { kind: 'required', field: 'forPacketId' },
    { kind: 'id', field: 'forPacketId', maxBytes: 32 },
    { kind: 'id', field: 'backendReceiptId', maxBytes: 40 },
    { kind: 'int', field: 'dedupOutcome', min: 0, max: 3 },
  ],
  [MessageType.HAZARD]: [
    { kind: 'required', field: 'hazardId' },
    { kind: 'id', field: 'hazardId', maxBytes: 32 },
    { kind: 'int', field: 'hazardType', min: 0, max: 8 },
    { kind: 'int', field: 'geometryKind', min: 0, max: 3 },
    { kind: 'int', field: 'radiusM', min: 0, max: 50000 },
    { kind: 'array', field: 'routeIds', maxItems: FIELD_LIMITS.MAX_ROUTE_IDS_PER_HAZARD },
    { kind: 'text', field: 'fallbackLabel', maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES },
  ],
  [MessageType.ROUTE_STATE]: [
    { kind: 'required', field: 'routeId' },
    { kind: 'id', field: 'routeId', maxBytes: 32 },
    { kind: 'int', field: 'state', min: 0, max: 4 },
    { kind: 'int', field: 'direction', min: 0, max: 2 },
    { kind: 'text', field: 'fallbackInstruction', maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES },
  ],
  [MessageType.OFFICIAL_ALERT]: [
    { kind: 'required', field: 'alertId' },
    { kind: 'id', field: 'alertId', maxBytes: 32 },
    { kind: 'int', field: 'category', min: 0, max: 6 },
    { kind: 'int', field: 'instruction', min: 0, max: 7 },
    { kind: 'int', field: 'latE7', min: -900000000, max: 900000000 },
    { kind: 'int', field: 'lonE7', min: -1800000000, max: 1800000000 },
    { kind: 'int', field: 'radiusM', min: 0, max: 200000 },
    { kind: 'text', field: 'fallbackText', maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES },
    { kind: 'array', field: 'relatedObjectIds', maxItems: 8 },
  ],
  [MessageType.CHECKIN_CAMPAIGN]: [
    { kind: 'required', field: 'campaignId' },
    { kind: 'id', field: 'campaignId', maxBytes: 32 },
    { kind: 'id', field: 'formId', maxBytes: 32 },
    { kind: 'array', field: 'allowedStatuses', maxItems: FIELD_LIMITS.MAX_RESPONSE_OPTIONS },
    { kind: 'text', field: 'fallbackPrompt', maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES },
  ],
  [MessageType.CHECKIN_RESPONSE]: [
    { kind: 'required', field: 'campaignId' },
    { kind: 'id', field: 'campaignId', maxBytes: 32 },
    { kind: 'int', field: 'status', min: 0, max: 4 },
    { kind: 'int', field: 'peopleCount', min: 0, max: FIELD_LIMITS.MAX_PEOPLE_TOTAL },
    { kind: 'location', field: 'location' },
  ],
  [MessageType.RESOURCE_REQUEST]: [
    { kind: 'required', field: 'requestId' },
    { kind: 'id', field: 'requestId', maxBytes: 32 },
    { kind: 'int', field: 'category', min: 0, max: 7 },
    { kind: 'int', field: 'urgency', min: 0, max: 3 },
    { kind: 'location', field: 'location' },
  ],
  [MessageType.MESH_CHAT]: [
    { kind: 'required', field: 'conversationId' },
    { kind: 'id', field: 'conversationId', maxBytes: 64 },
    { kind: 'required', field: 'senderNodeToken' },
    { kind: 'id', field: 'senderNodeToken', maxBytes: 32 },
    { kind: 'required', field: 'recipientNodeToken' },
    { kind: 'id', field: 'recipientNodeToken', maxBytes: 32 },
    { kind: 'text', field: 'senderLabel', maxBytes: 32 },
    { kind: 'required', field: 'text' },
    { kind: 'text', field: 'text', maxBytes: FIELD_LIMITS.MESH_CHAT_TEXT_BYTES },
    { kind: 'location', field: 'location' },
  ],
  [MessageType.FILE_MANIFEST]: [
    { kind: 'required', field: 'fileId' },
    { kind: 'id', field: 'fileId', maxBytes: 32 },
    { kind: 'int', field: 'totalBytes', min: 0, max: 131072 },
    { kind: 'int', field: 'fragmentSize', min: 1, max: 4096 },
    { kind: 'int', field: 'fragmentCount', min: 1, max: 64 },
  ],
  [MessageType.FILE_FRAGMENT]: [
    { kind: 'required', field: 'fileId' },
    { kind: 'id', field: 'fileId', maxBytes: 32 },
    { kind: 'int', field: 'fragmentIndex', min: 0, max: 63 },
  ],

  // --- previously unguarded: these accepted a completely empty payload ------
  [MessageType.RESPONDER_ACCEPTED]: [
    { kind: 'required', field: 'incidentId' },
    { kind: 'id', field: 'incidentId', maxBytes: 32 },
    { kind: 'required', field: 'assignmentId' },
    { kind: 'id', field: 'assignmentId', maxBytes: 32 },
    { kind: 'id', field: 'responderRef', maxBytes: 32 },
  ],
  [MessageType.RESPONDER_DECLINED]: [
    { kind: 'required', field: 'incidentId' },
    { kind: 'id', field: 'incidentId', maxBytes: 32 },
    { kind: 'required', field: 'assignmentId' },
    { kind: 'id', field: 'assignmentId', maxBytes: 32 },
    { kind: 'id', field: 'responderRef', maxBytes: 32 },
    { kind: 'int', field: 'reasonCode', min: 0, max: 255 },
  ],
  [MessageType.WEATHER_BULLETIN]: [
    { kind: 'required', field: 'bulletinId' },
    { kind: 'id', field: 'bulletinId', maxBytes: 32 },
    { kind: 'array', field: 'codes', maxItems: 16 },
    { kind: 'text', field: 'fallbackText', maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES },
  ],
  [MessageType.CACHE_CATALOG]: [
    { kind: 'required', field: 'bundles' },
    { kind: 'array', field: 'bundles', maxItems: 16 },
  ],
  [MessageType.CONTENT_ACTIVATE]: [
    { kind: 'required', field: 'bundleId' },
    { kind: 'id', field: 'bundleId', maxBytes: 32 },
    { kind: 'required', field: 'objectId' },
    { kind: 'id', field: 'objectId', maxBytes: 32 },
    { kind: 'required', field: 'opcode' },
    { kind: 'int', field: 'opcode', min: 0, max: 255 },
    { kind: 'text', field: 'fallbackText', maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES },
  ],
  [MessageType.RECORD_UPSERT]: [
    { kind: 'required', field: 'bundleId' },
    { kind: 'id', field: 'bundleId', maxBytes: 32 },
    { kind: 'required', field: 'objectId' },
    { kind: 'id', field: 'objectId', maxBytes: 32 },
    { kind: 'required', field: 'recordVersion' },
    { kind: 'int', field: 'recordVersion', min: 0, max: 65535 },
  ],
  [MessageType.RECORD_TOMBSTONE]: [
    { kind: 'required', field: 'bundleId' },
    { kind: 'id', field: 'bundleId', maxBytes: 32 },
    { kind: 'required', field: 'objectId' },
    { kind: 'id', field: 'objectId', maxBytes: 32 },
    { kind: 'required', field: 'recordVersion' },
    { kind: 'int', field: 'recordVersion', min: 0, max: 65535 },
    { kind: 'int', field: 'reasonCode', min: 0, max: 255 },
  ],
  [MessageType.CACHE_INVALIDATE]: [
    { kind: 'required', field: 'bundleId' },
    { kind: 'id', field: 'bundleId', maxBytes: 32 },
    { kind: 'required', field: 'version' },
    { kind: 'int', field: 'version', min: 0, max: 65535 },
    { kind: 'int', field: 'reasonCode', min: 0, max: 255 },
  ],
  [MessageType.HELLO_CAPABILITY]: [
    { kind: 'required', field: 'nodeToken' },
    { kind: 'id', field: 'nodeToken', maxBytes: 16 },
    { kind: 'required', field: 'protocolMin' },
    { kind: 'int', field: 'protocolMin', min: 0, max: 255 },
    { kind: 'required', field: 'protocolMax' },
    { kind: 'int', field: 'protocolMax', min: 0, max: 255 },
    { kind: 'int', field: 'batteryBand', min: 0, max: 3 },
    { kind: 'int', field: 'storageBand', min: 0, max: 3 },
    { kind: 'int', field: 'maxRecordBytes', min: 0, max: 65535 },
    { kind: 'int', field: 'maxFragmentBytes', min: 0, max: 65535 },
    { kind: 'int', field: 'queueEpoch', min: 0, max: 65535 },
    { kind: 'int', field: 'highestWaitingPriority', min: 0, max: 7 },
  ],
  [MessageType.INVENTORY]: [
    { kind: 'required', field: 'queueEpoch' },
    { kind: 'int', field: 'queueEpoch', min: 0, max: 65535 },
    { kind: 'array', field: 'criticalIds', maxItems: 16 },
    { kind: 'array', field: 'entries', maxItems: 48 },
    { kind: 'array', field: 'terminalIds', maxItems: 48 },
  ],
  [MessageType.PACKET_REQUEST]: [
    { kind: 'required', field: 'packetIds' },
    { kind: 'array', field: 'packetIds', maxItems: 48 },
    { kind: 'array', field: 'fragmentRequests', maxItems: 16 },
  ],
  [MessageType.NETWORK_STATUS_OBSERVATION]: [
    { kind: 'required', field: 'observerToken' },
    { kind: 'id', field: 'observerToken', maxBytes: 16 },
    { kind: 'required', field: 'peerToken' },
    { kind: 'id', field: 'peerToken', maxBytes: 16 },
    { kind: 'required', field: 'edgeKind' },
    { kind: 'int', field: 'edgeKind', min: 0, max: 4 },
  ],
};

/** Resource records share one rule set across SHELTER/MEDICAL/FOOD/SAFE_ZONE. */
const RESOURCE_RULES: readonly Rule[] = [
  { kind: 'required', field: 'objectId' },
  { kind: 'id', field: 'objectId', maxBytes: 32 },
  { kind: 'int', field: 'state', min: 0, max: 5 },
  { kind: 'int', field: 'capacityBand', min: 0, max: 5 },
  { kind: 'int', field: 'capacityExact', min: 0, max: 100000 },
  { kind: 'location', field: 'location' },
  { kind: 'text', field: 'fallbackLabel', maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES },
];

const RESOURCE_TYPES: ReadonlySet<number> = new Set([
  MessageType.SHELTER,
  MessageType.MEDICAL_POST,
  MessageType.FOOD_WATER,
  MessageType.SAFE_ZONE,
]);

function checkRules(rules: readonly Rule[], value: Record<string, unknown>): SchemaResult {
  for (const rule of rules) {
    const field = value[rule.field];

    if (rule.kind === 'required') {
      if (field === undefined || field === null) {
        return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: `missing required field "${rule.field}"` };
      }
      continue;
    }
    if (field === undefined || field === null) continue;

    switch (rule.kind) {
      case 'int': {
        if (typeof field !== 'number' || !Number.isInteger(field)) {
          return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: `"${rule.field}" must be an integer` };
        }
        if (field < rule.min || field > rule.max) {
          return {
            ok: false,
            reason: RejectReason.FIELD_OVER_LIMIT,
            detail: `"${rule.field}"=${field} outside [${rule.min}, ${rule.max}]`,
          };
        }
        break;
      }
      case 'text': {
        if (typeof field !== 'string') {
          return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: `"${rule.field}" must be text` };
        }
        const size = encoder.encode(field).length;
        if (size > rule.maxBytes) {
          return {
            ok: false,
            reason: RejectReason.FIELD_OVER_LIMIT,
            detail: `"${rule.field}" is ${size}B, over ${rule.maxBytes}B`,
          };
        }
        break;
      }
      case 'id': {
        if (typeof field !== 'string' || !SAFE_ID.test(field)) {
          return {
            ok: false,
            reason: RejectReason.SCHEMA_INVALID,
            detail: `"${rule.field}" is not a safe compact identifier`,
          };
        }
        if (encoder.encode(field).length > rule.maxBytes) {
          return { ok: false, reason: RejectReason.FIELD_OVER_LIMIT, detail: `"${rule.field}" too long` };
        }
        break;
      }
      case 'array': {
        if (!Array.isArray(field)) {
          return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: `"${rule.field}" must be an array` };
        }
        if (field.length > rule.maxItems) {
          return {
            ok: false,
            reason: RejectReason.FIELD_OVER_LIMIT,
            detail: `"${rule.field}" has ${field.length} items, over ${rule.maxItems}`,
          };
        }
        break;
      }
      case 'location': {
        if (typeof field !== 'object') {
          return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: `"${rule.field}" must be an object` };
        }
        const nested = checkRules(LOCATION_RULES, field as Record<string, unknown>);
        if (!nested.ok) return nested;
        break;
      }
    }
  }
  return { ok: true };
}

/**
 * FAILS CLOSED.
 *
 * This previously returned ok for any message type without a rules entry, so
 * 12 of 33 types accepted a completely empty payload -- including
 * RECORD_UPSERT and CONTENT_ACTIVATE, which mutate the map projection.
 *
 * Registering a new message type now requires registering its rules too.
 */
export function validateSchema(messageType: number, payload: Record<string, unknown>): SchemaResult {
  const rules = RESOURCE_TYPES.has(messageType) ? RESOURCE_RULES : RULES[messageType];
  if (!rules) {
    return {
      ok: false,
      reason: RejectReason.SCHEMA_INVALID,
      detail: `no schema rules registered for message type 0x${messageType.toString(16)}`,
    };
  }
  return checkRules(rules, payload);
}
