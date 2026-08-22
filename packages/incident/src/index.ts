/**
 * @dsm/incident -- one incident timeline from many packets.
 *
 * Spec: 02-... "Incident reducer".
 *  - Builds one timeline from SOS create/update/cancel plus responder and
 *    backend lifecycle packets.
 *  - Selects active state by incident ID and valid source sequence/state rules.
 *  - NEVER destructively merges separate possible incidents merely because
 *    their coordinates are close.
 *
 * DEC-022 / SOS-007 / SOS-008: link receipts, responder acknowledgement,
 * gateway upload, and backend acceptance are SEPARATE delivery facts. A relay
 * copy is never described as "help is coming".
 */

import {
  MessageType,
  Severity,
  type DeliveryState,
  type IncidentState,
  type Packet,
  type StreamId,
} from '@dsm/contracts';

export interface TimelineEntry {
  readonly packetId: string;
  readonly messageType: number;
  readonly atS: number;
  readonly sourceClass: number;
  readonly sourceSequence?: number;
  /** False once a later packet supersedes this one. History is retained. */
  readonly active: boolean;
  readonly summary: string;
}

/** All separately-tracked delivery facts for one incident (SOS-007). */
export interface DeliveryFacts {
  readonly savedLocallyAtS?: number;
  /** REL-006: distinct peers, not total receipts. */
  readonly distinctPeerReceipts: number;
  readonly responderSeenAtS?: number;
  readonly uploadedAtS?: number;
  readonly backendAcceptedAtS?: number;
  readonly assignedAtS?: number;
  readonly acceptedAtS?: number;
  readonly enRouteAtS?: number;
  readonly arrivedAtS?: number;
  readonly resolvedAtS?: number;
  readonly cancelledAtS?: number;
}

export interface IncidentView {
  readonly incidentId: StreamId;
  readonly state: IncidentState;
  readonly severity: number;
  readonly category: number;
  readonly peopleTotal?: number;
  readonly injured?: number;
  readonly mobility?: number;
  readonly shortNote?: string;
  readonly latE7?: number;
  readonly lonE7?: number;
  readonly locationAccuracyM?: number;
  /** Age of the LOCATION FIX at packet-creation time (DEC-020). */
  readonly locationAgeS?: number;
  readonly locationSource?: number;
  readonly createdAtS: number;
  readonly updatedAtS: number;
  readonly latestSourceSequence: number;
  readonly ownedLocally: boolean;
  readonly assignmentId?: string;
  readonly responderRef?: string;
  readonly delivery: DeliveryFacts;
  readonly timeline: readonly TimelineEntry[];
}

/** State transitions the reducer will honour. Anything else is ignored. */
const ALLOWED_NEXT: Readonly<Record<IncidentState, readonly IncidentState[]>> = {
  draft: ['created', 'cancelled'],
  created: ['active', 'assigned', 'cancelled', 'expired'],
  active: ['assigned', 'cancelled', 'expired', 'resolved'],
  assigned: ['accepted', 'active', 'cancelled', 'resolved', 'expired'],
  accepted: ['en-route', 'arrived', 'cancelled', 'resolved'],
  'en-route': ['arrived', 'cancelled', 'resolved'],
  arrived: ['resolved', 'cancelled'],
  resolved: ['reopened'],
  cancelled: [],
  expired: ['reopened'],
  reopened: ['active', 'assigned', 'resolved', 'cancelled'],
};

function canTransition(from: IncidentState, to: IncidentState): boolean {
  return ALLOWED_NEXT[from].includes(to);
}

export interface ReduceOptions {
  readonly localSourceId: string;
  /** Rotating peer token that delivered this packet, for distinct-peer counting. */
  readonly viaPeerToken?: string;
}

/**
 * Folds packets into incident views. Feed it every accepted packet, in any
 * order: sequence rules pick the active state, and out-of-order arrivals are
 * retained as history rather than reactivating an older state.
 */
