/**
 * OBSERVABILITY VOCABULARY
 *
 * Spec: 02-... "Observability vocabulary". One shared event name set across
 * every component, so the diagnostics screen and the evidence bundle read the
 * same language.
 *
 * INT-007: logs avoid unnecessary personal content. Never put a short note,
 * alias, contact, or exact coordinate in an event.
 */

export const EventCategory = {
  CAPABILITY: 'capability',
  PERMISSION: 'permission',
  RELAY_LIFECYCLE: 'relay-lifecycle',
  PEER_DISCOVERY: 'peer-discovery',
  SESSION: 'session',
  INVENTORY: 'inventory',
  TRANSFER: 'transfer',
  VALIDATION: 'validation',
  POLICY: 'policy',
  CUSTODY: 'custody',
  INCIDENT: 'incident',
  PROJECTION: 'projection',
  CONNECTIVITY: 'connectivity',
  GATEWAY: 'gateway',
  TIER2: 'tier2',
  FILE: 'file',
  RESOURCE_ADAPTATION: 'resource-adaptation',
} as const;
export type EventCategoryName = (typeof EventCategory)[keyof typeof EventCategory];

export type EventSeverity = 'debug' | 'info' | 'warn' | 'error';

/** One structured diagnostic record. Fields are all optional except the core. */
export interface DiagnosticEvent {
  readonly category: EventCategoryName;
  readonly name: string;
  readonly severity: EventSeverity;
  readonly atMs: number;
  /** Reason code from reasons.ts. Judges read this column. */
  readonly reason?: string;
  readonly packetId?: string;
  readonly packetType?: number;
  readonly incidentId?: string;
  readonly sessionId?: string;
  readonly peerToken?: string;
  readonly campaignId?: string;
  readonly transport?: string;
  readonly bytes?: number;
  readonly durationMs?: number;
  readonly result?: string;
  /** Bounded numeric extras only. No free-text payload content. */
  readonly metrics?: Readonly<Record<string, number>>;
}

export interface EventSink {
  emit(event: DiagnosticEvent): void;
  /** Newest first, bounded by STORAGE.MAX_EVENT_LOG_ENTRIES. */
  recent(limit: number): readonly DiagnosticEvent[];
  clear(): void;
}

/** 01-... "Product analytics for the demo" -- the questions we must answer. */
export interface DemoMetrics {
  readonly discoveryToSessionMs?: number;
  readonly requestToStoredMs?: number;
  readonly distinctPeersReceived: number;
  readonly duplicatesSuppressed: number;
  readonly encodedBytesByType: Readonly<Record<string, number>>;
  readonly gatewayProvenAtMs?: number;
  readonly backendAckLatencyMs?: number;
  readonly tier2FramesDetected: number;
  readonly tier2FramesValid: number;
  readonly tier2FramesCorrupt: number;
  readonly tier2FramesDuplicate: number;
  readonly tier2PacketsMissing: number;
  readonly mapObjectsChangedByTransport: Readonly<Record<string, number>>;
}
