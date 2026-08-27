/**
 * COMPACT FIELD KEYS
 *
 * Spec: 02-... "Packet sizing rules" -- "Use enumerations and numeric IDs for
 * known values", "Omit unused fields", "Send object IDs and changed fields".
 *
 * Every payload field name maps to a one-byte key on the wire. The long name
 * exists only in TypeScript. Adding a NEW key is backward compatible; changing
 * an existing key number is a Gate I change.
 */

import { MessageType } from '@dsm/contracts';

export type FieldMap = Readonly<Record<string, number>>;

/** Nested LocationState. Shared by every payload that carries a position. */
export const LOCATION_FIELDS: FieldMap = {
  source: 1,
  latE7: 2,
  lonE7: 3,
  accuracyM: 4,
  ageS: 5,
};

/** Nested GeoExtension (blueprint 7.3). Rides on reserved key 252. */
export const GEO_FIELDS: FieldMap = {
  latE7: 1,
  lonE7: 2,
  accuracyM: 3,
  scopeRadiusM: 4,
};

/** One entry of CACHE_CATALOG.bundles. */
export const BUNDLE_FIELDS: FieldMap = { bundleId: 1, version: 2 };

/** One entry of INVENTORY.entries. */
export const INVENTORY_ENTRY_FIELDS: FieldMap = {
  packetId: 1,
  type: 2,
  priority: 3,
  fragmentsHeld: 4,
  fragmentCount: 5,
};

/** One entry of PACKET_REQUEST.fragmentRequests. */
export const FRAGMENT_REQUEST_FIELDS: FieldMap = { fileId: 1, from: 2, to: 3 };

/**
 * Nested object shapes, resolved by field NAME wherever they appear.
 *
 * EVERY nested object must be registered here. The encoder refuses to write an
 * unregistered one rather than silently emitting an empty map -- that
 * fail-open behaviour silently discarded the whole GEO extension.
 */
export const NESTED_FIELD_MAPS: Readonly<Record<string, FieldMap>> = {
  location: LOCATION_FIELDS,
  __geo: GEO_FIELDS,
  bundles: BUNDLE_FIELDS,
  entries: INVENTORY_ENTRY_FIELDS,
  fragmentRequests: FRAGMENT_REQUEST_FIELDS,
};

const SOS_CREATE: FieldMap = {
  incidentId: 1,
  category: 2,
  peopleTotal: 3,
  mobility: 4,
  location: 5,
  replyCapabilities: 6,
  injured: 7,
  children: 8,
  shortNote: 9,
  preparedPhraseId: 10,
  language: 11,
  helpCategories: 12,
  batteryBand: 13,
};

const SOS_UPDATE: FieldMap = {
  incidentId: 1,
  category: 2,
  peopleTotal: 3,
  injured: 4,
  mobility: 5,
  location: 6,
  shortNote: 7,
  preparedPhraseId: 8,
  batteryBand: 9,
};

const SOS_CANCEL: FieldMap = { incidentId: 1, reason: 2, terminalRetentionS: 3 };

const RESPONDER_ASSIGNED: FieldMap = {
  incidentId: 1,
  assignmentId: 2,
  responderRef: 3,
  teamRef: 4,
  dispatcherLabel: 5,
};

const RESPONDER_ACK: FieldMap = { incidentId: 1, assignmentId: 2, responderRef: 3, reasonCode: 4 };

const RESPONDER_EN_ROUTE: FieldMap = {
  incidentId: 1,
  assignmentId: 2,
  responderRef: 3,
  location: 4,
  etaBandMin: 5,
};

const RESPONDER_ARRIVED: FieldMap = { incidentId: 1, assignmentId: 2, responderRef: 3, evidence: 4 };

const RESOLVED: FieldMap = { incidentId: 1, resolverRef: 2, outcome: 3, terminalRetentionS: 4 };

const LINK_RECEIPT: FieldMap = { forPacketId: 1, digestPrefix: 2, receivingNodeToken: 3, result: 4 };

