/**
 * TYPED PAYLOAD SCHEMAS  --  FROZEN (Gate I)
 *
 * One TypeScript type per message code in the registry. Every packet family
 * listed in 01-... "Complete packet catalogue" appears here, so nothing is
 * dropped for being off the main demo path (working rule 7).
 *
 * Field names are short on the wire (see codec/payload-codec.ts field maps);
 * these long names exist for readability in the domain layer only.
 */

import type { ObjectId, StreamId } from './envelope.js';
import type {
  AlertCategoryValue,
  ArrivalEvidenceValue,
  BackendDedupOutcomeValue,
  BatteryBandValue,
  CancelReasonValue,
  CapacityBandValue,
  CheckinStatusValue,
  EmergencyCategoryValue,
  GeometryKindValue,
  HazardTypeValue,
  HelpCategoryValue,
  InstructionCodeValue,
  LinkReceiptResultValue,
  LocationSourceValue,
  MobilityValue,
  OperationalStateValue,
  ResolutionOutcomeValue,
  RouteStateValue,
} from './enums.js';

/** A bounded location observation. Age and accuracy travel with it (DEC-020). */
export interface LocationState {
  readonly source: LocationSourceValue;
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly accuracyM?: number;
  /** Seconds between the fix and packet creation. */
  readonly ageS: number;
}

// --- Emergency family --------------------------------------------------------

export interface SosCreatePayload {
  readonly incidentId: StreamId;
  readonly category: EmergencyCategoryValue;
  readonly peopleTotal: number;
  readonly mobility: MobilityValue;
  readonly location: LocationState;
  readonly replyCapabilities: number;
  readonly injured?: number;
  readonly children?: number;
  /** Bounded free text, FIELD_LIMITS.SHORT_NOTE_BYTES. Optional by design. */
  readonly shortNote?: string;
  /** Index into the content pack's prepared-phrase list. Cheaper than text. */
  readonly preparedPhraseId?: number;
  readonly language?: string;
  readonly helpCategories?: readonly HelpCategoryValue[];
  readonly batteryBand?: BatteryBandValue;
}

/** SOS-005: references the incident, raises the sequence, carries changed fields only. */
export interface SosUpdatePayload {
  readonly incidentId: StreamId;
  readonly category?: EmergencyCategoryValue;
  readonly peopleTotal?: number;
  readonly injured?: number;
  readonly mobility?: MobilityValue;
  readonly location?: LocationState;
  readonly shortNote?: string;
  readonly preparedPhraseId?: number;
  readonly batteryBand?: BatteryBandValue;
}

export interface SosCancelPayload {
  readonly incidentId: StreamId;
  readonly reason: CancelReasonValue;
  /** Seconds the terminal record is retained to suppress stale copies. */
  readonly terminalRetentionS: number;
}

// --- Response family ---------------------------------------------------------

export interface ResponderAssignedPayload {
  readonly incidentId: StreamId;
  readonly assignmentId: string;
  readonly responderRef: string;
  readonly teamRef?: string;
  readonly dispatcherLabel: string;
}

export interface ResponderAcceptedPayload {
  readonly incidentId: StreamId;
  readonly assignmentId: string;
  readonly responderRef: string;
}

export interface ResponderDeclinedPayload {
  readonly incidentId: StreamId;
  readonly assignmentId: string;
  readonly responderRef: string;
  readonly reasonCode?: number;
}

export interface ResponderEnRoutePayload {
  readonly incidentId: StreamId;
  readonly assignmentId: string;
  readonly responderRef: string;
  readonly location?: LocationState;
  /** Coarse band in minutes. Never presented as a guarantee. */
  readonly etaBandMin?: number;
}

export interface ResponderArrivedPayload {
  readonly incidentId: StreamId;
  readonly assignmentId: string;
  readonly responderRef: string;
  readonly evidence: ArrivalEvidenceValue;
}

export interface ResolvedPayload {
  readonly incidentId: StreamId;
  readonly resolverRef: string;
  readonly outcome: ResolutionOutcomeValue;
  readonly terminalRetentionS: number;
}

// --- Receipt family ----------------------------------------------------------

/** DEC-022: never rendered as rescue progress. */
export interface LinkReceiptPayload {
  readonly forPacketId: string;
  readonly digestPrefix: string;
  readonly receivingNodeToken: string;
  readonly result: LinkReceiptResultValue;
}

