/**
 * AUTHORITY / COORDINATOR DASHBOARD SURFACE REGISTRY
 *
 * Spec: 04-BLUEPRINT 26.3; 01-... screen 14; WEB-001..WEB-007, WEB-010.
 *
 * Same pattern as the mobile screen registry: the spec's requirements encoded
 * as a checklist so Workstream E cannot silently drop a surface, and reviewers
 * have something concrete to check against.
 */

export type SurfaceStatus = 'scaffold' | 'partial' | 'complete';

export interface SurfaceSpec {
  readonly key: string;
  readonly title: string;
  readonly requirements: readonly string[];
  readonly mustShow: readonly string[];
  readonly status: SurfaceStatus;
}

export const AUTHORITY_SURFACES: readonly SurfaceSpec[] = [
  {
    key: 'incident-queue',
    title: 'Incident map and queue',
    requirements: ['WEB-001', 'WEB-003', 'GTW-003'],
    mustShow: [
      'ONE deduplicated incident per incident ID',
      'MULTIPLE gateway observations, never multiplied victims',
      'incident timeline',
      'last-known location AGE and ACCURACY',
      'filters: severity, age, state, type, region',
    ],
    status: 'partial',
  },
  {
    key: 'responder-ops',
    title: 'Responder roster and assignment',
    requirements: ['WEB-002', 'ROL-003'],
    mustShow: [
      'responder availability',
      'assign, acknowledge, en route, arrived, resolved',
      'responder identity labelled ORGANISATION-PROVISIONED, never "verified" (INT-004)',
      'every action emits a new packet rather than mutating history invisibly',
    ],
    status: 'partial',
  },
  {
    key: 'regional-editor',
    title: 'Resource, hazard, and route editor',
    requirements: ['WEB-004', 'MAP-002'],
    mustShow: [
      'hospitals, shelters, food/water, safe zones for the selected region',
      'hazards and route records',
      'edits reference STABLE COMPACT OBJECT IDs from the content pack',
    ],
    status: 'partial',
  },
  {
    key: 'alert-composer',
    // HD-010: check-in campaigns are no longer composed here. WEB-004 stays
    // unmet on that point rather than being quietly reworded as complete.
    title: 'Official alert composer (check-in campaigns not offered, HD-010)',
    requirements: ['WEB-004', 'WEB-005', 'DEC-015'],
    mustShow: [
      'compact outbound content preview',
      'ESTIMATED AND ACTUAL BYTE SIZE (WEB-005)',
      'campaign validation and approval controls',
      'only authority-provisioned sources may compose official alerts',
      'operator-selected broadcast point carried in the alert packet',
    ],
    status: 'partial',
  },
  {
    key: 'gateway-audit',
    title: 'Gateway synchronization and audit',
    requirements: ['WEB-010', 'GTW-003'],
    mustShow: [
      'per-gateway upload and download history',
      'outbound-to-mesh queue state',
      'region-bounded outbound selection',
    ],
    status: 'partial',
  },
];

export const BROADCASTER_SURFACES: readonly SurfaceSpec[] = [
  {
    key: 'approved-campaigns',
    title: 'Approved campaigns only',
    requirements: ['WEB-006', 'WEB-007', 'DEC-025'],
    mustShow: [
      'ONLY campaigns in an approved-or-later state',
      'editing approved content returns it to draft/validation',
      'the broadcaster cannot silently alter authority meaning',
    ],
    status: 'complete',
  },
  {
    key: 'packet-inventory',
    title: 'Packet inventory and schedule',
    requirements: ['WEB-008', 'T2-005', 'T2-006'],
    mustShow: [
      'packet inventory with per-item byte budgets',
      'repetition order and expected duration',
      'critical items repeating more often than normal updates',
      'an over-budget campaign shown as over budget, never silently truncated',
    ],
    status: 'complete',
  },
  {
    key: 'decode-test',
    title: 'Decode-before-broadcast',
    requirements: ['WEB-008', 'WEB-009'],
    mustShow: [
      'audio artifact preview',
      'expected versus recovered packet IDs',
      'frames detected / valid / corrupt / duplicate',
      'pass or fail, tied to the artifact integrity value',
    ],
    status: 'complete',
  },
  {
    key: 'broadcast-log',
    title: 'Schedule, export, and log',
    requirements: ['WEB-006', 'WEB-008'],
    mustShow: [
      'scheduled / exported / played state',
      'an IMMUTABLE log entry naming the tested artifact version and integrity value',
    ],
    status: 'partial',
  },
];
