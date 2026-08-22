/**
 * POLICY DECISION CONTRACT
 *
 * Spec: 02-... "Independent packet-policy decisions" and invariant 6:
 * "Receiving a packet does not automatically mean showing it, notifying the
 * user, forwarding it, or uploading it. Those are separate decisions."
 *
 * Six independent outputs, each with its own reason code.
 */

import type { Packet, TransportKind } from './envelope.js';
import type { PolicyReasonName } from './reasons.js';
import type { LocalRole } from './profile.js';
import type { BatteryBandValue } from './enums.js';

export type StoreDecision = 'store' | 'store-compact' | 'discard';
export type DisplayDecision = 'show-full' | 'show-minimal' | 'diagnostics-only' | 'hide';
/** 01-... "Notification policy" table. */
export type AlertDecision = 'critical' | 'normal' | 'quiet' | 'silent' | 'none';
export type RelayDecision = 'urgent' | 'normal' | 'opportunistic' | 'requested-only' | 'never';
export type UploadDecision = 'upload-priority' | 'upload-normal' | 'never';
export type ActDecision = 'apply-map' | 'open-checkin' | 'update-incident' | 'complete-file' | 'none';

export interface PolicyOutcome {
  readonly store: StoreDecision;
  readonly display: DisplayDecision;
  readonly alert: AlertDecision;
  readonly relay: RelayDecision;
  readonly upload: UploadDecision;
  readonly act: ActDecision;
  /** Seconds. Never Infinity: 02-... "No budget may remain 'unlimited'." */
  readonly retentionS: number;
  /** One reason per decision, in the order above, for the diagnostics screen. */
  readonly reasons: {
    readonly store: PolicyReasonName;
    readonly display: PolicyReasonName;
    readonly alert: PolicyReasonName;
    readonly relay: PolicyReasonName;
    readonly upload: PolicyReasonName;
    readonly act: PolicyReasonName;
  };
}

/** Everything the policy engine is allowed to read. Nothing else. */
export interface PolicyContext {
  readonly role: LocalRole;
  readonly localSourceId: string;
  readonly ownIncidentIds: ReadonlySet<string>;
  readonly transport: TransportKind;
  readonly nowS: number;
  /** Coarse position only. The engine never needs an exact fix. */
  readonly coarseLocation?: { readonly latE7: number; readonly lonE7: number };
  readonly displayRadiusM: number;
  readonly regionCode: string;
  readonly batteryBand: BatteryBandValue;
  readonly storagePressure: 'ok' | 'high' | 'critical';
  readonly queueDepth: number;
  readonly packRegionKnown: boolean;
  /** Set false when the user muted non-critical alerts. */
  readonly nonCriticalAlertsEnabled: boolean;
}

export interface PolicyEngine {
  decide(packet: Packet, context: PolicyContext): PolicyOutcome;
}