export interface BackendAckPayload {
  readonly forPacketId: string;
  readonly incidentId?: StreamId;
  readonly backendReceiptId: string;
  readonly dedupOutcome: BackendDedupOutcomeValue;
  /** Optional compact coordination status code from the dashboard. */
  readonly coordinationStatus?: number;
}

// --- Resource family ---------------------------------------------------------

/** Shared shape for SHELTER, MEDICAL_POST, FOOD_WATER, SAFE_ZONE. */
export interface ResourceRecordPayload {
  /** Compact ID from the regional pack, or a temporary ID for a new point. */
  readonly objectId: ObjectId;
  readonly state: OperationalStateValue;
  readonly location?: LocationState;
  readonly capacityBand?: CapacityBandValue;
  readonly capacityExact?: number;
  readonly availabilityBand?: CapacityBandValue;
  readonly openingHoursCode?: number;
  /** Shown when the object is missing from the local pack (MAP-008, T2-010). */
  readonly fallbackLabel?: string;
  /** Bitmask of pack-defined capability bits (surgery, dialysis, wheelchair, ...). */
  readonly capabilityBits?: number;
  readonly lastConfirmedS?: number;
}

// --- Hazard and navigation family --------------------------------------------

export interface HazardPayload {
  readonly hazardId: StreamId;
  readonly hazardType: HazardTypeValue;
  readonly geometryKind: GeometryKindValue;
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly radiusM?: number;
  readonly routeIds?: readonly ObjectId[];
  readonly cachedGeometryRef?: ObjectId;
  readonly fallbackLabel?: string;
}

export interface RouteStatePayload {
  readonly routeId: ObjectId;
  readonly state: RouteStateValue;
  readonly reasonCode?: number;
  /** 0 both ways, 1 forward, 2 reverse. */
  readonly direction?: number;
  readonly fallbackInstruction?: string;
}

// --- Authority family --------------------------------------------------------

export interface OfficialAlertPayload {
  readonly alertId: StreamId;
  readonly category: AlertCategoryValue;
  readonly instruction: InstructionCodeValue;
  /** Region code from the content pack, or a circle when the pack lacks it. */
  readonly regionCode?: string;
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly radiusM?: number;
  readonly validFromS?: number;
  readonly validUntilS?: number;
  /** T2-010: short fallback text for critical meaning when an object is missing. */
  readonly fallbackText?: string;
  readonly language?: string;
  readonly relatedObjectIds?: readonly ObjectId[];
  readonly campaignId?: string;
}

export interface WeatherBulletinPayload {
  readonly bulletinId: StreamId;
  readonly regionCode?: string;
  /** Compact coded observations; the pack maps codes to display strings. */
  readonly codes: readonly number[];
  readonly validUntilS?: number;
  readonly fallbackText?: string;
}

// --- Check-in family ---------------------------------------------------------

export interface CheckinCampaignPayload {
  readonly campaignId: StreamId;
  readonly campaignVersion: number;
  /** Cached form ID in the content pack. The wire never carries a form schema. */
  readonly formId: ObjectId;
  readonly deadlineS: number;
  readonly regionCode?: string;
  readonly allowedStatuses: readonly CheckinStatusValue[];
  readonly requestPeopleCount?: boolean;
  readonly requestLocation?: boolean;
  readonly fallbackPrompt?: string;
}

/** T2-012 / DEC-008: this always leaves by Tier 1 or a gateway, never by radio. */
export interface CheckinResponsePayload {
  readonly campaignId: StreamId;
  readonly status: CheckinStatusValue;
  readonly peopleCount?: number;
  readonly location?: LocationState;
  readonly sourceRef?: string;
}

// --- Request family ----------------------------------------------------------

export interface ResourceRequestPayload {
  readonly requestId: StreamId;
  readonly category: HelpCategoryValue;
  /** 0 routine .. 3 immediate. Distinct from SOS severity. */
  readonly urgency: number;
  readonly quantityBand?: number;
  readonly peopleCount?: number;
  readonly location?: LocationState;
  readonly linkedIncidentId?: StreamId;
}

// --- Cached-content family ---------------------------------------------------

export interface CacheCatalogPayload {
  readonly bundles: readonly { readonly bundleId: string; readonly version: number }[];
}

export interface ContentActivatePayload {
  readonly bundleId: string;
  readonly objectId: ObjectId;
  /** Pack-defined opcode. Never a path, URL, or command (02-... object resolution). */
  readonly opcode: number;
  readonly fallbackText?: string;
}

