/**
 * DOMAIN ENUMERATIONS  --  FROZEN (Gate I)
 *
 * Compact numeric enumerations. Spec: 02-... "Packet sizing rules" -- "Use
 * enumerations and numeric IDs for known values."
 *
 * These are wire values. Renaming a key is free; changing a number is Gate I.
 */

export const EmergencyCategory = {
  MEDICAL: 0,
  TRAPPED: 1,
  FIRE: 2,
  FLOOD: 3,
  VIOLENCE: 4,
  STRUCTURAL_COLLAPSE: 5,
  MISSING_PERSON: 6,
  OTHER: 7,
} as const;
export type EmergencyCategoryValue = (typeof EmergencyCategory)[keyof typeof EmergencyCategory];

export const Mobility = {
  UNKNOWN: 0,
  MOBILE: 1,
  LIMITED: 2,
  IMMOBILE: 3,
  TRAPPED: 4,
} as const;
export type MobilityValue = (typeof Mobility)[keyof typeof Mobility];

/** OFF-005 / MAP-004: location is never silently absent. */
export const LocationSource = {
  UNKNOWN: 0,
  FRESH_GNSS: 1,
  CACHED_GNSS: 2,
  NETWORK: 3,
  USER_PIN: 4,
} as const;
export type LocationSourceValue = (typeof LocationSource)[keyof typeof LocationSource];

export const BatteryBand = {
  CRITICAL: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
} as const;
export type BatteryBandValue = (typeof BatteryBand)[keyof typeof BatteryBand];

export const ReplyCapability = {
  TIER1_BLE: 1 << 0,
  INTERNET: 1 << 1,
  SMS: 1 << 2,
  VOICE: 1 << 3,
} as const;

export const HelpCategory = {
  MEDICAL_AID: 0,
  RESCUE: 1,
  FOOD: 2,
  WATER: 3,
  SHELTER: 4,
  EVACUATION: 5,
  FUEL: 6,
  COMMUNICATION: 7,
} as const;
export type HelpCategoryValue = (typeof HelpCategory)[keyof typeof HelpCategory];

/** Resource operational state (01-... "Resource state"). */
export const OperationalState = {
  UNKNOWN: 0,
  OPEN: 1,
  FULL: 2,
  CLOSED: 3,
  UNAVAILABLE: 4,
  DAMAGED: 5,
} as const;
export type OperationalStateValue = (typeof OperationalState)[keyof typeof OperationalState];

export const CapacityBand = {
  UNKNOWN: 0,
  EMPTY: 1,
  LOW_OCCUPANCY: 2,
  HALF: 3,
  NEARLY_FULL: 4,
  FULL: 5,
} as const;
export type CapacityBandValue = (typeof CapacityBand)[keyof typeof CapacityBand];

export const HazardType = {
  FIRE: 0,
  FLOOD: 1,
  COLLAPSE: 2,
  LANDSLIDE: 3,
  CHEMICAL: 4,
  GAS_LEAK: 5,
  ELECTRICAL: 6,
  CROWD: 7,
  OTHER: 8,
} as const;
export type HazardTypeValue = (typeof HazardType)[keyof typeof HazardType];

/**
 * 02-...: "Complex polygons are not sent as ordinary emergency packets; the
 * hackathon uses points, circles, small route-segment sets, or cached
 * geometry references."
 */
export const GeometryKind = {
  POINT: 0,
  CIRCLE: 1,
  ROUTE_SEGMENTS: 2,
  CACHED_REFERENCE: 3,
} as const;
export type GeometryKindValue = (typeof GeometryKind)[keyof typeof GeometryKind];

export const RouteState = {
  OPEN: 0,
  BLOCKED: 1,
  RESTRICTED: 2,
  ADVISED: 3,
  REOPENED: 4,
} as const;
export type RouteStateValue = (typeof RouteState)[keyof typeof RouteState];

