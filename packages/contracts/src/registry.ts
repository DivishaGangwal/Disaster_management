/**
 * CANONICAL PROTOCOL REGISTRY  --  FROZEN (Gate I)
 *
 * Spec: 02-SYSTEM-ARCHITECTURE-AND-PACKET-RULES.md "Canonical protocol registry"
 *       04-BLUEPRINT-finalsih.md section 7.5
 *
 * These numeric codes are the ONE source of truth for mobile, backend, map,
 * and Tier 2. Never create a transport-specific alias with a different meaning
 * (02-...: "agents must not create transport-specific aliases").
 *
 * Changing any value here is a Gate I change: see docs/CONTRACT-FREEZE.md.
 * Codes are stable once merged; retire a code, never reuse it.
 */

export const PROTOCOL_MAGIC = 0x444d; // "DM"
export const PROTOCOL_VERSION = 1;

/** Wire code for every packet family member. Stable numeric identity. */
export const MessageType = {
  // --- Emergency family 0x10 ------------------------------------------------
  SOS_CREATE: 0x10,
  SOS_UPDATE: 0x11,
  SOS_CANCEL: 0x12,

  // --- Response family 0x20 -------------------------------------------------
  RESPONDER_ASSIGNED: 0x20,
  RESPONDER_ACCEPTED: 0x21,
  RESPONDER_DECLINED: 0x22,
  RESPONDER_EN_ROUTE: 0x23,
  RESPONDER_ARRIVED: 0x24,
  RESOLVED: 0x25,

  // --- Receipt family 0x30 --------------------------------------------------
  LINK_RECEIPT: 0x30,
  BACKEND_ACKNOWLEDGEMENT: 0x31,

  // --- Resource family 0x40 -------------------------------------------------
  SHELTER: 0x40,
  MEDICAL_POST: 0x41,
  FOOD_WATER: 0x42,
  SAFE_ZONE: 0x43,

  // --- Hazard and navigation family 0x50 ------------------------------------
  HAZARD: 0x50,
  ROUTE_STATE: 0x51,

  // --- Authority family 0x60 ------------------------------------------------
  OFFICIAL_ALERT: 0x60,
  WEATHER_BULLETIN: 0x61,

  // --- Check-in family 0x70 -------------------------------------------------
  CHECKIN_CAMPAIGN: 0x70,
  CHECKIN_RESPONSE: 0x71,

  // --- Request family 0x80 --------------------------------------------------
  RESOURCE_REQUEST: 0x80,
  /** Person-to-person, store-carry-forward text addressed to one mesh node. */
  MESH_CHAT: 0x81,

  // --- Cached-content family 0x90 -------------------------------------------
  CACHE_CATALOG: 0x90,
  CONTENT_ACTIVATE: 0x91,
  RECORD_UPSERT: 0x92,
  RECORD_TOMBSTONE: 0x93,
  CACHE_INVALIDATE: 0x94,

  // --- File/data family 0xa0 ------------------------------------------------
  FILE_MANIFEST: 0xa0,
  FILE_FRAGMENT: 0xa1,

  // --- Network/session control family 0xf0 ----------------------------------
  HELLO_CAPABILITY: 0xf0,
  INVENTORY: 0xf1,
  PACKET_REQUEST: 0xf2,
  NETWORK_STATUS_OBSERVATION: 0xf3,
} as const;

export type MessageTypeName = keyof typeof MessageType;
export type MessageTypeCode = (typeof MessageType)[MessageTypeName];

const NAME_BY_CODE = new Map<number, MessageTypeName>(
  (Object.entries(MessageType) as [MessageTypeName, number][]).map(([name, code]) => [code, name]),
);

export function messageTypeName(code: number): MessageTypeName | undefined {
  return NAME_BY_CODE.get(code);
}

export function isKnownMessageType(code: number): code is MessageTypeCode {
  return NAME_BY_CODE.has(code);
}

/**
 * Network scheduling class. LOWER number is served FIRST.
 * Spec: 02-... "Queue order". Priority is NOT severity (02-... "Priority and severity").
 */
export const Priority = {
  /** SOS create/update/cancel, resolution, critical acknowledgements. */
  EMERGENCY: 0,
  /** Responder assignment and lifecycle control. */
  RESPONSE_CONTROL: 1,
  /** Official critical alerts. */
  AUTHORITY_CRITICAL: 2,
  /** Hazards, routes, hospitals, shelters, safe zones, help requests. */
  OPERATIONAL: 3,
  /** Check-in campaigns and responses. */
  CHECKIN: 4,
  /** General resource updates and cached-content operations. */
  GENERAL_UPDATE: 5,
  /** File manifests. */
  FILE_MANIFEST: 6,
  /** Requested file/image fragments. Lowest. */
  FILE_FRAGMENT: 7,
} as const;

export type PriorityValue = (typeof Priority)[keyof typeof Priority];

/**
 * Human emergency level. Severity never grants authority (DEC-016).
 * Spec: 01-... "Severity and importance".
 */
export const Severity = {
  INFO: 0,
  ASSISTANCE: 1,
  URGENT: 2,
  LIFE_CRITICAL: 3,
} as const;

export type SeverityValue = (typeof Severity)[keyof typeof Severity];

/**
 * Envelope flag bits (16-bit field at offset 4).
 * Spec: 04-BLUEPRINT section 7.2.
 */
