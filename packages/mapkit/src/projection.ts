/**
 * MAP PROJECTION ENGINE
 *
 * Spec: 02-... "Map projection engine", "Projection precedence",
 * "Dynamic-person markers"; MAP-001..MAP-012.
 *
 * Deterministic and idempotent: applying the same operation twice changes
 * nothing (MAP-006). Every visible value records the packet that caused it.
 * Different sources are never silently collapsed into a false consensus.
 */

import {
  FRESHNESS,
  ProjectionReason,
  type FreshnessClass,
  type MapOperation,
  type ObjectId,
  type ObjectResolver,
  type ProjectionResult,
  type ProvenanceSource,
  type StreamId,
  type TransportKind,
} from '@dsm/contracts';

export interface VisibleObject {
  readonly objectId: ObjectId;
  readonly kind: 'resource' | 'hazard' | 'route' | 'incident' | 'responder' | 'peer' | 'content';
  readonly label: string;
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly state?: number;
  readonly capacityBand?: number;
  readonly severity?: number;
  readonly version: number;
  readonly provenance: ProvenanceSource;
  readonly causedByPacketId: string;
  /** Fix time for markers; update time for static objects. */
  readonly asOfS: number;
  readonly accuracyM?: number;
  readonly expiresAtS?: number;
  readonly tombstoned: boolean;
  /** True when the pack does not contain this object (MAP-008). */
  readonly missingFromPack: boolean;
  /** Kept when two sources disagree (02-... "reports differ"). */
  readonly conflictingSources?: readonly ProvenanceSource[];
}

export interface ProjectionEvent extends ProjectionResult {
  readonly atS: number;
  readonly operation: MapOperation['kind'];
  readonly transport: TransportKind;
}

function provenanceFor(transport: TransportKind): ProvenanceSource {
  switch (transport) {
    case 'tier1-ble':
    case 'tier1-classic':
      return 'tier1';
    case 'tier2-mic':
    case 'tier2-direct':
      return 'tier2';
    case 'gateway':
      return 'gateway';
    default:
      return 'local';
  }
}

/** DEC-020 / MAP-005: age classification, never an undated "live" dot. */
export function freshnessOf(asOfS: number, nowS: number): FreshnessClass {
  const age = nowS - asOfS;
  if (age <= FRESHNESS.LOCATION_LIVE_S) return 'live';
  if (age <= FRESHNESS.LOCATION_STALE_S) return 'aging';
  if (age <= FRESHNESS.LOCATION_EXPIRE_S) return 'stale';
  return 'expired';
}

export class MapProjection {
  private readonly objects = new Map<string, VisibleObject>();
  private readonly events: ProjectionEvent[] = [];
  private readonly missingObjectIds = new Set<ObjectId>();

  constructor(private readonly resolver?: ObjectResolver) {
    if (!resolver) return;
    const asOfS = Math.floor(resolver.manifest.createdAtMs / 1000);
    for (const object of resolver.baselineObjects()) {
      const kind = ['shelter', 'medical', 'food-water', 'safe-zone', 'help-centre'].includes(object.type) ? 'resource' : 'content';
      this.objects.set(`obj:${object.objectId}`, {
        objectId: object.objectId,
        kind,
        label: object.name,
        ...(object.latE7 !== undefined ? { latE7: object.latE7 } : {}),
        ...(object.lonE7 !== undefined ? { lonE7: object.lonE7 } : {}),
        ...(object.baselineState !== undefined ? { state: object.baselineState } : {}),
        version: 0,
        provenance: 'base-pack',
        causedByPacketId: `PACK:${resolver.manifest.packId}`,
        asOfS,
        tombstoned: false,
        missingFromPack: false,
      });
    }
    for (const route of resolver.baselineRoutes()) {
      this.objects.set(`rte:${route.objectId}`, {
        objectId: route.objectId,
        kind: 'route',
        label: route.name,
        latE7: route.fromLatE7,
        lonE7: route.fromLonE7,
        state: route.baselineState,
        version: 0,
        provenance: 'base-pack',
        causedByPacketId: `PACK:${resolver.manifest.packId}`,
        asOfS,
        tombstoned: false,
        missingFromPack: false,
      });
    }
  }