export class IncidentReducer {
  private readonly incidents = new Map<StreamId, MutableIncident>();
  private readonly peerReceipts = new Map<StreamId, Set<string>>();

  apply(packet: Packet, options: ReduceOptions): IncidentView | undefined {
    const incidentId = this.incidentIdFor(packet);
    if (!incidentId) return undefined;

    const existing = this.incidents.get(incidentId) ?? this.create(incidentId, packet, options);
    this.incidents.set(incidentId, existing);

    const atS = packet.header.createdAt;
    const seq = packet.sourceSequence;
    const payload = packet.payload as Record<string, unknown>;

    // Latest-wins for the SOS source stream only. Responder and backend
    // packets carry their own streams and never overwrite victim-reported data.
    const isSourceStream =
      packet.header.type === MessageType.SOS_CREATE ||
      packet.header.type === MessageType.SOS_UPDATE ||
      packet.header.type === MessageType.SOS_CANCEL;

    const superseded = isSourceStream && seq !== undefined && seq <= existing.latestSourceSequence;

    switch (packet.header.type) {
      case MessageType.SOS_CREATE: {
        if (!superseded) {
          existing.severity = packet.header.severity;
          existing.category = numberOf(payload['category']) ?? existing.category;
          existing.peopleTotal = numberOf(payload['peopleTotal']);
          existing.injured = numberOf(payload['injured']);
          existing.mobility = numberOf(payload['mobility']);
          existing.shortNote = stringOf(payload['shortNote']);
          this.applyLocation(existing, payload, packet);
          existing.latestSourceSequence = seq ?? existing.latestSourceSequence;
          if (existing.state === 'draft') existing.state = 'created';
          if (existing.state === 'created') existing.state = 'active';
        }
        existing.delivery.savedLocallyAtS ??= atS;
        break;
      }
      case MessageType.SOS_UPDATE: {
        if (!superseded) {
          if (payload['category'] !== undefined) existing.category = numberOf(payload['category'])!;
          if (payload['peopleTotal'] !== undefined) existing.peopleTotal = numberOf(payload['peopleTotal']);
          if (payload['injured'] !== undefined) existing.injured = numberOf(payload['injured']);
          if (payload['mobility'] !== undefined) existing.mobility = numberOf(payload['mobility']);
          if (payload['shortNote'] !== undefined) existing.shortNote = stringOf(payload['shortNote']);
          if (payload['location'] !== undefined) this.applyLocation(existing, payload, packet);
          existing.severity = packet.header.severity;
          existing.latestSourceSequence = seq ?? existing.latestSourceSequence;
        }
        break;
      }
      case MessageType.SOS_CANCEL: {
        // Terminal records apply even out of sequence (SOS-006, SOS-009).
        if (canTransition(existing.state, 'cancelled')) existing.state = 'cancelled';
        existing.delivery.cancelledAtS = atS;
        break;
      }
      case MessageType.RESPONDER_ASSIGNED: {
        existing.assignmentId = stringOf(payload['assignmentId']);
        existing.responderRef = stringOf(payload['responderRef']);
        if (canTransition(existing.state, 'assigned')) existing.state = 'assigned';
        existing.delivery.assignedAtS = atS;
        existing.delivery.responderSeenAtS ??= atS;
        break;
      }
      case MessageType.RESPONDER_ACCEPTED: {
        if (canTransition(existing.state, 'accepted')) existing.state = 'accepted';
        existing.delivery.acceptedAtS = atS;
        existing.delivery.responderSeenAtS ??= atS;
        break;
      }
      case MessageType.RESPONDER_DECLINED: {
        // Declined returns the case to the queue; it does not close anything.
        if (canTransition(existing.state, 'active')) existing.state = 'active';
        existing.assignmentId = undefined;
        existing.responderRef = undefined;
        break;
      }
      case MessageType.RESPONDER_EN_ROUTE: {
        if (canTransition(existing.state, 'en-route')) existing.state = 'en-route';
        existing.delivery.enRouteAtS = atS;
        break;
      }
      case MessageType.RESPONDER_ARRIVED: {
        // 02-...: arrival does NOT automatically close the incident.
        if (canTransition(existing.state, 'arrived')) existing.state = 'arrived';
        existing.delivery.arrivedAtS = atS;
        break;
      }
      case MessageType.RESOLVED: {
        if (canTransition(existing.state, 'resolved')) existing.state = 'resolved';
        existing.delivery.resolvedAtS = atS;
        break;
      }
      case MessageType.LINK_RECEIPT: {
        // DEC-022: a distinct peer copy, nothing more.
        const token = stringOf(payload['receivingNodeToken']) ?? options.viaPeerToken;
        if (token) {
          const set = this.peerReceipts.get(incidentId) ?? new Set<string>();
          set.add(token);
          this.peerReceipts.set(incidentId, set);
        }
        break;
      }
      case MessageType.BACKEND_ACKNOWLEDGEMENT: {
        // GTW-008: only this proves the coordination centre received it.
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
      ...(seq !== undefined ? { sourceSequence: seq } : {}),
      active: !superseded,
      summary: summarize(packet),
    });

    if (superseded) {
      // History stays; the entry is simply not active (02-... latest-wins).
      existing.timeline[existing.timeline.length - 1] = {
        ...existing.timeline[existing.timeline.length - 1]!,
        active: false,
      };
    }

    return this.view(incidentId);
  }

