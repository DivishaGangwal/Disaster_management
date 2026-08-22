/**
 * SCREEN REGISTRY  --  the mobile app's contract with the spec.
 *
 * Spec: 04-BLUEPRINT 26.2 "Required mobile screens" (13 screens) and
 * 01-... "Screen-by-screen product specification".
 *
 * Every screen is listed with the requirement IDs it must satisfy and the
 * elements it MUST show. Workstream A implements them; this file is the
 * checklist reviewers and QA run against, so nothing is quietly dropped.
 *
 * `status` is honest: 'scaffold' means the route and contract exist but the
 * surface is not built yet. Update it in the same PR that builds the screen.
 */

export type ScreenStatus = 'scaffold' | 'partial' | 'complete';

export interface ScreenSpec {
  readonly route: string;
  readonly title: string;
  readonly requirements: readonly string[];
  /** Elements the spec says the screen MUST show. Reviewed one by one. */
  readonly mustShow: readonly string[];
  readonly status: ScreenStatus;
}

export const SCREENS: readonly ScreenSpec[] = [
  {
    route: 'Readiness',
    title: 'Readiness and role',
    requirements: ['OFF-001', 'OFF-004', 'OFF-006', 'ROL-001', 'ROL-002', 'DEC-004'],
    mustShow: [
      'selected local role (General Public / Responder)',
      'offline content pack name, version, region',
      'Bluetooth support and permission status',
      'relay-mode status',
      'internet state as untested / unavailable / probing / proven gateway -- never "connected"',
      'last-known location status',
      'Tier 2 listening inactive/active',
      'whether the transport is SIMULATED or native (DEC-004, working rule 11)',
      'a prominent route to Home even when permissions are incomplete',
    ],
    status: 'scaffold',
  },
  {
    route: 'Home',
    title: 'Citizen home',
    requirements: ['SOS-001', 'OFF-001', 'MAP-001'],
    mustShow: [
      'large primary SOS action',
      'current operating mode',
      'active SOS status if one exists',
      'most urgent relevant alert',
      'nearest useful resources from offline data',
      'relay status and recent peer count',
      'last proven gateway / acknowledgement state',
      'offline map entry',
      'NO generic "Connected" label -- say what is connected',
    ],
    status: 'scaffold',
  },
  {
    route: 'SosComposer',
    title: 'SOS composer',
    requirements: ['SOS-002', 'SOS-003', 'OFF-002', 'OFF-005'],
    mustShow: [
      'rapid path: one action creates a default urgent SOS from local profile/location',
      'expanded path: category, 4-level severity, people count, injured count',
      'mobility: mobile / limited / immobile / trapped / unknown',
      'short constrained note or prepared phrase',
      'location source, accuracy, and age',
      'language preference',
      'confirmation of what will be shared locally',
      'creation must succeed with NO location and NO internet',
    ],
    status: 'scaffold',
  },
  {
    route: 'ActiveSos',
    title: 'Active SOS and delivery timeline',
    requirements: ['SOS-007', 'SOS-008', 'SOS-010', 'DEC-022', 'GTW-008'],
    mustShow: [
      'incident summary and latest update sequence',
      'local-save timestamp',
      'number of DISTINCT peer link receipts',
      'responder acknowledgement, shown SEPARATELY',
      'gateway/backend acknowledgement, shown SEPARATELY',
      'assignment / accepted / en route / arrived / resolved states',
      'next retry/relay state in plain language',
      'update and cancel actions',
      'location age and an update-location action',
      'a relay copy is NEVER described as "help is coming" (use DELIVERY_STATE_COPY)',
    ],
    status: 'scaffold',
  },
  {
    route: 'Map',
    title: 'Offline operational map and list',
    requirements: ['MAP-001', 'MAP-003', 'MAP-004', 'MAP-005', 'MAP-010', 'MAP-011'],
    mustShow: [
      'layers: self, SOS, responders, permitted peers, hospitals, shelters, food/water, safe zones, help centres, hazards, route changes, gateway observations, optional topology',
      'every dynamic marker exposes update age; accuracy when supplied',
      'stale markers are visually stale and eventually withdrawn',
      'detail sheet: source category, last update, location quality, state, action',
      'a LIST equivalent for accessibility and low-performance devices',
      'filters for incidents / responders / resources / hazards / routes / topology',
    ],
    status: 'scaffold',
  },
  {
    route: 'NearbyIncidents',
    title: 'Nearby incidents',
    requirements: ['ROL-006', 'ROL-007', 'MAP-011'],
    mustShow: [
      'General Public: the configured MINIMAL public view only',
      'Responder: sort by severity, age, distance, people/injury, assignment state, last update',
      'severity alone must not hide older unhandled cases indefinitely',
    ],
    status: 'scaffold',
  },
  {
    route: 'ResponderIncident',
    title: 'Responder incident detail',
    requirements: ['OFF-007', 'ROL-007'],
    mustShow: [
      'accept or decline',
      'mark en route',
      'last-known location and its uncertainty',
      'latest incident update and timeline',
      'deliberate publish of responder status/location',
      'mark arrived',
      'resolve with a reason, or escalate/reopen where the demo workflow allows',
      'every transition produces a compact state packet',
    ],
    status: 'scaffold',
  },
  {
    route: 'ResourceDetail',
    title: 'Local help / resource detail',
    requirements: ['MAP-004', 'MAP-008', 'DEC-020'],
    mustShow: [
      'type and name',
      'stable object identity for diagnostics',
      'coordinates and offline route context',
      'open / closed / unknown state',
      'capacity or availability if supplied',
      'last update and source category',
      'whether the value came from base pack, Tier 1, Tier 2, or gateway',
      'superseded / stale warning',
    ],
    status: 'scaffold',
  },
  {
    route: 'RelayStatus',
    title: 'Relay and gateway status',
    requirements: ['REL-001', 'GTW-001', 'GTW-007'],
    mustShow: [
      'relay active/inactive with a visible STOP control',
      'scan/advertise capability',
      'peers recently seen',
      'packets stored, queued, forwarded, expired, rejected, waiting',
      'queue BY PRIORITY -- never personal packet contents',
      'proven internet state and last probe time',
      'last upload / last download',
      'battery mode',
    ],
    status: 'scaffold',
  },
  {
    route: 'Topology',
    title: 'Network topology and packet journey',
    requirements: ['DEC-021', 'MAP-012'],
    mustShow: [
      'time-bounded observed nodes and edges',
      'edge kinds: discovered, transferred, ack returned, gateway upload, radio bridge',
      'observation age; old observations fade and expire',
      'one packet’s known path and state observations',
      'NO claim of an omniscient global graph',
    ],
    status: 'scaffold',
  },
  {
    route: 'Tier2Listen',
    title: 'Tier 2 listening',
    requirements: ['T2-002', 'T2-003', 'T2-007', 'T2-008'],
    mustShow: [
      'microphone permission and an active-capture indicator',
      'direct-demo versus microphone source, direct labelled a controlled demonstration',
      'active campaign ID and version when detected',
      'frames detected / valid / corrupt / duplicate / missing',
      'packets recovered versus the expected manifest',
      'resulting alerts and map actions',
      'listen timeout and a STOP control',
      'explicit "one-way broadcast" language',
    ],
    status: 'scaffold',
  },
  {
    route: 'Checkin',
    title: 'Check-in form',
    requirements: ['T2-012', 'DEC-008'],
    mustShow: [
      'the CACHED form schema and options from the content pack',
      'status, people count where requested, current location state',
      'the source incident/campaign reference',
      'the response leaves by Tier 1 or a later gateway -- NEVER by radio',
    ],
    status: 'scaffold',
  },
  {
    route: 'Diagnostics',
    title: 'Diagnostics',
    requirements: ['INT-004', 'INT-007'],
    mustShow: [
      'transport, packet ID prefix, packet type, size',
      'source category and previous hop',
      'timestamps',
      'validation outcome with its gate and reason code',
      'policy outcomes (store/show/alert/relay/upload/act) with reason codes',
      'resulting map or incident action',
      'kept separable from the normal citizen experience',
    ],
    status: 'scaffold',
  },
];

/** Guard used by the boundary check: no screen may silently disappear. */
export const REQUIRED_SCREEN_COUNT = 13;
