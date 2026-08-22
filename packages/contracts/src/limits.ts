/**
 * PERFORMANCE AND RESOURCE BUDGETS  --  FROZEN (Gate I)
 *
 * Spec: 02-... "Performance and resource budgets" -- "No budget may remain
 * 'unlimited'. Values can be tuned after measurement, but the configuration
 * and evidence must remain visible."
 *
 * Every value here is a first-pass engineering target taken from the specs.
 * Tuning a number is a normal PR; REMOVING a bound is a Gate I change.
 * Record measured values in evidence/packet-size-sheet.md when you tune.
 */

export const ENVELOPE = {
  /** Fixed transport header, 04-BLUEPRINT section 7.2. */
  HEADER_BYTES: 64,
  /** Room for optional typed header extensions (GEO, ROUTING, FILE, ...). */
  MAX_HEADER_BYTES: 192,
  MAX_PAYLOAD_BYTES: 4096,
  /** Hard rejection bound applied BEFORE any allocation (INT-001). */
  MAX_TOTAL_BYTES: 4096 + 192,
} as const;

export const PACKET_ID_BYTES = 16;
export const SOURCE_ID_BYTES = 8;
export const DIGEST_PREFIX_BYTES = 8;

/** Per-type maximum encoded payload. Enforced before allocation. */
export const MAX_PAYLOAD_BY_CLASS = {
  EMERGENCY: 320,
  RESPONSE_CONTROL: 192,
  RECEIPT: 128,
  RESOURCE: 400,
  HAZARD_ROUTE: 400,
  AUTHORITY: 512,
  CHECKIN: 320,
  REQUEST: 256,
  CONTENT_OP: 256,
  FILE_MANIFEST: 1024,
  FILE_FRAGMENT: 4096,
  SESSION_CONTROL: 1024,
} as const;

export const FIELD_LIMITS = {
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
  MAX_RESPONSE_OPTIONS: 8,
} as const;

export const TIME = {
  /** Compact timestamps are seconds since this epoch (2025-01-01T00:00:00Z). */
  DEMO_EPOCH_MS: Date.UTC(2025, 0, 1),
  /** Accepted clock skew before a packet is flagged implausible (02-... clock anomalies). */
  MAX_CLOCK_SKEW_S: 15 * 60,
  /** A creation time further ahead than this is rejected outright. */
  MAX_FUTURE_S: 60 * 60,
  /** Nothing may be retained on an absolute expiry beyond this horizon. */
  MAX_TTL_S: 24 * 60 * 60,
} as const;

/**
 * Per-class replication bounds.
 * Spec: 02-... "Copy budgets by class" -- relative order is binding,
 * exact numbers are test configuration.
 */
export interface ClassBudget {
  /** Initial number of onward copies this node may make. */
  readonly copyBudget: number;
  /** Maximum peers served in one queue epoch. */
  readonly peersPerEpoch: number;
  /** Seconds before the same packet may be offered to the same neighbor again. */
  readonly retryCooldownS: number;
  readonly hopLimit: number;
  readonly ttlS: number;
}

export const CLASS_BUDGETS = {
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
  LOW: { copyBudget: 2, peersPerEpoch: 1, retryCooldownS: 600, hopLimit: 2, ttlS: 3600 },
} as const satisfies Record<string, ClassBudget>;

export type ClassBudgetName = keyof typeof CLASS_BUDGETS;

export const SESSION = {
  MAX_DURATION_MS: 20_000,
  IDLE_TIMEOUT_MS: 5_000,
  MAX_BYTES: 64 * 1024,
  MAX_IN_FLIGHT_RECORDS: 4,
  MAX_CONCURRENT_SESSIONS: 2,
  MAX_RECORDS: 64,
  /** Inventory entries a node may advertise in one session. */
  MAX_INVENTORY_ENTRIES: 48,
  /** Explicit critical IDs always sent in full before the compact summary. */
  MAX_CRITICAL_EXPLICIT_IDS: 16,
  /** Backoff after a failed session, before jitter. */
  BACKOFF_BASE_MS: 2_000,
  BACKOFF_MAX_MS: 60_000,
  BACKOFF_JITTER_MS: 1_500,
} as const;

export const STORAGE = {
  MAX_STORED_PACKETS: 2_000,
  MAX_INCOMPLETE_OBJECTS: 8,
  MAX_FRAGMENTS_PER_OBJECT: 64,
  MAX_REASSEMBLY_BYTES: 256 * 1024,
  /** FIL-007: one strict maximum size for the demo. */
  MAX_FILE_BYTES: 128 * 1024,
  /** Seen-ID records survive payload eviction so duplicates stay suppressed. */
  SEEN_ID_RETENTION_S: 12 * 3600,
  MAX_SEEN_IDS: 20_000,
  PEER_OBSERVATION_RETENTION_S: 30 * 60,
  TOPOLOGY_OBSERVATION_RETENTION_S: 15 * 60,
  EVENT_LOG_RETENTION_S: 6 * 3600,
  MAX_EVENT_LOG_ENTRIES: 5_000,
  /** How long a terminal record is kept to suppress stale copies (SOS-009). */
  TOMBSTONE_RETENTION_S: 2 * 3600,
} as const;