const BACKEND_ACK: FieldMap = {
  forPacketId: 1,
  incidentId: 2,
  backendReceiptId: 3,
  dedupOutcome: 4,
  coordinationStatus: 5,
};

const RESOURCE_RECORD: FieldMap = {
  objectId: 1,
  state: 2,
  location: 3,
  capacityBand: 4,
  capacityExact: 5,
  availabilityBand: 6,
  openingHoursCode: 7,
  fallbackLabel: 8,
  capabilityBits: 9,
  lastConfirmedS: 10,
};

const HAZARD: FieldMap = {
  hazardId: 1,
  hazardType: 2,
  geometryKind: 3,
  latE7: 4,
  lonE7: 5,
  radiusM: 6,
  routeIds: 7,
  cachedGeometryRef: 8,
  fallbackLabel: 9,
};

const ROUTE_STATE: FieldMap = {
  routeId: 1,
  state: 2,
  reasonCode: 3,
  direction: 4,
  fallbackInstruction: 5,
};

const OFFICIAL_ALERT: FieldMap = {
  alertId: 1,
  category: 2,
  instruction: 3,
  regionCode: 4,
  latE7: 5,
  lonE7: 6,
  radiusM: 7,
  validFromS: 8,
  validUntilS: 9,
  fallbackText: 10,
  language: 11,
  relatedObjectIds: 12,
  campaignId: 13,
};

const WEATHER_BULLETIN: FieldMap = {
  bulletinId: 1,
  regionCode: 2,
  codes: 3,
  validUntilS: 4,
  fallbackText: 5,
};

const CHECKIN_CAMPAIGN: FieldMap = {
  campaignId: 1,
  campaignVersion: 2,
  formId: 3,
  deadlineS: 4,
  regionCode: 5,
  allowedStatuses: 6,
  requestPeopleCount: 7,
  requestLocation: 8,
  fallbackPrompt: 9,
};

const CHECKIN_RESPONSE: FieldMap = {
  campaignId: 1,
  status: 2,
  peopleCount: 3,
  location: 4,
  sourceRef: 5,
};

const RESOURCE_REQUEST: FieldMap = {
  requestId: 1,
  category: 2,
  urgency: 3,
  quantityBand: 4,
  peopleCount: 5,
  location: 6,
  linkedIncidentId: 7,
};

const MESH_CHAT: FieldMap = {
  conversationId: 1,
  senderNodeToken: 2,
  recipientNodeToken: 3,
  senderLabel: 4,
  text: 5,
};

const CACHE_CATALOG: FieldMap = { bundles: 1 };
const CONTENT_ACTIVATE: FieldMap = { bundleId: 1, objectId: 2, opcode: 3, fallbackText: 4 };
const RECORD_UPSERT: FieldMap = { bundleId: 1, objectId: 2, recordVersion: 3, fields: 4 };
const RECORD_TOMBSTONE: FieldMap = { bundleId: 1, objectId: 2, recordVersion: 3, reasonCode: 4 };
const CACHE_INVALIDATE: FieldMap = { bundleId: 1, version: 2, reasonCode: 3 };

const FILE_MANIFEST: FieldMap = {
  fileId: 1,
  purposeCode: 2,
  mimeCategory: 3,
  totalBytes: 4,
  fragmentSize: 5,
  fragmentCount: 6,
  digest: 7,
  thumbnailRef: 8,
  linkedIncidentId: 9,
};

const FILE_FRAGMENT: FieldMap = { fileId: 1, fragmentIndex: 2, fragmentDigest: 3, data: 4 };

const HELLO_CAPABILITY: FieldMap = {
  nodeToken: 1,
  protocolMin: 2,
  protocolMax: 3,
  roleClass: 4,
  batteryBand: 5,
  storageBand: 6,
  maxRecordBytes: 7,
  maxFragmentBytes: 8,
  gatewayProven: 9,
  gatewayProofAgeS: 10,
  queueEpoch: 11,
  highestWaitingPriority: 12,
};

