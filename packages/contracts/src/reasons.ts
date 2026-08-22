/**
 * REASON CODES  --  FROZEN (Gate I)
 *
 * Spec: 02-... "Every decision must include reason codes suitable for
 * diagnostics" and the Diagnostics screen (01-... screen 13).
 *
 * Every rejection, every policy outcome, and every map projection result
 * carries one of these. Judges read these strings on the diagnostics screen,
 * so they are stable, greppable, and never free text.
 */

/** Ordered validation gates, 02-... "Validation pipeline" (15 gates). */
export const ValidationGate = {
  ENVELOPE_LENGTH: 'gate.envelope-length',
  PROTOCOL_VERSION: 'gate.protocol-version',
  DECLARED_SIZES: 'gate.declared-sizes',
  HEADER_INTEGRITY: 'gate.header-integrity',
  KNOWN_TYPE: 'gate.known-type',
  DUPLICATE_LOOKUP: 'gate.duplicate-lookup',
  CLOCK_SANITY: 'gate.clock-sanity',
  HOP_LIMIT: 'gate.hop-limit',
  FRAGMENT_LIMITS: 'gate.fragment-limits',
  PAYLOAD_INTEGRITY: 'gate.payload-integrity',
  SCHEMA: 'gate.schema',
  SOURCE_ROLE: 'gate.source-role',
  GEOGRAPHIC_RELEVANCE: 'gate.geographic-relevance',
  USER_PREFERENCE: 'gate.user-preference',
  RESOURCE_PRESSURE: 'gate.resource-pressure',
} as const;
export type ValidationGateName = (typeof ValidationGate)[keyof typeof ValidationGate];

export const RejectReason = {
  TOO_SHORT: 'reject.too-short',
  BAD_MAGIC: 'reject.bad-magic',
  UNSUPPORTED_VERSION: 'reject.unsupported-version',
  LENGTH_OVER_LIMIT: 'reject.length-over-limit',
  LENGTH_MISMATCH: 'reject.length-mismatch',
  HEADER_CRC_FAILED: 'reject.header-crc-failed',
  UNKNOWN_TYPE: 'reject.unknown-type',
  EXPIRED: 'reject.expired',
  CREATED_IN_FUTURE: 'reject.created-in-future',
  CLOCK_IMPLAUSIBLE: 'reject.clock-implausible',
  HOP_LIMIT_EXCEEDED: 'reject.hop-limit-exceeded',
  FRAGMENT_INDEX_INVALID: 'reject.fragment-index-invalid',
  FRAGMENT_COUNT_OVER_LIMIT: 'reject.fragment-count-over-limit',
  REASSEMBLY_OVER_LIMIT: 'reject.reassembly-over-limit',
  PAYLOAD_DIGEST_MISMATCH: 'reject.payload-digest-mismatch',
  SCHEMA_INVALID: 'reject.schema-invalid',
  FIELD_OVER_LIMIT: 'reject.field-over-limit',
  /** DEC-015 / ROL-006: a general-public source cannot publish authority records. */
  ROLE_NOT_PERMITTED: 'reject.role-not-permitted',
  /** Same packet ID, different digest (02-... "Conflicting updates"). */
  DIGEST_CONFLICT: 'reject.digest-conflict',
  SEQUENCE_CONFLICT: 'reject.sequence-conflict',
  SUPERSEDED: 'reject.superseded',
  TERMINAL_APPLIED: 'reject.terminal-applied',
  STORAGE_FULL: 'reject.storage-full',
  QUEUE_FULL: 'reject.queue-full',
  OUT_OF_REGION: 'reject.out-of-region',
} as const;
export type RejectReasonName = (typeof RejectReason)[keyof typeof RejectReason];

/** Non-rejection outcomes worth recording. */
export const AcceptReason = {
  NEW_PACKET: 'accept.new-packet',
  NEW_OBSERVATION_OF_KNOWN: 'accept.new-observation-of-known',
  SUPERSEDES_PREVIOUS: 'accept.supersedes-previous',
  TERMINAL_RECORD: 'accept.terminal-record',
  FRAGMENT_STORED: 'accept.fragment-stored',
  OBJECT_COMPLETED: 'accept.object-completed',
} as const;
export type AcceptReasonName = (typeof AcceptReason)[keyof typeof AcceptReason];

