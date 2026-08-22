/**
 * Synthetic demo actors for the judged scenario.
 *
 * INT-006 is binding: no real names, phone numbers, or addresses. Every value
 * here is invented. ROL-003: responder status is demo-provisioned, and the UI
 * must say so rather than "verified".
 */

import type { LocalProfile } from '@dsm/contracts';

export interface DemoActor {
  readonly name: string;
  readonly nodeToken: string;
  readonly sourceId: string;
  readonly profile: LocalProfile;
  readonly latE7: number;
  readonly lonE7: number;
}

export const DEMO_ACTORS: readonly DemoActor[] = [
  {
    name: 'Phone A (source)',
    nodeToken: 'a1a10001',
    sourceId: 'a1a1a1a1a1a1a1a1',
    profile: {
      localUserId: 'demo-user-a',
      alias: 'Demo Citizen A',
      role: 'general-public',
      language: 'en',
      responderProvisionedByDemo: false,
    },
    latE7: 285355000,
    lonE7: 771234000,
  },
  {
    name: 'Phone B (carrier)',
    nodeToken: 'b2b20002',
    sourceId: 'b2b2b2b2b2b2b2b2',
    profile: {
      localUserId: 'demo-user-b',
      alias: 'Demo Citizen B',
      role: 'general-public',
      language: 'en',
      responderProvisionedByDemo: false,
    },
    latE7: 285380000,
    lonE7: 771280000,
  },
  {
    name: 'Phone C (responder)',
    nodeToken: 'c3c30003',
    sourceId: 'c3c3c3c3c3c3c3c3',
    profile: {
      localUserId: 'demo-user-c',
      alias: 'Demo Responder C',
      role: 'responder',
      language: 'en',
      responderCapabilities: ['medical', 'rescue'],
      // Demo-provisioned, NOT cryptographically verified (ROL-003, INT-004).
      responderProvisionedByDemo: true,
    },
    latE7: 285420000,
    lonE7: 771320000,
  },
  {
    name: 'Phone D (gateway candidate)',
    nodeToken: 'd4d40004',
    sourceId: 'd4d4d4d4d4d4d4d4',
    profile: {
      localUserId: 'demo-user-d',
      alias: 'Demo Citizen D',
      role: 'general-public',
      language: 'hi',
      responderProvisionedByDemo: false,
    },
    latE7: 285460000,
    lonE7: 771360000,
  },
];

/** 03-... "Demo reset must restore" -- the checklist, as data. */
export const DEMO_RESET_CHECKLIST: readonly string[] = [
  'clear all stored packets, custody, and observations on every phone',
  'clear incidents, incident events, and delivery facts',
  'reset the map projection to the baseline content pack',
  'clear peer and topology observations',
  'reset gateway probe state and sync cursors',
  'reset Tier 2 campaign recovered/expected state',
  'clear the local diagnostic event log',
  'restore the seeded resource, hazard, and route baseline',
  'leave relay mode STOPPED so the operator starts it deliberately',
];
