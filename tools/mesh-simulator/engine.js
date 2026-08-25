/* Disaster SOS Mesh engine — the real @dsm packages, bundled for the browser. */
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // packages/contracts/dist/index.js
  var dist_exports = {};
  __export(dist_exports, {
    ACCEPTED_MIME_CATEGORIES: () => ACCEPTED_MIME_CATEGORIES,
    ADVERTISEMENT: () => ADVERTISEMENT,
    AcceptReason: () => AcceptReason,
    AlertCategory: () => AlertCategory,
    ArrivalEvidence: () => ArrivalEvidence,
    BATTERY: () => BATTERY,
    BLE_IDENTIFIERS: () => BLE_IDENTIFIERS,
    BackendDedupOutcome: () => BackendDedupOutcome,
    BatteryBand: () => BatteryBand,
    CAMPAIGN_TRANSITIONS: () => CAMPAIGN_TRANSITIONS,
    CLASS_BUDGETS: () => CLASS_BUDGETS,
    CancelReason: () => CancelReason,
    CapacityBand: () => CapacityBand,
    CheckinStatus: () => CheckinStatus,
    DEFAULT_PRIORITY: () => DEFAULT_PRIORITY,
    DELIVERY_STATE_COPY: () => DELIVERY_STATE_COPY,
    DIGEST_PREFIX_BYTES: () => DIGEST_PREFIX_BYTES,
    ENVELOPE: () => ENVELOPE,
    EmergencyCategory: () => EmergencyCategory,
    EventCategory: () => EventCategory,
    FIELD_LIMITS: () => FIELD_LIMITS,
    FILE_TRANSFER: () => FILE_TRANSFER,
    FRESHNESS: () => FRESHNESS,
    Flags: () => Flags,
    GATEWAY: () => GATEWAY,
    GeometryKind: () => GeometryKind,
    HazardType: () => HazardType,
    HelpCategory: () => HelpCategory,
    InstructionCode: () => InstructionCode,
    LINK: () => LINK,
    LinkReceiptResult: () => LinkReceiptResult,
    LocationSource: () => LocationSource,
    MAX_PAYLOAD_BY_CLASS: () => MAX_PAYLOAD_BY_CLASS,
    MessageType: () => MessageType,
    MimeCategory: () => MimeCategory,
    Mobility: () => Mobility,
    OperationalState: () => OperationalState,
    PACKET_ID_BYTES: () => PACKET_ID_BYTES,
    PROTOCOL_MAGIC: () => PROTOCOL_MAGIC,
    PROTOCOL_VERSION: () => PROTOCOL_VERSION,
    PolicyReason: () => PolicyReason,
    Priority: () => Priority,
    ProjectionReason: () => ProjectionReason,
    RejectReason: () => RejectReason,
    ReplyCapability: () => ReplyCapability,
    ResolutionOutcome: () => ResolutionOutcome,
    RouteState: () => RouteState,
    SESSION: () => SESSION,
    SESSION_CONTROL_TYPES: () => SESSION_CONTROL_TYPES,
    SOURCE_ID_BYTES: () => SOURCE_ID_BYTES,
    STORAGE: () => STORAGE,
    Severity: () => Severity,
    SourceClass: () => SourceClass,
    TERMINAL_TYPES: () => TERMINAL_TYPES,
    TIER2: () => TIER2,
    TIME: () => TIME,
    Tier2Reason: () => Tier2Reason,
    ValidationGate: () => ValidationGate,
    isKnownMessageType: () => isKnownMessageType,
    messageTypeName: () => messageTypeName
  });

  // packages/contracts/dist/registry.js
  var PROTOCOL_MAGIC = 17485;
  var PROTOCOL_VERSION = 1;
  var MessageType = {
    // --- Emergency family 0x10 ------------------------------------------------
    SOS_CREATE: 16,
    SOS_UPDATE: 17,
    SOS_CANCEL: 18,
    // --- Response family 0x20 -------------------------------------------------
    RESPONDER_ASSIGNED: 32,
    RESPONDER_ACCEPTED: 33,
    RESPONDER_DECLINED: 34,
    RESPONDER_EN_ROUTE: 35,
    RESPONDER_ARRIVED: 36,
    RESOLVED: 37,
    // --- Receipt family 0x30 --------------------------------------------------
    LINK_RECEIPT: 48,
    BACKEND_ACKNOWLEDGEMENT: 49,
    // --- Resource family 0x40 -------------------------------------------------
    SHELTER: 64,
    MEDICAL_POST: 65,
    FOOD_WATER: 66,
    SAFE_ZONE: 67,
    // --- Hazard and navigation family 0x50 ------------------------------------
    HAZARD: 80,
    ROUTE_STATE: 81,
    // --- Authority family 0x60 ------------------------------------------------
    OFFICIAL_ALERT: 96,
    WEATHER_BULLETIN: 97,
    // --- Check-in family 0x70 -------------------------------------------------
    CHECKIN_CAMPAIGN: 112,
    CHECKIN_RESPONSE: 113,
    // --- Request family 0x80 --------------------------------------------------
    RESOURCE_REQUEST: 128,
    // --- Cached-content family 0x90 -------------------------------------------
    CACHE_CATALOG: 144,
    CONTENT_ACTIVATE: 145,
    RECORD_UPSERT: 146,
    RECORD_TOMBSTONE: 147,
    CACHE_INVALIDATE: 148,
    // --- File/data family 0xa0 ------------------------------------------------
    FILE_MANIFEST: 160,
    FILE_FRAGMENT: 161,
    // --- Network/session control family 0xf0 ----------------------------------
    HELLO_CAPABILITY: 240,
    INVENTORY: 241,
    PACKET_REQUEST: 242,
    NETWORK_STATUS_OBSERVATION: 243
  };
  var NAME_BY_CODE = new Map(Object.entries(MessageType).map(([name, code]) => [code, name]));
  function messageTypeName(code) {
    return NAME_BY_CODE.get(code);
  }
  function isKnownMessageType(code) {
    return NAME_BY_CODE.has(code);
  }
  var Priority = {
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
    FILE_FRAGMENT: 7
  };
  var Severity = {
    INFO: 0,
    ASSISTANCE: 1,
    URGENT: 2,
    LIFE_CRITICAL: 3
  };
  var Flags = {
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
    COMMUNITY_REPORTED: 1 << 7
  };
  var SourceClass = {
    UNKNOWN: 0,
    GENERAL_PUBLIC: 1,
    RESPONDER_PROVISIONED: 2,
    AUTHORITY_PROVISIONED: 3,
    COORDINATOR_PROVISIONED: 4,
    BACKEND: 5,
    TIER2_BROADCAST: 6
  };
  var DEFAULT_PRIORITY = {
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
    [MessageType.NETWORK_STATUS_OBSERVATION]: Priority.GENERAL_UPDATE
  };
  var SESSION_CONTROL_TYPES = /* @__PURE__ */ new Set([
    MessageType.HELLO_CAPABILITY,
    MessageType.INVENTORY,
    MessageType.PACKET_REQUEST
  ]);
  var TERMINAL_TYPES = /* @__PURE__ */ new Set([
    MessageType.SOS_CANCEL,
    MessageType.RESOLVED,
    MessageType.RECORD_TOMBSTONE,
    MessageType.CACHE_INVALIDATE
  ]);

  // packages/contracts/dist/limits.js
  var ENVELOPE = {
    /** Fixed transport header, 04-BLUEPRINT section 7.2. */
    HEADER_BYTES: 64,
    /** Room for optional typed header extensions (GEO, ROUTING, FILE, ...). */
    MAX_HEADER_BYTES: 192,
    MAX_PAYLOAD_BYTES: 4096,
    /** Hard rejection bound applied BEFORE any allocation (INT-001). */
    MAX_TOTAL_BYTES: 4096 + 192
  };
  var PACKET_ID_BYTES = 16;
  var SOURCE_ID_BYTES = 8;
  var DIGEST_PREFIX_BYTES = 8;
  var FILE_TRANSFER = {
    /**
     * Bytes of TEXT carried in one FILE_FRAGMENT.
     *
     * Derived, not guessed: the 180-byte payload budget minus roughly 60 bytes of
     * fragment metadata (fileId, index, digest prefix, field keys and tags).
     */
    FRAGMENT_DATA_BYTES: 120,
    /**
     * Per-fragment integrity is a 16-hex-char PREFIX, not a full digest.
     * A full SHA-256 hex string is 64 chars and would consume a third of the
     * fragment budget for a check the whole-object digest already guarantees.
     * The prefix is an early-reject hint; FIL-004 integrity is the whole-object
     * digest in the manifest.
     */
    FRAGMENT_DIGEST_CHARS: 16
  };
  var LINK = {
    /** ATT MTU this build requires. */
    REQUIRED_ATT_MTU: 247,
    /** Usable bytes per write: MTU minus the 3-byte ATT header. */
    MAX_RECORD_BYTES: 244,
    /** 244 minus the 64-byte envelope. No payload may exceed this. */
    MAX_PAYLOAD_BYTES: 180
  };
  var MAX_PAYLOAD_BY_CLASS = {
    EMERGENCY: 180,
    RESPONSE_CONTROL: 180,
    RECEIPT: 128,
    RESOURCE: 180,
    HAZARD_ROUTE: 180,
    AUTHORITY: 180,
    CHECKIN: 180,
    REQUEST: 180,
    CONTENT_OP: 180,
    FILE_MANIFEST: 180,
    /** Text fragment data, sized so header + payload fits one BLE write. */
    FILE_FRAGMENT: 180,
    /** Inventory truncates itself to fit rather than overflowing (see INVENTORY.truncated). */
    SESSION_CONTROL: 180
  };
  var FIELD_LIMITS = {
    /** SOS short note, UTF-8 bytes (01-... SOS-003 "strict limits"). */
    SHORT_NOTE_BYTES: 120,
    FALLBACK_TEXT_BYTES: 96,
    LABEL_BYTES: 48,
    LANGUAGE_TAG_BYTES: 8,
    MAX_PEOPLE_TOTAL: 999,
    MAX_INJURED: 999,
    MAX_CHILDREN: 999,
    MAX_HELP_CATEGORIES: 6,
    MAX_LANGUAGE_PREFERENCES: 3,
    MAX_ROUTE_IDS_PER_HAZARD: 8,
    MAX_RESPONSE_OPTIONS: 8
  };
  var TIME = {
    /** Compact timestamps are seconds since this epoch (2025-01-01T00:00:00Z). */
    DEMO_EPOCH_MS: Date.UTC(2025, 0, 1),
    /** Accepted clock skew before a packet is flagged implausible (02-... clock anomalies). */
    MAX_CLOCK_SKEW_S: 15 * 60,
    /** A creation time further ahead than this is rejected outright. */
    MAX_FUTURE_S: 60 * 60,
    /** Nothing may be retained on an absolute expiry beyond this horizon. */
    MAX_TTL_S: 24 * 60 * 60
  };
  var CLASS_BUDGETS = {
    /** Level 3 SOS and terminal control: largest controlled budget. */
    CRITICAL: { copyBudget: 12, peersPerEpoch: 4, retryCooldownS: 30, hopLimit: 8, ttlS: 6 * 3600 },
    /** Other SOS, responder lifecycle, critical official alert. */
    HIGH: { copyBudget: 8, peersPerEpoch: 3, retryCooldownS: 60, hopLimit: 6, ttlS: 6 * 3600 },
    /** Hazard, route, urgent requests. */
    MEDIUM_HIGH: { copyBudget: 6, peersPerEpoch: 3, retryCooldownS: 90, hopLimit: 5, ttlS: 4 * 3600 },
    /** Resources and check-ins. */
    MEDIUM: { copyBudget: 4, peersPerEpoch: 2, retryCooldownS: 180, hopLimit: 4, ttlS: 4 * 3600 },
    /** General updates. */
    LOW_MEDIUM: { copyBudget: 3, peersPerEpoch: 2, retryCooldownS: 300, hopLimit: 3, ttlS: 2 * 3600 },
    /** Files, fragments, topology observations: explicitly requested and bounded. */
    LOW: { copyBudget: 2, peersPerEpoch: 1, retryCooldownS: 600, hopLimit: 2, ttlS: 3600 }
  };
  var SESSION = {
    MAX_DURATION_MS: 2e4,
    IDLE_TIMEOUT_MS: 5e3,
    MAX_BYTES: 64 * 1024,
    MAX_IN_FLIGHT_RECORDS: 4,
    MAX_CONCURRENT_SESSIONS: 2,
    MAX_RECORDS: 64,
    /** Inventory entries a node may advertise in one session. */
    MAX_INVENTORY_ENTRIES: 48,
    /** Explicit critical IDs always sent in full before the compact summary. */
    MAX_CRITICAL_EXPLICIT_IDS: 16,
    /** Backoff after a failed session, before jitter. */
    BACKOFF_BASE_MS: 2e3,
    BACKOFF_MAX_MS: 6e4,
    BACKOFF_JITTER_MS: 1500
  };
  var STORAGE = {
    MAX_STORED_PACKETS: 2e3,
    MAX_INCOMPLETE_OBJECTS: 8,
    MAX_FRAGMENTS_PER_OBJECT: 64,
    MAX_REASSEMBLY_BYTES: 16 * 1024,
    /**
     * FIL-007: the ONE strict maximum, and it is now derived rather than guessed.
     *
     * The demo carries TEXT ONLY. A fragment's data field gets roughly 140 bytes
     * once the fileId, index and digest fields are encoded, and there are at most
     * 64 fragments, so ~8 KB is the real ceiling. 8 KB of text is about 1,400
     * words -- ample for a situation report, and far too small to be abused.
     */
    MAX_FILE_BYTES: 8 * 1024,
    /** Seen-ID records survive payload eviction so duplicates stay suppressed. */
    SEEN_ID_RETENTION_S: 12 * 3600,
    MAX_SEEN_IDS: 2e4,
    PEER_OBSERVATION_RETENTION_S: 30 * 60,
    TOPOLOGY_OBSERVATION_RETENTION_S: 15 * 60,
    EVENT_LOG_RETENTION_S: 6 * 3600,
    MAX_EVENT_LOG_ENTRIES: 5e3,
    /** How long a terminal record is kept to suppress stale copies (SOS-009). */
    TOMBSTONE_RETENTION_S: 2 * 3600
  };
  var FRESHNESS = {
    /** Newer than this: a location may be presented as current (DEC-020, MAP-005). */
    LOCATION_LIVE_S: 120,
    /** Between live and stale: shown with explicit age. */
    LOCATION_STALE_S: 600,
    /** Older than this: the marker is withdrawn from the map. */
    LOCATION_EXPIRE_S: 3600,
    /** A gateway flag is only trusted this long after a successful probe (GTW-001). */
    GATEWAY_PROOF_S: 120,
    PEER_RECENT_S: 300
  };
  var GATEWAY = {
    PROBE_TIMEOUT_MS: 4e3,
    PROBE_INTERVAL_MS: 6e4,
    MAX_UPLOAD_BATCH: 32,
    MAX_DOWNLOAD_BATCH: 32,
    MAX_BATCH_BYTES: 128 * 1024,
    SYNC_INTERVAL_MS: 3e4,
    MAX_UPLOAD_RETRIES: 5
  };
  var TIER2 = {
    /** Ultra-compact radio frame. Not the 64-byte Tier 1 envelope (02-...). */
    MAX_FRAME_BYTES: 140,
    MAX_FRAMES_PER_PACKET: 8,
    MAX_CAMPAIGN_PACKETS: 32,
    /** Judging duration budget: a campaign exceeding this must be reduced, not hidden. */
    MAX_CAMPAIGN_DURATION_S: 180,
    MIN_CRITICAL_REPEATS: 3,
    MIN_NORMAL_REPEATS: 1,
    MICROPHONE_TIMEOUT_MS: 12e4,
    SAMPLE_RATE_HZ: 48e3
  };
  var BATTERY = {
    /** Below this band, files and low-priority relay stop before critical traffic. */
    LOW_PERCENT: 25,
    CRITICAL_PERCENT: 10,
    /** Discovery duty cycles by mode, in milliseconds. */
    DUTY_CYCLE: {
      ACTIVE_EMERGENCY: { scanMs: 8e3, idleMs: 2e3 },
      RELAY: { scanMs: 5e3, idleMs: 1e4 },
      PREPAREDNESS: { scanMs: 3e3, idleMs: 3e4 },
      BATTERY_SAVER: { scanMs: 2e3, idleMs: 6e4 }
    }
  };
  var ADVERTISEMENT = {
    /** Total AD data in a legacy advertising PDU. */
    PDU_BYTES: 31,
    /** Mandatory Flags AD element. */
    FLAGS_ELEMENT_BYTES: 3,
    /** len + type 0xff + 2-byte company identifier. */
    MANUFACTURER_HEADER_BYTES: 4,
    /** What is actually left for us: 31 - 3 - 4. */
    MAX_BYTES: 24,
    NODE_TOKEN_BYTES: 4,
    /** Node token rotates on this interval so it is not a permanent public identifier. */
    TOKEN_ROTATION_MS: 15 * 6e4
  };
  var BLE_IDENTIFIERS = {
    /** GATT service exposed by every node. */
    SERVICE_UUID: "7d4f0000-9a1c-4b6e-8f21-3c5d7e9a1b02",
    /** Peer writes session records here. */
    SESSION_RX_CHARACTERISTIC_UUID: "7d4f0001-9a1c-4b6e-8f21-3c5d7e9a1b02",
    /** Node notifies session records out on this. */
    SESSION_TX_CHARACTERISTIC_UUID: "7d4f0002-9a1c-4b6e-8f21-3c5d7e9a1b02",
    /** SIG-reserved "for testing" company identifier. Not a real assignment. */
    COMPANY_ID: 65535,
    /** First byte of our manufacturer payload, so foreign 0xffff ads are ignored. */
    ADVERTISEMENT_MAGIC: 213
  };

  // packages/contracts/dist/enums.js
  var EmergencyCategory = {
    MEDICAL: 0,
    TRAPPED: 1,
    FIRE: 2,
    FLOOD: 3,
    VIOLENCE: 4,
    STRUCTURAL_COLLAPSE: 5,
    MISSING_PERSON: 6,
    OTHER: 7
  };
  var Mobility = {
    UNKNOWN: 0,
    MOBILE: 1,
    LIMITED: 2,
    IMMOBILE: 3,
    TRAPPED: 4
  };
  var LocationSource = {
    UNKNOWN: 0,
    FRESH_GNSS: 1,
    CACHED_GNSS: 2,
    NETWORK: 3,
    USER_PIN: 4
  };
  var BatteryBand = {
    CRITICAL: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3
  };
  var ReplyCapability = {
    TIER1_BLE: 1 << 0,
    INTERNET: 1 << 1,
    SMS: 1 << 2,
    VOICE: 1 << 3
  };
  var HelpCategory = {
    MEDICAL_AID: 0,
    RESCUE: 1,
    FOOD: 2,
    WATER: 3,
    SHELTER: 4,
    EVACUATION: 5,
    FUEL: 6,
    COMMUNICATION: 7
  };
  var OperationalState = {
    UNKNOWN: 0,
    OPEN: 1,
    FULL: 2,
    CLOSED: 3,
    UNAVAILABLE: 4,
    DAMAGED: 5
  };
  var CapacityBand = {
    UNKNOWN: 0,
    EMPTY: 1,
    LOW_OCCUPANCY: 2,
    HALF: 3,
    NEARLY_FULL: 4,
    FULL: 5
  };
  var HazardType = {
    FIRE: 0,
    FLOOD: 1,
    COLLAPSE: 2,
    LANDSLIDE: 3,
    CHEMICAL: 4,
    GAS_LEAK: 5,
    ELECTRICAL: 6,
    CROWD: 7,
    OTHER: 8
  };
  var GeometryKind = {
    POINT: 0,
    CIRCLE: 1,
    ROUTE_SEGMENTS: 2,
    CACHED_REFERENCE: 3
  };
  var RouteState = {
    OPEN: 0,
    BLOCKED: 1,
    RESTRICTED: 2,
    ADVISED: 3,
    REOPENED: 4
  };
  var AlertCategory = {
    EVACUATION: 0,
    SHELTER_IN_PLACE: 1,
    WEATHER: 2,
    UTILITY: 3,
    HEALTH: 4,
    SECURITY: 5,
    ALL_CLEAR: 6
  };
  var InstructionCode = {
    NONE: 0,
    EVACUATE_NOW: 1,
    MOVE_TO_HIGHER_GROUND: 2,
    STAY_INDOORS: 3,
    BOIL_WATER: 4,
    AVOID_AREA: 5,
    REPORT_TO_SHELTER: 6,
    AWAIT_INSTRUCTION: 7
  };
  var CheckinStatus = {
    SAFE: 0,
    SAFE_NEED_SUPPLIES: 1,
    NEED_ASSISTANCE: 2,
    INJURED: 3,
    DISPLACED: 4
  };
  var CancelReason = {
    ACCIDENTAL: 0,
    RESOLVED_SELF: 1,
    HELP_ARRIVED: 2,
    DUPLICATE: 3,
    OTHER: 4
  };
  var ResolutionOutcome = {
    RESCUED: 0,
    ASSISTED_ON_SITE: 1,
    TRANSPORTED: 2,
    NO_ACTION_REQUIRED: 3,
    UNREACHABLE: 4,
    ESCALATED: 5
  };
  var ArrivalEvidence = {
    DECLARED: 0,
    PROXIMITY_ASSISTED: 1
  };
  var LinkReceiptResult = {
    ACCEPTED: 0,
    REJECTED_INVALID: 1,
    REJECTED_DUPLICATE: 2,
    REJECTED_FULL: 3
  };
  var BackendDedupOutcome = {
    ACCEPTED_NEW: 0,
    DUPLICATE_OBSERVATION: 1,
    CONFLICT_QUARANTINED: 2,
    EXPIRED: 3
  };
  var MimeCategory = {
    /** The ONLY accepted category: UTF-8 text. */
    TEXT: 0,
    /** Refused: no image decoding in the prototype. */
    IMAGE: 1,
    /** Refused: no audio decoding in the prototype. */
    AUDIO: 2,
    /** Refused: no executables or automatic installation. */
    EXECUTABLE: 3,
    /** Refused: the prototype has no decompressor at all. */
    ARCHIVE: 4,
    /** Refused: unknown content cannot be bounded. */
    OTHER: 5
  };
  var ACCEPTED_MIME_CATEGORIES = /* @__PURE__ */ new Set([MimeCategory.TEXT]);

  // packages/contracts/dist/reasons.js
  var ValidationGate = {
    ENVELOPE_LENGTH: "gate.envelope-length",
    PROTOCOL_VERSION: "gate.protocol-version",
    DECLARED_SIZES: "gate.declared-sizes",
    HEADER_INTEGRITY: "gate.header-integrity",
    KNOWN_TYPE: "gate.known-type",
    DUPLICATE_LOOKUP: "gate.duplicate-lookup",
    CLOCK_SANITY: "gate.clock-sanity",
    HOP_LIMIT: "gate.hop-limit",
    FRAGMENT_LIMITS: "gate.fragment-limits",
    PAYLOAD_INTEGRITY: "gate.payload-integrity",
    SCHEMA: "gate.schema",
    SOURCE_ROLE: "gate.source-role",
    GEOGRAPHIC_RELEVANCE: "gate.geographic-relevance",
    USER_PREFERENCE: "gate.user-preference",
    RESOURCE_PRESSURE: "gate.resource-pressure"
  };
  var RejectReason = {
    TOO_SHORT: "reject.too-short",
    BAD_MAGIC: "reject.bad-magic",
    UNSUPPORTED_VERSION: "reject.unsupported-version",
    LENGTH_OVER_LIMIT: "reject.length-over-limit",
    LENGTH_MISMATCH: "reject.length-mismatch",
    HEADER_CRC_FAILED: "reject.header-crc-failed",
    UNKNOWN_TYPE: "reject.unknown-type",
    EXPIRED: "reject.expired",
    CREATED_IN_FUTURE: "reject.created-in-future",
    CLOCK_IMPLAUSIBLE: "reject.clock-implausible",
    HOP_LIMIT_EXCEEDED: "reject.hop-limit-exceeded",
    FRAGMENT_INDEX_INVALID: "reject.fragment-index-invalid",
    FRAGMENT_COUNT_OVER_LIMIT: "reject.fragment-count-over-limit",
    REASSEMBLY_OVER_LIMIT: "reject.reassembly-over-limit",
    PAYLOAD_DIGEST_MISMATCH: "reject.payload-digest-mismatch",
    SCHEMA_INVALID: "reject.schema-invalid",
    FIELD_OVER_LIMIT: "reject.field-over-limit",
    /** DEC-015 / ROL-006: a general-public source cannot publish authority records. */
    ROLE_NOT_PERMITTED: "reject.role-not-permitted",
    /** Same packet ID, different digest (02-... "Conflicting updates"). */
    DIGEST_CONFLICT: "reject.digest-conflict",
    SEQUENCE_CONFLICT: "reject.sequence-conflict",
    SUPERSEDED: "reject.superseded",
    TERMINAL_APPLIED: "reject.terminal-applied",
    STORAGE_FULL: "reject.storage-full",
    QUEUE_FULL: "reject.queue-full",
    OUT_OF_REGION: "reject.out-of-region"
  };
  var AcceptReason = {
    NEW_PACKET: "accept.new-packet",
    NEW_OBSERVATION_OF_KNOWN: "accept.new-observation-of-known",
    SUPERSEDES_PREVIOUS: "accept.supersedes-previous",
    TERMINAL_RECORD: "accept.terminal-record",
    FRAGMENT_STORED: "accept.fragment-stored",
    OBJECT_COMPLETED: "accept.object-completed"
  };
  var PolicyReason = {
    OWN_PACKET: "policy.own-packet",
    OWN_INCIDENT: "policy.own-incident",
    WITHIN_DISPLAY_RADIUS: "policy.within-display-radius",
    OUTSIDE_DISPLAY_RADIUS: "policy.outside-display-radius",
    SEVERITY_THRESHOLD_MET: "policy.severity-threshold-met",
    SEVERITY_BELOW_THRESHOLD: "policy.severity-below-threshold",
    RESPONDER_ROLE: "policy.responder-role",
    PUBLIC_ROLE_MINIMAL_VIEW: "policy.public-role-minimal-view",
    AUTHORITY_SOURCE: "policy.authority-source",
    COMMUNITY_SOURCE_LOWER_WEIGHT: "policy.community-source-lower-weight",
    HAZARD_INTERSECTS_AREA: "policy.hazard-intersects-area",
    DUPLICATE_SUPPRESSED: "policy.duplicate-suppressed",
    COPY_BUDGET_EXHAUSTED: "policy.copy-budget-exhausted",
    COPY_BUDGET_AVAILABLE: "policy.copy-budget-available",
    NEIGHBOR_ALREADY_HAS: "policy.neighbor-already-has",
    COOLDOWN_ACTIVE: "policy.cooldown-active",
    GATEWAY_PROVEN: "policy.gateway-proven",
    GATEWAY_UNPROVEN: "policy.gateway-unproven",
    BATTERY_RESTRICTED: "policy.battery-restricted",
    STORAGE_RESTRICTED: "policy.storage-restricted",
    CONGESTION_PREEMPTED: "policy.congestion-preempted",
    TERMINAL_SUPPRESSES_ACTIVE: "policy.terminal-suppresses-active",
    RETENTION_WINDOW: "policy.retention-window",
    FILE_REQUIRES_EXPLICIT_REQUEST: "policy.file-requires-explicit-request",
    SESSION_CONTROL_NOT_RELAYED: "policy.session-control-not-relayed",
    NOT_UPLOAD_ELIGIBLE: "policy.not-upload-eligible",
    ALREADY_BACKEND_ORIGIN: "policy.already-backend-origin"
  };
  var ProjectionReason = {
    APPLIED: "projection.applied",
    APPLIED_AS_TEMPORARY: "projection.applied-as-temporary",
    IGNORED_OLDER_VERSION: "projection.ignored-older-version",
    IGNORED_IDENTICAL: "projection.ignored-identical",
    IGNORED_TOMBSTONED: "projection.ignored-tombstoned",
    /** MAP-008: fallback text/coordinates, never a silent substitution. */
    MISSING_OBJECT_FALLBACK: "projection.missing-object-fallback",
    CONFLICTING_SOURCES_RETAINED: "projection.conflicting-sources-retained",
    OUT_OF_PACK_REGION: "projection.out-of-pack-region",
    UNSUPPORTED_OPERATION: "projection.unsupported-operation"
  };
  var Tier2Reason = {
    PREAMBLE_DETECTED: "tier2.preamble-detected",
    FRAME_VALID: "tier2.frame-valid",
    FRAME_CORRUPT: "tier2.frame-corrupt",
    FRAME_DUPLICATE: "tier2.frame-duplicate",
    PACKET_REASSEMBLED: "tier2.packet-reassembled",
    PACKET_INCOMPLETE: "tier2.packet-incomplete",
    CAMPAIGN_COMPLETE: "tier2.campaign-complete",
    CAMPAIGN_INCOMPLETE: "tier2.campaign-incomplete",
    LISTEN_TIMEOUT: "tier2.listen-timeout"
  };

  // packages/contracts/dist/profile.js
  var DELIVERY_STATE_COPY = {
    "saved-locally": "Saved on this phone",
    "copied-to-peer": "Copied to nearby phones",
    "seen-by-responder": "A responder has seen this",
    "uploaded-via-gateway": "Sent through a phone with internet",
    "accepted-by-backend": "Coordination centre received it",
    "responder-assigned": "A responder was assigned",
    "responder-accepted": "A responder accepted this case",
    "responder-en-route": "A responder is travelling to you",
    "responder-arrived": "A responder reported arriving",
    resolved: "Marked resolved",
    cancelled: "Cancelled",
    expired: "No longer active"
  };

  // packages/contracts/dist/campaign.js
  var CAMPAIGN_TRANSITIONS = {
    draft: ["validated", "failed"],
    validated: ["approved", "draft", "failed"],
    approved: ["broadcaster-ready", "draft"],
    "broadcaster-ready": ["audio-generated", "draft"],
    "audio-generated": ["decode-tested", "draft", "failed"],
    "decode-tested": ["scheduled", "draft", "failed"],
    scheduled: ["played", "draft", "failed"],
    played: ["archived"],
    archived: [],
    failed: ["draft"]
  };

  // packages/contracts/dist/events.js
  var EventCategory = {
    CAPABILITY: "capability",
    PERMISSION: "permission",
    RELAY_LIFECYCLE: "relay-lifecycle",
    PEER_DISCOVERY: "peer-discovery",
    SESSION: "session",
    INVENTORY: "inventory",
    TRANSFER: "transfer",
    VALIDATION: "validation",
    POLICY: "policy",
    CUSTODY: "custody",
    INCIDENT: "incident",
    PROJECTION: "projection",
    CONNECTIVITY: "connectivity",
    GATEWAY: "gateway",
    TIER2: "tier2",
    FILE: "file",
    RESOURCE_ADAPTATION: "resource-adaptation"
  };

  // packages/codec/dist/index.js
  var dist_exports2 = {};
  __export(dist_exports2, {
    BUNDLE_FIELDS: () => BUNDLE_FIELDS,
    ByteReader: () => ByteReader,
    ByteWriter: () => ByteWriter,
    DEFAULT_LIMITS: () => DEFAULT_LIMITS,
    FIELD_MAP_BY_TYPE: () => FIELD_MAP_BY_TYPE,
    FRAGMENT_REQUEST_FIELDS: () => FRAGMENT_REQUEST_FIELDS,
    GEO_FIELDS: () => GEO_FIELDS,
    HEADER_BYTES: () => HEADER_BYTES,
    HEADER_OFFSETS: () => HEADER_OFFSETS,
    INVENTORY_ENTRY_FIELDS: () => INVENTORY_ENTRY_FIELDS,
    LOCATION_FIELDS: () => LOCATION_FIELDS,
    MessageType: () => MessageType,
    NESTED_FIELD_MAPS: () => NESTED_FIELD_MAPS,
    budgetClassFor: () => budgetClassFor,
    buildBackendAck: () => buildBackendAck,
    buildCheckinCampaign: () => buildCheckinCampaign,
    buildCheckinResponse: () => buildCheckinResponse,
    buildFileFragment: () => buildFileFragment,
    buildFileManifest: () => buildFileManifest,
    buildHazard: () => buildHazard,
    buildHello: () => buildHello,
    buildInventory: () => buildInventory,
    buildLinkReceipt: () => buildLinkReceipt,
    buildOfficialAlert: () => buildOfficialAlert,
    buildPacketRequest: () => buildPacketRequest,
    buildResourceRecord: () => buildResourceRecord,
    buildResourceRequest: () => buildResourceRequest,
    buildResponderState: () => buildResponderState,
    buildRouteState: () => buildRouteState,
    buildSosCancel: () => buildSosCancel,
    buildSosCreate: () => buildSosCreate,
    buildSosUpdate: () => buildSosUpdate,
    crc32: () => crc32,
    decodeFields: () => decodeFields,
    decodeHeader: () => decodeHeader,
    decodePacket: () => decodePacket,
    digestPrefix: () => digestPrefix,
    e7ToFloat: () => e7ToFloat,
    encodeFields: () => encodeFields,
    encodeHeader: () => encodeHeader,
    encodePacket: () => encodePacket,
    floatToE7: () => floatToE7,
    fromEpochS: () => fromEpochS,
    fromHex: () => fromHex,
    incrementHopInPlace: () => incrementHopInPlace,
    maxPayloadBytesFor: () => maxPayloadBytesFor,
    newNodeToken: () => newNodeToken,
    newPacketId: () => newPacketId,
    newSourceId: () => newSourceId,
    payloadDigest: () => payloadDigest,
    reencode: () => reencode,
    reverseFieldMap: () => reverseFieldMap,
    sha256Hex: () => sha256Hex,
    toEpochS: () => toEpochS,
    toHex: () => toHex2
  });

  // tools/mesh-simulator/bundler/shim-crypto.mjs
  var K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  function rotr(x, n) {
    return x >>> n | x << 32 - n;
  }
  function sha256(bytes) {
    const bitLen = bytes.length * 8;
    const padded = new Uint8Array(bytes.length + 9 + 63 >> 6 << 6);
    padded.set(bytes);
    padded[bytes.length] = 128;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);
    view.setUint32(padded.length - 4, bitLen >>> 0, false);
    const H = new Uint32Array([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
    const w = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i += 1) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
        w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i += 1) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = e & f ^ ~e & g;
        const t1 = h + S1 + ch + K[i] + w[i] >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = a & b ^ a & c ^ b & c;
        const t2 = S0 + maj >>> 0;
        h = g;
        g = f;
        f = e;
        e = d + t1 >>> 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 >>> 0;
      }
      H[0] = H[0] + a >>> 0;
      H[1] = H[1] + b >>> 0;
      H[2] = H[2] + c >>> 0;
      H[3] = H[3] + d >>> 0;
      H[4] = H[4] + e >>> 0;
      H[5] = H[5] + f >>> 0;
      H[6] = H[6] + g >>> 0;
      H[7] = H[7] + h >>> 0;
    }
    const out = new Uint8Array(32);
    new DataView(out.buffer).setUint32(0, H[0], false);
    for (let i = 0; i < 8; i += 1) new DataView(out.buffer).setUint32(i * 4, H[i], false);
    return out;
  }
  function toHex(bytes) {
    let s = "";
    for (const b of bytes) s += b.toString(16).padStart(2, "0");
    return s;
  }
  function createHash(algorithm) {
    if (algorithm !== "sha256") throw new Error(`shim supports sha256 only, got ${algorithm}`);
    const chunks = [];
    return {
      update(data) {
        chunks.push(data instanceof Uint8Array ? data : new TextEncoder().encode(String(data)));
        return this;
      },
      digest(encoding) {
        let total = 0;
        for (const c of chunks) total += c.length;
        const joined = new Uint8Array(total);
        let o = 0;
        for (const c of chunks) {
          joined.set(c, o);
          o += c.length;
        }
        const hash = sha256(joined);
        return encoding === "hex" ? toHex(hash) : hash;
      }
    };
  }
  function randomBytes(size) {
    const out = new Uint8Array(size);
    (globalThis.crypto || globalThis.msCrypto).getRandomValues(out);
    return out;
  }

  // packages/codec/dist/integrity.js
  var CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      }
      table[i] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes, start = 0, end = bytes.length) {
    let crc = 4294967295;
    for (let i = start; i < end; i += 1) {
      crc = (CRC32_TABLE[(crc ^ bytes[i]) & 255] ^ crc >>> 8) >>> 0;
    }
    return (crc ^ 4294967295) >>> 0;
  }
  function sha256Hex(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
  }
  function payloadDigest(bytes, messageType) {
    const bound = new Uint8Array(bytes.length + 1);
    bound[0] = messageType & 255;
    bound.set(bytes, 1);
    return sha256Hex(bound);
  }
  function digestPrefix(bytes, messageType) {
    return payloadDigest(bytes, messageType).slice(0, 16);
  }
  function toHex2(bytes) {
    let out = "";
    for (const b of bytes)
      out += b.toString(16).padStart(2, "0");
    return out;
  }
  function fromHex(hex) {
    if (hex.length % 2 !== 0)
      throw new Error("hex string must have an even length");
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i += 1) {
      const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      if (Number.isNaN(byte))
        throw new Error(`invalid hex at offset ${i * 2}`);
      out[i] = byte;
    }
    return out;
  }
  function newPacketId() {
    return toHex2(randomBytes(16));
  }
  function newSourceId() {
    return toHex2(randomBytes(8));
  }
  function newNodeToken() {
    return toHex2(randomBytes(4));
  }

  // packages/codec/dist/coordinates.js
  var E7 = 1e7;
  function e7ToFloat(e7) {
    return e7 / E7;
  }
  function floatToE7(deg) {
    return Math.round(deg * E7);
  }

  // packages/codec/dist/varint.js
  var ByteWriter = class {
    buf;
    len = 0;
    constructor(initial = 128) {
      this.buf = new Uint8Array(initial);
    }
    ensure(extra) {
      if (this.len + extra <= this.buf.length)
        return;
      let next = this.buf.length * 2;
      while (next < this.len + extra)
        next *= 2;
      const grown = new Uint8Array(next);
      grown.set(this.buf.subarray(0, this.len));
      this.buf = grown;
    }
    u8(value) {
      this.ensure(1);
      this.buf[this.len++] = value & 255;
    }
    bytes(value) {
      this.ensure(value.length);
      this.buf.set(value, this.len);
      this.len += value.length;
    }
    uvarint(value) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`uvarint requires a non-negative integer, got ${value}`);
      }
      let v = value;
      while (v >= 128) {
        this.u8(v & 127 | 128);
        v = Math.floor(v / 128);
      }
      this.u8(v);
    }
    get length() {
      return this.len;
    }
    toUint8Array() {
      return this.buf.slice(0, this.len);
    }
  };
  var ByteReader = class {
    buf;
    pos = 0;
    constructor(buf) {
      this.buf = buf;
    }
    get offset() {
      return this.pos;
    }
    get remaining() {
      return this.buf.length - this.pos;
    }
    get exhausted() {
      return this.pos >= this.buf.length;
    }
    u8() {
      if (this.pos >= this.buf.length)
        throw new RangeError("read past end of buffer");
      return this.buf[this.pos++];
    }
    /** Bounded read: `limit` is checked BEFORE allocation (INT-001). */
    bytes(length, limit) {
      if (length < 0 || length > limit)
        throw new RangeError(`declared length ${length} exceeds limit ${limit}`);
      if (this.pos + length > this.buf.length)
        throw new RangeError("read past end of buffer");
      const out = this.buf.slice(this.pos, this.pos + length);
      this.pos += length;
      return out;
    }
    uvarint() {
      let result = 0;
      let shift = 1;
      for (let i = 0; i < 8; i += 1) {
        const byte = this.u8();
        result += (byte & 127) * shift;
        if ((byte & 128) === 0)
          return result;
        shift *= 128;
      }
      throw new RangeError("uvarint too long");
    }
  };

  // packages/codec/dist/field-maps.js
  var LOCATION_FIELDS = {
    source: 1,
    latE7: 2,
    lonE7: 3,
    accuracyM: 4,
    ageS: 5
  };
  var GEO_FIELDS = {
    latE7: 1,
    lonE7: 2,
    accuracyM: 3,
    scopeRadiusM: 4
  };
  var BUNDLE_FIELDS = { bundleId: 1, version: 2 };
  var INVENTORY_ENTRY_FIELDS = {
    packetId: 1,
    type: 2,
    priority: 3,
    fragmentsHeld: 4,
    fragmentCount: 5
  };
  var FRAGMENT_REQUEST_FIELDS = { fileId: 1, from: 2, to: 3 };
  var NESTED_FIELD_MAPS = {
    location: LOCATION_FIELDS,
    __geo: GEO_FIELDS,
    bundles: BUNDLE_FIELDS,
    entries: INVENTORY_ENTRY_FIELDS,
    fragmentRequests: FRAGMENT_REQUEST_FIELDS
  };
  var SOS_CREATE = {
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
    batteryBand: 13
  };
  var SOS_UPDATE = {
    incidentId: 1,
    category: 2,
    peopleTotal: 3,
    injured: 4,
    mobility: 5,
    location: 6,
    shortNote: 7,
    preparedPhraseId: 8,
    batteryBand: 9
  };
  var SOS_CANCEL = { incidentId: 1, reason: 2, terminalRetentionS: 3 };
  var RESPONDER_ASSIGNED = {
    incidentId: 1,
    assignmentId: 2,
    responderRef: 3,
    teamRef: 4,
    dispatcherLabel: 5
  };
  var RESPONDER_ACK = { incidentId: 1, assignmentId: 2, responderRef: 3, reasonCode: 4 };
  var RESPONDER_EN_ROUTE = {
    incidentId: 1,
    assignmentId: 2,
    responderRef: 3,
    location: 4,
    etaBandMin: 5
  };
  var RESPONDER_ARRIVED = { incidentId: 1, assignmentId: 2, responderRef: 3, evidence: 4 };
  var RESOLVED = { incidentId: 1, resolverRef: 2, outcome: 3, terminalRetentionS: 4 };
  var LINK_RECEIPT = { forPacketId: 1, digestPrefix: 2, receivingNodeToken: 3, result: 4 };
  var BACKEND_ACK = {
    forPacketId: 1,
    incidentId: 2,
    backendReceiptId: 3,
    dedupOutcome: 4,
    coordinationStatus: 5
  };
  var RESOURCE_RECORD = {
    objectId: 1,
    state: 2,
    location: 3,
    capacityBand: 4,
    capacityExact: 5,
    availabilityBand: 6,
    openingHoursCode: 7,
    fallbackLabel: 8,
    capabilityBits: 9,
    lastConfirmedS: 10
  };
  var HAZARD = {
    hazardId: 1,
    hazardType: 2,
    geometryKind: 3,
    latE7: 4,
    lonE7: 5,
    radiusM: 6,
    routeIds: 7,
    cachedGeometryRef: 8,
    fallbackLabel: 9
  };
  var ROUTE_STATE = {
    routeId: 1,
    state: 2,
    reasonCode: 3,
    direction: 4,
    fallbackInstruction: 5
  };
  var OFFICIAL_ALERT = {
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
    campaignId: 13
  };
  var WEATHER_BULLETIN = {
    bulletinId: 1,
    regionCode: 2,
    codes: 3,
    validUntilS: 4,
    fallbackText: 5
  };
  var CHECKIN_CAMPAIGN = {
    campaignId: 1,
    campaignVersion: 2,
    formId: 3,
    deadlineS: 4,
    regionCode: 5,
    allowedStatuses: 6,
    requestPeopleCount: 7,
    requestLocation: 8,
    fallbackPrompt: 9
  };
  var CHECKIN_RESPONSE = {
    campaignId: 1,
    status: 2,
    peopleCount: 3,
    location: 4,
    sourceRef: 5
  };
  var RESOURCE_REQUEST = {
    requestId: 1,
    category: 2,
    urgency: 3,
    quantityBand: 4,
    peopleCount: 5,
    location: 6,
    linkedIncidentId: 7
  };
  var CACHE_CATALOG = { bundles: 1 };
  var CONTENT_ACTIVATE = { bundleId: 1, objectId: 2, opcode: 3, fallbackText: 4 };
  var RECORD_UPSERT = { bundleId: 1, objectId: 2, recordVersion: 3, fields: 4 };
  var RECORD_TOMBSTONE = { bundleId: 1, objectId: 2, recordVersion: 3, reasonCode: 4 };
  var CACHE_INVALIDATE = { bundleId: 1, version: 2, reasonCode: 3 };
  var FILE_MANIFEST = {
    fileId: 1,
    purposeCode: 2,
    mimeCategory: 3,
    totalBytes: 4,
    fragmentSize: 5,
    fragmentCount: 6,
    digest: 7,
    thumbnailRef: 8,
    linkedIncidentId: 9
  };
  var FILE_FRAGMENT = { fileId: 1, fragmentIndex: 2, fragmentDigest: 3, data: 4 };
  var HELLO_CAPABILITY = {
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
    highestWaitingPriority: 12
  };
  var INVENTORY = {
    criticalIds: 1,
    entries: 2,
    terminalIds: 3,
    queueEpoch: 4,
    truncated: 5
  };
  var PACKET_REQUEST = { packetIds: 1, fragmentRequests: 2 };
  var NETWORK_STATUS_OBSERVATION = {
    observerToken: 1,
    peerToken: 2,
    edgeKind: 3,
    observedAtS: 4
  };
  var FIELD_MAP_BY_TYPE = {
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
    [MessageType.NETWORK_STATUS_OBSERVATION]: NETWORK_STATUS_OBSERVATION
  };
  var REVERSE_CACHE = /* @__PURE__ */ new Map();
  function reverseFieldMap(map) {
    const cached = REVERSE_CACHE.get(map);
    if (cached)
      return cached;
    const reverse = /* @__PURE__ */ new Map();
    for (const [name, key] of Object.entries(map))
      reverse.set(key, name);
    REVERSE_CACHE.set(map, reverse);
    return reverse;
  }

  // packages/codec/dist/value-codec.js
  var TAG = {
    UINT: 0,
    NINT: 1,
    BYTES: 2,
    TEXT: 3,
    FALSE: 4,
    TRUE: 5,
    ARRAY: 6,
    MAP: 7
  };
  var DEFAULT_LIMITS = {
    maxBytes: 4096,
    maxTextBytes: 512,
    maxArrayItems: 64,
    maxDepth: 4
  };
  var textEncoder = new TextEncoder();
  var textDecoder = new TextDecoder("utf-8", { fatal: true });
  function writeValue(w, value, limits, depth, nestedMap) {
    if (depth > limits.maxDepth)
      throw new RangeError("payload nesting exceeds maxDepth");
    if (typeof value === "boolean") {
      w.u8(value ? TAG.TRUE : TAG.FALSE);
      return;
    }
    if (typeof value === "number") {
      if (!Number.isInteger(value))
        throw new TypeError("only integers may be encoded; scale floats (use E7)");
      if (value >= 0) {
        w.u8(TAG.UINT);
        w.uvarint(value);
      } else {
        w.u8(TAG.NINT);
        w.uvarint(-1 - value);
      }
      return;
    }
    if (typeof value === "string") {
      const bytes = textEncoder.encode(value);
      if (bytes.length > limits.maxTextBytes) {
        throw new RangeError(`text field of ${bytes.length} bytes exceeds ${limits.maxTextBytes}`);
      }
      w.u8(TAG.TEXT);
      w.uvarint(bytes.length);
      w.bytes(bytes);
      return;
    }
    if (value instanceof Uint8Array) {
      if (value.length > limits.maxBytes)
        throw new RangeError("byte field exceeds maxBytes");
      w.u8(TAG.BYTES);
      w.uvarint(value.length);
      w.bytes(value);
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > limits.maxArrayItems)
        throw new RangeError("array exceeds maxArrayItems");
      w.u8(TAG.ARRAY);
      w.uvarint(value.length);
      for (const item of value)
        writeValue(w, item, limits, depth + 1, nestedMap);
      return;
    }
    if (typeof value === "object" && value !== null) {
      if (!nestedMap) {
        throw new Error("nested object has no registered field map; add it to NESTED_FIELD_MAPS before encoding");
      }
      w.u8(TAG.MAP);
      writeFieldsBody(w, value, nestedMap, limits, depth + 1);
      return;
    }
    throw new TypeError(`unsupported payload value type: ${typeof value}`);
  }
  function writeFieldsBody(w, source, map, limits, depth) {
    const entries = [];
    for (const [name, value] of Object.entries(source)) {
      if (value === void 0 || value === null)
        continue;
      const key = map?.[name];
      if (key === void 0) {
        throw new Error(`field "${name}" has no wire key in its field map`);
      }
      entries.push({ key, name, value });
    }
    entries.sort((a, b) => a.key - b.key);
    w.uvarint(entries.length);
    for (const entry of entries) {
      w.uvarint(entry.key);
      writeValue(w, entry.value, limits, depth, NESTED_FIELD_MAPS[entry.name]);
    }
  }
  function encodeFields(payload, map, limits = DEFAULT_LIMITS) {
    const w = new ByteWriter(256);
    writeFieldsBody(w, payload, map, limits, 0);
    const out = w.toUint8Array();
    if (out.length > limits.maxBytes) {
      throw new RangeError(`encoded payload ${out.length}B exceeds limit ${limits.maxBytes}B`);
    }
    return out;
  }
  function readValue(r, limits, depth, nestedMap) {
    if (depth > limits.maxDepth)
      throw new RangeError("payload nesting exceeds maxDepth");
    const tag = r.u8();
    switch (tag) {
      case TAG.UINT:
        return r.uvarint();
      case TAG.NINT:
        return -1 - r.uvarint();
      case TAG.BYTES: {
        const len = r.uvarint();
        return r.bytes(len, limits.maxBytes);
      }
      case TAG.TEXT: {
        const len = r.uvarint();
        return textDecoder.decode(r.bytes(len, limits.maxTextBytes));
      }
      case TAG.FALSE:
        return false;
      case TAG.TRUE:
        return true;
      case TAG.ARRAY: {
        const count = r.uvarint();
        if (count > limits.maxArrayItems)
          throw new RangeError("array count exceeds maxArrayItems");
        const out = [];
        for (let i = 0; i < count; i += 1)
          out.push(readValue(r, limits, depth + 1, nestedMap));
        return out;
      }
      case TAG.MAP:
        return readFieldsBody(r, nestedMap, limits, depth + 1);
      default:
        throw new RangeError(`unknown value tag ${tag}`);
    }
  }
  function readFieldsBody(r, map, limits, depth) {
    const count = r.uvarint();
    if (count > 64)
      throw new RangeError("field count exceeds hard limit");
    const reverse = map ? reverseFieldMap(map) : void 0;
    const out = {};
    for (let i = 0; i < count; i += 1) {
      const key = r.uvarint();
      const name = reverse?.get(key);
      const value = readValue(r, limits, depth, name ? NESTED_FIELD_MAPS[name] : void 0);
      if (name !== void 0)
        out[name] = value;
    }
    return out;
  }
  function decodeFields(bytes, map, limits = DEFAULT_LIMITS) {
    if (bytes.length > limits.maxBytes)
      throw new RangeError("payload exceeds maxBytes before decode");
    const r = new ByteReader(bytes);
    const out = readFieldsBody(r, map, limits, 0);
    return out;
  }

  // packages/codec/dist/envelope-codec.js
  var HEADER_BYTES = ENVELOPE.HEADER_BYTES;
  var OFF = {
    MAGIC: 0,
    VERSION: 2,
    TYPE: 3,
    FLAGS: 4,
    PRIORITY_SEVERITY: 6,
    HEADER_LENGTH: 7,
    PACKET_ID: 8,
    SOURCE_ID: 24,
    CREATED: 32,
    EXPIRES: 36,
    HOP_LIMIT: 40,
    HOP_COUNT: 41,
    PAYLOAD_LENGTH: 42,
    FRAGMENT_INDEX: 46,
    FRAGMENT_COUNT: 48,
    DIGEST_PREFIX: 50,
    SOURCE_CLASS: 58,
    RESERVED: 59,
    CRC: 60
  };
  function encodeHeader(header) {
    const buf = new Uint8Array(HEADER_BYTES);
    const view = new DataView(buf.buffer);
    view.setUint16(OFF.MAGIC, PROTOCOL_MAGIC, false);
    buf[OFF.VERSION] = header.version & 255;
    buf[OFF.TYPE] = header.type & 255;
    view.setUint16(OFF.FLAGS, header.flags & 65535, false);
    buf[OFF.PRIORITY_SEVERITY] = (header.priority & 15) << 4 | header.severity & 15;
    buf[OFF.HEADER_LENGTH] = HEADER_BYTES;
    buf.set(fromHex(header.packetId), OFF.PACKET_ID);
    buf.set(fromHex(header.sourceId), OFF.SOURCE_ID);
    view.setUint32(OFF.CREATED, header.createdAt >>> 0, false);
    view.setUint32(OFF.EXPIRES, header.expiresAt >>> 0, false);
    buf[OFF.HOP_LIMIT] = header.hopLimit & 255;
    buf[OFF.HOP_COUNT] = header.hopCount & 255;
    view.setUint32(OFF.PAYLOAD_LENGTH, header.payloadLength >>> 0, false);
    view.setUint16(OFF.FRAGMENT_INDEX, header.fragmentIndex & 65535, false);
    view.setUint16(OFF.FRAGMENT_COUNT, header.fragmentCount & 65535, false);
    buf.set(fromHex(header.digestPrefix), OFF.DIGEST_PREFIX);
    buf[OFF.SOURCE_CLASS] = header.sourceClass & 255;
    buf[OFF.RESERVED] = 0;
    view.setUint32(OFF.CRC, crc32(buf, 0, OFF.CRC), false);
    return buf;
  }
  function decodeHeader(bytes) {
    if (bytes.length < HEADER_BYTES)
      throw new RangeError("buffer shorter than the fixed header");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magicValid = view.getUint16(OFF.MAGIC, false) === PROTOCOL_MAGIC;
    const storedCrc = view.getUint32(OFF.CRC, false);
    const crcValid = crc32(bytes, 0, OFF.CRC) === storedCrc;
    const prioritySeverity = bytes[OFF.PRIORITY_SEVERITY];
    const header = {
      version: bytes[OFF.VERSION],
      type: bytes[OFF.TYPE],
      flags: view.getUint16(OFF.FLAGS, false),
      priority: prioritySeverity >> 4 & 15,
      severity: prioritySeverity & 15,
      packetId: toHex2(bytes.subarray(OFF.PACKET_ID, OFF.PACKET_ID + 16)),
      sourceId: toHex2(bytes.subarray(OFF.SOURCE_ID, OFF.SOURCE_ID + 8)),
      sourceClass: bytes[OFF.SOURCE_CLASS],
      createdAt: view.getUint32(OFF.CREATED, false),
      expiresAt: view.getUint32(OFF.EXPIRES, false),
      hopLimit: bytes[OFF.HOP_LIMIT],
      hopCount: bytes[OFF.HOP_COUNT],
      payloadLength: view.getUint32(OFF.PAYLOAD_LENGTH, false),
      fragmentIndex: view.getUint16(OFF.FRAGMENT_INDEX, false),
      fragmentCount: view.getUint16(OFF.FRAGMENT_COUNT, false),
      digestPrefix: toHex2(bytes.subarray(OFF.DIGEST_PREFIX, OFF.DIGEST_PREFIX + 8))
    };
    return { header, crcValid, magicValid };
  }
  function incrementHopInPlace(bytes) {
    const out = bytes.slice();
    out[OFF.HOP_COUNT] = Math.min(255, out[OFF.HOP_COUNT] + 1);
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    view.setUint32(OFF.CRC, crc32(out, 0, OFF.CRC), false);
    return out;
  }
  var HEADER_OFFSETS = OFF;

  // packages/codec/dist/size-limits.js
  var BY_TYPE = {
    [MessageType.SOS_CREATE]: MAX_PAYLOAD_BY_CLASS.EMERGENCY,
    [MessageType.SOS_UPDATE]: MAX_PAYLOAD_BY_CLASS.EMERGENCY,
    [MessageType.SOS_CANCEL]: MAX_PAYLOAD_BY_CLASS.RESPONSE_CONTROL,
    [MessageType.RESPONDER_ASSIGNED]: MAX_PAYLOAD_BY_CLASS.RESPONSE_CONTROL,
    [MessageType.RESPONDER_ACCEPTED]: MAX_PAYLOAD_BY_CLASS.RESPONSE_CONTROL,
    [MessageType.RESPONDER_DECLINED]: MAX_PAYLOAD_BY_CLASS.RESPONSE_CONTROL,
    [MessageType.RESPONDER_EN_ROUTE]: MAX_PAYLOAD_BY_CLASS.RESPONSE_CONTROL,
    [MessageType.RESPONDER_ARRIVED]: MAX_PAYLOAD_BY_CLASS.RESPONSE_CONTROL,
    [MessageType.RESOLVED]: MAX_PAYLOAD_BY_CLASS.RESPONSE_CONTROL,
    [MessageType.LINK_RECEIPT]: MAX_PAYLOAD_BY_CLASS.RECEIPT,
    [MessageType.BACKEND_ACKNOWLEDGEMENT]: MAX_PAYLOAD_BY_CLASS.RECEIPT,
    [MessageType.SHELTER]: MAX_PAYLOAD_BY_CLASS.RESOURCE,
    [MessageType.MEDICAL_POST]: MAX_PAYLOAD_BY_CLASS.RESOURCE,
    [MessageType.FOOD_WATER]: MAX_PAYLOAD_BY_CLASS.RESOURCE,
    [MessageType.SAFE_ZONE]: MAX_PAYLOAD_BY_CLASS.RESOURCE,
    [MessageType.HAZARD]: MAX_PAYLOAD_BY_CLASS.HAZARD_ROUTE,
    [MessageType.ROUTE_STATE]: MAX_PAYLOAD_BY_CLASS.HAZARD_ROUTE,
    [MessageType.OFFICIAL_ALERT]: MAX_PAYLOAD_BY_CLASS.AUTHORITY,
    [MessageType.WEATHER_BULLETIN]: MAX_PAYLOAD_BY_CLASS.AUTHORITY,
    [MessageType.CHECKIN_CAMPAIGN]: MAX_PAYLOAD_BY_CLASS.CHECKIN,
    [MessageType.CHECKIN_RESPONSE]: MAX_PAYLOAD_BY_CLASS.CHECKIN,
    [MessageType.RESOURCE_REQUEST]: MAX_PAYLOAD_BY_CLASS.REQUEST,
    [MessageType.CACHE_CATALOG]: MAX_PAYLOAD_BY_CLASS.CONTENT_OP,
    [MessageType.CONTENT_ACTIVATE]: MAX_PAYLOAD_BY_CLASS.CONTENT_OP,
    [MessageType.RECORD_UPSERT]: MAX_PAYLOAD_BY_CLASS.CONTENT_OP,
    [MessageType.RECORD_TOMBSTONE]: MAX_PAYLOAD_BY_CLASS.CONTENT_OP,
    [MessageType.CACHE_INVALIDATE]: MAX_PAYLOAD_BY_CLASS.CONTENT_OP,
    [MessageType.FILE_MANIFEST]: MAX_PAYLOAD_BY_CLASS.FILE_MANIFEST,
    [MessageType.FILE_FRAGMENT]: MAX_PAYLOAD_BY_CLASS.FILE_FRAGMENT,
    [MessageType.HELLO_CAPABILITY]: MAX_PAYLOAD_BY_CLASS.SESSION_CONTROL,
    [MessageType.INVENTORY]: MAX_PAYLOAD_BY_CLASS.SESSION_CONTROL,
    [MessageType.PACKET_REQUEST]: MAX_PAYLOAD_BY_CLASS.SESSION_CONTROL,
    [MessageType.NETWORK_STATUS_OBSERVATION]: MAX_PAYLOAD_BY_CLASS.CONTENT_OP
  };
  function maxPayloadBytesFor(messageType) {
    return BY_TYPE[messageType] ?? MAX_PAYLOAD_BY_CLASS.CONTENT_OP;
  }

  // packages/codec/dist/packet-codec.js
  var ENVELOPE_EXTRA_FIELDS = { streamId: 250, sourceSequence: 251, geo: 252 };
  function toEpochS(ms) {
    return Math.max(0, Math.floor((ms - TIME.DEMO_EPOCH_MS) / 1e3));
  }
  function fromEpochS(s) {
    return TIME.DEMO_EPOCH_MS + s * 1e3;
  }
  function encodePacket(options) {
    const fieldMap = FIELD_MAP_BY_TYPE[options.type];
    if (!fieldMap)
      throw new Error(`no field map registered for message type 0x${options.type.toString(16)}`);
    const maxPayload = maxPayloadBytesFor(options.type);
    const limits = {
      maxBytes: maxPayload,
      maxTextBytes: 512,
      maxArrayItems: 64,
      maxDepth: 4
    };
    const body = { ...options.payload };
    const extras = /* @__PURE__ */ new Map();
    if (options.streamId !== void 0)
      extras.set(ENVELOPE_EXTRA_FIELDS.streamId, options.streamId);
    if (options.sourceSequence !== void 0)
      extras.set(ENVELOPE_EXTRA_FIELDS.sourceSequence, options.sourceSequence);
    if (options.geo !== void 0)
      extras.set(ENVELOPE_EXTRA_FIELDS.geo, options.geo);
    const extendedMap = { ...fieldMap };
    if (extras.has(ENVELOPE_EXTRA_FIELDS.streamId)) {
      extendedMap["__streamId"] = ENVELOPE_EXTRA_FIELDS.streamId;
      body["__streamId"] = options.streamId;
    }
    if (extras.has(ENVELOPE_EXTRA_FIELDS.sourceSequence)) {
      extendedMap["__sourceSequence"] = ENVELOPE_EXTRA_FIELDS.sourceSequence;
      body["__sourceSequence"] = options.sourceSequence;
    }
    if (extras.has(ENVELOPE_EXTRA_FIELDS.geo)) {
      extendedMap["__geo"] = ENVELOPE_EXTRA_FIELDS.geo;
      body["__geo"] = options.geo;
    }
    const payloadBytes = encodeFields(body, extendedMap, limits);
    const priority = options.priority ?? DEFAULT_PRIORITY[options.type] ?? Priority.GENERAL_UPDATE;
    let flags = options.flags ?? 0;
    if (options.geo)
      flags |= Flags.LOCATION_PRESENT;
    if (TERMINAL_TYPES.has(options.type))
      flags |= Flags.TERMINAL;
    if ((options.fragmentCount ?? 1) > 1)
      flags |= Flags.FRAGMENTED;
    if (options.sourceClass === SourceClass.AUTHORITY_PROVISIONED)
      flags |= Flags.PROTOTYPE_AUTHORITY;
    const header = {
      version: PROTOCOL_VERSION,
      type: options.type,
      flags,
      priority,
      severity: options.severity ?? 0,
      packetId: options.packetId ?? newPacketId(),
      sourceId: options.sourceId,
      sourceClass: options.sourceClass,
      createdAt: options.createdAt,
      expiresAt: options.createdAt + Math.min(options.ttlS, TIME.MAX_TTL_S),
      hopLimit: options.hopLimit,
      hopCount: options.hopCount ?? 0,
      payloadLength: payloadBytes.length,
      fragmentIndex: options.fragmentIndex ?? 0,
      fragmentCount: options.fragmentCount ?? 1,
      digestPrefix: digestPrefix(payloadBytes, options.type)
    };
    const headerBytes = encodeHeader(header);
    const bytes = new Uint8Array(headerBytes.length + payloadBytes.length);
    bytes.set(headerBytes, 0);
    bytes.set(payloadBytes, headerBytes.length);
    return {
      bytes,
      packetId: header.packetId,
      headerBytes: headerBytes.length,
      payloadBytes: payloadBytes.length,
      totalBytes: bytes.length
    };
  }
  function decodePacket(bytes) {
    if (bytes.length < HEADER_BYTES)
      return { ok: false, reason: RejectReason.TOO_SHORT };
    if (bytes.length > ENVELOPE.MAX_TOTAL_BYTES)
      return { ok: false, reason: RejectReason.LENGTH_OVER_LIMIT };
    let decoded;
    try {
      decoded = decodeHeader(bytes);
    } catch {
      return { ok: false, reason: RejectReason.TOO_SHORT };
    }
    if (!decoded.magicValid)
      return { ok: false, reason: RejectReason.BAD_MAGIC };
    if (!decoded.crcValid)
      return { ok: false, reason: RejectReason.HEADER_CRC_FAILED };
    const header = decoded.header;
    if (header.version !== PROTOCOL_VERSION) {
      return { ok: false, reason: RejectReason.UNSUPPORTED_VERSION, detail: `v${header.version}` };
    }
    if (!isKnownMessageType(header.type)) {
      return { ok: false, reason: RejectReason.UNKNOWN_TYPE, detail: `0x${header.type.toString(16)}` };
    }
    const maxPayload = maxPayloadBytesFor(header.type);
    if (header.payloadLength > maxPayload) {
      return { ok: false, reason: RejectReason.LENGTH_OVER_LIMIT, detail: `${header.payloadLength}>${maxPayload}` };
    }
    if (HEADER_BYTES + header.payloadLength !== bytes.length) {
      return { ok: false, reason: RejectReason.LENGTH_MISMATCH };
    }
    const payloadBytes = bytes.subarray(HEADER_BYTES);
    if (digestPrefix(payloadBytes, header.type) !== header.digestPrefix) {
      return { ok: false, reason: RejectReason.PAYLOAD_DIGEST_MISMATCH };
    }
    const fieldMap = FIELD_MAP_BY_TYPE[header.type];
    if (!fieldMap)
      return { ok: false, reason: RejectReason.UNKNOWN_TYPE };
    const extendedMap = {
      ...fieldMap,
      __streamId: ENVELOPE_EXTRA_FIELDS.streamId,
      __sourceSequence: ENVELOPE_EXTRA_FIELDS.sourceSequence,
      __geo: ENVELOPE_EXTRA_FIELDS.geo
    };
    let fields;
    try {
      fields = decodeFields(payloadBytes, extendedMap, {
        maxBytes: maxPayload,
        maxTextBytes: 512,
        maxArrayItems: 64,
        maxDepth: 4
      });
    } catch (error) {
      return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: String(error) };
    }
    const streamId = fields["__streamId"];
    const sourceSequence = fields["__sourceSequence"];
    const geo = fields["__geo"];
    delete fields["__streamId"];
    delete fields["__sourceSequence"];
    delete fields["__geo"];
    const packet = {
      header,
      ...geo ? { geo } : {},
      ...streamId !== void 0 ? { streamId } : {},
      ...sourceSequence !== void 0 ? { sourceSequence } : {},
      payload: fields
    };
    return { ok: true, packet, digest: payloadDigest(payloadBytes, header.type), totalBytes: bytes.length };
  }
  function reencode(packet) {
    return encodePacket({
      type: packet.header.type,
      payload: packet.payload,
      sourceId: packet.header.sourceId,
      sourceClass: packet.header.sourceClass,
      createdAt: packet.header.createdAt,
      ttlS: packet.header.expiresAt - packet.header.createdAt,
      hopLimit: packet.header.hopLimit,
      hopCount: packet.header.hopCount,
      severity: packet.header.severity,
      priority: packet.header.priority,
      packetId: packet.header.packetId,
      flags: packet.header.flags,
      fragmentIndex: packet.header.fragmentIndex,
      fragmentCount: packet.header.fragmentCount,
      ...packet.streamId !== void 0 ? { streamId: packet.streamId } : {},
      ...packet.sourceSequence !== void 0 ? { sourceSequence: packet.sourceSequence } : {},
      ...packet.geo !== void 0 ? { geo: packet.geo } : {}
    });
  }

  // packages/codec/dist/builders.js
  function budgetClassFor(messageType, severity) {
    switch (messageType) {
      case MessageType.SOS_CREATE:
      case MessageType.SOS_UPDATE:
        return severity >= Severity.LIFE_CRITICAL ? "CRITICAL" : "HIGH";
      case MessageType.SOS_CANCEL:
      case MessageType.RESOLVED:
      case MessageType.BACKEND_ACKNOWLEDGEMENT:
        return "CRITICAL";
      case MessageType.RESPONDER_ASSIGNED:
      case MessageType.RESPONDER_ACCEPTED:
      case MessageType.RESPONDER_DECLINED:
      case MessageType.RESPONDER_EN_ROUTE:
      case MessageType.RESPONDER_ARRIVED:
      case MessageType.OFFICIAL_ALERT:
        return "HIGH";
      case MessageType.HAZARD:
      case MessageType.ROUTE_STATE:
      case MessageType.RESOURCE_REQUEST:
        return "MEDIUM_HIGH";
      case MessageType.SHELTER:
      case MessageType.MEDICAL_POST:
      case MessageType.FOOD_WATER:
      case MessageType.SAFE_ZONE:
      case MessageType.CHECKIN_CAMPAIGN:
      case MessageType.CHECKIN_RESPONSE:
        return "MEDIUM";
      case MessageType.FILE_MANIFEST:
      case MessageType.FILE_FRAGMENT:
      case MessageType.NETWORK_STATUS_OBSERVATION:
        return "LOW";
      default:
        return "LOW_MEDIUM";
    }
  }
  function build(ctx, type, payload, extras = {}) {
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
      ...extras
    });
  }
  function buildSosCreate(ctx, input) {
    const { severity, geo, ...payload } = input;
    return build(ctx, MessageType.SOS_CREATE, payload, {
      severity,
      streamId: input.incidentId,
      sourceSequence: 1,
      ...geo ? { geo } : {},
      flags: Flags.RECEIPT_REQUESTED
    });
  }
  function buildSosUpdate(ctx, incidentId, sequence, severity, changed, geo) {
    return build(ctx, MessageType.SOS_UPDATE, { incidentId, ...changed }, {
      severity,
      streamId: incidentId,
      sourceSequence: sequence,
      ...geo ? { geo } : {}
    });
  }
  function buildSosCancel(ctx, incidentId, sequence, reason, terminalRetentionS) {
    return build(ctx, MessageType.SOS_CANCEL, { incidentId, reason, terminalRetentionS }, {
      streamId: incidentId,
      sourceSequence: sequence
    });
  }
  function buildResponderState(ctx, type, incidentId, sequence, payload, geo) {
    return build(ctx, type, { incidentId, ...payload }, {
      streamId: incidentId,
      sourceSequence: sequence,
      ...geo ? { geo } : {}
    });
  }
  function buildLinkReceipt(ctx, forPacketId, digestPrefixHex, receivingNodeToken, result) {
    return build(ctx, MessageType.LINK_RECEIPT, {
      forPacketId,
      digestPrefix: digestPrefixHex,
      receivingNodeToken,
      result
    });
  }
  function buildBackendAck(ctx, forPacketId, backendReceiptId, dedupOutcome, incidentId) {
    return build(ctx, MessageType.BACKEND_ACKNOWLEDGEMENT, { forPacketId, backendReceiptId, dedupOutcome, ...incidentId ? { incidentId } : {} }, { ...incidentId ? { streamId: incidentId } : {} });
  }
  function buildResourceRecord(ctx, type, objectId, version, payload) {
    return build(ctx, type, { objectId, ...payload }, { streamId: objectId, sourceSequence: version });
  }
  function buildHazard(ctx, hazardId, version, severity, payload) {
    return build(ctx, MessageType.HAZARD, { hazardId, ...payload }, {
      severity,
      streamId: hazardId,
      sourceSequence: version
    });
  }
  function buildRouteState(ctx, routeId, version, payload) {
    return build(ctx, MessageType.ROUTE_STATE, { routeId, ...payload }, {
      streamId: routeId,
      sourceSequence: version
    });
  }
  function buildOfficialAlert(ctx, alertId, version, severity, payload) {
    if (ctx.sourceClass !== SourceClass.AUTHORITY_PROVISIONED && ctx.sourceClass !== SourceClass.BACKEND) {
      throw new Error("OFFICIAL_ALERT requires an authority-provisioned source class");
    }
    return build(ctx, MessageType.OFFICIAL_ALERT, { alertId, ...payload }, {
      severity,
      streamId: alertId,
      sourceSequence: version
    });
  }
  function buildCheckinCampaign(ctx, campaignId, payload) {
    return build(ctx, MessageType.CHECKIN_CAMPAIGN, { campaignId, ...payload }, { streamId: campaignId });
  }
  function buildCheckinResponse(ctx, campaignId, payload) {
    return build(ctx, MessageType.CHECKIN_RESPONSE, { campaignId, ...payload }, { streamId: campaignId });
  }
  function buildResourceRequest(ctx, requestId, payload) {
    return build(ctx, MessageType.RESOURCE_REQUEST, { requestId, ...payload }, { streamId: requestId });
  }
  function buildFileManifest(ctx, fileId, payload) {
    return build(ctx, MessageType.FILE_MANIFEST, { fileId, ...payload }, { streamId: fileId });
  }
  function buildFileFragment(ctx, fileId, fragmentIndex, fragmentCount, fragmentDigest, data) {
    return build(ctx, MessageType.FILE_FRAGMENT, { fileId, fragmentIndex, fragmentDigest, data }, {
      streamId: fileId,
      fragmentIndex,
      fragmentCount
    });
  }
  function buildHello(ctx, payload) {
    return build(ctx, MessageType.HELLO_CAPABILITY, payload);
  }
  function buildInventory(ctx, payload) {
    return build(ctx, MessageType.INVENTORY, payload);
  }
  function buildPacketRequest(ctx, payload) {
    return build(ctx, MessageType.PACKET_REQUEST, payload);
  }

  // packages/validator/dist/index.js
  var dist_exports3 = {};
  __export(dist_exports3, {
    SOURCE_LABEL_COPY: () => SOURCE_LABEL_COPY,
    observationFor: () => observationFor,
    sourceLabelFor: () => sourceLabelFor,
    validate: () => validate,
    validateSchema: () => validateSchema
  });

  // packages/validator/dist/schemas.js
  var encoder = new TextEncoder();
  var SAFE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;
  var LOCATION_RULES = [
    { kind: "int", field: "source", min: 0, max: 4 },
    { kind: "int", field: "latE7", min: -9e8, max: 9e8 },
    { kind: "int", field: "lonE7", min: -18e8, max: 18e8 },
    { kind: "int", field: "accuracyM", min: 0, max: 1e5 },
    { kind: "int", field: "ageS", min: 0, max: 86400 }
  ];
  var RULES = {
    [MessageType.SOS_CREATE]: [
      { kind: "required", field: "incidentId" },
      { kind: "id", field: "incidentId", maxBytes: 32 },
      { kind: "required", field: "category" },
      { kind: "int", field: "category", min: 0, max: 7 },
      { kind: "required", field: "peopleTotal" },
      { kind: "int", field: "peopleTotal", min: 0, max: FIELD_LIMITS.MAX_PEOPLE_TOTAL },
      { kind: "int", field: "injured", min: 0, max: FIELD_LIMITS.MAX_INJURED },
      { kind: "int", field: "children", min: 0, max: FIELD_LIMITS.MAX_CHILDREN },
      { kind: "int", field: "mobility", min: 0, max: 4 },
      { kind: "location", field: "location" },
      { kind: "text", field: "shortNote", maxBytes: FIELD_LIMITS.SHORT_NOTE_BYTES },
      { kind: "text", field: "language", maxBytes: FIELD_LIMITS.LANGUAGE_TAG_BYTES },
      { kind: "array", field: "helpCategories", maxItems: FIELD_LIMITS.MAX_HELP_CATEGORIES },
      { kind: "int", field: "batteryBand", min: 0, max: 3 }
    ],
    [MessageType.SOS_UPDATE]: [
      { kind: "required", field: "incidentId" },
      { kind: "id", field: "incidentId", maxBytes: 32 },
      { kind: "int", field: "category", min: 0, max: 7 },
      { kind: "int", field: "peopleTotal", min: 0, max: FIELD_LIMITS.MAX_PEOPLE_TOTAL },
      { kind: "int", field: "injured", min: 0, max: FIELD_LIMITS.MAX_INJURED },
      { kind: "int", field: "mobility", min: 0, max: 4 },
      { kind: "location", field: "location" },
      { kind: "text", field: "shortNote", maxBytes: FIELD_LIMITS.SHORT_NOTE_BYTES }
    ],
    [MessageType.SOS_CANCEL]: [
      { kind: "required", field: "incidentId" },
      { kind: "id", field: "incidentId", maxBytes: 32 },
      { kind: "int", field: "reason", min: 0, max: 4 },
      { kind: "int", field: "terminalRetentionS", min: 0, max: 86400 }
    ],
    [MessageType.RESPONDER_ASSIGNED]: [
      { kind: "required", field: "incidentId" },
      { kind: "id", field: "incidentId", maxBytes: 32 },
      { kind: "required", field: "assignmentId" },
      { kind: "id", field: "assignmentId", maxBytes: 32 },
      { kind: "id", field: "responderRef", maxBytes: 32 },
      { kind: "text", field: "dispatcherLabel", maxBytes: FIELD_LIMITS.LABEL_BYTES }
    ],
    [MessageType.RESPONDER_EN_ROUTE]: [
      { kind: "required", field: "incidentId" },
      { kind: "id", field: "incidentId", maxBytes: 32 },
      { kind: "location", field: "location" },
      { kind: "int", field: "etaBandMin", min: 0, max: 600 }
    ],
    [MessageType.RESPONDER_ARRIVED]: [
      { kind: "required", field: "incidentId" },
      { kind: "int", field: "evidence", min: 0, max: 1 }
    ],
    [MessageType.RESOLVED]: [
      { kind: "required", field: "incidentId" },
      { kind: "int", field: "outcome", min: 0, max: 5 },
      { kind: "int", field: "terminalRetentionS", min: 0, max: 86400 }
    ],
    [MessageType.LINK_RECEIPT]: [
      { kind: "required", field: "forPacketId" },
      { kind: "id", field: "forPacketId", maxBytes: 32 },
      { kind: "int", field: "result", min: 0, max: 3 }
    ],
    [MessageType.BACKEND_ACKNOWLEDGEMENT]: [
      { kind: "required", field: "forPacketId" },
      { kind: "id", field: "forPacketId", maxBytes: 32 },
      { kind: "id", field: "backendReceiptId", maxBytes: 40 },
      { kind: "int", field: "dedupOutcome", min: 0, max: 3 }
    ],
    [MessageType.HAZARD]: [
      { kind: "required", field: "hazardId" },
      { kind: "id", field: "hazardId", maxBytes: 32 },
      { kind: "int", field: "hazardType", min: 0, max: 8 },
      { kind: "int", field: "geometryKind", min: 0, max: 3 },
      { kind: "int", field: "radiusM", min: 0, max: 5e4 },
      { kind: "array", field: "routeIds", maxItems: FIELD_LIMITS.MAX_ROUTE_IDS_PER_HAZARD },
      { kind: "text", field: "fallbackLabel", maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES }
    ],
    [MessageType.ROUTE_STATE]: [
      { kind: "required", field: "routeId" },
      { kind: "id", field: "routeId", maxBytes: 32 },
      { kind: "int", field: "state", min: 0, max: 4 },
      { kind: "int", field: "direction", min: 0, max: 2 },
      { kind: "text", field: "fallbackInstruction", maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES }
    ],
    [MessageType.OFFICIAL_ALERT]: [
      { kind: "required", field: "alertId" },
      { kind: "id", field: "alertId", maxBytes: 32 },
      { kind: "int", field: "category", min: 0, max: 6 },
      { kind: "int", field: "instruction", min: 0, max: 7 },
      { kind: "int", field: "latE7", min: -9e8, max: 9e8 },
      { kind: "int", field: "lonE7", min: -18e8, max: 18e8 },
      { kind: "int", field: "radiusM", min: 0, max: 2e5 },
      { kind: "text", field: "fallbackText", maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES },
      { kind: "array", field: "relatedObjectIds", maxItems: 8 }
    ],
    [MessageType.CHECKIN_CAMPAIGN]: [
      { kind: "required", field: "campaignId" },
      { kind: "id", field: "campaignId", maxBytes: 32 },
      { kind: "id", field: "formId", maxBytes: 32 },
      { kind: "array", field: "allowedStatuses", maxItems: FIELD_LIMITS.MAX_RESPONSE_OPTIONS },
      { kind: "text", field: "fallbackPrompt", maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES }
    ],
    [MessageType.CHECKIN_RESPONSE]: [
      { kind: "required", field: "campaignId" },
      { kind: "id", field: "campaignId", maxBytes: 32 },
      { kind: "int", field: "status", min: 0, max: 4 },
      { kind: "int", field: "peopleCount", min: 0, max: FIELD_LIMITS.MAX_PEOPLE_TOTAL },
      { kind: "location", field: "location" }
    ],
    [MessageType.RESOURCE_REQUEST]: [
      { kind: "required", field: "requestId" },
      { kind: "id", field: "requestId", maxBytes: 32 },
      { kind: "int", field: "category", min: 0, max: 7 },
      { kind: "int", field: "urgency", min: 0, max: 3 },
      { kind: "location", field: "location" }
    ],
    [MessageType.FILE_MANIFEST]: [
      { kind: "required", field: "fileId" },
      { kind: "id", field: "fileId", maxBytes: 32 },
      { kind: "int", field: "totalBytes", min: 0, max: 131072 },
      { kind: "int", field: "fragmentSize", min: 1, max: 4096 },
      { kind: "int", field: "fragmentCount", min: 1, max: 64 }
    ],
    [MessageType.FILE_FRAGMENT]: [
      { kind: "required", field: "fileId" },
      { kind: "id", field: "fileId", maxBytes: 32 },
      { kind: "int", field: "fragmentIndex", min: 0, max: 63 }
    ],
    // --- previously unguarded: these accepted a completely empty payload ------
    [MessageType.RESPONDER_ACCEPTED]: [
      { kind: "required", field: "incidentId" },
      { kind: "id", field: "incidentId", maxBytes: 32 },
      { kind: "required", field: "assignmentId" },
      { kind: "id", field: "assignmentId", maxBytes: 32 },
      { kind: "id", field: "responderRef", maxBytes: 32 }
    ],
    [MessageType.RESPONDER_DECLINED]: [
      { kind: "required", field: "incidentId" },
      { kind: "id", field: "incidentId", maxBytes: 32 },
      { kind: "required", field: "assignmentId" },
      { kind: "id", field: "assignmentId", maxBytes: 32 },
      { kind: "id", field: "responderRef", maxBytes: 32 },
      { kind: "int", field: "reasonCode", min: 0, max: 255 }
    ],
    [MessageType.WEATHER_BULLETIN]: [
      { kind: "required", field: "bulletinId" },
      { kind: "id", field: "bulletinId", maxBytes: 32 },
      { kind: "array", field: "codes", maxItems: 16 },
      { kind: "text", field: "fallbackText", maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES }
    ],
    [MessageType.CACHE_CATALOG]: [
      { kind: "required", field: "bundles" },
      { kind: "array", field: "bundles", maxItems: 16 }
    ],
    [MessageType.CONTENT_ACTIVATE]: [
      { kind: "required", field: "bundleId" },
      { kind: "id", field: "bundleId", maxBytes: 32 },
      { kind: "required", field: "objectId" },
      { kind: "id", field: "objectId", maxBytes: 32 },
      { kind: "required", field: "opcode" },
      { kind: "int", field: "opcode", min: 0, max: 255 },
      { kind: "text", field: "fallbackText", maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES }
    ],
    [MessageType.RECORD_UPSERT]: [
      { kind: "required", field: "bundleId" },
      { kind: "id", field: "bundleId", maxBytes: 32 },
      { kind: "required", field: "objectId" },
      { kind: "id", field: "objectId", maxBytes: 32 },
      { kind: "required", field: "recordVersion" },
      { kind: "int", field: "recordVersion", min: 0, max: 65535 }
    ],
    [MessageType.RECORD_TOMBSTONE]: [
      { kind: "required", field: "bundleId" },
      { kind: "id", field: "bundleId", maxBytes: 32 },
      { kind: "required", field: "objectId" },
      { kind: "id", field: "objectId", maxBytes: 32 },
      { kind: "required", field: "recordVersion" },
      { kind: "int", field: "recordVersion", min: 0, max: 65535 },
      { kind: "int", field: "reasonCode", min: 0, max: 255 }
    ],
    [MessageType.CACHE_INVALIDATE]: [
      { kind: "required", field: "bundleId" },
      { kind: "id", field: "bundleId", maxBytes: 32 },
      { kind: "required", field: "version" },
      { kind: "int", field: "version", min: 0, max: 65535 },
      { kind: "int", field: "reasonCode", min: 0, max: 255 }
    ],
    [MessageType.HELLO_CAPABILITY]: [
      { kind: "required", field: "nodeToken" },
      { kind: "id", field: "nodeToken", maxBytes: 16 },
      { kind: "required", field: "protocolMin" },
      { kind: "int", field: "protocolMin", min: 0, max: 255 },
      { kind: "required", field: "protocolMax" },
      { kind: "int", field: "protocolMax", min: 0, max: 255 },
      { kind: "int", field: "batteryBand", min: 0, max: 3 },
      { kind: "int", field: "storageBand", min: 0, max: 3 },
      { kind: "int", field: "maxRecordBytes", min: 0, max: 65535 },
      { kind: "int", field: "maxFragmentBytes", min: 0, max: 65535 },
      { kind: "int", field: "queueEpoch", min: 0, max: 65535 },
      { kind: "int", field: "highestWaitingPriority", min: 0, max: 7 }
    ],
    [MessageType.INVENTORY]: [
      { kind: "required", field: "queueEpoch" },
      { kind: "int", field: "queueEpoch", min: 0, max: 65535 },
      { kind: "array", field: "criticalIds", maxItems: 16 },
      { kind: "array", field: "entries", maxItems: 48 },
      { kind: "array", field: "terminalIds", maxItems: 48 }
    ],
    [MessageType.PACKET_REQUEST]: [
      { kind: "required", field: "packetIds" },
      { kind: "array", field: "packetIds", maxItems: 48 },
      { kind: "array", field: "fragmentRequests", maxItems: 16 }
    ],
    [MessageType.NETWORK_STATUS_OBSERVATION]: [
      { kind: "required", field: "observerToken" },
      { kind: "id", field: "observerToken", maxBytes: 16 },
      { kind: "required", field: "peerToken" },
      { kind: "id", field: "peerToken", maxBytes: 16 },
      { kind: "required", field: "edgeKind" },
      { kind: "int", field: "edgeKind", min: 0, max: 4 }
    ]
  };
  var RESOURCE_RULES = [
    { kind: "required", field: "objectId" },
    { kind: "id", field: "objectId", maxBytes: 32 },
    { kind: "int", field: "state", min: 0, max: 5 },
    { kind: "int", field: "capacityBand", min: 0, max: 5 },
    { kind: "int", field: "capacityExact", min: 0, max: 1e5 },
    { kind: "location", field: "location" },
    { kind: "text", field: "fallbackLabel", maxBytes: FIELD_LIMITS.FALLBACK_TEXT_BYTES }
  ];
  var RESOURCE_TYPES = /* @__PURE__ */ new Set([
    MessageType.SHELTER,
    MessageType.MEDICAL_POST,
    MessageType.FOOD_WATER,
    MessageType.SAFE_ZONE
  ]);
  function checkRules(rules, value) {
    for (const rule of rules) {
      const field = value[rule.field];
      if (rule.kind === "required") {
        if (field === void 0 || field === null) {
          return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: `missing required field "${rule.field}"` };
        }
        continue;
      }
      if (field === void 0 || field === null)
        continue;
      switch (rule.kind) {
        case "int": {
          if (typeof field !== "number" || !Number.isInteger(field)) {
            return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: `"${rule.field}" must be an integer` };
          }
          if (field < rule.min || field > rule.max) {
            return {
              ok: false,
              reason: RejectReason.FIELD_OVER_LIMIT,
              detail: `"${rule.field}"=${field} outside [${rule.min}, ${rule.max}]`
            };
          }
          break;
        }
        case "text": {
          if (typeof field !== "string") {
            return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: `"${rule.field}" must be text` };
          }
          const size = encoder.encode(field).length;
          if (size > rule.maxBytes) {
            return {
              ok: false,
              reason: RejectReason.FIELD_OVER_LIMIT,
              detail: `"${rule.field}" is ${size}B, over ${rule.maxBytes}B`
            };
          }
          break;
        }
        case "id": {
          if (typeof field !== "string" || !SAFE_ID.test(field)) {
            return {
              ok: false,
              reason: RejectReason.SCHEMA_INVALID,
              detail: `"${rule.field}" is not a safe compact identifier`
            };
          }
          if (encoder.encode(field).length > rule.maxBytes) {
            return { ok: false, reason: RejectReason.FIELD_OVER_LIMIT, detail: `"${rule.field}" too long` };
          }
          break;
        }
        case "array": {
          if (!Array.isArray(field)) {
            return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: `"${rule.field}" must be an array` };
          }
          if (field.length > rule.maxItems) {
            return {
              ok: false,
              reason: RejectReason.FIELD_OVER_LIMIT,
              detail: `"${rule.field}" has ${field.length} items, over ${rule.maxItems}`
            };
          }
          break;
        }
        case "location": {
          if (typeof field !== "object") {
            return { ok: false, reason: RejectReason.SCHEMA_INVALID, detail: `"${rule.field}" must be an object` };
          }
          const nested = checkRules(LOCATION_RULES, field);
          if (!nested.ok)
            return nested;
          break;
        }
      }
    }
    return { ok: true };
  }
  function validateSchema(messageType, payload) {
    const rules = RESOURCE_TYPES.has(messageType) ? RESOURCE_RULES : RULES[messageType];
    if (!rules) {
      return {
        ok: false,
        reason: RejectReason.SCHEMA_INVALID,
        detail: `no schema rules registered for message type 0x${messageType.toString(16)}`
      };
    }
    return checkRules(rules, payload);
  }

  // packages/validator/dist/index.js
  function sourceLabelFor(sourceClass, flags) {
    if ((flags & Flags.COMMUNITY_REPORTED) !== 0)
      return "community-reported";
    switch (sourceClass) {
      case SourceClass.GENERAL_PUBLIC:
        return "general-public";
      case SourceClass.RESPONDER_PROVISIONED:
        return "responder-demo-provisioned";
      case SourceClass.AUTHORITY_PROVISIONED:
        return "authority-demo-provisioned";
      case SourceClass.COORDINATOR_PROVISIONED:
        return "coordinator-demo-provisioned";
      case SourceClass.BACKEND:
        return "coordination-backend";
      case SourceClass.TIER2_BROADCAST:
        return "radio-broadcast-demo-provisioned";
      default:
        return "unknown-source";
    }
  }
  var SOURCE_LABEL_COPY = {
    "community-reported": "Community reported",
    "general-public": "Reported by a member of the public",
    "responder-demo-provisioned": "Responder (demo-provisioned role)",
    "authority-demo-provisioned": "Authority (demo-provisioned role)",
    "coordinator-demo-provisioned": "Coordinator (demo-provisioned role)",
    "coordination-backend": "From the coordination centre",
    "radio-broadcast-demo-provisioned": "Radio broadcast (demo-provisioned role)",
    "unknown-source": "Unknown source"
  };
  var AUTHORITY_ONLY = /* @__PURE__ */ new Set([
    MessageType.OFFICIAL_ALERT,
    MessageType.WEATHER_BULLETIN,
    MessageType.CHECKIN_CAMPAIGN,
    MessageType.CACHE_CATALOG,
    MessageType.CACHE_INVALIDATE
  ]);
  var RESPONDER_OR_AUTHORITY_ONLY = /* @__PURE__ */ new Set([
    MessageType.RESPONDER_ASSIGNED,
    MessageType.RESPONDER_ACCEPTED,
    MessageType.RESPONDER_DECLINED,
    MessageType.RESPONDER_EN_ROUTE,
    MessageType.RESPONDER_ARRIVED,
    MessageType.RESOLVED,
    MessageType.SHELTER,
    MessageType.MEDICAL_POST,
    MessageType.FOOD_WATER,
    MessageType.SAFE_ZONE
  ]);
  function rolePermits(type, sourceClass, flags) {
    const privileged = sourceClass === SourceClass.AUTHORITY_PROVISIONED || sourceClass === SourceClass.COORDINATOR_PROVISIONED || sourceClass === SourceClass.BACKEND || sourceClass === SourceClass.TIER2_BROADCAST;
    if (AUTHORITY_ONLY.has(type))
      return privileged;
    if (RESPONDER_OR_AUTHORITY_ONLY.has(type)) {
      if ((flags & Flags.COMMUNITY_REPORTED) !== 0) {
        return type === MessageType.SHELTER || type === MessageType.MEDICAL_POST || type === MessageType.FOOD_WATER;
      }
      return privileged || sourceClass === SourceClass.RESPONDER_PROVISIONED;
    }
    return true;
  }
  function validate(bytes, context) {
    const gatesPassed = [];
    const warnings = [];
    const decoded = decodePacket(bytes);
    if (!decoded.ok) {
      return {
        ok: false,
        gate: gateForDecodeReason(decoded.reason),
        reason: decoded.reason,
        ...decoded.detail ? { detail: decoded.detail } : {},
        gatesPassed
      };
    }
    gatesPassed.push(ValidationGate.ENVELOPE_LENGTH, ValidationGate.PROTOCOL_VERSION, ValidationGate.DECLARED_SIZES, ValidationGate.HEADER_INTEGRITY, ValidationGate.KNOWN_TYPE);
    const { packet, digest, totalBytes } = decoded;
    const { header } = packet;
    const packetId = header.packetId;
    if (context.conflictingDigest && context.conflictingDigest !== digest) {
      return {
        ok: false,
        gate: ValidationGate.DUPLICATE_LOOKUP,
        reason: RejectReason.DIGEST_CONFLICT,
        detail: "same packet ID, different payload digest",
        packetId,
        gatesPassed
      };
    }
    gatesPassed.push(ValidationGate.DUPLICATE_LOOKUP);
    if (header.createdAt > context.nowS + TIME.MAX_FUTURE_S) {
      return {
        ok: false,
        gate: ValidationGate.CLOCK_SANITY,
        reason: RejectReason.CREATED_IN_FUTURE,
        packetId,
        gatesPassed
      };
    }
    if (header.createdAt > context.nowS + TIME.MAX_CLOCK_SKEW_S) {
      warnings.push("created-time ahead of local clock but inside tolerance");
    }
    if (header.expiresAt <= context.nowS) {
      return { ok: false, gate: ValidationGate.CLOCK_SANITY, reason: RejectReason.EXPIRED, packetId, gatesPassed };
    }
    if (header.expiresAt - header.createdAt > TIME.MAX_TTL_S) {
      return {
        ok: false,
        gate: ValidationGate.CLOCK_SANITY,
        reason: RejectReason.CLOCK_IMPLAUSIBLE,
        detail: "TTL beyond the configured maximum",
        packetId,
        gatesPassed
      };
    }
    gatesPassed.push(ValidationGate.CLOCK_SANITY);
    if (header.hopCount >= header.hopLimit) {
      return {
        ok: false,
        gate: ValidationGate.HOP_LIMIT,
        reason: RejectReason.HOP_LIMIT_EXCEEDED,
        detail: `${header.hopCount}/${header.hopLimit}`,
        packetId,
        gatesPassed
      };
    }
    gatesPassed.push(ValidationGate.HOP_LIMIT);
    if (header.fragmentCount === 0 || header.fragmentIndex >= header.fragmentCount) {
      return {
        ok: false,
        gate: ValidationGate.FRAGMENT_LIMITS,
        reason: RejectReason.FRAGMENT_INDEX_INVALID,
        packetId,
        gatesPassed
      };
    }
    gatesPassed.push(ValidationGate.FRAGMENT_LIMITS, ValidationGate.PAYLOAD_INTEGRITY);
    const schema = validateSchema(header.type, packet.payload);
    if (!schema.ok) {
      return {
        ok: false,
        gate: ValidationGate.SCHEMA,
        reason: schema.reason,
        detail: schema.detail,
        packetId,
        gatesPassed
      };
    }
    gatesPassed.push(ValidationGate.SCHEMA);
    if (!rolePermits(header.type, header.sourceClass, header.flags)) {
      return {
        ok: false,
        gate: ValidationGate.SOURCE_ROLE,
        reason: RejectReason.ROLE_NOT_PERMITTED,
        detail: `sourceClass ${header.sourceClass} may not create type 0x${header.type.toString(16)}`,
        packetId,
        gatesPassed
      };
    }
    gatesPassed.push(ValidationGate.SOURCE_ROLE);
    const gatesDeferred = [
      ValidationGate.GEOGRAPHIC_RELEVANCE,
      ValidationGate.USER_PREFERENCE
    ];
    if (context.storagePressure === "critical" && header.priority > 1) {
      return {
        ok: false,
        gate: ValidationGate.RESOURCE_PRESSURE,
        reason: RejectReason.STORAGE_FULL,
        packetId,
        gatesPassed
      };
    }
    if (context.queueDepth >= context.maxQueueDepth && header.priority > 2) {
      return {
        ok: false,
        gate: ValidationGate.RESOURCE_PRESSURE,
        reason: RejectReason.QUEUE_FULL,
        packetId,
        gatesPassed
      };
    }
    gatesPassed.push(ValidationGate.RESOURCE_PRESSURE);
    const isTerminal = TERMINAL_TYPES.has(header.type) || (header.flags & Flags.TERMINAL) !== 0;
    let supersedes = false;
    if (packet.sourceSequence !== void 0 && context.knownSequence !== void 0) {
      if (packet.sourceSequence > context.knownSequence) {
        supersedes = true;
      } else if (!isTerminal) {
        return {
          ok: false,
          gate: ValidationGate.SCHEMA,
          reason: RejectReason.SUPERSEDED,
          detail: `sequence ${packet.sourceSequence} <= known ${context.knownSequence}`,
          packetId,
          gatesPassed
        };
      }
    } else if (packet.sourceSequence !== void 0) {
      supersedes = true;
    }
    if (context.streamTerminated && !isTerminal) {
      return {
        ok: false,
        gate: ValidationGate.SCHEMA,
        reason: RejectReason.TERMINAL_APPLIED,
        detail: "stream already has a terminal record",
        packetId,
        gatesPassed
      };
    }
    return {
      ok: true,
      packet,
      digest,
      totalBytes,
      sourceLabel: sourceLabelFor(header.sourceClass, header.flags),
      isTerminal,
      isSessionControl: SESSION_CONTROL_TYPES.has(header.type),
      supersedes,
      gatesPassed,
      gatesDeferred,
      warnings
    };
  }
  function gateForDecodeReason(reason) {
    switch (reason) {
      case RejectReason.TOO_SHORT:
        return ValidationGate.ENVELOPE_LENGTH;
      case RejectReason.BAD_MAGIC:
        return ValidationGate.ENVELOPE_LENGTH;
      case RejectReason.UNSUPPORTED_VERSION:
        return ValidationGate.PROTOCOL_VERSION;
      case RejectReason.LENGTH_OVER_LIMIT:
      case RejectReason.LENGTH_MISMATCH:
        return ValidationGate.DECLARED_SIZES;
      case RejectReason.HEADER_CRC_FAILED:
        return ValidationGate.HEADER_INTEGRITY;
      case RejectReason.UNKNOWN_TYPE:
        return ValidationGate.KNOWN_TYPE;
      case RejectReason.PAYLOAD_DIGEST_MISMATCH:
        return ValidationGate.PAYLOAD_INTEGRITY;
      default:
        return ValidationGate.SCHEMA;
    }
  }
  function observationFor(result, transport, atMs, extras = {}) {
    return {
      packetId: result.packet.header.packetId,
      transport,
      receivedAtMs: atMs,
      hopCountOnArrival: result.packet.header.hopCount,
      bytes: result.totalBytes,
      ...extras
    };
  }

  // packages/policy/dist/index.js
  var dist_exports4 = {};
  __export(dist_exports4, {
    DefaultPolicyEngine: () => DefaultPolicyEngine,
    defaultPolicyEngine: () => defaultPolicyEngine,
    distanceM: () => distanceM
  });
  function distanceM(aLatE7, aLonE7, bLatE7, bLonE7) {
    const toRad = Math.PI / 180;
    const lat1 = aLatE7 / 1e7 * toRad;
    const lat2 = bLatE7 / 1e7 * toRad;
    const dLat = lat2 - lat1;
    const dLon = (bLonE7 - aLonE7) / 1e7 * toRad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371e3 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  var EMERGENCY_TYPES = /* @__PURE__ */ new Set([
    MessageType.SOS_CREATE,
    MessageType.SOS_UPDATE,
    MessageType.SOS_CANCEL
  ]);
  var RESPONDER_LIFECYCLE = /* @__PURE__ */ new Set([
    MessageType.RESPONDER_ASSIGNED,
    MessageType.RESPONDER_ACCEPTED,
    MessageType.RESPONDER_DECLINED,
    MessageType.RESPONDER_EN_ROUTE,
    MessageType.RESPONDER_ARRIVED,
    MessageType.RESOLVED
  ]);
  var RESOURCE_TYPES2 = /* @__PURE__ */ new Set([
    MessageType.SHELTER,
    MessageType.MEDICAL_POST,
    MessageType.FOOD_WATER,
    MessageType.SAFE_ZONE
  ]);
  var MAP_DELTA_TYPES = /* @__PURE__ */ new Set([
    ...RESOURCE_TYPES2,
    MessageType.HAZARD,
    MessageType.ROUTE_STATE,
    MessageType.RECORD_UPSERT,
    MessageType.RECORD_TOMBSTONE,
    MessageType.CONTENT_ACTIVATE
  ]);
  var DefaultPolicyEngine = class {
    decide(packet, context) {
      const { header } = packet;
      const type = header.type;
      const isOwn = header.sourceId === context.localSourceId;
      const isOwnIncident = packet.streamId !== void 0 && context.ownIncidentIds.has(packet.streamId);
      const isTerminal = TERMINAL_TYPES.has(type) || (header.flags & Flags.TERMINAL) !== 0;
      const isResponder = context.role === "responder";
      if (SESSION_CONTROL_TYPES.has(type)) {
        return outcome({
          store: "discard",
          display: "diagnostics-only",
          alert: "none",
          relay: "never",
          upload: "never",
          act: "none",
          retentionS: 0,
          reasons: {
            store: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
            display: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
            alert: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
            relay: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
            upload: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
            act: PolicyReason.SESSION_CONTROL_NOT_RELAYED
          }
        });
      }
      const distance = this.distanceToSelf(packet, context);
      const withinRadius = distance === void 0 || distance <= context.displayRadiusM;
      let store = "store";
      let storeReason = PolicyReason.RETENTION_WINDOW;
      if (isOwn || isOwnIncident) {
        storeReason = PolicyReason.OWN_PACKET;
      } else if (context.storagePressure === "critical" && header.priority > Priority.RESPONSE_CONTROL) {
        store = "discard";
        storeReason = PolicyReason.STORAGE_RESTRICTED;
      } else if (context.storagePressure === "high" && header.priority >= Priority.FILE_MANIFEST) {
        store = "store-compact";
        storeReason = PolicyReason.STORAGE_RESTRICTED;
      }
      let display;
      let displayReason;
      if (isOwn || isOwnIncident) {
        display = "show-full";
        displayReason = PolicyReason.OWN_INCIDENT;
      } else if (type === MessageType.FILE_FRAGMENT) {
        display = "hide";
        displayReason = PolicyReason.FILE_REQUIRES_EXPLICIT_REQUEST;
      } else if (type === MessageType.LINK_RECEIPT) {
        display = isResponder ? "diagnostics-only" : "diagnostics-only";
        displayReason = PolicyReason.DUPLICATE_SUPPRESSED;
      } else if (EMERGENCY_TYPES.has(type)) {
        if (isResponder) {
          display = "show-full";
          displayReason = PolicyReason.RESPONDER_ROLE;
        } else if (withinRadius && header.severity >= Severity.URGENT) {
          display = "show-minimal";
          displayReason = PolicyReason.WITHIN_DISPLAY_RADIUS;
        } else {
          display = "hide";
          displayReason = withinRadius ? PolicyReason.SEVERITY_BELOW_THRESHOLD : PolicyReason.OUTSIDE_DISPLAY_RADIUS;
        }
      } else if (RESPONDER_LIFECYCLE.has(type)) {
        display = isResponder || isOwnIncident ? "show-full" : "hide";
        displayReason = isResponder ? PolicyReason.RESPONDER_ROLE : PolicyReason.PUBLIC_ROLE_MINIMAL_VIEW;
      } else if (MAP_DELTA_TYPES.has(type) || type === MessageType.OFFICIAL_ALERT) {
        display = withinRadius ? "show-full" : "diagnostics-only";
        displayReason = withinRadius ? PolicyReason.WITHIN_DISPLAY_RADIUS : PolicyReason.OUTSIDE_DISPLAY_RADIUS;
      } else {
        display = "show-minimal";
        displayReason = PolicyReason.WITHIN_DISPLAY_RADIUS;
      }
      const { alert, alertReason } = this.decideAlert(packet, context, {
        isOwn: isOwn || isOwnIncident,
        isResponder,
        withinRadius,
        isTerminal
      });
      let relay;
      let relayReason;
      if (type === MessageType.FILE_FRAGMENT || type === MessageType.FILE_MANIFEST) {
        relay = "requested-only";
        relayReason = PolicyReason.FILE_REQUIRES_EXPLICIT_REQUEST;
      } else if (context.batteryBand <= 0 && header.priority > Priority.RESPONSE_CONTROL) {
        relay = "never";
        relayReason = PolicyReason.BATTERY_RESTRICTED;
      } else if (header.priority <= Priority.RESPONSE_CONTROL || isTerminal) {
        relay = "urgent";
        relayReason = isTerminal ? PolicyReason.TERMINAL_SUPPRESSES_ACTIVE : PolicyReason.COPY_BUDGET_AVAILABLE;
      } else if (header.priority <= Priority.OPERATIONAL) {
        relay = "normal";
        relayReason = PolicyReason.COPY_BUDGET_AVAILABLE;
      } else {
        relay = "opportunistic";
        relayReason = PolicyReason.COPY_BUDGET_AVAILABLE;
      }
      if (relay === "never" && RESOURCE_TYPES2.has(type) && context.batteryBand > 0) {
        relay = "opportunistic";
        relayReason = PolicyReason.OUTSIDE_DISPLAY_RADIUS;
      }
      let upload;
      let uploadReason;
      if (header.sourceClass === SourceClass.BACKEND) {
        upload = "never";
        uploadReason = PolicyReason.ALREADY_BACKEND_ORIGIN;
      } else if (type === MessageType.LINK_RECEIPT || type === MessageType.NETWORK_STATUS_OBSERVATION) {
        upload = "never";
        uploadReason = PolicyReason.NOT_UPLOAD_ELIGIBLE;
      } else if (header.priority <= Priority.RESPONSE_CONTROL) {
        upload = "upload-priority";
        uploadReason = PolicyReason.GATEWAY_PROVEN;
      } else if (header.priority >= Priority.FILE_MANIFEST) {
        upload = "never";
        uploadReason = PolicyReason.NOT_UPLOAD_ELIGIBLE;
      } else {
        upload = "upload-normal";
        uploadReason = PolicyReason.GATEWAY_PROVEN;
      }
      let act;
      let actReason;
      if (MAP_DELTA_TYPES.has(type)) {
        act = "apply-map";
        actReason = PolicyReason.AUTHORITY_SOURCE;
      } else if (EMERGENCY_TYPES.has(type) || RESPONDER_LIFECYCLE.has(type)) {
        act = "update-incident";
        actReason = PolicyReason.OWN_INCIDENT;
      } else if (type === MessageType.CHECKIN_CAMPAIGN) {
        act = "open-checkin";
        actReason = PolicyReason.AUTHORITY_SOURCE;
      } else if (type === MessageType.FILE_FRAGMENT) {
        act = "complete-file";
        actReason = PolicyReason.FILE_REQUIRES_EXPLICIT_REQUEST;
      } else {
        act = "none";
        actReason = PolicyReason.RETENTION_WINDOW;
      }
      const budget = CLASS_BUDGETS[budgetClassFor(type, header.severity)];
      const retentionS = isTerminal ? STORAGE.TOMBSTONE_RETENTION_S : budget.ttlS;
      return outcome({
        store,
        display,
        alert,
        relay,
        upload,
        act,
        retentionS,
        reasons: {
          store: storeReason,
          display: displayReason,
          alert: alertReason,
          relay: relayReason,
          upload: uploadReason,
          act: actReason
        }
      });
    }
    /** 01-... "Notification policy" table, row by row. */
    decideAlert(packet, context, flags) {
      const type = packet.header.type;
      const severity = packet.header.severity;
      if (flags.isOwn) {
        if (type === MessageType.SOS_CREATE)
          return { alert: "normal", alertReason: PolicyReason.OWN_PACKET };
        if (type === MessageType.BACKEND_ACKNOWLEDGEMENT) {
          return { alert: "normal", alertReason: PolicyReason.OWN_INCIDENT };
        }
        if (type === MessageType.LINK_RECEIPT)
          return { alert: "quiet", alertReason: PolicyReason.OWN_PACKET };
        return { alert: "quiet", alertReason: PolicyReason.OWN_INCIDENT };
      }
      if (!context.nonCriticalAlertsEnabled && severity < Severity.LIFE_CRITICAL) {
        return { alert: "silent", alertReason: PolicyReason.PUBLIC_ROLE_MINIMAL_VIEW };
      }
      if (type === MessageType.OFFICIAL_ALERT) {
        return severity >= Severity.URGENT ? { alert: "critical", alertReason: PolicyReason.AUTHORITY_SOURCE } : { alert: "normal", alertReason: PolicyReason.AUTHORITY_SOURCE };
      }
      if (EMERGENCY_TYPES.has(type)) {
        if (flags.isTerminal)
          return { alert: "silent", alertReason: PolicyReason.TERMINAL_SUPPRESSES_ACTIVE };
        if (severity >= Severity.LIFE_CRITICAL && flags.withinRadius) {
          return {
            alert: "critical",
            alertReason: flags.isResponder ? PolicyReason.RESPONDER_ROLE : PolicyReason.SEVERITY_THRESHOLD_MET
          };
        }
        if (flags.isResponder)
          return { alert: "normal", alertReason: PolicyReason.RESPONDER_ROLE };
        return { alert: "silent", alertReason: PolicyReason.SEVERITY_BELOW_THRESHOLD };
      }
      if (type === MessageType.HAZARD || type === MessageType.ROUTE_STATE) {
        if (flags.withinRadius) {
          return severity >= Severity.URGENT ? { alert: "critical", alertReason: PolicyReason.HAZARD_INTERSECTS_AREA } : { alert: "normal", alertReason: PolicyReason.HAZARD_INTERSECTS_AREA };
        }
        return { alert: "silent", alertReason: PolicyReason.OUTSIDE_DISPLAY_RADIUS };
      }
      if (type === MessageType.RESPONDER_ASSIGNED && flags.isResponder) {
        return { alert: "normal", alertReason: PolicyReason.RESPONDER_ROLE };
      }
      if (type === MessageType.CHECKIN_CAMPAIGN) {
        return { alert: "normal", alertReason: PolicyReason.AUTHORITY_SOURCE };
      }
      return { alert: "silent", alertReason: PolicyReason.OUTSIDE_DISPLAY_RADIUS };
    }
    distanceToSelf(packet, context) {
      if (!context.coarseLocation)
        return void 0;
      const geo = packet.geo;
      const payloadLoc = packet.payload.location;
      const latE7 = geo?.latE7 ?? payloadLoc?.latE7;
      const lonE7 = geo?.lonE7 ?? payloadLoc?.lonE7;
      if (latE7 === void 0 || lonE7 === void 0)
        return void 0;
      return distanceM(context.coarseLocation.latE7, context.coarseLocation.lonE7, latE7, lonE7);
    }
  };
  function outcome(o) {
    return o;
  }
  var defaultPolicyEngine = new DefaultPolicyEngine();

  // packages/routing/dist/index.js
  var dist_exports5 = {};
  __export(dist_exports5, {
    DEFAULT_SESSION_LIMITS: () => DEFAULT_SESSION_LIMITS,
    SessionStateMachine: () => SessionStateMachine,
    UTILITY_WEIGHTS: () => UTILITY_WEIGHTS,
    afterTransfer: () => afterTransfer,
    backoffMs: () => backoffMs,
    forwardingUtility: () => forwardingUtility,
    planTransfer: () => planTransfer,
    shouldInitiate: () => shouldInitiate
  });

  // packages/routing/dist/session.js
  var DEFAULT_SESSION_LIMITS = {
    maxDurationMs: SESSION.MAX_DURATION_MS,
    idleTimeoutMs: SESSION.IDLE_TIMEOUT_MS,
    maxBytes: SESSION.MAX_BYTES,
    maxRecords: SESSION.MAX_RECORDS,
    maxInFlight: SESSION.MAX_IN_FLIGHT_RECORDS
  };
  var PHASE_ORDER = [
    "establish",
    "hello",
    "inventory",
    "request",
    "transfer",
    "receipt",
    "reconciliation",
    "close"
  ];
  var SessionStateMachine = class {
    sessionId;
    peerToken;
    initiatedLocally;
    limits;
    phaseIndex = 0;
    startedAtMs;
    lastActivityMs;
    bytes = 0;
    records = 0;
    inFlight = 0;
    closed;
    constructor(sessionId, peerToken, initiatedLocally, nowMs, limits = DEFAULT_SESSION_LIMITS) {
      this.sessionId = sessionId;
      this.peerToken = peerToken;
      this.initiatedLocally = initiatedLocally;
      this.limits = limits;
      this.startedAtMs = nowMs;
      this.lastActivityMs = nowMs;
    }
    get phase() {
      return PHASE_ORDER[this.phaseIndex];
    }
    get isClosed() {
      return this.closed !== void 0;
    }
    get closeReason() {
      return this.closed;
    }
    get bytesTransferred() {
      return this.bytes;
    }
    get recordsTransferred() {
      return this.records;
    }
    advance(nowMs) {
      this.lastActivityMs = nowMs;
      if (this.phaseIndex < PHASE_ORDER.length - 1)
        this.phaseIndex += 1;
      return this.phase;
    }
    /** Protocol range check at the hello phase. */
    negotiate(peerMin, peerMax, localVersion) {
      if (localVersion < peerMin || localVersion > peerMax) {
        this.close("incompatible");
        return false;
      }
      return true;
    }
    /**
     * REL-003: continue only when inventories actually differ. Skipping a
     * pointless session is a feature, not a failure.
     */
    hasUsefulDifference(localIds, peerIds, criticalPending) {
      if (criticalPending > 0)
        return true;
      for (const id of localIds)
        if (!peerIds.has(id))
          return true;
      for (const id of peerIds)
        if (!localIds.has(id))
          return true;
      this.close("no-useful-difference");
      return false;
    }
    /** Flow control: only maxInFlight unacknowledged records at a time. */
    canSend(byteCount) {
      if (this.closed)
        return false;
      if (this.inFlight >= this.limits.maxInFlight)
        return false;
      if (this.records >= this.limits.maxRecords)
        return false;
      if (this.bytes + byteCount > this.limits.maxBytes)
        return false;
      return true;
    }
    recordSent(byteCount, nowMs) {
      this.inFlight += 1;
      this.bytes += byteCount;
      this.lastActivityMs = nowMs;
    }
    /**
     * A receipt is issued only after complete parsing, integrity validation, and
     * durable acceptance (02-...). Transport write success is NOT acceptance.
     */
    recordAcknowledged(nowMs) {
      this.inFlight = Math.max(0, this.inFlight - 1);
      this.records += 1;
      this.lastActivityMs = nowMs;
    }
    /** Control records may interrupt fragment batches. */
    allowControlInterrupt() {
      return !this.closed;
    }
    /** Returns a close reason when any bound is exceeded. */
    checkBudgets(nowMs) {
      if (this.closed)
        return this.closed;
      if (nowMs - this.startedAtMs > this.limits.maxDurationMs)
        return this.close("duration-budget");
      if (nowMs - this.lastActivityMs > this.limits.idleTimeoutMs)
        return this.close("idle-timeout");
      if (this.bytes >= this.limits.maxBytes)
        return this.close("byte-budget");
      return void 0;
    }
    close(reason) {
      this.closed ??= reason;
      this.phaseIndex = PHASE_ORDER.length - 1;
      return this.closed;
    }
  };

  // packages/routing/dist/index.js
  var UTILITY_WEIGHTS = {
    gatewayProven: 0.3,
    novelty: 0.2,
    urgency: 0.25,
    linkReliability: 0.1,
    age: 0.1,
    batterySuitability: 0.05
  };
  function forwardingUtility(candidate, ctx) {
    const { packet, custody } = candidate;
    const header = packet.header;
    if (ctx.peerInventory.has(candidate.packetId)) {
      return refuse(PolicyReason.NEIGHBOR_ALREADY_HAS);
    }
    if (custody.knownHolders.includes(ctx.peer.peerToken)) {
      return refuse(PolicyReason.NEIGHBOR_ALREADY_HAS);
    }
    if (ctx.previousHopByPacket.get(candidate.packetId) === ctx.peer.peerToken) {
      return refuse(PolicyReason.NEIGHBOR_ALREADY_HAS);
    }
    if (custody.copyBudgetRemaining <= 0) {
      return refuse(PolicyReason.COPY_BUDGET_EXHAUSTED);
    }
    if (custody.nextEligibleAtMs !== void 0 && custody.nextEligibleAtMs > ctx.nowMs) {
      return refuse(PolicyReason.COOLDOWN_ACTIVE);
    }
    if (header.hopCount >= header.hopLimit) {
      return refuse(PolicyReason.COPY_BUDGET_EXHAUSTED);
    }
    if (ctx.localBatteryBand <= 0 && header.priority > Priority.RESPONSE_CONTROL) {
      return refuse(PolicyReason.BATTERY_RESTRICTED);
    }
    const gatewayFresh = ctx.peer.gatewayProven && ctx.nowMs - ctx.peer.lastSeenAtMs <= FRESHNESS.GATEWAY_PROOF_S * 1e3;
    const gateway = gatewayFresh && isUploadEligible(header.priority) ? 1 : 0;
    const attempts = ctx.peer.sessionsCompleted + ctx.peer.sessionsFailed;
    const reliability = attempts === 0 ? 0.5 : ctx.peer.sessionsCompleted / attempts;
    const budget = CLASS_BUDGETS[budgetClassFor(header.type, header.severity)];
    const novelty = Math.max(0, 1 - custody.copiesMade / Math.max(1, budget.copyBudget));
    const urgency = 1 - header.priority / 7;
    const ageS = Math.max(0, ctx.nowMs / 1e3 - header.createdAt);
    const ttl = Math.max(1, header.expiresAt - header.createdAt);
    const age = Math.min(1, ageS / ttl);
    const battery = ctx.localBatteryBand / 3;
    const components = {
      gateway: gateway * UTILITY_WEIGHTS.gatewayProven,
      novelty: novelty * UTILITY_WEIGHTS.novelty,
      urgency: urgency * UTILITY_WEIGHTS.urgency,
      reliability: reliability * UTILITY_WEIGHTS.linkReliability,
      age: age * UTILITY_WEIGHTS.age,
      battery: battery * UTILITY_WEIGHTS.batterySuitability
    };
    const utility = Object.values(components).reduce((a, b) => a + b, 0);
    return {
      forward: true,
      utility: Math.min(1, utility),
      reason: gateway > 0 ? PolicyReason.GATEWAY_PROVEN : PolicyReason.COPY_BUDGET_AVAILABLE,
      components
    };
  }
  function refuse(reason) {
    return { forward: false, utility: 0, reason, components: {} };
  }
  function isUploadEligible(priority) {
    return priority <= Priority.GENERAL_UPDATE;
  }
  function planTransfer(candidates, ctx, options = {}) {
    const maxRecords = options.maxRecords ?? SESSION.MAX_RECORDS;
    const maxBytes = options.maxBytes ?? SESSION.MAX_BYTES;
    const scored = [];
    const skipped = [];
    for (const candidate of candidates) {
      const decision = forwardingUtility(candidate, ctx);
      if (decision.forward)
        scored.push({ candidate, decision });
      else
        skipped.push({ packetId: candidate.packetId, reason: decision.reason });
    }
    scored.sort((a, b) => {
      const pa = a.candidate.packet.header.priority;
      const pb = b.candidate.packet.header.priority;
      if (pa !== pb)
        return pa - pb;
      if (a.decision.utility !== b.decision.utility)
        return b.decision.utility - a.decision.utility;
      return a.candidate.packet.header.createdAt - b.candidate.packet.header.createdAt;
    });
    const fileReserveRecords = Math.max(1, Math.floor(maxRecords * 0.25));
    const nonFileLimit = maxRecords - fileReserveRecords;
    const offers = [];
    let bytes = 0;
    let fileRecords = 0;
    let normalRecords = 0;
    for (const entry of scored) {
      const isFile = entry.candidate.packet.header.priority >= Priority.FILE_MANIFEST;
      const size = entry.candidate.packet.header.payloadLength + 64;
      if (bytes + size > maxBytes) {
        skipped.push({ packetId: entry.candidate.packetId, reason: PolicyReason.CONGESTION_PREEMPTED });
        continue;
      }
      if (isFile && fileRecords >= fileReserveRecords) {
        skipped.push({ packetId: entry.candidate.packetId, reason: PolicyReason.CONGESTION_PREEMPTED });
        continue;
      }
      if (!isFile && normalRecords >= nonFileLimit) {
        skipped.push({ packetId: entry.candidate.packetId, reason: PolicyReason.CONGESTION_PREEMPTED });
        continue;
      }
      offers.push(entry);
      bytes += size;
      if (isFile)
        fileRecords += 1;
      else
        normalRecords += 1;
      if (offers.length >= maxRecords)
        break;
    }
    return { offers, skipped, totalBytes: bytes };
  }
  function afterTransfer(custody, peerToken, nowMs, type, severity) {
    const budget = CLASS_BUDGETS[budgetClassFor(type, severity)];
    return {
      ...custody,
      state: "sent",
      copiesMade: custody.copiesMade + 1,
      copyBudgetRemaining: Math.max(0, custody.copyBudgetRemaining - 1),
      lastOfferedAtMs: nowMs,
      nextEligibleAtMs: nowMs + budget.retryCooldownS * 1e3,
      knownHolders: custody.knownHolders.includes(peerToken) ? custody.knownHolders : [...custody.knownHolders, peerToken]
    };
  }
  function backoffMs(consecutiveFailures, random = Math.random) {
    const base = Math.min(SESSION.BACKOFF_MAX_MS, SESSION.BACKOFF_BASE_MS * 2 ** Math.min(10, consecutiveFailures));
    return base + Math.floor(random() * SESSION.BACKOFF_JITTER_MS);
  }
  function shouldInitiate(localToken, peerToken) {
    return localToken < peerToken;
  }

  // packages/store/dist/index.js
  var dist_exports6 = {};
  __export(dist_exports6, {
    MemoryEventSink: () => MemoryEventSink,
    MemoryFileRepository: () => MemoryFileRepository,
    MemoryIncidentRepository: () => MemoryIncidentRepository,
    MemoryMapObjectRepository: () => MemoryMapObjectRepository,
    MemoryPacketRepository: () => MemoryPacketRepository,
    MemoryPeerRepository: () => MemoryPeerRepository,
    NULL_EVENT_SINK: () => NULL_EVENT_SINK
  });

  // packages/store/dist/memory-store.js
  var MemoryPacketRepository = class {
    slots = /* @__PURE__ */ new Map();
    /** Survives payload eviction so duplicates stay suppressed (02-...). */
    seen = /* @__PURE__ */ new Map();
    fragments = /* @__PURE__ */ new Map();
    async insert(stored, observation, custody) {
      const id = stored.packet.header.packetId;
      const known = this.seen.get(id);
      if (known) {
        if (known.digest !== stored.digest)
          return "conflict";
        const slot = this.slots.get(id);
        if (slot)
          slot.observations.push(observation);
        return "duplicate";
      }
      if (this.slots.size >= STORAGE.MAX_STORED_PACKETS) {
        await this.evictOne(stored.packet.header.priority);
      }
      this.slots.set(id, { stored, custody, observations: [observation] });
      this.seen.set(id, { digest: stored.digest, atMs: stored.storedAtMs });
      return "inserted";
    }
    async get(packetId) {
      return this.slots.get(packetId)?.stored;
    }
    async hasSeen(packetId) {
      return this.seen.has(packetId);
    }
    async getDigest(packetId) {
      return this.seen.get(packetId)?.digest;
    }
    async listAll() {
      return [...this.slots.values()].map((slot) => slot.stored);
    }
    async addObservation(observation) {
      this.slots.get(observation.packetId)?.observations.push(observation);
    }
    async listObservations(packetId) {
      return this.slots.get(packetId)?.observations ?? [];
    }
    async getCustody(packetId) {
      return this.slots.get(packetId)?.custody;
    }
    async updateCustody(record) {
      const slot = this.slots.get(record.packetId);
      if (slot)
        slot.custody = record;
    }
    async listRelayable(limit) {
      const now = Date.now();
      const eligible = [...this.slots.values()].filter((slot) => {
        const c = slot.custody;
        if (c.copyBudgetRemaining <= 0)
          return false;
        if (c.state === "expired" || c.state === "invalid" || c.state === "evicted")
          return false;
        if (c.nextEligibleAtMs !== void 0 && c.nextEligibleAtMs > now)
          return false;
        return true;
      });
      eligible.sort((a, b) => {
        const pa = a.stored.packet.header.priority;
        const pb = b.stored.packet.header.priority;
        if (pa !== pb)
          return pa - pb;
        return a.stored.packet.header.createdAt - b.stored.packet.header.createdAt;
      });
      return eligible.slice(0, limit).map((slot) => slot.custody);
    }
    async listUploadQueue(limit) {
      const queued = [...this.slots.values()].filter((slot) => slot.custody.uploadState === "queued");
      queued.sort((a, b) => a.stored.packet.header.priority - b.stored.packet.header.priority);
      return queued.slice(0, limit).map((slot) => slot.custody);
    }
    async putFragment(fragment) {
      let group = this.fragments.get(fragment.objectId);
      if (!group) {
        if (this.fragments.size >= STORAGE.MAX_INCOMPLETE_OBJECTS) {
          throw new Error("too many incomplete objects");
        }
        group = /* @__PURE__ */ new Map();
        this.fragments.set(fragment.objectId, group);
      }
      if (group.size >= STORAGE.MAX_FRAGMENTS_PER_OBJECT && !group.has(fragment.index)) {
        throw new Error("fragment count over limit");
      }
      group.set(fragment.index, fragment);
    }
    async listFragments(objectId) {
      const group = this.fragments.get(objectId);
      if (!group)
        return [];
      return [...group.values()].sort((a, b) => a.index - b.index);
    }
    async dropFragments(objectId) {
      this.fragments.delete(objectId);
    }
    async evictExpired(nowS) {
      let removed = 0;
      for (const [id, slot] of this.slots) {
        if (slot.stored.retentionUntilS <= nowS) {
          this.slots.delete(id);
          removed += 1;
        }
      }
      const cutoffMs = (nowS - STORAGE.SEEN_ID_RETENTION_S) * 1e3;
      for (const [id, entry] of this.seen) {
        if (entry.atMs < cutoffMs && !this.slots.has(id)) {
          this.seen.delete(id);
          removed += 1;
        }
      }
      return removed;
    }
    async count() {
      return this.slots.size;
    }
    /**
     * 02-... "Storage pressure" eviction order. Never evicts the user's own
     * active SOS, critical control, or a terminal suppression record before
     * optional data.
     */
    async evictOne(incomingPriority) {
      const candidates = [...this.slots.values()].filter((slot) => {
        const p = slot.stored.packet.header.priority;
        if (p <= Priority.RESPONSE_CONTROL)
          return false;
        if (slot.custody.state === "created-locally")
          return false;
        return true;
      }).sort((a, b) => {
        const pa = a.stored.packet.header.priority;
        const pb = b.stored.packet.header.priority;
        if (pa !== pb)
          return pb - pa;
        return a.stored.storedAtMs - b.stored.storedAtMs;
      });
      const victim = candidates[0];
      if (!victim) {
        if (incomingPriority > Priority.RESPONSE_CONTROL)
          throw new Error("storage full, nothing evictable");
        return;
      }
      this.slots.delete(victim.stored.packet.header.packetId);
    }
  };
  var MemoryIncidentRepository = class {
    incidents = /* @__PURE__ */ new Map();
    events = /* @__PURE__ */ new Map();
    async upsert(record) {
      this.incidents.set(record.incidentId, record);
    }
    async get(incidentId) {
      return this.incidents.get(incidentId);
    }
    async list() {
      return [...this.incidents.values()];
    }
    async appendEvent(event) {
      const list = this.events.get(event.incidentId) ?? [];
      list.push(event);
      this.events.set(event.incidentId, list);
    }
    async listEvents(incidentId) {
      return [...this.events.get(incidentId) ?? []].sort((a, b) => a.atS - b.atS);
    }
  };
  var MemoryPeerRepository = class {
    peers = /* @__PURE__ */ new Map();
    async observe(record) {
      this.peers.set(record.peerToken, record);
    }
    async list(nowMs) {
      const cutoff = nowMs - STORAGE.PEER_OBSERVATION_RETENTION_S * 1e3;
      return [...this.peers.values()].filter((p) => p.lastSeenAtMs >= cutoff);
    }
    async get(peerToken) {
      return this.peers.get(peerToken);
    }
    async evictStale(nowMs) {
      const cutoff = nowMs - STORAGE.PEER_OBSERVATION_RETENTION_S * 1e3;
      let removed = 0;
      for (const [token, peer] of this.peers) {
        if (peer.lastSeenAtMs < cutoff) {
          this.peers.delete(token);
          removed += 1;
        }
      }
      return removed;
    }
  };
  var MemoryFileRepository = class {
    files = /* @__PURE__ */ new Map();
    async putManifest(file) {
      if (!ACCEPTED_MIME_CATEGORIES.has(file.mimeCategory))
        return false;
      if (file.totalBytes > STORAGE.MAX_FILE_BYTES)
        return false;
      if (file.fragmentCount < 1 || file.fragmentCount > STORAGE.MAX_FRAGMENTS_PER_OBJECT)
        return false;
      const existing = this.files.get(file.fileId);
      if (existing?.visible)
        return true;
      if (!existing && this.files.size >= STORAGE.MAX_INCOMPLETE_OBJECTS)
        return false;
      this.files.set(file.fileId, file);
      return true;
    }
    async getManifest(fileId) {
      return this.files.get(fileId);
    }
    async markComplete(fileId, bytes, atMs) {
      const file = this.files.get(fileId);
      if (!file)
        return;
      this.files.set(fileId, { ...file, bytes, visible: true, completedAtMs: atMs });
    }
    async listVisible() {
      return [...this.files.values()].filter((f) => f.visible);
    }
    async missingFragments(fileId, held) {
      const file = this.files.get(fileId);
      if (!file)
        return [];
      const have = new Set(held);
      const missing = [];
      for (let i = 0; i < file.fragmentCount; i += 1)
        if (!have.has(i))
          missing.push(i);
      return missing;
    }
    async evictExpired(nowS) {
      let removed = 0;
      for (const [id, file] of this.files) {
        if (file.expiresAtS <= nowS) {
          this.files.delete(id);
          removed += 1;
        }
      }
      return removed;
    }
  };
  var MemoryMapObjectRepository = class {
    objects = /* @__PURE__ */ new Map();
    async upsert(record) {
      this.objects.set(record.objectId, record);
    }
    async remove(objectId) {
      this.objects.delete(objectId);
    }
    async list() {
      return [...this.objects.values()];
    }
    async replaceAll(records) {
      this.objects.clear();
      for (const record of records)
        this.objects.set(record.objectId, record);
    }
  };

  // packages/store/dist/event-log.js
  var MemoryEventSink = class {
    maxEntries;
    events = [];
    constructor(maxEntries = STORAGE.MAX_EVENT_LOG_ENTRIES) {
      this.maxEntries = maxEntries;
    }
    emit(event) {
      this.events.push(event);
      if (this.events.length > this.maxEntries) {
        this.events.splice(0, this.events.length - this.maxEntries);
      }
    }
    recent(limit) {
      return this.events.slice(-limit).reverse();
    }
    clear() {
      this.events.length = 0;
    }
    /** Everything, oldest first. Used by the evidence exporter. */
    all() {
      return [...this.events];
    }
  };
  var NULL_EVENT_SINK = {
    emit() {
    },
    recent() {
      return [];
    },
    clear() {
    }
  };

  // packages/incident/dist/index.js
  var dist_exports7 = {};
  __export(dist_exports7, {
    IncidentReducer: () => IncidentReducer,
    deliveryStatesFor: () => deliveryStatesFor
  });
  var ALLOWED_NEXT = {
    draft: ["created", "cancelled"],
    created: ["active", "assigned", "cancelled", "expired"],
    active: ["assigned", "cancelled", "expired", "resolved"],
    assigned: ["accepted", "active", "cancelled", "resolved", "expired"],
    accepted: ["en-route", "arrived", "cancelled", "resolved"],
    "en-route": ["arrived", "cancelled", "resolved"],
    arrived: ["resolved", "cancelled"],
    resolved: ["reopened"],
    cancelled: [],
    expired: ["reopened"],
    reopened: ["active", "assigned", "resolved", "cancelled"]
  };
  function canTransition(from, to) {
    return ALLOWED_NEXT[from].includes(to);
  }
  var IncidentReducer = class {
    incidents = /* @__PURE__ */ new Map();
    peerReceipts = /* @__PURE__ */ new Map();
    apply(packet, options) {
      const incidentId = this.incidentIdFor(packet);
      if (!incidentId)
        return void 0;
      const existing = this.incidents.get(incidentId) ?? this.create(incidentId, packet, options);
      this.incidents.set(incidentId, existing);
      const atS = packet.header.createdAt;
      const seq = packet.sourceSequence;
      const payload = packet.payload;
      const isSourceStream = packet.header.type === MessageType.SOS_CREATE || packet.header.type === MessageType.SOS_UPDATE || packet.header.type === MessageType.SOS_CANCEL;
      const superseded = isSourceStream && seq !== void 0 && seq <= existing.latestSourceSequence;
      switch (packet.header.type) {
        case MessageType.SOS_CREATE: {
          if (!superseded) {
            existing.severity = packet.header.severity;
            existing.category = numberOf(payload["category"]) ?? existing.category;
            existing.peopleTotal = numberOf(payload["peopleTotal"]);
            existing.injured = numberOf(payload["injured"]);
            existing.mobility = numberOf(payload["mobility"]);
            existing.shortNote = stringOf(payload["shortNote"]);
            this.applyLocation(existing, payload, packet);
            existing.latestSourceSequence = seq ?? existing.latestSourceSequence;
            if (existing.state === "draft")
              existing.state = "created";
            if (existing.state === "created")
              existing.state = "active";
          }
          existing.delivery.savedLocallyAtS ??= atS;
          break;
        }
        case MessageType.SOS_UPDATE: {
          if (!superseded) {
            if (payload["category"] !== void 0)
              existing.category = numberOf(payload["category"]);
            if (payload["peopleTotal"] !== void 0)
              existing.peopleTotal = numberOf(payload["peopleTotal"]);
            if (payload["injured"] !== void 0)
              existing.injured = numberOf(payload["injured"]);
            if (payload["mobility"] !== void 0)
              existing.mobility = numberOf(payload["mobility"]);
            if (payload["shortNote"] !== void 0)
              existing.shortNote = stringOf(payload["shortNote"]);
            if (payload["location"] !== void 0)
              this.applyLocation(existing, payload, packet);
            existing.severity = packet.header.severity;
            existing.latestSourceSequence = seq ?? existing.latestSourceSequence;
          }
          break;
        }
        case MessageType.SOS_CANCEL: {
          if (canTransition(existing.state, "cancelled"))
            existing.state = "cancelled";
          existing.delivery.cancelledAtS = atS;
          break;
        }
        case MessageType.RESPONDER_ASSIGNED: {
          existing.assignmentId = stringOf(payload["assignmentId"]);
          existing.responderRef = stringOf(payload["responderRef"]);
          if (canTransition(existing.state, "assigned"))
            existing.state = "assigned";
          existing.delivery.assignedAtS = atS;
          existing.delivery.responderSeenAtS ??= atS;
          break;
        }
        case MessageType.RESPONDER_ACCEPTED: {
          if (canTransition(existing.state, "accepted"))
            existing.state = "accepted";
          existing.delivery.acceptedAtS = atS;
          existing.delivery.responderSeenAtS ??= atS;
          break;
        }
        case MessageType.RESPONDER_DECLINED: {
          if (canTransition(existing.state, "active"))
            existing.state = "active";
          existing.assignmentId = void 0;
          existing.responderRef = void 0;
          break;
        }
        case MessageType.RESPONDER_EN_ROUTE: {
          if (canTransition(existing.state, "en-route"))
            existing.state = "en-route";
          existing.delivery.enRouteAtS = atS;
          break;
        }
        case MessageType.RESPONDER_ARRIVED: {
          if (canTransition(existing.state, "arrived"))
            existing.state = "arrived";
          existing.delivery.arrivedAtS = atS;
          break;
        }
        case MessageType.RESOLVED: {
          if (canTransition(existing.state, "resolved"))
            existing.state = "resolved";
          existing.delivery.resolvedAtS = atS;
          break;
        }
        case MessageType.LINK_RECEIPT: {
          const token = stringOf(payload["receivingNodeToken"]) ?? options.viaPeerToken;
          if (token) {
            const set = this.peerReceipts.get(incidentId) ?? /* @__PURE__ */ new Set();
            set.add(token);
            this.peerReceipts.set(incidentId, set);
          }
          break;
        }
        case MessageType.BACKEND_ACKNOWLEDGEMENT: {
          existing.delivery.backendAcceptedAtS = atS;
          existing.delivery.uploadedAtS ??= atS;
          break;
        }
        default:
          break;
      }
      existing.updatedAtS = Math.max(existing.updatedAtS, atS);
      existing.timeline.push({
        packetId: packet.header.packetId,
        messageType: packet.header.type,
        atS,
        sourceClass: packet.header.sourceClass,
        ...seq !== void 0 ? { sourceSequence: seq } : {},
        active: !superseded,
        summary: summarize(packet)
      });
      if (superseded) {
        existing.timeline[existing.timeline.length - 1] = {
          ...existing.timeline[existing.timeline.length - 1],
          active: false
        };
      }
      return this.view(incidentId);
    }
    /** Marks incidents whose expiry passed. Never invents a new identity. */
    expireOlderThan(nowS, maxAgeS) {
      const expired = [];
      for (const [id, inc] of this.incidents) {
        const terminal = inc.state === "resolved" || inc.state === "cancelled" || inc.state === "expired";
        if (!terminal && nowS - inc.updatedAtS > maxAgeS) {
          inc.state = "expired";
          expired.push(id);
        }
      }
      return expired;
    }
    view(incidentId) {
      const inc = this.incidents.get(incidentId);
      if (!inc)
        return void 0;
      return {
        incidentId,
        state: inc.state,
        severity: inc.severity,
        category: inc.category,
        peopleTotal: inc.peopleTotal,
        injured: inc.injured,
        mobility: inc.mobility,
        shortNote: inc.shortNote,
        latE7: inc.latE7,
        lonE7: inc.lonE7,
        locationAccuracyM: inc.locationAccuracyM,
        locationAgeS: inc.locationAgeS,
        locationReportedAtS: inc.locationReportedAtS,
        locationSource: inc.locationSource,
        createdAtS: inc.createdAtS,
        updatedAtS: inc.updatedAtS,
        latestSourceSequence: inc.latestSourceSequence,
        ownedLocally: inc.ownedLocally,
        assignmentId: inc.assignmentId,
        responderRef: inc.responderRef,
        delivery: {
          ...inc.delivery,
          distinctPeerReceipts: this.peerReceipts.get(incidentId)?.size ?? 0
        },
        timeline: [...inc.timeline].sort((a, b) => a.atS - b.atS)
      };
    }
    list() {
      return [...this.incidents.keys()].map((id) => this.view(id)).filter(Boolean);
    }
    incidentIdFor(packet) {
      const payload = packet.payload;
      const direct = stringOf(payload["incidentId"]);
      if (direct)
        return direct;
      if (packet.header.type === MessageType.LINK_RECEIPT)
        return void 0;
      if (packet.header.type === MessageType.BACKEND_ACKNOWLEDGEMENT)
        return stringOf(payload["incidentId"]);
      return void 0;
    }
    create(incidentId, packet, options) {
      return {
        incidentId,
        state: "draft",
        severity: packet.header.severity ?? Severity.INFO,
        category: 0,
        createdAtS: packet.header.createdAt,
        updatedAtS: packet.header.createdAt,
        latestSourceSequence: 0,
        ownedLocally: packet.header.sourceId === options.localSourceId,
        delivery: { distinctPeerReceipts: 0 },
        timeline: []
      };
    }
    applyLocation(target, payload, packet) {
      const loc = payload["location"];
      const latE7 = numberOf(loc?.["latE7"]) ?? packet.geo?.latE7;
      const lonE7 = numberOf(loc?.["lonE7"]) ?? packet.geo?.lonE7;
      if (latE7 === void 0 || lonE7 === void 0)
        return;
      target.latE7 = latE7;
      target.lonE7 = lonE7;
      target.locationAccuracyM = numberOf(loc?.["accuracyM"]) ?? packet.geo?.accuracyM;
      target.locationAgeS = numberOf(loc?.["ageS"]);
      target.locationReportedAtS = packet.header.createdAt;
      target.locationSource = numberOf(loc?.["source"]);
    }
  };
  function numberOf(value) {
    return typeof value === "number" ? value : void 0;
  }
  function stringOf(value) {
    return typeof value === "string" ? value : void 0;
  }
  function summarize(packet) {
    const names = {
      [MessageType.SOS_CREATE]: "SOS created",
      [MessageType.SOS_UPDATE]: "SOS updated",
      [MessageType.SOS_CANCEL]: "SOS cancelled by source",
      [MessageType.RESPONDER_ASSIGNED]: "Responder assigned",
      [MessageType.RESPONDER_ACCEPTED]: "Responder accepted",
      [MessageType.RESPONDER_DECLINED]: "Responder declined",
      [MessageType.RESPONDER_EN_ROUTE]: "Responder en route",
      [MessageType.RESPONDER_ARRIVED]: "Responder reported arriving",
      [MessageType.RESOLVED]: "Marked resolved",
      [MessageType.LINK_RECEIPT]: "Copied to a nearby phone",
      [MessageType.BACKEND_ACKNOWLEDGEMENT]: "Coordination centre received it"
    };
    return names[packet.header.type] ?? "Update received";
  }
  function deliveryStatesFor(view) {
    const d = view.delivery;
    const states = [];
    if (d.savedLocallyAtS !== void 0)
      states.push("saved-locally");
    if (d.distinctPeerReceipts > 0)
      states.push("copied-to-peer");
    if (d.responderSeenAtS !== void 0)
      states.push("seen-by-responder");
    if (d.uploadedAtS !== void 0)
      states.push("uploaded-via-gateway");
    if (d.backendAcceptedAtS !== void 0)
      states.push("accepted-by-backend");
    if (d.assignedAtS !== void 0)
      states.push("responder-assigned");
    if (d.acceptedAtS !== void 0)
      states.push("responder-accepted");
    if (d.enRouteAtS !== void 0)
      states.push("responder-en-route");
    if (d.arrivedAtS !== void 0)
      states.push("responder-arrived");
    if (d.resolvedAtS !== void 0)
      states.push("resolved");
    if (d.cancelledAtS !== void 0)
      states.push("cancelled");
    return states;
  }

  // packages/mapkit/dist/index.js
  var dist_exports8 = {};
  __export(dist_exports8, {
    MapProjection: () => MapProjection,
    PackResolver: () => PackResolver,
    freshnessOf: () => freshnessOf,
    loadContentPack: () => loadContentPack,
    toMapOperations: () => toMapOperations
  });

  // packages/mapkit/dist/content-pack.js
  var PackResolver = class {
    pack;
    byId = /* @__PURE__ */ new Map();
    routesById = /* @__PURE__ */ new Map();
    formsById = /* @__PURE__ */ new Map();
    constructor(pack) {
      this.pack = pack;
      for (const object of pack.objects)
        this.byId.set(object.objectId, object);
      for (const route of pack.routes)
        this.routesById.set(route.objectId, route);
      for (const form of pack.forms)
        this.formsById.set(form.objectId, form);
    }
    get manifest() {
      return this.pack.manifest;
    }
    resolve(objectId, expectedType) {
      const object = this.byId.get(objectId);
      if (!object)
        return void 0;
      if (expectedType && object.type !== expectedType)
        return void 0;
      return object;
    }
    resolveRoute(objectId) {
      return this.routesById.get(objectId);
    }
    resolveForm(objectId) {
      return this.formsById.get(objectId);
    }
    phrase(phraseId, language) {
      const entry = this.pack.phrases.find((p) => p.phraseId === phraseId);
      return entry?.text[language] ?? entry?.text["en"];
    }
    /** True when a coordinate falls inside the pack's declared bounds. */
    withinBounds(latE7, lonE7) {
      const b = this.pack.manifest.bounds;
      return latE7 >= b.minLatE7 && latE7 <= b.maxLatE7 && lonE7 >= b.minLonE7 && lonE7 <= b.maxLonE7;
    }
    /** OFF-006: readiness is reported, never assumed. */
    isReady() {
      return this.pack.manifest.readiness === "ready";
    }
  };
  function loadContentPack(raw) {
    if (typeof raw !== "object" || raw === null)
      throw new Error("content pack must be an object");
    const pack = raw;
    if (!pack.manifest)
      throw new Error("content pack is missing its manifest");
    if (!Array.isArray(pack.objects))
      throw new Error("content pack is missing its object registry");
    return {
      manifest: pack.manifest,
      objects: pack.objects,
      routes: pack.routes ?? [],
      forms: pack.forms ?? [],
      phrases: pack.phrases ?? []
    };
  }

  // packages/mapkit/dist/projection.js
  function provenanceFor(transport) {
    switch (transport) {
      case "tier1-ble":
      case "tier1-classic":
        return "tier1";
      case "tier2-mic":
      case "tier2-direct":
        return "tier2";
      case "gateway":
        return "gateway";
      default:
        return "local";
    }
  }
  function freshnessOf(asOfS, nowS) {
    const age = nowS - asOfS;
    if (age <= FRESHNESS.LOCATION_LIVE_S)
      return "live";
    if (age <= FRESHNESS.LOCATION_STALE_S)
      return "aging";
    if (age <= FRESHNESS.LOCATION_EXPIRE_S)
      return "stale";
    return "expired";
  }
  var MapProjection = class {
    resolver;
    objects = /* @__PURE__ */ new Map();
    events = [];
    missingObjectIds = /* @__PURE__ */ new Set();
    constructor(resolver) {
      this.resolver = resolver;
    }
    apply(op) {
      const result = this.applyInner(op);
      this.events.push({
        ...result,
        atS: op.appliedAtS,
        operation: op.kind,
        transport: op.transport
      });
      if (this.events.length > 500)
        this.events.splice(0, this.events.length - 500);
      return result;
    }
    applyInner(op) {
      const key = this.keyFor(op);
      if (!key) {
        return { applied: false, reason: ProjectionReason.UNSUPPORTED_OPERATION };
      }
      const existing = this.objects.get(key);
      if (existing?.tombstoned && op.kind !== "tombstone-object" && op.version <= existing.version) {
        return { applied: false, reason: ProjectionReason.IGNORED_TOMBSTONED, objectId: existing.objectId };
      }
      if (existing && op.version < existing.version) {
        return {
          applied: false,
          reason: ProjectionReason.IGNORED_OLDER_VERSION,
          objectId: existing.objectId,
          previousVersion: existing.version
        };
      }
      if (existing && op.version === existing.version && existing.causedByPacketId === op.causedByPacketId) {
        return { applied: false, reason: ProjectionReason.IGNORED_IDENTICAL, objectId: existing.objectId };
      }
      const built = this.build(op, existing);
      if (!built)
        return { applied: false, reason: ProjectionReason.UNSUPPORTED_OPERATION };
      this.objects.set(key, built.object);
      return {
        applied: true,
        reason: built.reason,
        objectId: built.object.objectId,
        ...existing ? { previousVersion: existing.version } : {},
        newVersion: built.object.version
      };
    }
    build(op, existing) {
      const provenance = provenanceFor(op.transport);
      const base = {
        version: op.version,
        provenance,
        causedByPacketId: op.causedByPacketId,
        asOfS: op.appliedAtS,
        tombstoned: false,
        ...op.expiresAtS !== void 0 ? { expiresAtS: op.expiresAtS } : {}
      };
      const conflicting = existing && existing.provenance !== provenance && existing.version === op.version ? { conflictingSources: [existing.provenance, provenance] } : {};
      switch (op.kind) {
        case "upsert-resource": {
          const packObject = this.resolver?.resolve(op.objectId);
          const missing = !packObject && !op.temporary;
          if (missing)
            this.missingObjectIds.add(op.objectId);
          return {
            object: {
              ...base,
              ...conflicting,
              objectId: op.objectId,
              kind: "resource",
              label: packObject?.name ?? op.fallbackLabel ?? op.objectId,
              ...op.latE7 !== void 0 ? { latE7: op.latE7 } : packObject?.latE7 !== void 0 ? { latE7: packObject.latE7 } : {},
              ...op.lonE7 !== void 0 ? { lonE7: op.lonE7 } : packObject?.lonE7 !== void 0 ? { lonE7: packObject.lonE7 } : {},
              state: op.state,
              ...op.capacityBand !== void 0 ? { capacityBand: op.capacityBand } : {},
              missingFromPack: missing
            },
            reason: missing ? ProjectionReason.MISSING_OBJECT_FALLBACK : op.temporary ? ProjectionReason.APPLIED_AS_TEMPORARY : ProjectionReason.APPLIED
          };
        }
        case "set-resource-state":
        case "set-capacity": {
          if (!existing) {
            const packObject = this.resolver?.resolve(op.objectId);
            if (!packObject)
              this.missingObjectIds.add(op.objectId);
            return {
              object: {
                ...base,
                objectId: op.objectId,
                kind: "resource",
                label: packObject?.name ?? op.fallbackLabel ?? op.objectId,
                ...packObject?.latE7 !== void 0 ? { latE7: packObject.latE7 } : {},
                ...packObject?.lonE7 !== void 0 ? { lonE7: packObject.lonE7 } : {},
                ...op.kind === "set-resource-state" ? { state: op.state } : { capacityBand: op.capacityBand },
                missingFromPack: !packObject
              },
              reason: packObject ? ProjectionReason.APPLIED : ProjectionReason.MISSING_OBJECT_FALLBACK
            };
          }
          return {
            object: {
              ...existing,
              ...base,
              ...conflicting,
              ...op.kind === "set-resource-state" ? { state: op.state } : { capacityBand: op.capacityBand }
            },
            reason: ProjectionReason.APPLIED
          };
        }
        case "upsert-hazard":
          return {
            object: {
              ...base,
              ...conflicting,
              objectId: op.hazardId,
              kind: "hazard",
              label: op.fallbackLabel ?? `Hazard ${op.hazardId}`,
              ...op.latE7 !== void 0 ? { latE7: op.latE7 } : {},
              ...op.lonE7 !== void 0 ? { lonE7: op.lonE7 } : {},
              severity: op.severity,
              missingFromPack: false
            },
            reason: ProjectionReason.APPLIED
          };
        case "clear-hazard":
          return {
            object: {
              ...existing ?? {
                objectId: op.hazardId,
                kind: "hazard",
                label: `Hazard ${op.hazardId}`,
                missingFromPack: false
              },
              ...base,
              tombstoned: true
            },
            reason: ProjectionReason.APPLIED
          };
        case "set-route-state": {
          const route = this.resolver?.resolveRoute(op.routeId);
          if (!route)
            this.missingObjectIds.add(op.routeId);
          return {
            object: {
              ...base,
              ...conflicting,
              objectId: op.routeId,
              kind: "route",
              label: route?.name ?? op.fallbackLabel ?? op.routeId,
              ...route ? { latE7: route.fromLatE7, lonE7: route.fromLonE7 } : {},
              state: op.state,
              missingFromPack: !route
            },
            reason: route ? ProjectionReason.APPLIED : ProjectionReason.MISSING_OBJECT_FALLBACK
          };
        }
        case "upsert-incident-marker":
          return {
            object: {
              ...base,
              objectId: op.incidentId,
              kind: "incident",
              label: op.fallbackLabel ?? `Incident ${op.incidentId}`,
              ...op.latE7 !== void 0 ? { latE7: op.latE7 } : {},
              ...op.lonE7 !== void 0 ? { lonE7: op.lonE7 } : {},
              severity: op.severity,
              // Markers age from the FIX time, not the receive time.
              asOfS: op.locationAtS,
              ...op.accuracyM !== void 0 ? { accuracyM: op.accuracyM } : {},
              missingFromPack: false
            },
            reason: ProjectionReason.APPLIED
          };
        case "upsert-responder-marker":
          return {
            object: {
              ...base,
              objectId: `RSP-${op.responderRef}`,
              kind: "responder",
              label: `Responder ${op.responderRef}`,
              ...op.latE7 !== void 0 ? { latE7: op.latE7 } : {},
              ...op.lonE7 !== void 0 ? { lonE7: op.lonE7 } : {},
              asOfS: op.locationAtS,
              ...op.accuracyM !== void 0 ? { accuracyM: op.accuracyM } : {},
              missingFromPack: false
            },
            reason: ProjectionReason.APPLIED
          };
        case "upsert-peer-marker":
          return {
            object: {
              ...base,
              objectId: `PEER-${op.peerToken}`,
              kind: "peer",
              label: "Participating phone",
              ...op.latE7 !== void 0 ? { latE7: op.latE7 } : {},
              ...op.lonE7 !== void 0 ? { lonE7: op.lonE7 } : {},
              asOfS: op.locationAtS,
              ...op.accuracyM !== void 0 ? { accuracyM: op.accuracyM } : {},
              missingFromPack: false
            },
            reason: ProjectionReason.APPLIED
          };
        case "set-incident-state": {
          const terminal = op.state === "resolved" || op.state === "cancelled" || op.state === "expired";
          return {
            object: {
              ...existing ?? {
                objectId: op.incidentId,
                kind: "incident",
                label: `Incident ${op.incidentId}`,
                missingFromPack: false
              },
              ...base,
              tombstoned: terminal
            },
            reason: ProjectionReason.APPLIED
          };
        }
        case "activate-content":
          return {
            object: {
              ...base,
              objectId: op.objectId,
              kind: "content",
              label: op.fallbackLabel ?? op.objectId,
              state: op.opcode,
              missingFromPack: !this.resolver?.resolve(op.objectId)
            },
            reason: ProjectionReason.APPLIED
          };
        case "tombstone-object":
          return {
            object: {
              ...existing ?? {
                objectId: op.objectId,
                kind: "resource",
                label: op.fallbackLabel ?? op.objectId,
                missingFromPack: true
              },
              ...base,
              tombstoned: true
            },
            reason: ProjectionReason.APPLIED
          };
        default:
          return void 0;
      }
    }
    keyFor(op) {
      switch (op.kind) {
        case "upsert-resource":
        case "set-resource-state":
        case "set-capacity":
        case "activate-content":
        case "tombstone-object":
          return `obj:${op.objectId}`;
        case "upsert-hazard":
        case "clear-hazard":
          return `haz:${op.hazardId}`;
        case "set-route-state":
          return `rte:${op.routeId}`;
        case "upsert-incident-marker":
        case "set-incident-state":
          return `inc:${op.incidentId}`;
        case "upsert-responder-marker":
          return `rsp:${op.responderRef}`;
        case "upsert-peer-marker":
          return `peer:${op.peerToken}`;
        default:
          return void 0;
      }
    }
    /** Visible objects. Expired markers are withdrawn per FRESHNESS policy. */
    visible(nowS, options = {}) {
      const out = [];
      for (const object of this.objects.values()) {
        if (object.tombstoned && !options.includeTombstoned)
          continue;
        if (object.expiresAtS !== void 0 && object.expiresAtS <= nowS)
          continue;
        const isMarker = object.kind === "incident" || object.kind === "responder" || object.kind === "peer";
        if (isMarker && freshnessOf(object.asOfS, nowS) === "expired")
          continue;
        out.push(object);
      }
      return out;
    }
    get(objectId) {
      for (const object of this.objects.values()) {
        if (object.objectId === objectId)
          return object;
      }
      return void 0;
    }
    /** Object IDs referenced by packets but absent from the pack (MAP-008). */
    missingObjects() {
      return [...this.missingObjectIds];
    }
    projectionEvents(limit = 100) {
      return this.events.slice(-limit).reverse();
    }
    /** MAP-010: list equivalents for accessibility and low-performance devices. */
    asList(nowS) {
      return this.visible(nowS).map((object) => ({
        object,
        freshness: freshnessOf(object.asOfS, nowS),
        ageS: Math.max(0, nowS - object.asOfS)
      }));
    }
  };

  // packages/mapkit/dist/packet-to-map.js
  var RESOURCE_KIND = {
    [MessageType.SHELTER]: "shelter",
    [MessageType.MEDICAL_POST]: "medical",
    [MessageType.FOOD_WATER]: "food-water",
    [MessageType.SAFE_ZONE]: "safe-zone"
  };
  function toMapOperations(packet, transport, nowS) {
    const p = packet.payload;
    const version = packet.sourceSequence ?? packet.header.createdAt;
    const base = {
      causedByPacketId: packet.header.packetId,
      transport,
      version,
      appliedAtS: packet.header.createdAt,
      ...packet.header.expiresAt ? { expiresAtS: packet.header.expiresAt } : {}
    };
    const type = packet.header.type;
    if (RESOURCE_KIND[type]) {
      const loc = p["location"];
      const objectId = str(p["objectId"]);
      if (!objectId)
        return [];
      return [
        {
          ...base,
          kind: "upsert-resource",
          objectId,
          objectType: RESOURCE_KIND[type],
          state: num(p["state"]) ?? 0,
          ...num(loc?.["latE7"]) !== void 0 ? { latE7: num(loc?.["latE7"]) } : {},
          ...num(loc?.["lonE7"]) !== void 0 ? { lonE7: num(loc?.["lonE7"]) } : {},
          ...num(p["capacityBand"]) !== void 0 ? { capacityBand: num(p["capacityBand"]) } : {},
          ...num(p["capabilityBits"]) !== void 0 ? { capabilityBits: num(p["capabilityBits"]) } : {},
          // A temporary object is one the packet positions itself rather than
          // referencing a baseline pack entry.
          temporary: objectId.startsWith("TMP-"),
          ...str(p["fallbackLabel"]) ? { fallbackLabel: str(p["fallbackLabel"]) } : {}
        }
      ];
    }
    switch (type) {
      case MessageType.HAZARD: {
        const hazardId = str(p["hazardId"]);
        if (!hazardId)
          return [];
        return [
          {
            ...base,
            kind: "upsert-hazard",
            hazardId,
            hazardType: num(p["hazardType"]) ?? 8,
            geometryKind: num(p["geometryKind"]) ?? 0,
            ...num(p["latE7"]) !== void 0 ? { latE7: num(p["latE7"]) } : {},
            ...num(p["lonE7"]) !== void 0 ? { lonE7: num(p["lonE7"]) } : {},
            ...num(p["radiusM"]) !== void 0 ? { radiusM: num(p["radiusM"]) } : {},
            ...Array.isArray(p["routeIds"]) ? { routeIds: p["routeIds"] } : {},
            severity: packet.header.severity,
            ...str(p["fallbackLabel"]) ? { fallbackLabel: str(p["fallbackLabel"]) } : {}
          }
        ];
      }
      case MessageType.ROUTE_STATE: {
        const routeId = str(p["routeId"]);
        if (!routeId)
          return [];
        return [
          {
            ...base,
            kind: "set-route-state",
            routeId,
            state: num(p["state"]) ?? 0,
            ...num(p["direction"]) !== void 0 ? { direction: num(p["direction"]) } : {},
            ...str(p["fallbackInstruction"]) ? { fallbackLabel: str(p["fallbackInstruction"]) } : {}
          }
        ];
      }
      case MessageType.SOS_CREATE:
      case MessageType.SOS_UPDATE: {
        const incidentId = str(p["incidentId"]);
        if (!incidentId)
          return [];
        const loc = p["location"];
        const latE7 = num(loc?.["latE7"]) ?? packet.geo?.latE7;
        const lonE7 = num(loc?.["lonE7"]) ?? packet.geo?.lonE7;
        if (latE7 === void 0 || lonE7 === void 0)
          return [];
        const locationAtS = packet.header.createdAt - (num(loc?.["ageS"]) ?? 0);
        return [
          {
            ...base,
            kind: "upsert-incident-marker",
            incidentId,
            latE7,
            lonE7,
            ...num(loc?.["accuracyM"]) !== void 0 ? { accuracyM: num(loc?.["accuracyM"]) } : {},
            locationAtS,
            locationSource: num(loc?.["source"]) ?? 0,
            severity: packet.header.severity,
            category: num(p["category"]) ?? 7,
            ...num(p["peopleTotal"]) !== void 0 ? { peopleTotal: num(p["peopleTotal"]) } : {}
          }
        ];
      }
      case MessageType.SOS_CANCEL: {
        const incidentId = str(p["incidentId"]);
        if (!incidentId)
          return [];
        return [{ ...base, kind: "set-incident-state", incidentId, state: "cancelled" }];
      }
      case MessageType.RESOLVED: {
        const incidentId = str(p["incidentId"]);
        if (!incidentId)
          return [];
        return [{ ...base, kind: "set-incident-state", incidentId, state: "resolved" }];
      }
      case MessageType.RESPONDER_ASSIGNED:
      case MessageType.RESPONDER_ACCEPTED:
      case MessageType.RESPONDER_EN_ROUTE:
      case MessageType.RESPONDER_ARRIVED: {
        const incidentId = str(p["incidentId"]);
        const responderRef = str(p["responderRef"]);
        const ops = [];
        if (incidentId) {
          const state = type === MessageType.RESPONDER_ASSIGNED ? "assigned" : type === MessageType.RESPONDER_ACCEPTED ? "accepted" : type === MessageType.RESPONDER_EN_ROUTE ? "en-route" : "arrived";
          ops.push({ ...base, kind: "set-incident-state", incidentId, state });
        }
        const loc = p["location"];
        if (responderRef && num(loc?.["latE7"]) !== void 0 && num(loc?.["lonE7"]) !== void 0) {
          ops.push({
            ...base,
            kind: "upsert-responder-marker",
            responderRef,
            ...incidentId ? { incidentId } : {},
            status: type === MessageType.RESPONDER_EN_ROUTE ? "en-route" : type === MessageType.RESPONDER_ARRIVED ? "arrived" : "assigned",
            latE7: num(loc?.["latE7"]),
            lonE7: num(loc?.["lonE7"]),
            ...num(loc?.["accuracyM"]) !== void 0 ? { accuracyM: num(loc?.["accuracyM"]) } : {},
            locationAtS: packet.header.createdAt - (num(loc?.["ageS"]) ?? 0),
            locationSource: num(loc?.["source"]) ?? 0
          });
        }
        return ops;
      }
      case MessageType.RECORD_TOMBSTONE: {
        const objectId = str(p["objectId"]);
        if (!objectId)
          return [];
        return [
          {
            ...base,
            kind: "tombstone-object",
            objectId,
            ...num(p["reasonCode"]) !== void 0 ? { reasonCode: num(p["reasonCode"]) } : {}
          }
        ];
      }
      case MessageType.CONTENT_ACTIVATE: {
        const objectId = str(p["objectId"]);
        const bundleId = str(p["bundleId"]);
        if (!objectId || !bundleId)
          return [];
        return [
          {
            ...base,
            kind: "activate-content",
            bundleId,
            objectId,
            opcode: num(p["opcode"]) ?? 0,
            ...str(p["fallbackText"]) ? { fallbackLabel: str(p["fallbackText"]) } : {}
          }
        ];
      }
      default:
        return [];
    }
  }
  function num(value) {
    return typeof value === "number" ? value : void 0;
  }
  function str(value) {
    return typeof value === "string" ? value : void 0;
  }

  // packages/transport-core/dist/index.js
  var dist_exports9 = {};
  __export(dist_exports9, {
    ADVERTISEMENT_BYTES: () => ADVERTISEMENT_BYTES,
    CapabilityBit: () => CapabilityBit,
    RadioMedium: () => RadioMedium,
    SimulatedTransportAdapter: () => SimulatedTransportAdapter,
    buildAdvertisingPdu: () => buildAdvertisingPdu,
    buildDiscoverySummary: () => buildDiscoverySummary,
    decodeAdvertisement: () => decodeAdvertisement,
    encodeAdvertisement: () => encodeAdvertisement
  });

  // packages/transport-core/dist/simulated-adapter.js
  var ALL_GRANTED = {
    bluetoothScan: "granted",
    bluetoothAdvertise: "granted",
    bluetoothConnect: "granted",
    location: "granted",
    notifications: "granted",
    microphone: "granted",
    foregroundService: "granted"
  };
  var RadioMedium = class {
    options;
    nodes = /* @__PURE__ */ new Map();
    ranges = /* @__PURE__ */ new Map();
    nowMs = 0;
    queue = [];
    constructor(options = {}) {
      this.options = options;
    }
    get clockMs() {
      return this.nowMs;
    }
    register(adapter) {
      this.nodes.set(adapter.nodeToken, adapter);
      this.ranges.set(adapter.nodeToken, /* @__PURE__ */ new Set());
    }
    /** Puts two nodes in mutual radio range. */
    connect(a, b) {
      this.ranges.get(a)?.add(b);
      this.ranges.get(b)?.add(a);
    }
    /** Removes them from range: the store-carry-forward scenario. */
    disconnect(a, b) {
      this.ranges.get(a)?.delete(b);
      this.ranges.get(b)?.delete(a);
    }
    peersInRange(token) {
      return [...this.ranges.get(token) ?? []];
    }
    schedule(delayMs, run) {
      this.queue.push({ atMs: this.nowMs + delayMs, run });
    }
    /**
     * Advances simulated time and runs everything due.
     *
     * This is ASYNC on purpose. A scheduled callback emits a transport event,
     * and the relay loop handles those events asynchronously. If we advanced the
     * clock synchronously the simulated time would outrun the work in flight,
     * and multi-hop results would depend on microtask timing rather than on the
     * protocol. Draining after every callback keeps runs deterministic.
     */
    async advance(ms) {
      const target = this.nowMs + ms;
      while (true) {
        this.queue.sort((a, b) => a.atMs - b.atMs);
        const next = this.queue[0];
        if (!next || next.atMs > target)
          break;
        this.queue.shift();
        this.nowMs = next.atMs;
        next.run();
        await drainMicrotasks();
      }
      this.nowMs = target;
      await drainMicrotasks();
    }
    deliver(fromToken, toToken, sessionId, record) {
      if (!this.ranges.get(fromToken)?.has(toToken))
        return;
      const random = this.options.random ?? Math.random;
      if (random() < (this.options.lossRate ?? 0))
        return;
      const target = this.nodes.get(toToken);
      if (!target)
        return;
      this.schedule(this.options.latencyMs ?? 20, () => {
        target.receive(fromToken, sessionId, record, this.nowMs);
      });
    }
    broadcastDiscovery(fromToken, summary) {
      for (const peerToken of this.peersInRange(fromToken)) {
        const peer = this.nodes.get(peerToken);
        if (!peer)
          continue;
        this.schedule(5, () => {
          peer.observePeer(fromToken, summary, this.nowMs);
        });
      }
    }
    /**
     * Tells the accepting side that a session opened against it.
     *
     * A Tier 1 session is BIDIRECTIONAL (DEC-005, 02-... "Mesh-to-mesh flow":
     * "Each node requests only missing, eligible items"). Without this the
     * lower-token node would only ever push, and responder state could never
     * travel back to the victim.
     */
    notifySessionOpened(fromToken, toToken, sessionId) {
      if (!this.ranges.get(fromToken)?.has(toToken))
        return;
      const target = this.nodes.get(toToken);
      if (!target)
        return;
      this.schedule(0, () => {
        target.acceptSession(fromToken, sessionId, this.nowMs);
      });
    }
    /**
     * A disconnect is observed at BOTH ends. Without this the accepting side
     * would keep the session slot forever and eventually advertise
     * "not accepting connections", silently killing multi-hop relay.
     */
    notifySessionClosed(fromToken, toToken, sessionId) {
      const target = this.nodes.get(toToken);
      if (!target)
        return;
      this.schedule(1, () => {
        target.remoteClosed(sessionId, fromToken, this.nowMs);
      });
    }
  };
  function yieldMacrotask() {
    return new Promise((resolve) => {
      if (typeof setImmediate === "function")
        setImmediate(resolve);
      else
        setTimeout(resolve, 0);
    });
  }
  async function drainMicrotasks() {
    for (let i = 0; i < 3; i += 1)
      await yieldMacrotask();
  }
  var SimulatedTransportAdapter = class {
    nodeToken;
    medium;
    capabilityOverrides;
    id;
    kind = "tier1-ble";
    listeners = /* @__PURE__ */ new Set();
    relayState = "stopped";
    summary;
    sessionCounter = 0;
    openSessions = /* @__PURE__ */ new Set();
    /** sessionId -> the OTHER end. Never derive this from the id string. */
    sessionPeers = /* @__PURE__ */ new Map();
    /** Sessions already torn down, so a late "opened" notice cannot revive one. */
    closedSessions = /* @__PURE__ */ new Set();
    constructor(nodeToken, medium, capabilityOverrides = {}) {
      this.nodeToken = nodeToken;
      this.medium = medium;
      this.capabilityOverrides = capabilityOverrides;
      this.id = `sim-${nodeToken}`;
      medium.register(this);
    }
    async getCapabilities() {
      return {
        androidApiLevel: 34,
        bluetoothAvailable: true,
        bluetoothEnabled: true,
        bleScanSupported: true,
        bleAdvertiseSupported: true,
        multipleAdvertisementSupported: true,
        gattClientSupported: true,
        gattServerSupported: true,
        extendedAdvertisingSupported: false,
        codedPhySupported: false,
        audioInputAvailable: true,
        permissions: ALL_GRANTED,
        batteryPercent: 80,
        batteryTemperatureC: 31.5,
        batteryOptimisationRestricted: false,
        thermalThrottled: false,
        // Never lie about this: the readiness screen renders it verbatim.
        simulated: true,
        observedAtMs: this.medium.clockMs,
        ...this.capabilityOverrides
      };
    }
    async requestPermissions() {
      return ALL_GRANTED;
    }
    async startRelay(summary) {
      this.summary = summary;
      this.setRelayState("starting");
      this.setRelayState("advertising-scanning");
      this.medium.broadcastDiscovery(this.nodeToken, summary);
    }
    async stopRelay() {
      this.summary = void 0;
      for (const sessionId of [...this.openSessions])
        await this.closeSession(sessionId);
      this.setRelayState("stopped");
    }
    async updateDiscoverySummary(summary) {
      this.summary = summary;
      if (this.relayState === "advertising-scanning" || this.relayState === "session-active") {
        this.medium.broadcastDiscovery(this.nodeToken, summary);
      }
    }
    async openSession(peerToken) {
      if (!this.medium.peersInRange(this.nodeToken).includes(peerToken)) {
        throw new Error(`peer ${peerToken} is not in range`);
      }
      this.sessionCounter += 1;
      const sessionId = `${this.nodeToken}-${peerToken}-${this.sessionCounter}`;
      this.openSessions.add(sessionId);
      this.sessionPeers.set(sessionId, peerToken);
      this.setRelayState("session-active");
      this.emit({
        kind: "session",
        sessionId,
        peerToken,
        phase: "establish",
        initiatedLocally: true,
        atMs: this.medium.clockMs
      });
      this.medium.notifySessionOpened(this.nodeToken, peerToken, sessionId);
      return sessionId;
    }
    /** Called by the medium on the accepting side of a session. */
    acceptSession(fromToken, sessionId, atMs) {
      if (this.closedSessions.has(sessionId))
        return;
      this.openSessions.add(sessionId);
      this.sessionPeers.set(sessionId, fromToken);
      this.emit({
        kind: "session",
        sessionId,
        peerToken: fromToken,
        phase: "establish",
        initiatedLocally: false,
        atMs
      });
    }
    async closeSession(sessionId) {
      if (!this.openSessions.delete(sessionId))
        return;
      const peerToken = this.sessionPeers.get(sessionId) ?? "";
      this.sessionPeers.delete(sessionId);
      this.emit({
        kind: "session-closed",
        sessionId,
        peerToken,
        reason: "complete",
        recordsAccepted: 0,
        bytesTransferred: 0,
        atMs: this.medium.clockMs
      });
      if (this.openSessions.size === 0 && this.summary)
        this.setRelayState("advertising-scanning");
      this.medium.notifySessionClosed(this.nodeToken, peerToken, sessionId);
    }
    /** The far end closed. Release the slot; never notify back (no ping-pong). */
    remoteClosed(sessionId, peerToken, atMs) {
      this.closedSessions.add(sessionId);
      if (!this.openSessions.delete(sessionId))
        return;
      this.sessionPeers.delete(sessionId);
      this.emit({
        kind: "session-closed",
        sessionId,
        peerToken,
        reason: "peer-closed",
        recordsAccepted: 0,
        bytesTransferred: 0,
        atMs
      });
      if (this.openSessions.size === 0 && this.summary)
        this.setRelayState("advertising-scanning");
    }
    async sendRecord(sessionId, record) {
      if (!this.openSessions.has(sessionId))
        throw new Error(`session ${sessionId} is not open`);
      const peerToken = this.sessionPeers.get(sessionId);
      if (!peerToken)
        throw new Error(`session ${sessionId} has no peer binding`);
      this.medium.deliver(this.nodeToken, peerToken, sessionId, record);
      this.emit({
        kind: "record-sent",
        sessionId,
        peerToken,
        packetId: record.packetId,
        byteCount: record.totalBytes,
        atMs: this.medium.clockMs
      });
    }
    async cancelTransfer(sessionId) {
      await this.closeSession(sessionId);
    }
    addEventListener(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    // --- called by the medium -------------------------------------------------
    receive(fromToken, sessionId, record, atMs) {
      this.openSessions.add(sessionId);
      this.sessionPeers.set(sessionId, fromToken);
      this.emit({
        kind: "record-received",
        sessionId,
        peerToken: fromToken,
        transport: this.kind,
        bytes: record.bytes,
        rssi: -60,
        atMs
      });
    }
    observePeer(peerToken, summary, atMs) {
      this.emit({ kind: "peer-observed", nodeToken: peerToken, summary, rssi: -60, observedAtMs: atMs });
    }
    setRelayState(state) {
      this.relayState = state;
      this.emit({ kind: "relay-state-changed", state, atMs: this.medium.clockMs });
    }
    emit(event) {
      for (const listener of this.listeners)
        listener(event);
    }
  };

  // packages/transport-core/dist/advertisement-codec.js
  var ADVERTISEMENT_BYTES = 12;
  function encodeAdvertisement(summary) {
    if (summary.nodeToken.length !== ADVERTISEMENT.NODE_TOKEN_BYTES * 2) {
      throw new Error(`node token must be ${ADVERTISEMENT.NODE_TOKEN_BYTES} bytes of hex`);
    }
    const out = new Uint8Array(ADVERTISEMENT_BYTES);
    const view = new DataView(out.buffer);
    out[0] = BLE_IDENTIFIERS.ADVERTISEMENT_MAGIC;
    out[1] = (summary.protocolMajor & 15) << 4 | summary.protocolMinor & 15;
    for (let i = 0; i < ADVERTISEMENT.NODE_TOKEN_BYTES; i += 1) {
      out[2 + i] = Number.parseInt(summary.nodeToken.slice(i * 2, i * 2 + 2), 16);
    }
    out[6] = summary.capabilityBits & 255;
    view.setUint16(7, summary.queueEpoch & 65535, false);
    view.setUint16(9, summary.inventoryHint & 65535, false);
    out[11] = summary.highestWaitingPriority & 7 | (summary.gatewayProven ? 8 : 0) | (summary.gatewayFreshnessClass & 3) << 4 | (summary.acceptingConnections ? 64 : 0);
    return out;
  }
  function decodeAdvertisement(bytes) {
    if (bytes.length < ADVERTISEMENT_BYTES)
      return { ok: false, reason: "too-short" };
    if (bytes[0] !== BLE_IDENTIFIERS.ADVERTISEMENT_MAGIC)
      return { ok: false, reason: "bad-magic" };
    const major = bytes[1] >> 4 & 15;
    if (major !== 1)
      return { ok: false, reason: "unsupported-protocol" };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let nodeToken = "";
    for (let i = 0; i < ADVERTISEMENT.NODE_TOKEN_BYTES; i += 1) {
      nodeToken += bytes[2 + i].toString(16).padStart(2, "0");
    }
    const packed = bytes[11];
    return {
      ok: true,
      summary: {
        protocolMajor: major,
        protocolMinor: bytes[1] & 15,
        nodeToken,
        capabilityBits: bytes[6],
        queueEpoch: view.getUint16(7, false),
        inventoryHint: view.getUint16(9, false),
        highestWaitingPriority: packed & 7,
        gatewayProven: (packed & 8) !== 0,
        gatewayFreshnessClass: packed >> 4 & 3,
        acceptingConnections: (packed & 64) !== 0
      }
    };
  }
  function buildAdvertisingPdu(summary) {
    const payload = encodeAdvertisement(summary);
    const flags = Uint8Array.from([2, 1, 6]);
    const manufacturer = new Uint8Array(2 + 2 + payload.length);
    manufacturer[0] = 1 + 2 + payload.length;
    manufacturer[1] = 255;
    manufacturer[2] = BLE_IDENTIFIERS.COMPANY_ID & 255;
    manufacturer[3] = BLE_IDENTIFIERS.COMPANY_ID >> 8 & 255;
    manufacturer.set(payload, 4);
    const pdu = new Uint8Array(flags.length + manufacturer.length);
    pdu.set(flags, 0);
    pdu.set(manufacturer, flags.length);
    if (pdu.length > ADVERTISEMENT.PDU_BYTES) {
      throw new Error(`advertising PDU is ${pdu.length}B, over the ${ADVERTISEMENT.PDU_BYTES}B limit`);
    }
    return pdu;
  }

  // packages/transport-core/dist/index.js
  function buildDiscoverySummary(input) {
    if (input.nodeToken.length !== ADVERTISEMENT.NODE_TOKEN_BYTES * 2) {
      throw new Error(`node token must be ${ADVERTISEMENT.NODE_TOKEN_BYTES} bytes of hex`);
    }
    return {
      protocolMajor: 1,
      protocolMinor: 0,
      nodeToken: input.nodeToken,
      capabilityBits: input.capabilityBits,
      queueEpoch: input.queueEpoch & 65535,
      highestWaitingPriority: Math.min(7, Math.max(0, input.highestWaitingPriority)),
      inventoryHint: input.inventoryHint & 65535,
      gatewayProven: input.gatewayProven,
      gatewayFreshnessClass: input.gatewayFreshnessClass,
      acceptingConnections: input.acceptingConnections
    };
  }
  var CapabilityBit = {
    GATT_SERVER: 1 << 0,
    GATT_CLIENT: 1 << 1,
    FRAGMENTS: 1 << 2,
    GATEWAY_CAPABLE: 1 << 3,
    RESPONDER_MODE: 1 << 4,
    CODED_PHY: 1 << 5
  };

  // packages/tier2/dist/index.js
  var dist_exports10 = {};
  __export(dist_exports10, {
    GGWAVE_PROFILES: () => GGWAVE_PROFILES,
    ManifestHandleResolver: () => ManifestHandleResolver,
    TIER2_CRC_BYTES: () => TIER2_CRC_BYTES,
    TIER2_HEADER_BYTES: () => TIER2_HEADER_BYTES,
    TIER2_MAGIC: () => TIER2_MAGIC,
    TIER2_OVERHEAD_BYTES: () => TIER2_OVERHEAD_BYTES,
    TIER2_VERSION: () => TIER2_VERSION,
    Tier2Receiver: () => Tier2Receiver,
    contentEdited: () => contentEdited,
    decodeTier2Frame: () => decodeTier2Frame,
    encodeTier2Frame: () => encodeTier2Frame,
    planCampaign: () => planCampaign,
    toTier2Frames: () => toTier2Frames,
    transitionCampaign: () => transitionCampaign
  });

  // packages/tier2/dist/frame-codec.js
  var TIER2_MAGIC = 210;
  var TIER2_VERSION = 1;
  var TIER2_HEADER_BYTES = 10;
  var TIER2_CRC_BYTES = 2;
  var TIER2_OVERHEAD_BYTES = TIER2_HEADER_BYTES + TIER2_CRC_BYTES;
  function crc16(bytes, end) {
    return crc32(bytes, 0, end) & 65535;
  }
  function encodeTier2Frame(frame) {
    if (frame.fragmentCount > TIER2.MAX_FRAMES_PER_PACKET) {
      throw new RangeError(`fragment count ${frame.fragmentCount} exceeds ${TIER2.MAX_FRAMES_PER_PACKET}`);
    }
    const total = TIER2_OVERHEAD_BYTES + frame.payload.length;
    if (total > TIER2.MAX_FRAME_BYTES) {
      throw new RangeError(`frame of ${total}B exceeds the Tier 2 limit of ${TIER2.MAX_FRAME_BYTES}B`);
    }
    const out = new Uint8Array(total);
    const view = new DataView(out.buffer);
    out[0] = TIER2_MAGIC;
    out[1] = (TIER2_VERSION & 15) << 4 | frame.fragmentCount & 15;
    out[2] = frame.fragmentIndex & 255;
    view.setUint16(3, frame.campaignHandle & 65535, false);
    out[5] = frame.campaignVersion & 255;
    view.setUint16(6, frame.packetHandle & 65535, false);
    out[8] = frame.messageType & 255;
    out[9] = (frame.priority & 15) << 4 | frame.severity & 15;
    out.set(frame.payload, TIER2_HEADER_BYTES);
    view.setUint16(TIER2_HEADER_BYTES + frame.payload.length, crc16(out, TIER2_HEADER_BYTES + frame.payload.length), false);
    return out;
  }
  function decodeTier2Frame(bytes) {
    if (bytes.length < TIER2_OVERHEAD_BYTES)
      return { ok: false, reason: "too-short" };
    if (bytes.length > TIER2.MAX_FRAME_BYTES)
      return { ok: false, reason: "over-limit" };
    if (bytes[0] !== TIER2_MAGIC)
      return { ok: false, reason: "bad-magic" };
    if ((bytes[1] >> 4 & 15) !== TIER2_VERSION)
      return { ok: false, reason: "bad-version" };
    const payloadEnd = bytes.length - TIER2_CRC_BYTES;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint16(payloadEnd, false) !== crc16(bytes, payloadEnd)) {
      return { ok: false, reason: "crc-failed" };
    }
    return {
      ok: true,
      frame: {
        fragmentCount: bytes[1] & 15,
        fragmentIndex: bytes[2],
        campaignHandle: view.getUint16(3, false),
        campaignVersion: bytes[5],
        packetHandle: view.getUint16(6, false),
        messageType: bytes[8],
        priority: bytes[9] >> 4 & 15,
        severity: bytes[9] & 15,
        payload: bytes.slice(TIER2_HEADER_BYTES, payloadEnd)
      }
    };
  }
  function toTier2Frames(input) {
    const capacity = TIER2.MAX_FRAME_BYTES - TIER2_OVERHEAD_BYTES;
    const count = Math.max(1, Math.ceil(input.canonicalPacketBytes.length / capacity));
    if (count > TIER2.MAX_FRAMES_PER_PACKET) {
      throw new RangeError(`payload needs ${count} frames, over the ${TIER2.MAX_FRAMES_PER_PACKET} limit`);
    }
    const frames = [];
    for (let i = 0; i < count; i += 1) {
      frames.push(encodeTier2Frame({
        campaignHandle: input.campaignHandle,
        campaignVersion: input.campaignVersion,
        packetHandle: input.packetHandle,
        messageType: input.messageType,
        priority: input.priority,
        severity: input.severity,
        fragmentIndex: i,
        fragmentCount: count,
        payload: input.canonicalPacketBytes.slice(i * capacity, (i + 1) * capacity)
      }));
    }
    return frames;
  }

  // packages/tier2/dist/receiver.js
  var Tier2Receiver = class {
    resolver;
    state = "stopped";
    source = null;
    listenStartedAtMs;
    framesDetected = 0;
    framesValid = 0;
    framesCorrupt = 0;
    framesDuplicate = 0;
    /** A packet handle is only unique inside one campaign version. */
    assemblies = /* @__PURE__ */ new Map();
    recovered = /* @__PURE__ */ new Set();
    seenFrameKeys = /* @__PURE__ */ new Set();
    listeners = /* @__PURE__ */ new Set();
    constructor(resolver) {
      this.resolver = resolver;
    }
    setResolver(resolver) {
      this.resolver = resolver;
    }
    /** T2-002: explicit, permissioned, visible, and time-bounded. */
    startListening(source, nowMs) {
      this.source = source;
      this.listenStartedAtMs = nowMs;
      this.state = source === "tier2-mic" ? "listening" : "reading-direct-input";
    }
    stop() {
      this.state = "stopped";
      this.source = null;
    }
    /** Enforces the bounded listen window (no unlimited microphone capture). */
    tick(nowMs) {
      if (this.state === "stopped" || this.listenStartedAtMs === void 0)
        return;
      if (nowMs - this.listenStartedAtMs >= TIER2.MICROPHONE_TIMEOUT_MS) {
        this.state = this.recovered.size > 0 ? this.completenessState() : "timed-out";
        this.source = null;
      }
    }
    /** Feed one raw frame from either audio path. */
    accept(raw) {
      this.framesDetected += 1;
      if (this.state === "stopped")
        this.startListening(raw.source, raw.receivedAtMs);
      if (this.state === "listening" || this.state === "reading-direct-input") {
        this.state = "preamble-detected";
      }
      const decoded = decodeTier2Frame(raw.bytes);
      if (!decoded.ok) {
        this.framesCorrupt += 1;
        return { reason: Tier2Reason.FRAME_CORRUPT };
      }
      const frame = decoded.frame;
      const key = `${frame.campaignHandle}:${frame.campaignVersion}:${frame.packetHandle}:${frame.fragmentIndex}`;
      if (this.seenFrameKeys.has(key)) {
        this.framesDuplicate += 1;
        return { reason: Tier2Reason.FRAME_DUPLICATE };
      }
      this.seenFrameKeys.add(key);
      this.framesValid += 1;
      this.state = "frame-collecting";
      const packet = this.assemble(frame, raw);
      if (!packet)
        return { reason: Tier2Reason.PACKET_INCOMPLETE };
      return { reason: Tier2Reason.PACKET_REASSEMBLED, packet };
    }
    assemble(frame, raw) {
      const assemblyKey = `${frame.campaignHandle}:${frame.campaignVersion}:${frame.packetHandle}`;
      const assembly = this.assemblies.get(assemblyKey) ?? {
        fragmentCount: frame.fragmentCount,
        parts: /* @__PURE__ */ new Map(),
        firstSeenMs: raw.receivedAtMs
      };
      assembly.parts.set(frame.fragmentIndex, frame.payload);
      this.assemblies.set(assemblyKey, assembly);
      if (assembly.parts.size < assembly.fragmentCount)
        return void 0;
      this.state = "packet-reassembling";
      let total = 0;
      for (const part of assembly.parts.values())
        total += part.length;
      const canonicalBytes = new Uint8Array(total);
      let offset = 0;
      for (let i = 0; i < assembly.fragmentCount; i += 1) {
        const part = assembly.parts.get(i);
        if (!part)
          return void 0;
        canonicalBytes.set(part, offset);
        offset += part.length;
      }
      const decoded = decodePacket(canonicalBytes);
      if (!decoded.ok)
        return void 0;
      const packetId = decoded.packet.header.packetId;
      if (decoded.packet.header.type !== frame.messageType || decoded.packet.header.priority !== frame.priority || decoded.packet.header.severity !== frame.severity)
        return void 0;
      const expectedPacketId = this.resolver?.resolvePacketId(frame.packetHandle);
      if (expectedPacketId !== void 0 && expectedPacketId !== packetId)
        return void 0;
      if (this.resolver && !this.resolver.verifyPacketBytes(frame.packetHandle, canonicalBytes))
        return void 0;
      this.assemblies.delete(assemblyKey);
      if (this.recovered.has(packetId)) {
        this.framesDuplicate += 1;
        return void 0;
      }
      this.recovered.add(packetId);
      this.state = this.completenessState();
      const packet = {
        packetId,
        bytes: canonicalBytes,
        source: raw.source,
        recoveredAtMs: raw.receivedAtMs
      };
      for (const listener of this.listeners)
        listener(packet);
      return packet;
    }
    completenessState() {
      const expected = this.resolver?.expectedPacketIds() ?? [];
      if (expected.length === 0)
        return "campaign-incomplete";
      const missing = expected.filter((id) => !this.recovered.has(id));
      return missing.length === 0 ? "campaign-complete" : "campaign-incomplete";
    }
    addListener(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    /** T2-011 / 01-... screen 11: the numbers the diagnostics screen renders. */
    metrics() {
      const expected = this.resolver?.expectedPacketIds() ?? [];
      return {
        state: this.state,
        source: this.source,
        ...this.resolver ? { campaignId: this.resolver.campaignId, campaignVersion: this.resolver.campaignVersion } : {},
        framesDetected: this.framesDetected,
        framesValid: this.framesValid,
        framesCorrupt: this.framesCorrupt,
        framesDuplicate: this.framesDuplicate,
        packetsRecovered: this.recovered.size,
        ...expected.length > 0 ? { packetsExpected: expected.length } : {},
        // T2: never fabricate missing map changes; list them honestly.
        missingPacketIds: expected.filter((id) => !this.recovered.has(id)),
        ...this.listenStartedAtMs !== void 0 ? { listenStartedAtMs: this.listenStartedAtMs } : {},
        listenTimeoutMs: TIER2.MICROPHONE_TIMEOUT_MS
      };
    }
    recoveredPacketIds() {
      return [...this.recovered];
    }
    reset() {
      this.framesDetected = 0;
      this.framesValid = 0;
      this.framesCorrupt = 0;
      this.framesDuplicate = 0;
      this.assemblies.clear();
      this.recovered.clear();
      this.seenFrameKeys.clear();
      this.state = "stopped";
      this.source = null;
      this.listenStartedAtMs = void 0;
    }
  };

  // packages/tier2/dist/campaign-builder.js
  var GGWAVE_PROFILES = {
    "audible-fast": { bytesPerSecond: 16, label: "Audible fast" },
    "audible-normal": { bytesPerSecond: 8, label: "Audible normal" },
    "ultrasound-normal": { bytesPerSecond: 8, label: "Ultrasound normal" }
  };
  function repeatsFor(priority) {
    if (priority <= Priority.AUTHORITY_CRITICAL)
      return TIER2.MIN_CRITICAL_REPEATS;
    if (priority <= Priority.OPERATIONAL)
      return 2;
    return TIER2.MIN_NORMAL_REPEATS;
  }
  function planCampaign(input) {
    if (input.packets.length > TIER2.MAX_CAMPAIGN_PACKETS) {
      throw new RangeError(`campaign has ${input.packets.length} packets, over ${TIER2.MAX_CAMPAIGN_PACKETS}`);
    }
    const bytesPerSecond = GGWAVE_PROFILES[input.profile].bytesPerSecond;
    const handleTable = /* @__PURE__ */ new Map();
    const items = [];
    input.packets.forEach((packet, index) => {
      const handle = index + 1;
      handleTable.set(handle, packet.packetId);
      const frames = toTier2Frames({
        campaignHandle: input.campaignHandle,
        campaignVersion: input.campaignVersion,
        packetHandle: handle,
        messageType: packet.messageType,
        priority: packet.priority,
        severity: packet.severity,
        canonicalPacketBytes: packet.bytes
      });
      const tier2Bytes = frames.reduce((sum, f) => sum + f.length, 0);
      items.push({
        packetId: packet.packetId,
        bytes: packet.bytes,
        messageType: packet.messageType,
        priority: packet.priority,
        repeats: repeatsFor(packet.priority),
        tier1Bytes: packet.bytes.length,
        tier2Bytes,
        frameCount: frames.length,
        estimatedAudioMs: Math.ceil(tier2Bytes / bytesPerSecond * 1e3)
      });
    });
    const schedule = interleave(items);
    const totalDurationS = Math.ceil(items.reduce((sum, item) => sum + item.estimatedAudioMs / 1e3 * item.repeats, 0));
    const totalTier2Bytes = items.reduce((sum, item) => sum + item.tier2Bytes * item.repeats, 0);
    const manifest = {
      campaignId: input.campaignId,
      campaignVersion: input.campaignVersion,
      regionCode: input.regionCode,
      validFromS: input.validFromS,
      validUntilS: input.validUntilS,
      requiredPackId: input.requiredPackId,
      requiredPackVersion: input.requiredPackVersion,
      items,
      burstSchedule: schedule,
      totalDurationS,
      totalTier2Bytes
    };
    return {
      manifest,
      overBudget: totalDurationS > TIER2.MAX_CAMPAIGN_DURATION_S,
      budgetS: TIER2.MAX_CAMPAIGN_DURATION_S,
      handleTable
    };
  }
  function interleave(items) {
    const maxRepeats = items.reduce((max, item) => Math.max(max, item.repeats), 0);
    const schedule = [];
    for (let round = 0; round < maxRepeats; round += 1) {
      const thisRound = items.filter((item) => item.repeats > round).sort((a, b) => a.priority - b.priority);
      for (const item of thisRound)
        schedule.push({ packetId: item.packetId, repeatIndex: round });
    }
    return schedule;
  }
  function transitionCampaign(from, to) {
    if (!CAMPAIGN_TRANSITIONS[from].includes(to)) {
      throw new Error(`illegal campaign transition ${from} -> ${to}`);
    }
    return to;
  }
  function contentEdited(state) {
    const approvedOrLater = [
      "approved",
      "broadcaster-ready",
      "audio-generated",
      "decode-tested",
      "scheduled"
    ];
    return approvedOrLater.includes(state) ? "draft" : state;
  }

  // packages/tier2/dist/handle-resolver.js
  var ManifestHandleResolver = class {
    campaignHandle;
    campaignId;
    campaignVersion;
    byHandle = /* @__PURE__ */ new Map();
    constructor(manifest, campaignHandle) {
      this.campaignHandle = campaignHandle;
      this.campaignId = manifest.campaignId;
      this.campaignVersion = manifest.campaignVersion;
      manifest.items.forEach((item, index) => {
        this.byHandle.set(index + 1, { packetId: item.packetId, canonical: item.bytes });
      });
    }
    resolvePacketId(handle) {
      return this.byHandle.get(handle)?.packetId;
    }
    expectedPacketIds() {
      return [...this.byHandle.values()].map((entry) => entry.packetId);
    }
    /** Acoustic input already contains canonical bytes; the manifest verifies it. */
    verifyPacketBytes(handle, canonicalBytes) {
      const entry = this.byHandle.get(handle);
      if (!entry || canonicalBytes.length !== entry.canonical.length)
        return false;
      return canonicalBytes.every((byte, index) => byte === entry.canonical[index]);
    }
  };

  // packages/gateway-client/dist/index.js
  var dist_exports11 = {};
  __export(dist_exports11, {
    GatewayStateTracker: () => GatewayStateTracker,
    HttpGatewayClient: () => HttpGatewayClient,
    decodeBase64: () => unbase64,
    encodeBase64: () => base64
  });
  var HttpGatewayClient = class {
    options;
    fetchImpl;
    constructor(options) {
      this.options = options;
      this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    }
    /**
     * The LIVE PROBE. This is the only thing that may declare a gateway.
     * A network icon, a "connected" Wi-Fi state, or a successful DNS lookup
     * is not proof (01-... non-negotiable decision 1).
     */
    async probe() {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.probeTimeoutMs ?? GATEWAY.PROBE_TIMEOUT_MS);
      try {
        const response = await this.fetchImpl(`${this.options.baseUrl}/health`, { signal: controller.signal });
        if (!response.ok) {
          return { proven: false, atMs: Date.now(), failureReason: `http ${response.status}` };
        }
        const body = await response.json();
        if (this.options.expectedIdentity && body.identity !== this.options.expectedIdentity) {
          return { proven: false, atMs: Date.now(), failureReason: "backend identity mismatch" };
        }
        return {
          proven: true,
          atMs: Date.now(),
          latencyMs: Date.now() - startedAt,
          ...body.identity ? { backendIdentity: body.identity } : {}
        };
      } catch (error) {
        return { proven: false, atMs: Date.now(), failureReason: String(error) };
      } finally {
        clearTimeout(timeout);
      }
    }
    async register(nodeToken, regionCode) {
      const response = await this.post("/gateway/register", { nodeToken, regionCode });
      return response;
    }
    async upload(request) {
      const wire = {
        gatewayToken: request.gatewayToken,
        batchId: request.batchId,
        items: request.items.map((item) => ({
          packetId: item.packetId,
          bytesBase64: base64(item.bytes),
          observation: item.observation
        }))
      };
      return await this.post("/gateway/upload", wire);
    }
    async pollOutbound(request) {
      const raw = await this.post("/gateway/outbound", request);
      return {
        items: raw.items.map((item) => ({ packetId: item.packetId, bytes: unbase64(item.bytesBase64) })),
        ...raw.nextCursor ? { nextCursor: raw.nextCursor } : {},
        hasMore: raw.hasMore
      };
    }
    async ackOutbound(request) {
      await this.post("/gateway/outbound/ack", request);
    }
    async post(path, body) {
      const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok)
        throw new Error(`gateway ${path} failed with ${response.status}`);
      return response.json();
    }
  };
  var GatewayStateTracker = class {
    status = { state: "untested", queuedForUpload: 0 };
    recordProbe(result) {
      this.status = {
        ...this.status,
        state: result.proven ? "proven" : "unavailable",
        lastProbeAtMs: result.atMs
      };
      return this.status;
    }
    markProbing() {
      this.status = { ...this.status, state: "probing" };
      return this.status;
    }
    /** Expires the proof so gateway features disappear safely (DEC-009). */
    current(nowMs) {
      if (this.status.state !== "proven")
        return this.status;
      const lastProbe = this.status.lastProbeAtMs ?? 0;
      if (nowMs - lastProbe > FRESHNESS.GATEWAY_PROOF_S * 1e3) {
        this.status = { ...this.status, state: "untested" };
      }
      return this.status;
    }
    recordUpload(atMs, cursor) {
      this.status = { ...this.status, lastUploadAtMs: atMs, ...cursor ? { uploadCursor: cursor } : {} };
    }
    /** 02-...: "A gateway cursor advances only after confirmed backend response." */
    recordDownload(atMs, cursor) {
      this.status = { ...this.status, lastDownloadAtMs: atMs, ...cursor ? { outboundCursor: cursor } : {} };
    }
    setQueueDepth(depth) {
      this.status = { ...this.status, queuedForUpload: depth };
    }
  };
  function base64(bytes) {
    if (typeof Buffer !== "undefined")
      return Buffer.from(bytes).toString("base64");
    let binary = "";
    for (const b of bytes)
      binary += String.fromCharCode(b);
    return btoa(binary);
  }
  function unbase64(value) {
    if (typeof Buffer !== "undefined")
      return new Uint8Array(Buffer.from(value, "base64"));
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1)
      out[i] = binary.charCodeAt(i);
    return out;
  }

  // packages/node-runtime/dist/index.js
  var dist_exports12 = {};
  __export(dist_exports12, {
    FileAssembler: () => FileAssembler,
    GatewaySynchronizer: () => GatewaySynchronizer,
    MessageType: () => MessageType,
    NodeEngine: () => NodeEngine,
    Priority: () => Priority,
    RelayLoop: () => RelayLoop
  });

  // packages/node-runtime/dist/file-assembler.js
  var FileAssembler = class {
    files;
    packets;
    events;
    constructor(files, packets, events) {
      this.files = files;
      this.packets = packets;
      this.events = events;
    }
    /** Called for every accepted FILE_MANIFEST / FILE_FRAGMENT packet. */
    async accept(packet, nowS, atMs) {
      if (packet.header.type === MessageType.FILE_MANIFEST)
        return this.acceptManifest(packet, nowS, atMs);
      if (packet.header.type === MessageType.FILE_FRAGMENT)
        return this.acceptFragment(packet, atMs);
      return { kind: "ignored" };
    }
    async acceptManifest(packet, nowS, atMs) {
      const p = packet.payload;
      const fileId = String(p["fileId"] ?? "");
      const mimeCategory = Number(p["mimeCategory"] ?? -1);
      const totalBytes = Number(p["totalBytes"] ?? 0);
      const fragmentCount = Number(p["fragmentCount"] ?? 0);
      const expectedDigest = String(p["digest"] ?? "");
      if (!ACCEPTED_MIME_CATEGORIES.has(mimeCategory)) {
        return this.refuse(fileId, `content category ${mimeCategory} is not accepted (text only)`, atMs);
      }
      if (totalBytes > STORAGE.MAX_FILE_BYTES) {
        return this.refuse(fileId, `${totalBytes}B over the ${STORAGE.MAX_FILE_BYTES}B demo maximum`, atMs);
      }
      if (!expectedDigest) {
        return this.refuse(fileId, "manifest carries no whole-object digest", atMs);
      }
      const record = {
        fileId,
        mimeCategory,
        purposeCode: Number(p["purposeCode"] ?? 0),
        totalBytes,
        fragmentCount,
        expectedDigest,
        visible: false,
        ...typeof p["linkedIncidentId"] === "string" ? { linkedIncidentId: p["linkedIncidentId"] } : {},
        expiresAtS: packet.header.expiresAt
      };
      if (!await this.files.putManifest(record)) {
        return this.refuse(fileId, "store refused the manifest (bounds or object limit)", atMs);
      }
      this.events.emit({
        category: EventCategory.FILE,
        name: "manifest-accepted",
        severity: "info",
        atMs,
        packetId: packet.header.packetId,
        metrics: { fragmentCount, totalBytes }
      });
      const outcome2 = await this.tryComplete(fileId, atMs);
      return outcome2 ?? { kind: "manifest-accepted", fileId, expecting: fragmentCount };
    }
    async acceptFragment(packet, atMs) {
      const p = packet.payload;
      const fileId = String(p["fileId"] ?? "");
      const index = Number(p["fragmentIndex"] ?? -1);
      const data = p["data"];
      if (!(data instanceof Uint8Array) || index < 0)
        return { kind: "ignored" };
      const manifest = await this.files.getManifest(fileId);
      if (!manifest) {
        this.events.emit({
          category: EventCategory.FILE,
          name: "fragment-orphaned",
          severity: "warn",
          atMs,
          packetId: packet.header.packetId,
          reason: "no manifest for this object"
        });
        return { kind: "fragment-orphaned", fileId };
      }
      if (index >= manifest.fragmentCount)
        return { kind: "fragment-orphaned", fileId };
      await this.packets.putFragment({
        objectId: fileId,
        index,
        digest: String(p["fragmentDigest"] ?? ""),
        bytes: data,
        receivedAtMs: atMs
      });
      const completed = await this.tryComplete(fileId, atMs);
      if (completed)
        return completed;
      const held = (await this.packets.listFragments(fileId)).length;
      return { kind: "fragment-stored", fileId, held, missing: manifest.fragmentCount - held };
    }
    /** Assembles and verifies once every fragment is present. */
    async tryComplete(fileId, atMs) {
      const manifest = await this.files.getManifest(fileId);
      if (!manifest || manifest.visible)
        return void 0;
      const fragments = await this.packets.listFragments(fileId);
      if (fragments.length < manifest.fragmentCount)
        return void 0;
      let total = 0;
      for (const fragment of fragments)
        total += fragment.bytes.length;
      if (total > STORAGE.MAX_REASSEMBLY_BYTES) {
        await this.discard(fileId);
        return this.fail(fileId, "reassembled size over the bound", atMs);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (let i = 0; i < manifest.fragmentCount; i += 1) {
        const fragment = fragments.find((f) => f.index === i);
        if (!fragment)
          return void 0;
        bytes.set(fragment.bytes, offset);
        offset += fragment.bytes.length;
      }
      const digest = sha256Hex(bytes);
      if (digest !== manifest.expectedDigest) {
        await this.discard(fileId);
        return this.fail(fileId, "whole-object digest mismatch", atMs);
      }
      if (bytes.length !== manifest.totalBytes) {
        await this.discard(fileId);
        return this.fail(fileId, `assembled ${bytes.length}B, manifest declared ${manifest.totalBytes}B`, atMs);
      }
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        await this.discard(fileId);
        return this.fail(fileId, "declared text but is not valid UTF-8", atMs);
      }
      await this.files.markComplete(fileId, bytes, atMs);
      await this.packets.dropFragments(fileId);
      this.events.emit({
        category: EventCategory.FILE,
        name: "completed",
        severity: "info",
        atMs,
        bytes: bytes.length,
        result: fileId
      });
      return { kind: "completed", fileId, bytes: bytes.length };
    }
    /** FIL-005: which fragments to ask for when resuming. */
    async missingFragments(fileId) {
      const held = (await this.packets.listFragments(fileId)).map((f) => f.index);
      return this.files.missingFragments(fileId, held);
    }
    /** FIL-003: only completed, digest-verified objects may be rendered. */
    async visibleFiles() {
      return this.files.listVisible();
    }
    async discard(fileId) {
      await this.packets.dropFragments(fileId);
    }
    refuse(fileId, reason, atMs) {
      this.events.emit({
        category: EventCategory.FILE,
        name: "manifest-refused",
        severity: "warn",
        atMs,
        reason,
        result: fileId
      });
      return { kind: "manifest-refused", fileId, reason };
    }
    fail(fileId, reason, atMs) {
      this.events.emit({
        category: EventCategory.FILE,
        name: "integrity-failed",
        severity: "error",
        atMs,
        reason,
        result: fileId
      });
      return { kind: "integrity-failed", fileId, reason };
    }
  };

  // packages/node-runtime/dist/node-engine.js
  var NodeEngine = class {
    options;
    packets;
    peers;
    files;
    events;
    mapObjects;
    projection;
    incidents = new IncidentReducer();
    policyEngine = new DefaultPolicyEngine();
    ownIncidentIds = /* @__PURE__ */ new Set();
    previousHopByPacket = /* @__PURE__ */ new Map();
    now;
    batteryBand = 3;
    storagePressure = "ok";
    coarseLocation;
    queueEpoch = 0;
    gatewayProven = false;
    gatewayProvenAtMs;
    constructor(options) {
      this.options = options;
      this.packets = options.packets ?? new MemoryPacketRepository();
      this.peers = options.peers ?? new MemoryPeerRepository();
      this.events = options.events ?? new MemoryEventSink();
      this.mapObjects = options.mapObjects ?? new MemoryMapObjectRepository();
      this.projection = options.projection ?? new MapProjection();
      this.now = options.now ?? (() => Date.now());
      this.files = new FileAssembler(options.files ?? new MemoryFileRepository(), this.packets, this.events);
    }
    get nodeToken() {
      return this.options.nodeToken;
    }
    get localSourceId() {
      return this.options.localSourceId;
    }
    get profile() {
      return this.options.profile;
    }
    get currentQueueEpoch() {
      return this.queueEpoch;
    }
    setBatteryBand(band) {
      this.batteryBand = band;
    }
    setStoragePressure(pressure) {
      this.storagePressure = pressure;
    }
    setCoarseLocation(latE7, lonE7) {
      this.coarseLocation = { latE7, lonE7 };
    }
    /** GTW-001: only a live probe result may set this. */
    setGatewayProven(proven, atMs) {
      this.gatewayProven = proven;
      this.gatewayProvenAtMs = proven ? atMs : void 0;
      this.emit({
        category: EventCategory.GATEWAY,
        name: proven ? "gateway-proven" : "gateway-lost",
        severity: "info",
        atMs
      });
    }
    isGatewayProven(nowMs) {
      if (!this.gatewayProven || this.gatewayProvenAtMs === void 0)
        return false;
      return nowMs - this.gatewayProvenAtMs <= FRESHNESS.GATEWAY_PROOF_S * 1e3;
    }
    /** Registers an incident this device owns, so policy shows it in full. */
    claimIncident(incidentId) {
      this.ownIncidentIds.add(incidentId);
    }
    /**
     * THE ONE INGRESS. Tier 1 BLE, gateway downloads, and Tier 2 all land here.
     * Adding a transport must never add a second version of this method.
     */
    async ingest(bytes, transport, meta = {}) {
      const atMs = meta.atMs ?? this.now();
      const nowS = toEpochS(atMs);
      const peek = peekPacketId(bytes);
      const conflictingDigest = peek ? await this.packets.getDigest(peek) : void 0;
      const alreadyStored = peek ? await this.packets.hasSeen(peek) : false;
      const validation = validate(bytes, {
        nowS,
        transport,
        hopCountOnArrival: 0,
        isKnownDuplicate: alreadyStored,
        ...conflictingDigest ? { conflictingDigest } : {},
        streamTerminated: false,
        storagePressure: this.storagePressure,
        queueDepth: await this.packets.count(),
        maxQueueDepth: STORAGE.MAX_STORED_PACKETS,
        regionCode: this.options.regionCode
      });
      if (!validation.ok) {
        this.emit({
          category: EventCategory.VALIDATION,
          name: "rejected",
          severity: "warn",
          atMs,
          reason: validation.reason,
          transport,
          bytes: bytes.length,
          ...validation.packetId ? { packetId: validation.packetId } : {},
          result: validation.gate
        });
        return { accepted: false, validation, mapOperationsApplied: 0 };
      }
      const packet = validation.packet;
      const packetId = packet.header.packetId;
      this.emit({
        category: EventCategory.VALIDATION,
        name: "accepted",
        severity: "debug",
        atMs,
        packetId,
        packetType: packet.header.type,
        transport,
        bytes: validation.totalBytes,
        result: validation.sourceLabel
      });
      const policy = this.policyEngine.decide(packet, this.policyContext(transport, nowS));
      this.emit({
        category: EventCategory.POLICY,
        name: "decided",
        severity: "debug",
        atMs,
        packetId,
        packetType: packet.header.type,
        reason: policy.reasons.relay,
        result: `${policy.store}/${policy.display}/${policy.alert}/${policy.relay}/${policy.upload}/${policy.act}`
      });
      let storeOutcome;
      if (policy.store !== "discard") {
        const stored = {
          packet,
          encoded: {
            bytes,
            packetId,
            headerBytes: 64,
            payloadBytes: packet.header.payloadLength,
            totalBytes: validation.totalBytes
          },
          digest: validation.digest,
          storedAtMs: atMs,
          retentionUntilS: nowS + policy.retentionS
        };
        const observation = {
          packetId,
          transport,
          receivedAtMs: atMs,
          hopCountOnArrival: packet.header.hopCount,
          bytes: validation.totalBytes,
          ...meta.previousHopToken ? { previousHopToken: meta.previousHopToken } : {},
          ...meta.campaignId ? { campaignId: meta.campaignId } : {}
        };
        storeOutcome = await this.packets.insert(stored, observation, this.newCustody(packet, policy, atMs));
        if (storeOutcome === "inserted") {
          this.queueEpoch = this.queueEpoch + 1 & 65535;
        }
        if (storeOutcome === "conflict") {
          this.emit({
            category: EventCategory.VALIDATION,
            name: "conflict-quarantined",
            severity: "error",
            atMs,
            packetId,
            reason: "reject.digest-conflict"
          });
          return { accepted: false, packetId, validation, policy, storeOutcome, mapOperationsApplied: 0 };
        }
      }
      if (meta.previousHopToken)
        this.previousHopByPacket.set(packetId, meta.previousHopToken);
      if (storeOutcome === "duplicate") {
        this.emit({
          category: EventCategory.POLICY,
          name: "duplicate-suppressed",
          severity: "debug",
          atMs,
          packetId,
          reason: "policy.duplicate-suppressed"
        });
        return { accepted: true, packetId, validation, policy, storeOutcome, mapOperationsApplied: 0 };
      }
      if (packet.header.type === MessageType.FILE_MANIFEST || packet.header.type === MessageType.FILE_FRAGMENT) {
        const outcome2 = await this.files.accept(packet, nowS, atMs);
        this.emit({
          category: EventCategory.FILE,
          name: outcome2.kind,
          severity: outcome2.kind === "integrity-failed" ? "error" : "debug",
          atMs,
          packetId
        });
      }
      let mapOperationsApplied = 0;
      if (policy.act === "apply-map" || policy.act === "update-incident") {
        for (const operation of toMapOperations(packet, transport, nowS)) {
          const result = this.projection.apply(operation);
          if (result.applied) {
            mapOperationsApplied += 1;
            await this.syncPersistedMapObject(result.objectId);
          }
          this.emit({
            category: EventCategory.PROJECTION,
            name: operation.kind,
            severity: "debug",
            atMs,
            packetId,
            reason: result.reason,
            transport,
            result: result.applied ? "applied" : "ignored"
          });
        }
      }
      let incident;
      if (policy.act === "update-incident" || packet.header.type === MessageType.BACKEND_ACKNOWLEDGEMENT) {
        incident = this.incidents.apply(packet, {
          localSourceId: this.options.localSourceId,
          ...meta.previousHopToken ? { viaPeerToken: meta.previousHopToken } : {}
        });
        if (incident) {
          this.emit({
            category: EventCategory.INCIDENT,
            name: "state",
            severity: "info",
            atMs,
            packetId,
            incidentId: incident.incidentId,
            result: incident.state
          });
        }
      }
      return { accepted: true, packetId, validation, policy, storeOutcome, incident, mapOperationsApplied };
    }
    /** Local packet creation. OFF-002: durable BEFORE the UI claims success. */
    async createLocal(encoded, incidentId) {
      if (incidentId)
        this.claimIncident(incidentId);
      const result = await this.ingest(encoded.bytes, "local", { atMs: this.now() });
      this.emit({
        category: EventCategory.CUSTODY,
        name: "created-locally",
        severity: "info",
        atMs: this.now(),
        packetId: encoded.packetId,
        bytes: encoded.totalBytes
      });
      return result;
    }
    /** Builds the relay plan for one peer session. */
    async planSessionTransfer(peerToken, peerInventory, nowMs) {
      const peer = await this.peers.get(peerToken) ?? {
        peerToken,
        lastSeenAtMs: nowMs,
        gatewayProven: false,
        queueEpoch: 0,
        sessionsCompleted: 0,
        sessionsFailed: 0
      };
      const custodies = await this.packets.listRelayable(64);
      const candidates = [];
      for (const custody of custodies) {
        const stored = await this.packets.get(custody.packetId);
        if (!stored)
          continue;
        candidates.push({ packetId: custody.packetId, packet: stored.packet, custody });
      }
      const ctx = {
        peer,
        peerInventory,
        nowMs,
        localBatteryBand: this.batteryBand,
        previousHopByPacket: this.previousHopByPacket
      };
      return planTransfer(candidates, ctx);
    }
    async recordTransfer(packetId, peerToken, nowMs) {
      const custody = await this.packets.getCustody(packetId);
      const stored = await this.packets.get(packetId);
      if (!custody || !stored)
        return;
      await this.packets.updateCustody(afterTransfer(custody, peerToken, nowMs, stored.packet.header.type, stored.packet.header.severity));
      this.emit({
        category: EventCategory.TRANSFER,
        name: "record-sent",
        severity: "debug",
        atMs: nowMs,
        packetId,
        peerToken,
        bytes: stored.encoded.totalBytes
      });
    }
    /** Packet IDs this node can offer, for the inventory phase. */
    async inventoryIds(limit = 48) {
      const custodies = await this.packets.listRelayable(limit);
      return custodies.map((c) => c.packetId);
    }
    /** Housekeeping: expiry, peer eviction, incident expiry. */
    async maintain(nowMs) {
      const nowS = toEpochS(nowMs);
      const evicted = await this.packets.evictExpired(nowS);
      const peersEvicted = await this.peers.evictStale(nowMs);
      const incidentsExpired = this.incidents.expireOlderThan(nowS, CLASS_BUDGETS.HIGH.ttlS).length;
      return { evicted, peersEvicted, incidentsExpired };
    }
    /**
     * Rebuilds the map projection from every packet already held in storage,
     * then overwrites the persisted map-object mirror with the result.
     *
     * Called once at startup, after the caller has already painted whatever
     * was in that persisted mirror for a fast first render (mapObjects.list()
     * predates this call and is not read here). The packet log stays the one
     * source of truth (02-... "packet-to-map operation matrix"); this just
     * re-derives it deterministically and reconciles the mirror so it can
     * never permanently drift.
     */
    async rebuildMapFromStoredPackets(nowMs) {
      const nowS = toEpochS(nowMs);
      const stored = await this.packets.listAll();
      for (const item of stored) {
        const observations = await this.packets.listObservations(item.packet.header.packetId);
        const transport = observations[0]?.transport ?? "local";
        for (const operation of toMapOperations(item.packet, transport, nowS)) {
          this.projection.apply(operation);
        }
      }
      const visible = this.projection.visible(nowS);
      await this.mapObjects.replaceAll(visible.map(toMapObjectRecord));
    }
    /** Write-through for one changed object, called from ingest()'s apply loop. */
    async syncPersistedMapObject(objectId) {
      if (!objectId)
        return;
      const visible = this.projection.get(objectId);
      if (!visible || visible.tombstoned) {
        await this.mapObjects.remove(objectId);
        return;
      }
      await this.mapObjects.upsert(toMapObjectRecord(visible));
    }
    policyContext(transport, nowS) {
      return {
        role: this.options.profile.role,
        localSourceId: this.options.localSourceId,
        ownIncidentIds: this.ownIncidentIds,
        transport,
        nowS,
        ...this.coarseLocation ? { coarseLocation: this.coarseLocation } : {},
        displayRadiusM: this.options.displayRadiusM ?? 5e3,
        regionCode: this.options.regionCode,
        batteryBand: this.batteryBand,
        storagePressure: this.storagePressure,
        queueDepth: 0,
        packRegionKnown: true,
        nonCriticalAlertsEnabled: true
      };
    }
    newCustody(packet, policy, atMs) {
      const budget = CLASS_BUDGETS[budgetClassFor(packet.header.type, packet.header.severity)];
      const isOwn = packet.header.sourceId === this.options.localSourceId;
      return {
        packetId: packet.header.packetId,
        state: isOwn ? "created-locally" : "stored",
        copyBudgetRemaining: policy.relay === "never" ? 0 : budget.copyBudget,
        copiesMade: 0,
        knownHolders: [],
        uploadState: policy.upload === "never" ? "not-eligible" : packet.header.sourceClass === SourceClass.BACKEND ? "not-eligible" : "queued",
        linkReceiptCount: 0,
        lastOfferedAtMs: atMs
      };
    }
    emit(event) {
      this.events.emit(event);
    }
  };
  function peekPacketId(bytes) {
    if (bytes.length < 24)
      return void 0;
    let out = "";
    for (let i = 8; i < 24; i += 1)
      out += bytes[i].toString(16).padStart(2, "0");
    return out;
  }
  function toMapObjectRecord(object) {
    return {
      objectId: object.objectId,
      kind: object.kind,
      label: object.label,
      ...object.state !== void 0 ? { state: object.state } : {},
      ...object.latE7 !== void 0 ? { latE7: object.latE7 } : {},
      ...object.lonE7 !== void 0 ? { lonE7: object.lonE7 } : {},
      asOfS: object.asOfS,
      provenance: object.provenance
    };
  }

  // packages/node-runtime/dist/relay-loop.js
  var RelayLoop = class {
    options;
    sessions = /* @__PURE__ */ new Map();
    peerInventories = /* @__PURE__ */ new Map();
    consecutiveFailures = /* @__PURE__ */ new Map();
    /** One inventory announcement and one filtered push per session. */
    announced = /* @__PURE__ */ new Set();
    pushed = /* @__PURE__ */ new Set();
    /** REL-007: earliest next connection attempt per peer, from backoffMs(). */
    nextAttemptAtMs = /* @__PURE__ */ new Map();
    /**
     * REL-003 optimisation: the (their epoch, our epoch) pair at the last
     * completed reconciliation with a peer. If neither side's queue has changed
     * since, there is nothing to exchange and the whole session is skipped.
     */
    lastReconciled = /* @__PURE__ */ new Map();
    unsubscribe;
    running = false;
    constructor(options) {
      this.options = options;
    }
    async start() {
      const { adapter, engine } = this.options;
      this.unsubscribe = adapter.addEventListener((event) => {
        void this.handle(event);
      });
      await adapter.startRelay(this.summary());
      this.running = true;
      engine.events.emit({
        category: EventCategory.RELAY_LIFECYCLE,
        name: "started",
        severity: "info",
        atMs: this.options.now()
      });
    }
    async stop() {
      this.running = false;
      this.unsubscribe?.();
      await this.options.adapter.stopRelay();
      this.options.engine.events.emit({
        category: EventCategory.RELAY_LIFECYCLE,
        name: "stopped",
        severity: "info",
        atMs: this.options.now()
      });
    }
    get isRunning() {
      return this.running;
    }
    /** Republishes the advertisement when the queue epoch changes. */
    async refreshAdvertisement() {
      if (!this.running)
        return;
      await this.options.adapter.updateDiscoverySummary(this.summary());
    }
    summary() {
      const { engine } = this.options;
      return buildDiscoverySummary({
        nodeToken: engine.nodeToken,
        queueEpoch: engine.currentQueueEpoch,
        highestWaitingPriority: 0,
        inventoryHint: engine.currentQueueEpoch,
        gatewayProven: this.options.gatewayProven?.() ?? false,
        gatewayFreshnessClass: this.options.gatewayProven?.() ? 0 : 2,
        acceptingConnections: this.sessions.size < 2,
        capabilityBits: CapabilityBit.GATT_SERVER | CapabilityBit.GATT_CLIENT | CapabilityBit.FRAGMENTS | (engine.profile.role === "responder" ? CapabilityBit.RESPONDER_MODE : 0)
      });
    }
    async handle(event) {
      const { engine, adapter, now } = this.options;
      switch (event.kind) {
        case "peer-observed": {
          const known = await engine.peers.get(event.nodeToken);
          await engine.peers.observe({
            peerToken: event.nodeToken,
            lastSeenAtMs: event.observedAtMs,
            ...event.rssi !== void 0 ? { rssi: event.rssi } : {},
            gatewayProven: event.summary.gatewayProven,
            queueEpoch: event.summary.queueEpoch,
            sessionsCompleted: known?.sessionsCompleted ?? 0,
            sessionsFailed: known?.sessionsFailed ?? 0
          });
          engine.events.emit({
            category: EventCategory.PEER_DISCOVERY,
            name: "observed",
            severity: "debug",
            atMs: event.observedAtMs,
            peerToken: event.nodeToken
          });
          const retryAt = this.nextAttemptAtMs.get(event.nodeToken) ?? 0;
          const backoffElapsed = event.observedAtMs >= retryAt;
          const reconciled = this.lastReconciled.get(event.nodeToken);
          const nothingChanged = reconciled !== void 0 && reconciled.theirs === event.summary.queueEpoch && reconciled.ours === engine.currentQueueEpoch;
          if (nothingChanged) {
            engine.events.emit({
              category: EventCategory.INVENTORY,
              name: "session-skipped",
              severity: "debug",
              atMs: event.observedAtMs,
              peerToken: event.nodeToken,
              reason: "no useful difference",
              metrics: { queueEpoch: event.summary.queueEpoch }
            });
            break;
          }
          if (this.running && backoffElapsed && shouldInitiate(engine.nodeToken, event.nodeToken)) {
            if (!this.hasSessionWith(event.nodeToken) && event.summary.acceptingConnections) {
              try {
                const sessionId = await adapter.openSession(event.nodeToken);
                this.sessions.set(sessionId, new SessionStateMachine(sessionId, event.nodeToken, true, now()));
                await this.runSession(sessionId, event.nodeToken);
              } catch {
                await this.recordPeerOutcome(event.nodeToken, false, now());
              }
            }
          }
          break;
        }
        case "session": {
          if (event.phase !== "establish")
            break;
          if (event.initiatedLocally)
            break;
          if (!this.sessions.has(event.sessionId)) {
            this.sessions.set(event.sessionId, new SessionStateMachine(event.sessionId, event.peerToken, false, event.atMs));
          }
          break;
        }
        case "record-received": {
          const peek = decodePacket(event.bytes);
          if (peek.ok && peek.packet.header.type === MessageType.INVENTORY) {
            await this.absorbInventory(event.sessionId, event.peerToken, peek.packet, event.atMs);
            break;
          }
          const result = await engine.ingest(event.bytes, event.transport, {
            previousHopToken: event.peerToken,
            atMs: event.atMs
          });
          if (result.accepted && result.packetId) {
            const decoded = decodePacket(event.bytes);
            if (decoded.ok && decoded.packet.header.type !== MessageType.LINK_RECEIPT) {
              const receipt = buildLinkReceipt({
                sourceId: engine.localSourceId,
                sourceClass: engine.profile.role === "responder" ? SourceClass.RESPONDER_PROVISIONED : SourceClass.GENERAL_PUBLIC,
                nowS: toEpochS(event.atMs)
              }, result.packetId, decoded.packet.header.digestPrefix, engine.nodeToken, 0);
              try {
                await adapter.sendRecord(event.sessionId, receipt);
              } catch {
              }
            }
          }
          this.sessions.get(event.sessionId)?.recordAcknowledged(event.atMs);
          break;
        }
        case "session-closed": {
          this.sessions.delete(event.sessionId);
          this.peerInventories.delete(event.peerToken);
          this.announced.delete(event.sessionId);
          this.pushed.delete(event.sessionId);
          const succeeded = event.reason === "complete" || event.reason === "peer-closed";
          await this.recordPeerOutcome(event.peerToken, succeeded, event.atMs);
          engine.events.emit({
            category: EventCategory.SESSION,
            name: "closed",
            severity: "debug",
            atMs: event.atMs,
            sessionId: event.sessionId,
            peerToken: event.peerToken,
            result: event.reason,
            metrics: { records: event.recordsAccepted, bytes: event.bytesTransferred }
          });
          break;
        }
        case "relay-state-changed":
          engine.events.emit({
            category: EventCategory.RELAY_LIFECYCLE,
            name: event.state,
            severity: "info",
            atMs: event.atMs
          });
          break;
        case "error":
          engine.events.emit({
            category: EventCategory.SESSION,
            name: "error",
            severity: "error",
            atMs: event.atMs,
            reason: event.code,
            result: event.recoverable ? "recoverable" : "fatal"
          });
          break;
        default:
          break;
      }
    }
    /** Hello -> inventory -> request -> transfer -> receipt -> close. */
    /**
     * Opens the exchange. The initiator announces its inventory and stops there.
     *
     * It deliberately does NOT push or close here: it has not yet seen what the
     * peer holds. Both the push and the close happen in absorbInventory() once
     * the peer answers, so every transfer is filtered (REL-003/REL-004).
     */
    async runSession(sessionId, _peerToken) {
      const machine = this.sessions.get(sessionId);
      if (!machine)
        return;
      const atMs = this.options.now();
      machine.advance(atMs);
      machine.advance(atMs);
      await this.announceInventory(sessionId);
      machine.advance(atMs);
    }
    /**
     * Sends the packets this node holds that the peer is missing.
     *
     * `peerInventories` is populated from the peer's INVENTORY packet, so the
     * plan can skip anything they already hold. Both sides run this, which is
     * what makes the session bidirectional.
     */
    async pushOffers(sessionId, peerToken) {
      const { engine, adapter, now } = this.options;
      const machine = this.sessions.get(sessionId);
      if (!machine)
        return;
      const peerInventory = this.peerInventories.get(peerToken) ?? /* @__PURE__ */ new Set();
      const plan = await engine.planSessionTransfer(peerToken, peerInventory, now());
      engine.events.emit({
        category: EventCategory.INVENTORY,
        name: "planned",
        severity: "debug",
        atMs: now(),
        sessionId,
        peerToken,
        metrics: {
          offered: plan.offers.length,
          skipped: plan.skipped.length,
          bytes: plan.totalBytes,
          peerAlreadyHolds: peerInventory.size
        }
      });
      for (const offer of plan.offers) {
        const stored = await engine.packets.get(offer.candidate.packetId);
        if (!stored)
          continue;
        if (!machine.canSend(stored.encoded.totalBytes))
          break;
        try {
          await adapter.sendRecord(sessionId, stored.encoded);
        } catch {
          break;
        }
        machine.recordSent(stored.encoded.totalBytes, now());
        await engine.recordTransfer(offer.candidate.packetId, peerToken, now());
      }
    }
    /**
     * Records the peer's inventory, answers with our own if we have not yet,
     * then pushes only what the peer is missing.
     *
     * Each side pushes exactly once per session, and both pushes are filtered.
     * No blocking primitive is needed: the exchange is purely event-driven.
     */
    async absorbInventory(sessionId, peerToken, packet, atMs) {
      const { engine, adapter } = this.options;
      const payload = packet.payload;
      const held = /* @__PURE__ */ new Set();
      for (const id of payload["criticalIds"] ?? [])
        held.add(id);
      for (const id of payload["terminalIds"] ?? [])
        held.add(id);
      for (const entry of payload["entries"] ?? []) {
        if (entry?.packetId)
          held.add(entry.packetId);
      }
      this.peerInventories.set(peerToken, held);
      engine.events.emit({
        category: EventCategory.INVENTORY,
        name: "received",
        severity: "debug",
        atMs,
        sessionId,
        peerToken,
        metrics: { peerHolds: held.size }
      });
      if (!this.announced.has(sessionId)) {
        try {
          await this.announceInventory(sessionId);
        } catch (error) {
          engine.events.emit({
            category: EventCategory.INVENTORY,
            name: "announce-failed",
            severity: "error",
            atMs,
            sessionId,
            peerToken,
            reason: String(error)
          });
        }
      }
      if (this.pushed.has(sessionId))
        return;
      this.pushed.add(sessionId);
      await this.pushOffers(sessionId, peerToken);
      this.lastReconciled.set(peerToken, {
        theirs: Number(payload["queueEpoch"] ?? 0),
        ours: engine.currentQueueEpoch
      });
      const machine = this.sessions.get(sessionId);
      if (machine?.initiatedLocally) {
        machine.advance(atMs);
        machine.advance(atMs);
        machine.advance(atMs);
        await adapter.closeSession(sessionId).catch(() => void 0);
      }
    }
    /**
     * Sends this node's inventory once per session.
     *
     * The list is TRUNCATED TO FIT the session-control payload budget. A packet
     * ID is 32 hex characters, so only a handful fit in 180 bytes -- and an
     * inventory that overflows does not merely lose entries, it throws and takes
     * the whole exchange down with it. `truncated` tells the peer the list is
     * partial so it does not conclude we hold nothing else.
     */
    async announceInventory(sessionId) {
      if (this.announced.has(sessionId))
        return;
      this.announced.add(sessionId);
      const { engine, adapter, now } = this.options;
      const buildCtx = {
        sourceId: engine.localSourceId,
        sourceClass: engine.profile.role === "responder" ? SourceClass.RESPONDER_PROVISIONED : SourceClass.GENERAL_PUBLIC,
        nowS: toEpochS(now())
      };
      const available = await engine.inventoryIds();
      const carried = [];
      for (const id of available.slice(0, SESSION.MAX_CRITICAL_EXPLICIT_IDS)) {
        const attempt = [...carried, id];
        try {
          buildInventory(buildCtx, {
            criticalIds: attempt,
            entries: [],
            terminalIds: [],
            queueEpoch: engine.currentQueueEpoch,
            truncated: true
          });
        } catch {
          break;
        }
        carried.push(id);
      }
      const record = buildInventory(buildCtx, {
        criticalIds: carried,
        entries: [],
        terminalIds: [],
        queueEpoch: engine.currentQueueEpoch,
        truncated: carried.length < available.length
      });
      engine.events.emit({
        category: EventCategory.INVENTORY,
        name: "announced",
        severity: "debug",
        atMs: now(),
        sessionId,
        bytes: record.totalBytes,
        metrics: { carried: carried.length, held: available.length }
      });
      await adapter.sendRecord(sessionId, record);
    }
    /**
     * Records one contact outcome against a peer.
     *
     * Feeds two things: the `reliability` term of the forwarding utility, and
     * the consecutive-failure count that `backoffMs()` needs.
     */
    async recordPeerOutcome(peerToken, succeeded, atMs) {
      const { engine } = this.options;
      const known = await engine.peers.get(peerToken);
      if (!known)
        return;
      await engine.peers.observe({
        ...known,
        lastSeenAtMs: Math.max(known.lastSeenAtMs, atMs),
        sessionsCompleted: known.sessionsCompleted + (succeeded ? 1 : 0),
        sessionsFailed: known.sessionsFailed + (succeeded ? 0 : 1)
      });
      const consecutive = succeeded ? 0 : (this.consecutiveFailures.get(peerToken) ?? 0) + 1;
      if (succeeded) {
        this.consecutiveFailures.delete(peerToken);
        this.nextAttemptAtMs.delete(peerToken);
      } else {
        this.consecutiveFailures.set(peerToken, consecutive);
        this.nextAttemptAtMs.set(peerToken, atMs + backoffMs(consecutive));
      }
      engine.events.emit({
        category: EventCategory.PEER_DISCOVERY,
        name: succeeded ? "contact-succeeded" : "contact-failed",
        severity: "debug",
        atMs,
        peerToken,
        metrics: { consecutiveFailures: consecutive }
      });
    }
    /** Consecutive failed contacts per peer, for `backoffMs()`. */
    consecutiveFailuresFor(peerToken) {
      return this.consecutiveFailures.get(peerToken) ?? 0;
    }
    hasSessionWith(peerToken) {
      const now = this.options.now();
      for (const [sessionId, session] of this.sessions) {
        if (session.peerToken !== peerToken)
          continue;
        if (session.isClosed || session.checkBudgets(now)) {
          this.sessions.delete(sessionId);
          this.announced.delete(sessionId);
          this.pushed.delete(sessionId);
          continue;
        }
        return true;
      }
      return false;
    }
  };

  // packages/node-runtime/dist/gateway-sync.js
  var GatewaySynchronizer = class {
    options;
    gatewayToken;
    outboundCursor;
    /** Only advanced after a confirmed backend response (02-... transactions). */
    lastConfirmedCursor;
    consecutiveFailures = 0;
    constructor(options) {
      this.options = options;
    }
    /**
     * One full sync cycle. Safe to call when offline: it probes first and
     * degrades to a no-op without losing queued work (GTW-007).
     */
    async sync() {
      const { engine, client, now } = this.options;
      const atMs = now();
      const probe = await client.probe();
      engine.setGatewayProven(probe.proven, probe.atMs);
      if (!probe.proven) {
        this.consecutiveFailures += 1;
        return {
          probed: true,
          proven: false,
          uploaded: 0,
          accepted: 0,
          duplicates: 0,
          downloaded: 0,
          injectedIntoMesh: 0,
          ...probe.failureReason ? { failureReason: probe.failureReason } : {}
        };
      }
      this.consecutiveFailures = 0;
      if (!this.gatewayToken) {
        const registration = await client.register(engine.nodeToken, this.options.regionCode);
        this.gatewayToken = registration.gatewayToken;
      }
      const upload = await this.uploadBatch(atMs);
      const download = await this.downloadBatch(atMs);
      return {
        probed: true,
        proven: true,
        uploaded: upload.uploaded,
        accepted: upload.accepted,
        duplicates: upload.duplicates,
        downloaded: download.downloaded,
        injectedIntoMesh: download.injected
      };
    }
    /** Mesh-to-internet: critical packets first, then bounded normal batches. */
    async uploadBatch(atMs) {
      const { engine, client } = this.options;
      const custodies = await engine.packets.listUploadQueue(GATEWAY.MAX_UPLOAD_BATCH);
      if (custodies.length === 0)
        return { uploaded: 0, accepted: 0, duplicates: 0 };
      const items = [];
      let bytes = 0;
      for (const custody of custodies) {
        const stored = await engine.packets.get(custody.packetId);
        if (!stored)
          continue;
        if (bytes + stored.encoded.totalBytes > GATEWAY.MAX_BATCH_BYTES)
          break;
        const observations = await engine.packets.listObservations(custody.packetId);
        const first = observations[0];
        items.push({
          bytes: stored.encoded.bytes,
          packetId: custody.packetId,
          observation: {
            receivedAtMs: first?.receivedAtMs ?? stored.storedAtMs,
            transport: first?.transport ?? "local",
            hopCountOnArrival: first?.hopCountOnArrival ?? 0
          }
        });
        bytes += stored.encoded.totalBytes;
      }
      if (items.length === 0)
        return { uploaded: 0, accepted: 0, duplicates: 0 };
      const batchId = `${engine.nodeToken}-${atMs}`;
      const response = await client.upload({ gatewayToken: this.gatewayToken, batchId, items });
      let accepted = 0;
      let duplicates = 0;
      for (const result of response.results) {
        if (result.outcome === "accepted")
          accepted += 1;
        if (result.outcome === "duplicate")
          duplicates += 1;
        const custody = await engine.packets.getCustody(result.packetId);
        if (custody && (result.outcome === "accepted" || result.outcome === "duplicate")) {
          await engine.packets.updateCustody({ ...custody, uploadState: "uploaded" });
        }
      }
      engine.events.emit({
        category: EventCategory.GATEWAY,
        name: "upload",
        severity: "info",
        atMs,
        bytes,
        metrics: { items: items.length, accepted, duplicates }
      });
      return { uploaded: items.length, accepted, duplicates };
    }
    /** Internet-to-mesh: download, revalidate locally, then advertise onward. */
    async downloadBatch(atMs) {
      const { engine, client } = this.options;
      const response = await client.pollOutbound({
        gatewayToken: this.gatewayToken,
        ...this.outboundCursor ? { cursor: this.outboundCursor } : {},
        regionCode: this.options.regionCode,
        maxItems: GATEWAY.MAX_DOWNLOAD_BATCH
      });
      const acked = [];
      let injected = 0;
      for (const item of response.items) {
        const result = await engine.ingest(item.bytes, "gateway", { atMs });
        if (result.accepted)
          injected += 1;
        acked.push(item.packetId);
      }
      if (acked.length > 0 && response.nextCursor) {
        await client.ackOutbound({
          gatewayToken: this.gatewayToken,
          cursor: response.nextCursor,
          packetIds: acked
        });
        this.lastConfirmedCursor = response.nextCursor;
        this.outboundCursor = response.nextCursor;
      }
      engine.events.emit({
        category: EventCategory.GATEWAY,
        name: "download",
        severity: "info",
        atMs,
        metrics: { downloaded: response.items.length, injected }
      });
      return { downloaded: response.items.length, injected };
    }
    get cursor() {
      return this.lastConfirmedCursor;
    }
    get failures() {
      return this.consecutiveFailures;
    }
  };

  // apps/mobile/src/screens/screen-registry.ts
  var screen_registry_exports = {};
  __export(screen_registry_exports, {
    REQUIRED_SCREEN_COUNT: () => REQUIRED_SCREEN_COUNT,
    SCREENS: () => SCREENS
  });
  var SCREENS = [
    {
      route: "Readiness",
      title: "Readiness and role",
      requirements: ["OFF-001", "OFF-004", "OFF-006", "ROL-001", "ROL-002", "DEC-004"],
      mustShow: [
        "selected local role (General Public / Responder)",
        "offline content pack name, version, region",
        "Bluetooth support and permission status",
        "relay-mode status",
        'internet state as untested / unavailable / probing / proven gateway -- never "connected"',
        "last-known location status",
        "Tier 2 listening inactive/active",
        "whether the transport is SIMULATED or native (DEC-004, working rule 11)",
        "a prominent route to Home even when permissions are incomplete"
      ],
      status: "complete"
    },
    {
      route: "Home",
      title: "Citizen home",
      requirements: ["SOS-001", "OFF-001", "MAP-001"],
      mustShow: [
        "large primary SOS action that IMMEDIATELY creates a default urgent SOS (rapid path)",
        "current operating mode",
        "active SOS status if one exists",
        "most urgent relevant alert",
        "nearest useful resources from offline data",
        "relay status and recent peer count",
        "last proven gateway / acknowledgement state",
        "offline map entry",
        'NO generic "Connected" label -- say what is connected'
      ],
      status: "partial"
    },
    {
      route: "SosComposer",
      title: "SOS composer",
      requirements: ["SOS-002", "SOS-003", "OFF-002", "OFF-005"],
      mustShow: [
        "expanded path: category, 4-level severity, people count, injured count",
        "mobility: mobile / limited / immobile / trapped / unknown",
        "short constrained note or prepared phrase",
        "location source, accuracy, and age",
        "language preference",
        "confirmation of what will be shared locally",
        "creation must succeed with NO location and NO internet"
      ],
      status: "complete"
    },
    {
      route: "ActiveSos",
      title: "Active SOS and delivery timeline",
      requirements: ["SOS-007", "SOS-008", "SOS-010", "DEC-022", "GTW-008"],
      mustShow: [
        "local-save timestamp",
        "number of DISTINCT peer link receipts",
        "responder acknowledgement, shown SEPARATELY",
        "gateway/backend acknowledgement, shown SEPARATELY",
        "assignment / accepted / en route / arrived / resolved states",
        "next retry/relay state in plain language",
        "update and cancel actions",
        "location age and an update-location action",
        'a relay copy is NEVER described as "help is coming" (use DELIVERY_STATE_COPY)'
      ],
      status: "partial"
    },
    {
      route: "Map",
      title: "Offline operational map and list",
      requirements: ["MAP-001", "MAP-003", "MAP-004", "MAP-005", "MAP-010", "MAP-011"],
      mustShow: [
        "layers: self, SOS, responders, permitted peers, hospitals, shelters, food/water, safe zones, help centres, hazards, route changes, gateway observations, optional topology",
        "every dynamic marker exposes update age; accuracy when supplied",
        "stale markers are visually stale and eventually withdrawn",
        "detail sheet: source category, last update, location quality, state, action",
        "a LIST equivalent for accessibility and low-performance devices"
      ],
      status: "partial"
    },
    {
      route: "NearbyIncidents",
      title: "Nearby incidents",
      requirements: ["ROL-006", "ROL-007", "MAP-011"],
      mustShow: [
        "General Public: the configured MINIMAL public view only",
        "Responder: sort by severity ONLY"
      ],
      status: "complete"
    },
    {
      route: "ResponderIncident",
      title: "Responder incident detail",
      requirements: ["OFF-007", "ROL-007"],
      mustShow: [
        "accept or decline",
        "mark en route",
        "last-known location and its uncertainty",
        "latest incident update and timeline",
        "Send My Location button (deliberate publish of responder status/location)",
        "mark arrived",
        "resolve with a reason, or escalate/reopen where the demo workflow allows",
        "every transition produces a compact state packet"
      ],
      status: "complete"
    },
    {
      route: "ResourceDetail",
      title: "Local help / resource detail",
      requirements: ["MAP-004", "MAP-008", "DEC-020"],
      mustShow: [
        "type and name",
        "stable object identity for diagnostics",
        "coordinates and offline route context",
        "open / closed / unknown state",
        "capacity or availability if supplied",
        "last update and source category",
        "whether the value came from base pack, Tier 1, Tier 2, or gateway",
        "superseded / stale warning"
      ],
      status: "complete"
    },
    {
      route: "RelayStatus",
      title: "Relay and gateway status",
      requirements: ["REL-001", "GTW-001", "GTW-007"],
      mustShow: [
        "relay active/inactive with a visible STOP control",
        "scan/advertise capability",
        "peers recently seen",
        "packets stored, queued, forwarded, expired, rejected, waiting",
        "queue BY PRIORITY -- never personal packet contents",
        "proven internet state and last probe time",
        "last upload / last download",
        "battery mode"
      ],
      status: "partial"
    },
    {
      route: "Tier2Listen",
      title: "Tier 2 listening",
      requirements: ["T2-002", "T2-003", "T2-007", "T2-008"],
      mustShow: [
        "history of all messages received from gg waves",
        "active campaign ID and version when detected",
        "frames detected / valid / corrupt / duplicate / missing",
        "packets recovered versus the expected manifest",
        "resulting alerts and map actions"
      ],
      status: "partial"
    },
    {
      route: "Diagnostics",
      title: "Diagnostics",
      requirements: ["INT-004", "INT-007"],
      mustShow: [
        "transport, packet ID prefix, packet type, size",
        "source category",
        "timestamps",
        "validation outcome with its gate and reason code",
        "policy outcomes (store/show/alert/relay/upload/act) with reason codes",
        "resulting map or incident action",
        "kept separable from the normal citizen experience"
      ],
      status: "complete"
    },
    {
      route: "Profile",
      title: "Profile and offline data",
      requirements: ["OFF-004"],
      mustShow: [
        "update district/region setting",
        "trigger download of new offline map/content pack for selected region"
      ],
      status: "partial"
    }
  ];
  var REQUIRED_SCREEN_COUNT = 12;

  // apps/mobile/src/services/app-runtime.ts
  var app_runtime_exports = {};
  __export(app_runtime_exports, {
    AppRuntime: () => AppRuntime,
    describeCapabilities: () => describeCapabilities
  });
  var AppRuntime = class _AppRuntime {
    constructor(config, engine, adapter, resolver) {
      this.config = config;
      this.adapter = adapter;
      this.resolver = resolver;
      this.engine = engine;
      this.relay = new RelayLoop({
        engine,
        adapter,
        now: () => Date.now(),
        gatewayProven: () => engine.isGatewayProven(Date.now())
      });
    }
    engine;
    relay;
    gatewaySync;
    static async create(config, resolver) {
      const adapter = config.adapterFactory ? await config.adapterFactory(config.adapter) : await selectAdapter(config.adapter);
      const engine = new NodeEngine({
        profile: config.profile,
        localSourceId: config.localSourceId ?? newSourceId(),
        nodeToken: config.nodeToken ?? newNodeToken(),
        regionCode: config.regionCode,
        ...config.packets ? { packets: config.packets } : {},
        ...config.peers ? { peers: config.peers } : {},
        ...config.files ? { files: config.files } : {},
        ...config.mapObjects ? { mapObjects: config.mapObjects } : {},
        ...config.events ? { events: config.events } : {},
        projection: new MapProjection(resolver)
      });
      return new _AppRuntime(config, engine, adapter, resolver);
    }
    get sourceClass() {
      return this.config.profile.role === "responder" ? SourceClass.RESPONDER_PROVISIONED : SourceClass.GENERAL_PUBLIC;
    }
    /**
     * REL-001: relay mode is explicit, visible, and stoppable.
     *
     * Permissions are requested HERE, not left to whichever screen happens to
     * run first. Relay starts an Android foreground service of type
     * `connectedDevice`, and since Android 14 that service is killed with a
     * SecurityException unless a Bluetooth permission is ALREADY granted. The
     * app previously only asked on the Readiness screen, so pressing SOS from
     * Home on a fresh install crashed the process instantly with nothing shown
     * to the user.
     */
    async startRelay() {
      const permissions = await this.adapter.requestPermissions();
      const canRunForegroundService = permissions.bluetoothAdvertise === "granted" || permissions.bluetoothConnect === "granted" || permissions.bluetoothScan === "granted";
      if (!canRunForegroundService) {
        throw new Error(
          "Bluetooth permission is required to start relay. Grant nearby-devices access and try again."
        );
      }
      await this.relay.start();
    }
    async stopRelay() {
      await this.relay.stop();
    }
    attachGateway(sync) {
      this.gatewaySync = sync;
    }
    /** GTW-001: nothing else in the app may declare a gateway. */
    async probeGateway() {
      if (!this.gatewaySync) return false;
      const report = await this.gatewaySync.sync();
      return report.proven;
    }
    getCapabilities() {
      return this.adapter.getCapabilities();
    }
    requestPermissions() {
      return this.adapter.requestPermissions();
    }
  };
  async function selectAdapter(selection) {
    if (selection === "simulated") {
      return new SimulatedTransportAdapter(newNodeToken(), new RadioMedium());
    }
    throw new Error(
      `Transport "${selection}" needs the native module from an Expo development build. Stock Expo Go cannot provide real Bluetooth (DEC-004). Use "simulated" in Expo Go.`
    );
  }
  function describeCapabilities(report) {
    const lines = [];
    lines.push(report.simulated ? "Transport: SIMULATED (not real Bluetooth)" : "Transport: native Android Bluetooth");
    lines.push(`Bluetooth available: ${report.bluetoothAvailable ? "yes" : "no"}`);
    lines.push(`Bluetooth enabled: ${report.bluetoothEnabled ? "yes" : "no"}`);
    lines.push(`BLE advertise: ${report.bleAdvertiseSupported ? "supported" : "not supported"}`);
    lines.push(`BLE scan: ${report.bleScanSupported ? "supported" : "not supported"}`);
    lines.push(`GATT server: ${report.gattServerSupported ? "available" : "unavailable"}`);
    lines.push(`Microphone: ${report.audioInputAvailable ? "available" : "unavailable"}`);
    return lines;
  }

  // tools/mesh-simulator/bundler/entry.mjs
  globalThis.DSM = {
    contracts: dist_exports,
    codec: dist_exports2,
    validator: dist_exports3,
    policy: dist_exports4,
    routing: dist_exports5,
    store: dist_exports6,
    incident: dist_exports7,
    mapkit: dist_exports8,
    transportCore: dist_exports9,
    tier2: dist_exports10,
    gatewayClient: dist_exports11,
    nodeRuntime: dist_exports12,
    mobile: { screens: screen_registry_exports, runtime: app_runtime_exports }
  };
})();