export const FRESHNESS = {
  /** Newer than this: a location may be presented as current (DEC-020, MAP-005). */
  LOCATION_LIVE_S: 120,
  /** Between live and stale: shown with explicit age. */
  LOCATION_STALE_S: 600,
  /** Older than this: the marker is withdrawn from the map. */
  LOCATION_EXPIRE_S: 3600,
  /** A gateway flag is only trusted this long after a successful probe (GTW-001). */
  GATEWAY_PROOF_S: 120,
  PEER_RECENT_S: 300,
} as const;

export const GATEWAY = {
  PROBE_TIMEOUT_MS: 4_000,
  PROBE_INTERVAL_MS: 60_000,
  MAX_UPLOAD_BATCH: 32,
  MAX_DOWNLOAD_BATCH: 32,
  MAX_BATCH_BYTES: 128 * 1024,
  SYNC_INTERVAL_MS: 30_000,
  MAX_UPLOAD_RETRIES: 5,
} as const;

export const TIER2 = {
  /** Ultra-compact radio frame. Not the 64-byte Tier 1 envelope (02-...). */
  MAX_FRAME_BYTES: 140,
  MAX_FRAMES_PER_PACKET: 8,
  MAX_CAMPAIGN_PACKETS: 32,
  /** Judging duration budget: a campaign exceeding this must be reduced, not hidden. */
  MAX_CAMPAIGN_DURATION_S: 180,
  MIN_CRITICAL_REPEATS: 3,
  MIN_NORMAL_REPEATS: 1,
  MICROPHONE_TIMEOUT_MS: 120_000,
  SAMPLE_RATE_HZ: 48_000,
} as const;

export const BATTERY = {
  /** Below this band, files and low-priority relay stop before critical traffic. */
  LOW_PERCENT: 25,
  CRITICAL_PERCENT: 10,
  /** Discovery duty cycles by mode, in milliseconds. */
  DUTY_CYCLE: {
    ACTIVE_EMERGENCY: { scanMs: 8_000, idleMs: 2_000 },
    RELAY: { scanMs: 5_000, idleMs: 10_000 },
    PREPAREDNESS: { scanMs: 3_000, idleMs: 30_000 },
    BATTERY_SAVER: { scanMs: 2_000, idleMs: 60_000 },
  },
} as const;

/**
 * BLE discovery advertisement budget (02-... "BLE discovery advertisement").
 *
 * THE REAL ARITHMETIC. A legacy BLE advertising PDU carries 31 bytes of AD
 * data, and two AD elements are mandatory overhead:
 *
 *   Flags element                     3 bytes  (len, type 0x01, value)
 *   Manufacturer-specific data header 4 bytes  (len, type 0xff, company id x2)
 *   ------------------------------------------
 *   usable payload                   24 bytes
 *
 * MAX_BYTES was previously 26, which does not fit. Nothing had ever encoded
 * an advertisement, so the budget had never been tested against a real PDU.
 *
 * Note on channels: a single advertising event is transmitted on ALL THREE
 * primary channels (37/38/39) by the Bluetooth controller. Android exposes no
 * channel-selection API, so this is neither configurable nor our concern --
 * but it does mean discovery is probabilistic, because a scanner listens to
 * one channel at a time and BLE advertising has no carrier sense.
 */
export const ADVERTISEMENT = {
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
  TOKEN_ROTATION_MS: 15 * 60_000,
} as const;

/**
 * BLE identifiers -- FROZEN (Gate II). Workstream B is blocked without these.
 *
 * The GATT service uses a full 128-bit custom UUID: it is exchanged after
 * connection, where there is no size pressure.
 *
 * The ADVERTISEMENT uses manufacturer-specific data with company identifier
 * 0xffff, which the Bluetooth SIG reserves for testing and development. That
 * is the honest choice for a prototype: we have no assigned company ID, and
 * squatting on someone else's would be wrong. A 128-bit service UUID in the
 * advertisement would consume 18 of the 31 bytes and leave only 10.
 */
export const BLE_IDENTIFIERS = {
  /** GATT service exposed by every node. */
  SERVICE_UUID: '7d4f0000-9a1c-4b6e-8f21-3c5d7e9a1b02',
  /** Peer writes session records here. */
  SESSION_RX_CHARACTERISTIC_UUID: '7d4f0001-9a1c-4b6e-8f21-3c5d7e9a1b02',
  /** Node notifies session records out on this. */
  SESSION_TX_CHARACTERISTIC_UUID: '7d4f0002-9a1c-4b6e-8f21-3c5d7e9a1b02',
  /** SIG-reserved "for testing" company identifier. Not a real assignment. */
  COMPANY_ID: 0xffff,
  /** First byte of our manufacturer payload, so foreign 0xffff ads are ignored. */
  ADVERTISEMENT_MAGIC: 0xd5,
} as const;
