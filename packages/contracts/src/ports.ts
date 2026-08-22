/**
 * PERSISTENCE PORTS
 *
 * Spec: 02-... "Persistence and data model", "Transaction boundaries".
 *
 * These are INTERFACES only. Workstream C ships an in-memory implementation
 * (packages/store) so every other workstream can build and test today; the
 * SQLite/expo-sqlite implementation lands behind the same interface without
 * anyone else changing a line.
 */

import type { EncodedPacket, Packet, PacketId, PacketObservation, StreamId } from './envelope.js';
import type { CustodyState, IncidentState } from './profile.js';
import type { MapOperation, ProjectionResult } from './map-ops.js';

export interface StoredPacket {
  readonly packet: Packet;
  readonly encoded: EncodedPacket;
  readonly digest: string;
  readonly storedAtMs: number;
  readonly retentionUntilS: number;
}

export interface CustodyRecord {
  readonly packetId: PacketId;
  readonly state: CustodyState;
  readonly copyBudgetRemaining: number;
  readonly copiesMade: number;
  readonly lastOfferedAtMs?: number;
  readonly nextEligibleAtMs?: number;
  /** Rotating tokens of neighbours known to already hold this packet. */
  readonly knownHolders: readonly string[];
  readonly uploadState: 'not-eligible' | 'queued' | 'uploaded' | 'acknowledged';
  readonly linkReceiptCount: number;
}

export interface FragmentRecord {
  readonly objectId: string;
  readonly index: number;
  readonly digest: string;
  readonly bytes: Uint8Array;
  readonly receivedAtMs: number;
}

export interface IncidentRecord {
  readonly incidentId: StreamId;
  readonly state: IncidentState;
  readonly severity: number;
  readonly category: number;
  readonly latestSourceSequence: number;
  readonly assignmentId?: string;
  readonly responderRef?: string;
  readonly ownedLocally: boolean;
  readonly createdAtS: number;
  readonly updatedAtS: number;
  readonly terminalAtS?: number;
}

export interface IncidentEventRecord {
  readonly incidentId: StreamId;
  readonly packetId: PacketId;
  readonly eventType: number;
  readonly atS: number;
  readonly sourceClass: number;
  readonly superseded: boolean;
}

/**
 * Idempotent packet repository.
 * 02-...: "Packet ID plus digest is idempotent. Packet ID with a different
 * digest is a conflict and quarantined."
 */
export interface PacketRepository {
  /**
   * Commits packet + custody + first observation together (02-... transactions).
   * Returns 'duplicate' when the same ID+digest is already stored, and
   * 'conflict' when the ID is known with a different digest.
   */
  insert(
    stored: StoredPacket,
    observation: PacketObservation,
    custody: CustodyRecord,
  ): Promise<'inserted' | 'duplicate' | 'conflict'>;

  get(packetId: PacketId): Promise<StoredPacket | undefined>;
  /** Efficient after the payload has been evicted (02-... seen-ID lookup). */
  hasSeen(packetId: PacketId): Promise<boolean>;
  getDigest(packetId: PacketId): Promise<string | undefined>;

  addObservation(observation: PacketObservation): Promise<void>;
  listObservations(packetId: PacketId): Promise<readonly PacketObservation[]>;

  getCustody(packetId: PacketId): Promise<CustodyRecord | undefined>;
  updateCustody(record: CustodyRecord): Promise<void>;
  /** Relay-eligible packets, best-first by priority then age. */
  listRelayable(limit: number): Promise<readonly CustodyRecord[]>;
  listUploadQueue(limit: number): Promise<readonly CustodyRecord[]>;

  putFragment(fragment: FragmentRecord): Promise<void>;
  listFragments(objectId: string): Promise<readonly FragmentRecord[]>;
  dropFragments(objectId: string): Promise<void>;

  /** Removes expired packets and fragments; returns how many were evicted. */
  evictExpired(nowS: number): Promise<number>;
  count(): Promise<number>;
}

export interface IncidentRepository {
  upsert(record: IncidentRecord): Promise<void>;
  get(incidentId: StreamId): Promise<IncidentRecord | undefined>;
  list(): Promise<readonly IncidentRecord[]>;
  appendEvent(event: IncidentEventRecord): Promise<void>;
  listEvents(incidentId: StreamId): Promise<readonly IncidentEventRecord[]>;
}

export interface MapProjectionStore {
  apply(operation: MapOperation): Promise<ProjectionResult>;
  /** Records which packet caused which visible change (02-... transactions). */
  listProjectionEvents(limit: number): Promise<readonly (ProjectionResult & { readonly atS: number })[]>;
}

export interface PeerObservationRecord {
  readonly peerToken: string;
  readonly lastSeenAtMs: number;
  readonly rssi?: number;
  readonly gatewayProven: boolean;
  readonly queueEpoch: number;
  readonly sessionsCompleted: number;
  readonly sessionsFailed: number;
}

export interface PeerRepository {
  observe(record: PeerObservationRecord): Promise<void>;
  list(nowMs: number): Promise<readonly PeerObservationRecord[]>;
  get(peerToken: string): Promise<PeerObservationRecord | undefined>;
  evictStale(nowMs: number): Promise<number>;
}