  /** Marks incidents whose expiry passed. Never invents a new identity. */
  expireOlderThan(nowS: number, maxAgeS: number): readonly StreamId[] {
    const expired: StreamId[] = [];
    for (const [id, inc] of this.incidents) {
      const terminal = inc.state === 'resolved' || inc.state === 'cancelled' || inc.state === 'expired';
      if (!terminal && nowS - inc.updatedAtS > maxAgeS) {
        inc.state = 'expired';
        expired.push(id);
      }
    }
    return expired;
  }

  view(incidentId: StreamId): IncidentView | undefined {
    const inc = this.incidents.get(incidentId);
    if (!inc) return undefined;
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
      locationSource: inc.locationSource,
      createdAtS: inc.createdAtS,
      updatedAtS: inc.updatedAtS,
      latestSourceSequence: inc.latestSourceSequence,
      ownedLocally: inc.ownedLocally,
      assignmentId: inc.assignmentId,
      responderRef: inc.responderRef,
      delivery: {
        ...inc.delivery,
        distinctPeerReceipts: this.peerReceipts.get(incidentId)?.size ?? 0,
      },
      timeline: [...inc.timeline].sort((a, b) => a.atS - b.atS),
    };
  }

  list(): readonly IncidentView[] {
    return [...this.incidents.keys()].map((id) => this.view(id)!).filter(Boolean);
  }

  private incidentIdFor(packet: Packet): StreamId | undefined {
    const payload = packet.payload as Record<string, unknown>;
    const direct = stringOf(payload['incidentId']);
    if (direct) return direct;
    if (packet.header.type === MessageType.LINK_RECEIPT) return undefined;
    if (packet.header.type === MessageType.BACKEND_ACKNOWLEDGEMENT) return stringOf(payload['incidentId']);
    return undefined;
  }

  private create(incidentId: StreamId, packet: Packet, options: ReduceOptions): MutableIncident {
    return {
      incidentId,
      state: 'draft',
      severity: packet.header.severity ?? Severity.INFO,
      category: 0,
      createdAtS: packet.header.createdAt,
      updatedAtS: packet.header.createdAt,
      latestSourceSequence: 0,
      ownedLocally: packet.header.sourceId === options.localSourceId,
      delivery: { distinctPeerReceipts: 0 } as MutableDelivery,
      timeline: [],
    };
  }

  private applyLocation(target: MutableIncident, payload: Record<string, unknown>, packet: Packet): void {
    const loc = payload['location'] as Record<string, unknown> | undefined;
    const latE7 = numberOf(loc?.['latE7']) ?? packet.geo?.latE7;
    const lonE7 = numberOf(loc?.['lonE7']) ?? packet.geo?.lonE7;
    if (latE7 === undefined || lonE7 === undefined) return;
    target.latE7 = latE7;
    target.lonE7 = lonE7;
    target.locationAccuracyM = numberOf(loc?.['accuracyM']) ?? packet.geo?.accuracyM;
    target.locationAgeS = numberOf(loc?.['ageS']);
    target.locationSource = numberOf(loc?.['source']);
  }
}

