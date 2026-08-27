/**
 * MAP OPERATION CONTRACT  --  FROZEN (Gate III)
 *
 * Spec: 02-... "Predownloaded map update operations", "Object resolution",
 * "Projection precedence"; MAP-001..MAP-012.
 *
 * Accepted packets may perform ONLY these typed operations. A packet never
 * supplies a filesystem path, URL, database command, or executable action
 * (02-...: "It never treats packet text as a filesystem path, URL, query, or
 * executable command").
 *
 * MAP-009 / DEC-013: Tier 1, gateway, and Tier 2 all reach the projection
 * through this one contract. There is no second "radio map".
 */

import type { ObjectId, PacketId, StreamId, TransportKind } from './envelope.js';
import type {
  CapacityBandValue,
  GeometryKindValue,
  HazardTypeValue,
  OperationalStateValue,
  RouteStateValue,
} from './enums.js';
import type { ProjectionReasonName } from './reasons.js';

export type MapOperationKind =
  | 'upsert-resource'
  | 'set-resource-state'
  | 'set-capacity'
  | 'upsert-hazard'
  | 'clear-hazard'
  | 'set-route-state'
  | 'upsert-incident-marker'
  | 'upsert-responder-marker'
  | 'upsert-peer-marker'
  | 'set-incident-state'
  | 'activate-content'
  | 'tombstone-object';

export interface MapOperationBase {
  readonly kind: MapOperationKind;
  /** Which packet caused this. Recorded with the projection (02-... transactions). */
  readonly causedByPacketId: PacketId;
  readonly transport: TransportKind;
  /** Latest-wins selection within one source stream. */
  readonly version: number;
  readonly appliedAtS: number;
  readonly expiresAtS?: number;
  /** MAP-008: shown when the object is not in the local pack. */
  readonly fallbackLabel?: string;
}

export interface UpsertResourceOp extends MapOperationBase {
  readonly kind: 'upsert-resource';
  readonly objectId: ObjectId;
  readonly objectType: 'shelter' | 'medical' | 'food-water' | 'safe-zone';
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly state: OperationalStateValue;
  readonly capacityBand?: CapacityBandValue;
  readonly capabilityBits?: number;
  /** True for a temporary object not present in the base pack. */
  readonly temporary: boolean;
}

export interface SetResourceStateOp extends MapOperationBase {
  readonly kind: 'set-resource-state';
  readonly objectId: ObjectId;
  readonly state: OperationalStateValue;
}

export interface SetCapacityOp extends MapOperationBase {
  readonly kind: 'set-capacity';
  readonly objectId: ObjectId;
  readonly capacityBand?: CapacityBandValue;
  readonly capacityExact?: number;
}

export interface UpsertHazardOp extends MapOperationBase {
  readonly kind: 'upsert-hazard';
  readonly hazardId: StreamId;
  readonly hazardType: HazardTypeValue;
  readonly geometryKind: GeometryKindValue;
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly radiusM?: number;
  readonly routeIds?: readonly ObjectId[];
  readonly severity: number;
}

export interface ClearHazardOp extends MapOperationBase {
  readonly kind: 'clear-hazard';
  readonly hazardId: StreamId;
}

export interface SetRouteStateOp extends MapOperationBase {
  readonly kind: 'set-route-state';
  readonly routeId: ObjectId;
  readonly state: RouteStateValue;
  readonly direction?: number;
}

/** Dynamic person markers carry their own freshness policy (02-...). */
export interface MarkerOpBase extends MapOperationBase {
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly accuracyM?: number;
  /** When the fix was taken, not when the packet arrived. */
  readonly locationAtS: number;
  readonly locationSource: number;
}

export interface UpsertIncidentMarkerOp extends MarkerOpBase {
  readonly kind: 'upsert-incident-marker';
  readonly incidentId: StreamId;
  readonly severity: number;
  readonly category: number;
  readonly peopleTotal?: number;
}

export interface UpsertResponderMarkerOp extends MarkerOpBase {
  readonly kind: 'upsert-responder-marker';
  readonly responderRef: string;
  readonly incidentId?: StreamId;
  readonly status: 'assigned' | 'en-route' | 'arrived' | 'available';
}

export interface UpsertPeerMarkerOp extends MarkerOpBase {
  readonly kind: 'upsert-peer-marker';
  readonly peerToken: string;
  readonly fallbackLabel?: string;
}

export interface SetIncidentStateOp extends MapOperationBase {
  readonly kind: 'set-incident-state';
  readonly incidentId: StreamId;
  readonly state: 'active' | 'assigned' | 'accepted' | 'en-route' | 'arrived' | 'resolved' | 'cancelled' | 'expired';
}

export interface ActivateContentOp extends MapOperationBase {
  readonly kind: 'activate-content';
  readonly bundleId: string;
  readonly objectId: ObjectId;
  /** Pack-defined opcode. Resolved through the typed registry only. */
  readonly opcode: number;
}

export interface TombstoneObjectOp extends MapOperationBase {
  readonly kind: 'tombstone-object';
  readonly objectId: ObjectId;
  readonly reasonCode?: number;
}

export type MapOperation =
  | UpsertResourceOp
  | SetResourceStateOp
  | SetCapacityOp
  | UpsertHazardOp
  | ClearHazardOp
  | SetRouteStateOp
  | UpsertIncidentMarkerOp
  | UpsertResponderMarkerOp
  | UpsertPeerMarkerOp
  | SetIncidentStateOp
  | ActivateContentOp
  | TombstoneObjectOp;

/** Result of applying one operation. MAP-006: applying twice changes nothing. */
export interface ProjectionResult {
  readonly applied: boolean;
  readonly reason: ProjectionReasonName;
  readonly objectId?: ObjectId;
  readonly previousVersion?: number;
  readonly newVersion?: number;
}

/** Where a visible value came from (01-... screen 8, MAP-004). */
export type ProvenanceSource = 'base-pack' | 'tier1' | 'tier2' | 'gateway' | 'local';

/** Freshness classification for anything with a location (DEC-020, MAP-005). */
export type FreshnessClass = 'live' | 'aging' | 'stale' | 'expired';