  apply(op: MapOperation): ProjectionResult {
    const result = this.applyInner(op);
    this.events.push({
      ...result,
      atS: op.appliedAtS,
      operation: op.kind,
      transport: op.transport,
    });
    if (this.events.length > 500) this.events.splice(0, this.events.length - 500);
    return result;
  }

  private applyInner(op: MapOperation): ProjectionResult {
    const key = this.keyFor(op);
    if (!key) {
      return { applied: false, reason: ProjectionReason.UNSUPPORTED_OPERATION };
    }

    const existing = this.objects.get(key);

    // A tombstone is terminal: nothing reactivates the object except a newer
    // explicit upsert with a higher version (02-... projection precedence).
    if (existing?.tombstoned && op.kind !== 'tombstone-object' && op.version <= existing.version) {
      return { applied: false, reason: ProjectionReason.IGNORED_TOMBSTONED, objectId: existing.objectId };
    }

    if (existing && op.version < existing.version) {
      return {
        applied: false,
        reason: ProjectionReason.IGNORED_OLDER_VERSION,
        objectId: existing.objectId,
        previousVersion: existing.version,
      };
    }

    if (existing && op.version === existing.version && existing.causedByPacketId === op.causedByPacketId) {
      // Idempotent: the same packet applied twice changes nothing (MAP-006).
      return { applied: false, reason: ProjectionReason.IGNORED_IDENTICAL, objectId: existing.objectId };
    }

    const built = this.build(op, existing);
    if (!built) return { applied: false, reason: ProjectionReason.UNSUPPORTED_OPERATION };

    this.objects.set(key, built.object);
    return {
      applied: true,
      reason: built.reason,
      objectId: built.object.objectId,
      ...(existing ? { previousVersion: existing.version } : {}),
      newVersion: built.object.version,
    };
  }