export const Flags = {
  FRAGMENTED: 1 << 0,
  LOCATION_PRESENT: 1 << 1,
  RECEIPT_REQUESTED: 1 << 2,
  /** Applies a typed operation to the offline map projection. */
  MAP_DELTA: 1 << 3,
  /** Terminal record: cancel, resolved, tombstone. Suppresses active replication. */
  TERMINAL: 1 << 4,
  /**
   * Created through the provisioned authority dashboard workflow.
   * DEC-019 / INT-004: a role LABEL, never cryptographic proof.
   */
  PROTOTYPE_AUTHORITY: 1 << 5,
  /** Packet originated on Tier 2 radio and was bridged into Tier 1. */
  TIER2_ORIGIN: 1 << 6,
  /** Community-reported: lower trust and routing weight (DEC-015). */
  COMMUNITY_REPORTED: 1 << 7,
} as const;

/**
 * Source/campaign class (1 byte at offset 58). Selects prototype role policy.
 * INT-005: the source ROLE LABEL, distinct from cryptographic proof.
 */
export const SourceClass = {
  UNKNOWN: 0,
  GENERAL_PUBLIC: 1,
  RESPONDER_PROVISIONED: 2,
  AUTHORITY_PROVISIONED: 3,
  COORDINATOR_PROVISIONED: 4,
  BACKEND: 5,
  TIER2_BROADCAST: 6,
} as const;

export type SourceClassValue = (typeof SourceClass)[keyof typeof SourceClass];

/** Default scheduling class per message type. Validation clamps illegal combinations. */
export const DEFAULT_PRIORITY: Readonly<Record<MessageTypeCode, PriorityValue>> = {
  [MessageType.SOS_CREATE]: Priority.EMERGENCY,
  [MessageType.SOS_UPDATE]: Priority.EMERGENCY,
  [MessageType.SOS_CANCEL]: Priority.EMERGENCY,
  [MessageType.RESPONDER_ASSIGNED]: Priority.RESPONSE_CONTROL,
  [MessageType.RESPONDER_ACCEPTED]: Priority.RESPONSE_CONTROL,
  [MessageType.RESPONDER_DECLINED]: Priority.RESPONSE_CONTROL,
  [MessageType.RESPONDER_EN_ROUTE]: Priority.RESPONSE_CONTROL,
  [MessageType.RESPONDER_ARRIVED]: Priority.RESPONSE_CONTROL,
  [MessageType.RESOLVED]: Priority.EMERGENCY,
  [MessageType.LINK_RECEIPT]: Priority.RESPONSE_CONTROL,
  [MessageType.BACKEND_ACKNOWLEDGEMENT]: Priority.EMERGENCY,
  [MessageType.SHELTER]: Priority.OPERATIONAL,
  [MessageType.MEDICAL_POST]: Priority.OPERATIONAL,
  [MessageType.FOOD_WATER]: Priority.OPERATIONAL,
  [MessageType.SAFE_ZONE]: Priority.OPERATIONAL,
  [MessageType.HAZARD]: Priority.OPERATIONAL,
  [MessageType.ROUTE_STATE]: Priority.OPERATIONAL,
  [MessageType.OFFICIAL_ALERT]: Priority.AUTHORITY_CRITICAL,
  [MessageType.WEATHER_BULLETIN]: Priority.GENERAL_UPDATE,
  [MessageType.CHECKIN_CAMPAIGN]: Priority.CHECKIN,
  [MessageType.CHECKIN_RESPONSE]: Priority.CHECKIN,
  [MessageType.RESOURCE_REQUEST]: Priority.OPERATIONAL,
  [MessageType.MESH_CHAT]: Priority.GENERAL_UPDATE,
  [MessageType.CACHE_CATALOG]: Priority.GENERAL_UPDATE,
  [MessageType.CONTENT_ACTIVATE]: Priority.GENERAL_UPDATE,
  [MessageType.RECORD_UPSERT]: Priority.GENERAL_UPDATE,
  [MessageType.RECORD_TOMBSTONE]: Priority.GENERAL_UPDATE,
  [MessageType.CACHE_INVALIDATE]: Priority.GENERAL_UPDATE,
  [MessageType.FILE_MANIFEST]: Priority.FILE_MANIFEST,
  [MessageType.FILE_FRAGMENT]: Priority.FILE_FRAGMENT,
  [MessageType.HELLO_CAPABILITY]: Priority.RESPONSE_CONTROL,
  [MessageType.INVENTORY]: Priority.RESPONSE_CONTROL,
  [MessageType.PACKET_REQUEST]: Priority.RESPONSE_CONTROL,
  [MessageType.NETWORK_STATUS_OBSERVATION]: Priority.GENERAL_UPDATE,
};

/** Session-scoped control types. Never stored as relayable custody. */
export const SESSION_CONTROL_TYPES: ReadonlySet<number> = new Set([
  MessageType.HELLO_CAPABILITY,
  MessageType.INVENTORY,
  MessageType.PACKET_REQUEST,
]);

/** Terminal record types: they stop active replication of their stream (SOS-009). */
export const TERMINAL_TYPES: ReadonlySet<number> = new Set([
  MessageType.SOS_CANCEL,
  MessageType.RESOLVED,
  MessageType.RECORD_TOMBSTONE,
  MessageType.CACHE_INVALIDATE,
]);