/** Why the policy engine decided to store / show / alert / relay / upload / act. */
export const PolicyReason = {
  OWN_PACKET: 'policy.own-packet',
  OWN_INCIDENT: 'policy.own-incident',
  WITHIN_DISPLAY_RADIUS: 'policy.within-display-radius',
  OUTSIDE_DISPLAY_RADIUS: 'policy.outside-display-radius',
  SEVERITY_THRESHOLD_MET: 'policy.severity-threshold-met',
  SEVERITY_BELOW_THRESHOLD: 'policy.severity-below-threshold',
  RESPONDER_ROLE: 'policy.responder-role',
  PUBLIC_ROLE_MINIMAL_VIEW: 'policy.public-role-minimal-view',
  AUTHORITY_SOURCE: 'policy.authority-source',
  COMMUNITY_SOURCE_LOWER_WEIGHT: 'policy.community-source-lower-weight',
  HAZARD_INTERSECTS_AREA: 'policy.hazard-intersects-area',
  DUPLICATE_SUPPRESSED: 'policy.duplicate-suppressed',
  COPY_BUDGET_EXHAUSTED: 'policy.copy-budget-exhausted',
  COPY_BUDGET_AVAILABLE: 'policy.copy-budget-available',
  NEIGHBOR_ALREADY_HAS: 'policy.neighbor-already-has',
  COOLDOWN_ACTIVE: 'policy.cooldown-active',
  GATEWAY_PROVEN: 'policy.gateway-proven',
  GATEWAY_UNPROVEN: 'policy.gateway-unproven',
  BATTERY_RESTRICTED: 'policy.battery-restricted',
  STORAGE_RESTRICTED: 'policy.storage-restricted',
  CONGESTION_PREEMPTED: 'policy.congestion-preempted',
  TERMINAL_SUPPRESSES_ACTIVE: 'policy.terminal-suppresses-active',
  RETENTION_WINDOW: 'policy.retention-window',
  FILE_REQUIRES_EXPLICIT_REQUEST: 'policy.file-requires-explicit-request',
  SESSION_CONTROL_NOT_RELAYED: 'policy.session-control-not-relayed',
  NOT_UPLOAD_ELIGIBLE: 'policy.not-upload-eligible',
  ALREADY_BACKEND_ORIGIN: 'policy.already-backend-origin',
} as const;
export type PolicyReasonName = (typeof PolicyReason)[keyof typeof PolicyReason];

/** Map projection outcomes (MAP-006 idempotence, MAP-008 missing objects). */
export const ProjectionReason = {
  APPLIED: 'projection.applied',
  APPLIED_AS_TEMPORARY: 'projection.applied-as-temporary',
  IGNORED_OLDER_VERSION: 'projection.ignored-older-version',
  IGNORED_IDENTICAL: 'projection.ignored-identical',
  IGNORED_TOMBSTONED: 'projection.ignored-tombstoned',
  /** MAP-008: fallback text/coordinates, never a silent substitution. */
  MISSING_OBJECT_FALLBACK: 'projection.missing-object-fallback',
  CONFLICTING_SOURCES_RETAINED: 'projection.conflicting-sources-retained',
  OUT_OF_PACK_REGION: 'projection.out-of-pack-region',
  UNSUPPORTED_OPERATION: 'projection.unsupported-operation',
} as const;
export type ProjectionReasonName = (typeof ProjectionReason)[keyof typeof ProjectionReason];

/** Tier 2 receiver outcomes (T2-007, T2-008). */
export const Tier2Reason = {
  PREAMBLE_DETECTED: 'tier2.preamble-detected',
  FRAME_VALID: 'tier2.frame-valid',
  FRAME_CORRUPT: 'tier2.frame-corrupt',
  FRAME_DUPLICATE: 'tier2.frame-duplicate',
  PACKET_REASSEMBLED: 'tier2.packet-reassembled',
  PACKET_INCOMPLETE: 'tier2.packet-incomplete',
  CAMPAIGN_COMPLETE: 'tier2.campaign-complete',
  CAMPAIGN_INCOMPLETE: 'tier2.campaign-incomplete',
  LISTEN_TIMEOUT: 'tier2.listen-timeout',
} as const;
export type Tier2ReasonName = (typeof Tier2Reason)[keyof typeof Tier2Reason];

export type AnyReason =
  | ValidationGateName
  | RejectReasonName
  | AcceptReasonName
  | PolicyReasonName
  | ProjectionReasonName
  | Tier2ReasonName;