  private build(
    op: MapOperation,
    existing: VisibleObject | undefined,
  ): { object: VisibleObject; reason: ProjectionResult['reason'] } | undefined {
    const provenance = provenanceFor(op.transport);
    const base = {
      version: op.version,
      provenance,
      causedByPacketId: op.causedByPacketId,
      asOfS: op.appliedAtS,
      tombstoned: false,
      ...(op.expiresAtS !== undefined ? { expiresAtS: op.expiresAtS } : {}),
    };

    // Two different source classes disagreeing is retained, not collapsed.
    const conflicting =
      existing && existing.provenance !== provenance && existing.version === op.version
        ? { conflictingSources: [existing.provenance, provenance] as const }
        : {};

    switch (op.kind) {
      case 'upsert-resource': {
        const packObject = this.resolver?.resolve(op.objectId);
        const missing = !packObject && !op.temporary;
        if (missing) this.missingObjectIds.add(op.objectId);
        return {
          object: {
            ...base,
            ...conflicting,
            objectId: op.objectId,
            kind: 'resource',
            label: packObject?.name ?? op.fallbackLabel ?? op.objectId,
            ...(op.latE7 !== undefined ? { latE7: op.latE7 } : packObject?.latE7 !== undefined ? { latE7: packObject.latE7 } : {}),
            ...(op.lonE7 !== undefined ? { lonE7: op.lonE7 } : packObject?.lonE7 !== undefined ? { lonE7: packObject.lonE7 } : {}),
            state: op.state,
            ...(op.capacityBand !== undefined ? { capacityBand: op.capacityBand } : {}),
            missingFromPack: missing,
          },
          reason: missing
            ? ProjectionReason.MISSING_OBJECT_FALLBACK
            : op.temporary
              ? ProjectionReason.APPLIED_AS_TEMPORARY
              : ProjectionReason.APPLIED,
        };
      }
      case 'set-resource-state':
      case 'set-capacity': {
        if (!existing) {
          // The object is unknown here; keep a fallback record rather than dropping
          // the change silently (MAP-008).
          const packObject = this.resolver?.resolve(op.objectId);
          if (!packObject) this.missingObjectIds.add(op.objectId);
          return {
            object: {
              ...base,
              objectId: op.objectId,
              kind: 'resource',
              label: packObject?.name ?? op.fallbackLabel ?? op.objectId,
              ...(packObject?.latE7 !== undefined ? { latE7: packObject.latE7 } : {}),
              ...(packObject?.lonE7 !== undefined ? { lonE7: packObject.lonE7 } : {}),
              ...(op.kind === 'set-resource-state' ? { state: op.state } : { capacityBand: op.capacityBand }),
              missingFromPack: !packObject,
            },
            reason: packObject ? ProjectionReason.APPLIED : ProjectionReason.MISSING_OBJECT_FALLBACK,
          };
        }
        return {
          object: {
            ...existing,
            ...base,
            ...conflicting,
            ...(op.kind === 'set-resource-state' ? { state: op.state } : { capacityBand: op.capacityBand }),
          },
          reason: ProjectionReason.APPLIED,
        };
      }
      case 'upsert-hazard':
        return {
          object: {
            ...base,
            ...conflicting,
            objectId: op.hazardId,
            kind: 'hazard',
            label: op.fallbackLabel ?? `Hazard ${op.hazardId}`,
            ...(op.latE7 !== undefined ? { latE7: op.latE7 } : {}),
            ...(op.lonE7 !== undefined ? { lonE7: op.lonE7 } : {}),
            severity: op.severity,
            missingFromPack: false,
          },
          reason: ProjectionReason.APPLIED,
        };
      case 'clear-hazard':
        return {
          object: {
            ...(existing ?? {
              objectId: op.hazardId,
              kind: 'hazard' as const,
              label: `Hazard ${op.hazardId}`,
              missingFromPack: false,
            }),
            ...base,
            tombstoned: true,
          },
          reason: ProjectionReason.APPLIED,
        };
      case 'set-route-state': {
        const route = this.resolver?.resolveRoute(op.routeId);
        if (!route) this.missingObjectIds.add(op.routeId);
        return {
          object: {
            ...base,
            ...conflicting,
            objectId: op.routeId,
            kind: 'route',
            label: route?.name ?? op.fallbackLabel ?? op.routeId,
            ...(route ? { latE7: route.fromLatE7, lonE7: route.fromLonE7 } : {}),
            state: op.state,
            missingFromPack: !route,
          },
          reason: route ? ProjectionReason.APPLIED : ProjectionReason.MISSING_OBJECT_FALLBACK,
        };
      }
      case 'upsert-incident-marker':
        return {
          object: {
            ...base,
            objectId: op.incidentId,
            kind: 'incident',
            label: op.fallbackLabel ?? `Incident ${op.incidentId}`,
            ...(op.latE7 !== undefined ? { latE7: op.latE7 } : {}),
            ...(op.lonE7 !== undefined ? { lonE7: op.lonE7 } : {}),
            severity: op.severity,
            // Markers age from the FIX time, not the receive time.
            asOfS: op.locationAtS,
            ...(op.accuracyM !== undefined ? { accuracyM: op.accuracyM } : {}),
            missingFromPack: false,
          },
          reason: ProjectionReason.APPLIED,
        };
      case 'upsert-responder-marker':
        return {
          object: {
            ...base,
            objectId: `RSP-${op.responderRef}`,
            kind: 'responder',
            label: `Responder ${op.responderRef}`,
            ...(op.latE7 !== undefined ? { latE7: op.latE7 } : {}),
            ...(op.lonE7 !== undefined ? { lonE7: op.lonE7 } : {}),
            asOfS: op.locationAtS,
            ...(op.accuracyM !== undefined ? { accuracyM: op.accuracyM } : {}),
            missingFromPack: false,
          },
          reason: ProjectionReason.APPLIED,
        };
      case 'upsert-peer-marker':
        return {
          object: {
            ...base,
            objectId: `PEER-${op.peerToken}`,
            kind: 'peer',
            label: op.fallbackLabel ?? 'Participating phone',
            ...(op.latE7 !== undefined ? { latE7: op.latE7 } : {}),
            ...(op.lonE7 !== undefined ? { lonE7: op.lonE7 } : {}),
            asOfS: op.locationAtS,
            ...(op.accuracyM !== undefined ? { accuracyM: op.accuracyM } : {}),
            missingFromPack: false,
          },
          reason: ProjectionReason.APPLIED,
        };
      case 'set-incident-state': {
        const terminal = op.state === 'resolved' || op.state === 'cancelled' || op.state === 'expired';
        return {
          object: {
            ...(existing ?? {
              objectId: op.incidentId,
              kind: 'incident' as const,
              label: `Incident ${op.incidentId}`,
              missingFromPack: false,
            }),
            ...base,
            tombstoned: terminal,
          },
          reason: ProjectionReason.APPLIED,
        };
      }
      case 'activate-content':
        return {
          object: {
            ...base,
            objectId: op.objectId,
            kind: 'content',
            label: op.fallbackLabel ?? op.objectId,
            state: op.opcode,
            missingFromPack: !this.resolver?.resolve(op.objectId),
          },
          reason: ProjectionReason.APPLIED,
        };
      case 'tombstone-object':
        return {
          object: {
            ...(existing ?? {
              objectId: op.objectId,
              kind: 'resource' as const,
              label: op.fallbackLabel ?? op.objectId,
              missingFromPack: true,
            }),
            ...base,
            tombstoned: true,
          },
          reason: ProjectionReason.APPLIED,
        };
      default:
        return undefined;
    }
  }

