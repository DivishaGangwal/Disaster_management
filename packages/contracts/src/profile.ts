/**
 * LOCAL PROFILE, ROLES, AND DELIVERY TRUTH LANGUAGE
 *
 * Spec: 01-... ROL-001..ROL-007, "Custody and truth language",
 * "Data minimization and disclosure".
 */

/** ROL-001: the two hackathon mobile modes. Web roles are not app roles. */
export type LocalRole = 'general-public' | 'responder';

/** ROL-004: web-only roles. Listed here so the backend shares one vocabulary. */
export type WebRole = 'authority-publisher' | 'coordinator' | 'radio-broadcaster';

/**
 * ROL-002: usable before any online registration.
 * Data minimization: everything except id/role/language is optional.
 */
export interface LocalProfile {
  readonly localUserId: string;
  readonly alias?: string;
  readonly role: LocalRole;
  readonly language: string;
  readonly contactRef?: string;
  readonly medicalSummary?: string;
  readonly responderCapabilities?: readonly string[];
  /**
   * ROL-003 / INT-004: true only means the demo dataset provisioned this role.
   * The UI must say "demo-provisioned", never "verified".
   */
  readonly responderProvisionedByDemo: boolean;
}

/**
 * CUSTODY AND TRUTH LANGUAGE  --  every state is distinct.
 * Spec: 02-... "Custody and truth language"; DEC-022; SOS-007; SOS-008.
 *
 * A link receipt means one neighbouring phone validated the packet. The UI
 * must NEVER translate it into "help is coming".
 */
export type DeliveryState =
  | 'saved-locally'
  | 'copied-to-peer'
  | 'seen-by-responder'
  | 'uploaded-via-gateway'
  | 'accepted-by-backend'
  | 'responder-assigned'
  | 'responder-accepted'
  | 'responder-en-route'
  | 'responder-arrived'
  | 'resolved'
  | 'cancelled'
  | 'expired';

/**
 * Approved user-facing copy for each delivery state. The mobile app must use
 * these strings (or their translations) and must not invent softer wording.
 * 01-... "Truthful status" acceptance row.
 */
export const DELIVERY_STATE_COPY: Readonly<Record<DeliveryState, string>> = {
  'saved-locally': 'Saved on this phone',
  'copied-to-peer': 'Copied to nearby phones',
  'seen-by-responder': 'A responder has seen this',
  'uploaded-via-gateway': 'Sent through a phone with internet',
  'accepted-by-backend': 'Coordination centre received it',
  'responder-assigned': 'A responder was assigned',
  'responder-accepted': 'A responder accepted this case',
  'responder-en-route': 'A responder is travelling to you',
  'responder-arrived': 'A responder reported arriving',
  resolved: 'Marked resolved',
  cancelled: 'Cancelled',
  expired: 'No longer active',
};

/** 01-... "Packet custody state". */
export type CustodyState =
  | 'created-locally'
  | 'stored'
  | 'advertised'
  | 'requested'
  | 'sent'
  | 'link-acknowledged'
  | 'gateway-queued'
  | 'uploaded'
  | 'backend-acknowledged'
  | 'expired'
  | 'superseded'
  | 'tombstoned'
  | 'invalid'
  | 'evicted';

/** 01-... "Incident state". */
export type IncidentState =
  | 'draft'
  | 'created'
  | 'active'
  | 'assigned'
  | 'accepted'
  | 'en-route'
  | 'arrived'
  | 'resolved'
  | 'cancelled'
  | 'expired'
  | 'reopened';