export interface RecordUpsertPayload {
  readonly bundleId: string;
  readonly objectId: ObjectId;
  readonly recordVersion: number;
  /** Bounded typed key/value pairs interpreted by the pack schema. */
  readonly fields: Readonly<Record<string, number | string | boolean>>;
}

export interface RecordTombstonePayload {
  readonly bundleId: string;
  readonly objectId: ObjectId;
  readonly recordVersion: number;
  readonly reasonCode?: number;
}

export interface CacheInvalidatePayload {
  readonly bundleId: string;
  readonly version: number;
  readonly reasonCode?: number;
}

// --- File/data family --------------------------------------------------------

export interface FileManifestPayload {
  readonly fileId: string;
  readonly purposeCode: number;
  readonly mimeCategory: number;
  readonly totalBytes: number;
  readonly fragmentSize: number;
  readonly fragmentCount: number;
  /** Whole-object digest, hex. FIL-004: display only after this validates. */
  readonly digest: string;
  readonly thumbnailRef?: ObjectId;
  readonly linkedIncidentId?: StreamId;
}

export interface FileFragmentPayload {
  readonly fileId: string;
  readonly fragmentIndex: number;
  readonly fragmentDigest: string;
  /** Raw bytes, base64 in the debug/JSON form only. */
  readonly data: Uint8Array;
}

// --- Network/session family --------------------------------------------------

export interface HelloCapabilityPayload {
  readonly nodeToken: string;
  readonly protocolMin: number;
  readonly protocolMax: number;
  readonly roleClass: number;
  readonly batteryBand: BatteryBandValue;
  readonly storageBand: number;
  readonly maxRecordBytes: number;
  readonly maxFragmentBytes: number;
  /** GTW-001: only true within FRESHNESS.GATEWAY_PROOF_S of a successful probe. */
  readonly gatewayProven: boolean;
  readonly gatewayProofAgeS?: number;
  readonly queueEpoch: number;
  readonly highestWaitingPriority: number;
}

export interface InventoryEntry {
  readonly packetId: string;
  readonly type: number;
  readonly priority: number;
  readonly fragmentsHeld?: number;
  readonly fragmentCount?: number;
}

export interface InventoryPayload {
  /**
   * REL-003's compact summary: concatenated 8-byte packet-ID prefixes, ordered
   * most-urgent first so truncation drops the least important entries.
   *
   * This is what nodes actually announce. `criticalIds` predates it and cost
   * 34 bytes per ID against a 180-byte budget, which capped an inventory at
   * four entries (HD-012); the prefix blob raises the same budget to ~19.
   */
  readonly idPrefixes?: Uint8Array;
  /** Reserved: full-length explicit IDs. Superseded by `idPrefixes`. */
  readonly criticalIds: readonly string[];
  readonly entries: readonly InventoryEntry[];
  readonly terminalIds: readonly string[];
  readonly queueEpoch: number;
  readonly truncated: boolean;
}

export interface PacketRequestPayload {
  /** Requested IDs in priority order (REL-004). */
  readonly packetIds: readonly string[];
  readonly fragmentRequests?: readonly {
    readonly fileId: string;
    readonly from: number;
    readonly to: number;
  }[];
}

export interface NetworkStatusObservationPayload {
  readonly observerToken: string;
  readonly peerToken: string;
  /** 0 discovered, 1 transferred, 2 ack returned, 3 gateway upload, 4 radio bridge. */
  readonly edgeKind: number;
  readonly observedAtS: number;
}

/** Discriminated union of everything the codec can carry. */
export type AnyPayload =
  | SosCreatePayload
  | SosUpdatePayload
  | SosCancelPayload
  | ResponderAssignedPayload
  | ResponderAcceptedPayload
  | ResponderDeclinedPayload
  | ResponderEnRoutePayload
  | ResponderArrivedPayload
  | ResolvedPayload
  | LinkReceiptPayload
  | BackendAckPayload
  | ResourceRecordPayload
  | HazardPayload
  | RouteStatePayload
  | OfficialAlertPayload
  | WeatherBulletinPayload
  | CheckinCampaignPayload
  | CheckinResponsePayload
  | ResourceRequestPayload
  | CacheCatalogPayload
  | ContentActivatePayload
  | RecordUpsertPayload
  | RecordTombstonePayload
  | CacheInvalidatePayload
  | FileManifestPayload
  | FileFragmentPayload
  | HelloCapabilityPayload
  | InventoryPayload
  | PacketRequestPayload
  | NetworkStatusObservationPayload;