const INVENTORY: FieldMap = {
  criticalIds: 1,
  entries: 2,
  terminalIds: 3,
  queueEpoch: 4,
  truncated: 5,
  /** Compact 8-byte ID prefixes; see inventory-ids.ts. Supersedes criticalIds. */
  idPrefixes: 6,
};

const PACKET_REQUEST: FieldMap = { packetIds: 1, fragmentRequests: 2 };

const NETWORK_STATUS_OBSERVATION: FieldMap = {
  observerToken: 1,
  peerToken: 2,
  edgeKind: 3,
  observedAtS: 4,
};

/** One field map per message code. Missing entry => the codec refuses to encode. */
export const FIELD_MAP_BY_TYPE: Readonly<Record<number, FieldMap>> = {
  [MessageType.SOS_CREATE]: SOS_CREATE,
  [MessageType.SOS_UPDATE]: SOS_UPDATE,
  [MessageType.SOS_CANCEL]: SOS_CANCEL,
  [MessageType.RESPONDER_ASSIGNED]: RESPONDER_ASSIGNED,
  [MessageType.RESPONDER_ACCEPTED]: RESPONDER_ACK,
  [MessageType.RESPONDER_DECLINED]: RESPONDER_ACK,
  [MessageType.RESPONDER_EN_ROUTE]: RESPONDER_EN_ROUTE,
  [MessageType.RESPONDER_ARRIVED]: RESPONDER_ARRIVED,
  [MessageType.RESOLVED]: RESOLVED,
  [MessageType.LINK_RECEIPT]: LINK_RECEIPT,
  [MessageType.BACKEND_ACKNOWLEDGEMENT]: BACKEND_ACK,
  [MessageType.SHELTER]: RESOURCE_RECORD,
  [MessageType.MEDICAL_POST]: RESOURCE_RECORD,
  [MessageType.FOOD_WATER]: RESOURCE_RECORD,
  [MessageType.SAFE_ZONE]: RESOURCE_RECORD,
  [MessageType.HAZARD]: HAZARD,
  [MessageType.ROUTE_STATE]: ROUTE_STATE,
  [MessageType.OFFICIAL_ALERT]: OFFICIAL_ALERT,
  [MessageType.WEATHER_BULLETIN]: WEATHER_BULLETIN,
  [MessageType.CHECKIN_CAMPAIGN]: CHECKIN_CAMPAIGN,
  [MessageType.CHECKIN_RESPONSE]: CHECKIN_RESPONSE,
  [MessageType.RESOURCE_REQUEST]: RESOURCE_REQUEST,
  [MessageType.MESH_CHAT]: MESH_CHAT,
  [MessageType.CACHE_CATALOG]: CACHE_CATALOG,
  [MessageType.CONTENT_ACTIVATE]: CONTENT_ACTIVATE,
  [MessageType.RECORD_UPSERT]: RECORD_UPSERT,
  [MessageType.RECORD_TOMBSTONE]: RECORD_TOMBSTONE,
  [MessageType.CACHE_INVALIDATE]: CACHE_INVALIDATE,
  [MessageType.FILE_MANIFEST]: FILE_MANIFEST,
  [MessageType.FILE_FRAGMENT]: FILE_FRAGMENT,
  [MessageType.HELLO_CAPABILITY]: HELLO_CAPABILITY,
  [MessageType.INVENTORY]: INVENTORY,
  [MessageType.PACKET_REQUEST]: PACKET_REQUEST,
  [MessageType.NETWORK_STATUS_OBSERVATION]: NETWORK_STATUS_OBSERVATION,
};

/** Reverse lookup, built once. */
const REVERSE_CACHE = new Map<FieldMap, ReadonlyMap<number, string>>();

export function reverseFieldMap(map: FieldMap): ReadonlyMap<number, string> {
  const cached = REVERSE_CACHE.get(map);
  if (cached) return cached;
  const reverse = new Map<number, string>();
  for (const [name, key] of Object.entries(map)) reverse.set(key, name);
  REVERSE_CACHE.set(map, reverse);
  return reverse;
}