interface MutableDelivery {
  savedLocallyAtS?: number;
  distinctPeerReceipts: number;
  responderSeenAtS?: number;
  uploadedAtS?: number;
  backendAcceptedAtS?: number;
  assignedAtS?: number;
  acceptedAtS?: number;
  enRouteAtS?: number;
  arrivedAtS?: number;
  resolvedAtS?: number;
  cancelledAtS?: number;
}

interface MutableIncident {
  incidentId: StreamId;
  state: IncidentState;
  severity: number;
  category: number;
  peopleTotal?: number;
  injured?: number;
  mobility?: number;
  shortNote?: string;
  latE7?: number;
  lonE7?: number;
  locationAccuracyM?: number;
  locationAgeS?: number;
  locationSource?: number;
  createdAtS: number;
  updatedAtS: number;
  latestSourceSequence: number;
  ownedLocally: boolean;
  assignmentId?: string;
  responderRef?: string;
  delivery: MutableDelivery;
  timeline: TimelineEntry[];
}

function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function summarize(packet: Packet): string {
  const names: Readonly<Record<number, string>> = {
    [MessageType.SOS_CREATE]: 'SOS created',
    [MessageType.SOS_UPDATE]: 'SOS updated',
    [MessageType.SOS_CANCEL]: 'SOS cancelled by source',
    [MessageType.RESPONDER_ASSIGNED]: 'Responder assigned',
    [MessageType.RESPONDER_ACCEPTED]: 'Responder accepted',
    [MessageType.RESPONDER_DECLINED]: 'Responder declined',
    [MessageType.RESPONDER_EN_ROUTE]: 'Responder en route',
    [MessageType.RESPONDER_ARRIVED]: 'Responder reported arriving',
    [MessageType.RESOLVED]: 'Marked resolved',
    [MessageType.LINK_RECEIPT]: 'Copied to a nearby phone',
    [MessageType.BACKEND_ACKNOWLEDGEMENT]: 'Coordination centre received it',
  };
  return names[packet.header.type] ?? 'Update received';
}

/** Ordered delivery facts for the Active SOS screen (01-... screen 4). */
export function deliveryStatesFor(view: IncidentView): readonly DeliveryState[] {
  const d = view.delivery;
  const states: DeliveryState[] = [];
  if (d.savedLocallyAtS !== undefined) states.push('saved-locally');
  if (d.distinctPeerReceipts > 0) states.push('copied-to-peer');
  if (d.responderSeenAtS !== undefined) states.push('seen-by-responder');
  if (d.uploadedAtS !== undefined) states.push('uploaded-via-gateway');
  if (d.backendAcceptedAtS !== undefined) states.push('accepted-by-backend');
  if (d.assignedAtS !== undefined) states.push('responder-assigned');
  if (d.acceptedAtS !== undefined) states.push('responder-accepted');
  if (d.enRouteAtS !== undefined) states.push('responder-en-route');
  if (d.arrivedAtS !== undefined) states.push('responder-arrived');
  if (d.resolvedAtS !== undefined) states.push('resolved');
  if (d.cancelledAtS !== undefined) states.push('cancelled');
  return states;
}
