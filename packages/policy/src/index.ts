/**
 * @dsm/policy -- six independent decisions per accepted packet.
 *
 * Spec: 02-... "Independent packet-policy decisions"; invariant 6.
 * "Receiving a packet does not automatically mean showing it, notifying the
 * user, forwarding it, or uploading it."
 *
 * Worked example from the spec, implemented below: a shelter update outside
 * the user's display radius is STORED and RELAYED toward its region without
 * NOTIFYING that user.
 */

import {
  CLASS_BUDGETS,
  Flags,
  MessageType,
  PolicyReason,
  Priority,
  SESSION_CONTROL_TYPES,
  Severity,
  SourceClass,
  STORAGE,
  TERMINAL_TYPES,
  type AlertDecision,
  type ActDecision,
  type DisplayDecision,
  type Packet,
  type PolicyContext,
  type PolicyEngine,
  type PolicyOutcome,
  type PolicyReasonName,
  type RelayDecision,
  type StoreDecision,
  type UploadDecision,
} from '@dsm/contracts';
import { budgetClassFor } from '@dsm/codec';

/** Approximate metres between two E7 coordinates. Good enough for radius policy. */
export function distanceM(aLatE7: number, aLonE7: number, bLatE7: number, bLonE7: number): number {
  const toRad = Math.PI / 180;
  const lat1 = (aLatE7 / 1e7) * toRad;
  const lat2 = (bLatE7 / 1e7) * toRad;
  const dLat = lat2 - lat1;
  const dLon = ((bLonE7 - aLonE7) / 1e7) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const EMERGENCY_TYPES: ReadonlySet<number> = new Set([
  MessageType.SOS_CREATE,
  MessageType.SOS_UPDATE,
  MessageType.SOS_CANCEL,
]);

const RESPONDER_LIFECYCLE: ReadonlySet<number> = new Set([
  MessageType.RESPONDER_ASSIGNED,
  MessageType.RESPONDER_ACCEPTED,
  MessageType.RESPONDER_DECLINED,
  MessageType.RESPONDER_EN_ROUTE,
  MessageType.RESPONDER_ARRIVED,
  MessageType.RESOLVED,
]);

const RESOURCE_TYPES: ReadonlySet<number> = new Set([
  MessageType.SHELTER,
  MessageType.MEDICAL_POST,
  MessageType.FOOD_WATER,
  MessageType.SAFE_ZONE,
]);

const MAP_DELTA_TYPES: ReadonlySet<number> = new Set([
  ...RESOURCE_TYPES,
  MessageType.HAZARD,
  MessageType.ROUTE_STATE,
  MessageType.RECORD_UPSERT,
  MessageType.RECORD_TOMBSTONE,
  MessageType.CONTENT_ACTIVATE,
]);

export class DefaultPolicyEngine implements PolicyEngine {
  decide(packet: Packet, context: PolicyContext): PolicyOutcome {
    const { header } = packet;
    const type = header.type;
    const isOwn = header.sourceId === context.localSourceId;
    const isOwnIncident = packet.streamId !== undefined && context.ownIncidentIds.has(packet.streamId);
    const isTerminal = TERMINAL_TYPES.has(type) || (header.flags & Flags.TERMINAL) !== 0;
    const isResponder = context.role === 'responder';

    // Session control never becomes custody: it is scoped to one connection.
    if (SESSION_CONTROL_TYPES.has(type)) {
      return outcome({
        store: 'discard',
        display: 'diagnostics-only',
        alert: 'none',
        relay: 'never',
        upload: 'never',
        act: 'none',
        retentionS: 0,
        reasons: {
          store: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
          display: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
          alert: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
          relay: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
          upload: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
          act: PolicyReason.SESSION_CONTROL_NOT_RELAYED,
        },
      });
    }

    const distance = this.distanceToSelf(packet, context);
    const withinRadius = distance === undefined || distance <= context.displayRadiusM;

    // --- STORE ---------------------------------------------------------------
    let store: StoreDecision = 'store';
    let storeReason: PolicyReasonName = PolicyReason.RETENTION_WINDOW;
    if (isOwn || isOwnIncident) {
      storeReason = PolicyReason.OWN_PACKET;
    } else if (context.storagePressure === 'critical' && header.priority > Priority.RESPONSE_CONTROL) {
      store = 'discard';
      storeReason = PolicyReason.STORAGE_RESTRICTED;
    } else if (context.storagePressure === 'high' && header.priority >= Priority.FILE_MANIFEST) {
      store = 'store-compact';
      storeReason = PolicyReason.STORAGE_RESTRICTED;
    }

    // --- DISPLAY -------------------------------------------------------------
    let display: DisplayDecision;
    let displayReason: PolicyReasonName;
    if (isOwn || isOwnIncident) {
      display = 'show-full';
      displayReason = PolicyReason.OWN_INCIDENT;
    } else if (type === MessageType.FILE_FRAGMENT) {
      display = 'hide'; // FIL-003: incomplete content stays hidden.
      displayReason = PolicyReason.FILE_REQUIRES_EXPLICIT_REQUEST;
    } else if (type === MessageType.LINK_RECEIPT) {
      display = isResponder ? 'diagnostics-only' : 'diagnostics-only';
      displayReason = PolicyReason.DUPLICATE_SUPPRESSED;
    } else if (EMERGENCY_TYPES.has(type)) {
      if (isResponder) {
        display = 'show-full';
        displayReason = PolicyReason.RESPONDER_ROLE;
      } else if (withinRadius && header.severity >= Severity.URGENT) {
        // MAP-011 / ROL-007: the public sees the configured minimal view only.
        display = 'show-minimal';
        displayReason = PolicyReason.WITHIN_DISPLAY_RADIUS;
      } else {
        display = 'hide';
        displayReason = withinRadius
          ? PolicyReason.SEVERITY_BELOW_THRESHOLD
          : PolicyReason.OUTSIDE_DISPLAY_RADIUS;
      }
    } else if (RESPONDER_LIFECYCLE.has(type)) {
      display = isResponder || isOwnIncident ? 'show-full' : 'hide';
      displayReason = isResponder ? PolicyReason.RESPONDER_ROLE : PolicyReason.PUBLIC_ROLE_MINIMAL_VIEW;
    } else if (MAP_DELTA_TYPES.has(type) || type === MessageType.OFFICIAL_ALERT) {
      display = withinRadius ? 'show-full' : 'diagnostics-only';
      displayReason = withinRadius ? PolicyReason.WITHIN_DISPLAY_RADIUS : PolicyReason.OUTSIDE_DISPLAY_RADIUS;
    } else {
      display = 'show-minimal';
      displayReason = PolicyReason.WITHIN_DISPLAY_RADIUS;
    }

    // --- ALERT ---------------------------------------------------------------
    const { alert, alertReason } = this.decideAlert(packet, context, {
      isOwn: isOwn || isOwnIncident,
      isResponder,
      withinRadius,
      isTerminal,
    });

    // --- RELAY ---------------------------------------------------------------
    let relay: RelayDecision;
    let relayReason: PolicyReasonName;
    if (type === MessageType.FILE_FRAGMENT || type === MessageType.FILE_MANIFEST) {
      relay = 'requested-only'; // FIL-001: bounded, requested transfer only.
      relayReason = PolicyReason.FILE_REQUIRES_EXPLICIT_REQUEST;
    } else if (context.batteryBand <= 0 && header.priority > Priority.RESPONSE_CONTROL) {
      relay = 'never';
      relayReason = PolicyReason.BATTERY_RESTRICTED;
    } else if (header.priority <= Priority.RESPONSE_CONTROL || isTerminal) {
      relay = 'urgent';
      relayReason = isTerminal ? PolicyReason.TERMINAL_SUPPRESSES_ACTIVE : PolicyReason.COPY_BUDGET_AVAILABLE;
    } else if (header.priority <= Priority.OPERATIONAL) {
      relay = 'normal';
      relayReason = PolicyReason.COPY_BUDGET_AVAILABLE;
    } else {
      relay = 'opportunistic';
      relayReason = PolicyReason.COPY_BUDGET_AVAILABLE;
    }
    // The spec's worked example: relay a distant shelter update toward its
    // region even though this user is not notified about it.
    if (relay === 'never' && RESOURCE_TYPES.has(type) && context.batteryBand > 0) {
      relay = 'opportunistic';
      relayReason = PolicyReason.OUTSIDE_DISPLAY_RADIUS;
    }

    // --- UPLOAD --------------------------------------------------------------
    let upload: UploadDecision;
    let uploadReason: PolicyReasonName;
    if (header.sourceClass === SourceClass.BACKEND) {
      upload = 'never';
      uploadReason = PolicyReason.ALREADY_BACKEND_ORIGIN;
    } else if (type === MessageType.LINK_RECEIPT || type === MessageType.NETWORK_STATUS_OBSERVATION || type === MessageType.MESH_CHAT) {
      upload = 'never';
      uploadReason = PolicyReason.NOT_UPLOAD_ELIGIBLE;
    } else if (header.priority <= Priority.RESPONSE_CONTROL) {
      upload = 'upload-priority';
      uploadReason = PolicyReason.GATEWAY_PROVEN;
    } else if (header.priority >= Priority.FILE_MANIFEST) {
      upload = 'never';
      uploadReason = PolicyReason.NOT_UPLOAD_ELIGIBLE;
    } else {
      upload = 'upload-normal';
      uploadReason = PolicyReason.GATEWAY_PROVEN;
    }

    // --- ACT -----------------------------------------------------------------
    let act: ActDecision;
    let actReason: PolicyReasonName;
    if (MAP_DELTA_TYPES.has(type)) {
      act = 'apply-map';
      actReason = PolicyReason.AUTHORITY_SOURCE;
    } else if (EMERGENCY_TYPES.has(type) || RESPONDER_LIFECYCLE.has(type)) {
      act = 'update-incident';
      actReason = PolicyReason.OWN_INCIDENT;
    } else if (type === MessageType.CHECKIN_CAMPAIGN) {
      act = 'open-checkin';
      actReason = PolicyReason.AUTHORITY_SOURCE;
    } else if (type === MessageType.FILE_FRAGMENT) {
      act = 'complete-file';
      actReason = PolicyReason.FILE_REQUIRES_EXPLICIT_REQUEST;
    } else {
      act = 'none';
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
        act: actReason,
      },
    });
  }

  /** 01-... "Notification policy" table, row by row. */
  private decideAlert(
    packet: Packet,
    context: PolicyContext,
    flags: { isOwn: boolean; isResponder: boolean; withinRadius: boolean; isTerminal: boolean },
  ): { alert: AlertDecision; alertReason: PolicyReasonName } {
    const type = packet.header.type;
    const severity = packet.header.severity;

    if (flags.isOwn) {
      // Own SOS stored / copied to peer: confirmation, then quiet progress.
      if (type === MessageType.SOS_CREATE) return { alert: 'normal', alertReason: PolicyReason.OWN_PACKET };
      if (type === MessageType.BACKEND_ACKNOWLEDGEMENT) {
        return { alert: 'normal', alertReason: PolicyReason.OWN_INCIDENT };
      }
      if (type === MessageType.LINK_RECEIPT) return { alert: 'quiet', alertReason: PolicyReason.OWN_PACKET };
      return { alert: 'quiet', alertReason: PolicyReason.OWN_INCIDENT };
    }

    if (!context.nonCriticalAlertsEnabled && severity < Severity.LIFE_CRITICAL) {
      return { alert: 'silent', alertReason: PolicyReason.PUBLIC_ROLE_MINIMAL_VIEW };
    }

    if (type === MessageType.OFFICIAL_ALERT) {
      return severity >= Severity.URGENT
        ? { alert: 'critical', alertReason: PolicyReason.AUTHORITY_SOURCE }
        : { alert: 'normal', alertReason: PolicyReason.AUTHORITY_SOURCE };
    }

    if (EMERGENCY_TYPES.has(type)) {
      if (flags.isTerminal) return { alert: 'silent', alertReason: PolicyReason.TERMINAL_SUPPRESSES_ACTIVE };
      if (severity >= Severity.LIFE_CRITICAL && flags.withinRadius) {
        return {
          alert: 'critical',
          alertReason: flags.isResponder ? PolicyReason.RESPONDER_ROLE : PolicyReason.SEVERITY_THRESHOLD_MET,
        };
      }
      if (flags.isResponder) return { alert: 'normal', alertReason: PolicyReason.RESPONDER_ROLE };
      return { alert: 'silent', alertReason: PolicyReason.SEVERITY_BELOW_THRESHOLD };
    }

    if (type === MessageType.HAZARD || type === MessageType.ROUTE_STATE) {
      if (flags.withinRadius) {
        return severity >= Severity.URGENT
          ? { alert: 'critical', alertReason: PolicyReason.HAZARD_INTERSECTS_AREA }
          : { alert: 'normal', alertReason: PolicyReason.HAZARD_INTERSECTS_AREA };
      }
      return { alert: 'silent', alertReason: PolicyReason.OUTSIDE_DISPLAY_RADIUS };
    }

    if (type === MessageType.RESPONDER_ASSIGNED && flags.isResponder) {
      return { alert: 'normal', alertReason: PolicyReason.RESPONDER_ROLE };
    }

    if (type === MessageType.CHECKIN_CAMPAIGN) {
      return { alert: 'normal', alertReason: PolicyReason.AUTHORITY_SOURCE };
    }

    // Shelter/resource updates: silent map change unless directly relevant.
    return { alert: 'silent', alertReason: PolicyReason.OUTSIDE_DISPLAY_RADIUS };
  }

  private distanceToSelf(packet: Packet, context: PolicyContext): number | undefined {
    if (!context.coarseLocation) return undefined;
    const geo = packet.geo;
    const payloadLoc = (packet.payload as { location?: { latE7?: number; lonE7?: number } }).location;
    const latE7 = geo?.latE7 ?? payloadLoc?.latE7;
    const lonE7 = geo?.lonE7 ?? payloadLoc?.lonE7;
    if (latE7 === undefined || lonE7 === undefined) return undefined;
    return distanceM(context.coarseLocation.latE7, context.coarseLocation.lonE7, latE7, lonE7);
  }
}

function outcome(o: PolicyOutcome): PolicyOutcome {
  return o;
}

export const defaultPolicyEngine = new DefaultPolicyEngine();