export const AlertCategory = {
  EVACUATION: 0,
  SHELTER_IN_PLACE: 1,
  WEATHER: 2,
  UTILITY: 3,
  HEALTH: 4,
  SECURITY: 5,
  ALL_CLEAR: 6,
} as const;
export type AlertCategoryValue = (typeof AlertCategory)[keyof typeof AlertCategory];

/** Prepared instruction codes so the wire never carries long sentences. */
export const InstructionCode = {
  NONE: 0,
  EVACUATE_NOW: 1,
  MOVE_TO_HIGHER_GROUND: 2,
  STAY_INDOORS: 3,
  BOIL_WATER: 4,
  AVOID_AREA: 5,
  REPORT_TO_SHELTER: 6,
  AWAIT_INSTRUCTION: 7,
} as const;
export type InstructionCodeValue = (typeof InstructionCode)[keyof typeof InstructionCode];

export const CheckinStatus = {
  SAFE: 0,
  SAFE_NEED_SUPPLIES: 1,
  NEED_ASSISTANCE: 2,
  INJURED: 3,
  DISPLACED: 4,
} as const;
export type CheckinStatusValue = (typeof CheckinStatus)[keyof typeof CheckinStatus];

export const CancelReason = {
  ACCIDENTAL: 0,
  RESOLVED_SELF: 1,
  HELP_ARRIVED: 2,
  DUPLICATE: 3,
  OTHER: 4,
} as const;
export type CancelReasonValue = (typeof CancelReason)[keyof typeof CancelReason];

export const ResolutionOutcome = {
  RESCUED: 0,
  ASSISTED_ON_SITE: 1,
  TRANSPORTED: 2,
  NO_ACTION_REQUIRED: 3,
  UNREACHABLE: 4,
  ESCALATED: 5,
} as const;
export type ResolutionOutcomeValue = (typeof ResolutionOutcome)[keyof typeof ResolutionOutcome];

/** 02-... RESPONDER_ARRIVED "declared/proximity-assisted evidence category". */
export const ArrivalEvidence = {
  DECLARED: 0,
  PROXIMITY_ASSISTED: 1,
} as const;
export type ArrivalEvidenceValue = (typeof ArrivalEvidence)[keyof typeof ArrivalEvidence];

export const LinkReceiptResult = {
  ACCEPTED: 0,
  REJECTED_INVALID: 1,
  REJECTED_DUPLICATE: 2,
  REJECTED_FULL: 3,
} as const;
export type LinkReceiptResultValue = (typeof LinkReceiptResult)[keyof typeof LinkReceiptResult];

export const BackendDedupOutcome = {
  ACCEPTED_NEW: 0,
  DUPLICATE_OBSERVATION: 1,
  CONFLICT_QUARANTINED: 2,
  EXPIRED: 3,
} as const;
export type BackendDedupOutcomeValue = (typeof BackendDedupOutcome)[keyof typeof BackendDedupOutcome];

/**
 * File content categories (FIL-006).
 *
 * The wire previously carried `mimeCategory` as a bare number with no defined
 * meaning, so "reject executables" was unimplementable. These are the only
 * accepted values; anything else is refused.
 *
 * HACKATHON DECISION: the demo transfers images and small documents only.
 * ARCHIVE exists purely so it can be REFUSED -- the prototype never
 * decompresses anything, which is how "no unbounded decompression" is
 * satisfied (02-... "File and image rules").
 */
export const MimeCategory = {
  IMAGE: 0,
  DOCUMENT: 1,
  AUDIO: 2,
  /** Always refused: no executables or automatic installation. */
  EXECUTABLE: 3,
  /** Always refused: the prototype never decompresses. */
  ARCHIVE: 4,
  OTHER: 5,
} as const;
export type MimeCategoryValue = (typeof MimeCategory)[keyof typeof MimeCategory];

/** FIL-006: categories the receiver refuses at manifest time. */
export const REFUSED_MIME_CATEGORIES: ReadonlySet<number> = new Set([
  MimeCategory.EXECUTABLE,
  MimeCategory.ARCHIVE,
]);