  private keyFor(op: MapOperation): string | undefined {
    switch (op.kind) {
      case 'upsert-resource':
      case 'set-resource-state':
      case 'set-capacity':
      case 'activate-content':
      case 'tombstone-object':
        return `obj:${op.objectId}`;
      case 'upsert-hazard':
      case 'clear-hazard':
        return `haz:${op.hazardId}`;
      case 'set-route-state':
        return `rte:${op.routeId}`;
      case 'upsert-incident-marker':
      case 'set-incident-state':
        return `inc:${op.incidentId}`;
      case 'upsert-responder-marker':
        return `rsp:${op.responderRef}`;
      case 'upsert-peer-marker':
        return `peer:${op.peerToken}`;
      default:
        return undefined;
    }
  }

  /** Visible objects. Expired markers are withdrawn per FRESHNESS policy. */
  visible(nowS: number, options: { includeTombstoned?: boolean } = {}): readonly VisibleObject[] {
    const out: VisibleObject[] = [];
    for (const object of this.objects.values()) {
      if (object.tombstoned && !options.includeTombstoned) continue;
      if (object.expiresAtS !== undefined && object.expiresAtS <= nowS) continue;
      const isMarker = object.kind === 'incident' || object.kind === 'responder' || object.kind === 'peer';
      if (isMarker && freshnessOf(object.asOfS, nowS) === 'expired') continue;
      out.push(object);
    }
    return out;
  }

  get(objectId: string): VisibleObject | undefined {
    for (const object of this.objects.values()) {
      if (object.objectId === objectId) return object;
    }
    return undefined;
  }

  /** Object IDs referenced by packets but absent from the pack (MAP-008). */
  missingObjects(): readonly ObjectId[] {
    return [...this.missingObjectIds];
  }

  projectionEvents(limit = 100): readonly ProjectionEvent[] {
    return this.events.slice(-limit).reverse();
  }

  /** MAP-010: list equivalents for accessibility and low-performance devices. */
  asList(nowS: number): readonly {
    readonly object: VisibleObject;
    readonly freshness: FreshnessClass;
    readonly ageS: number;
  }[] {
    return this.visible(nowS).map((object) => ({
      object,
      freshness: freshnessOf(object.asOfS, nowS),
      ageS: Math.max(0, nowS - object.asOfS),
    }));
  }
}

export type { StreamId };
