import {
  EmergencyCategory,
  LocationSource,
  Mobility,
  ReplyCapability,
  Severity,
  SourceClass,
} from '@dsm/contracts';
import { buildSosCreate, toEpochS } from '@dsm/codec';
import { IngestService } from './services.js';
import { REGION_CODE } from './operations.js';
import { SqliteBackendStore, type RegionalRecord, type ResponderRecord } from './sqlite-store.js';

export const ASSAM_SEED_VERSION = 'assam-synthetic-v2';

const RESPONDERS: readonly ResponderRecord[] = [
  responder('RSP-AS-01', 'River Rescue Unit 01', 'Kamrup Metropolitan', ['rescue', 'flood', 'first-aid']),
  responder('RSP-AS-02', 'Medical Response Unit 02', 'Nagaon', ['medical', 'triage']),
  responder('RSP-AS-03', 'Relief Field Unit 03', 'Dibrugarh', ['shelter', 'supplies', 'evacuation']),
  responder('RSP-AS-04', 'Hill Response Unit 04', 'Dima Hasao', ['landslide', 'rescue']),
  responder('RSP-AS-05', 'Urban Search Unit 05', 'Kamrup Metropolitan', ['collapse', 'search', 'medical']),
  responder('RSP-AS-06', 'Boat Response Unit 06', 'Barpeta', ['rescue', 'flood', 'evacuation']),
  responder('RSP-AS-07', 'Mobile Medical Unit 07', 'Cachar', ['medical', 'triage', 'transport']),
  responder('RSP-AS-08', 'Relief Logistics Unit 08', 'Jorhat', ['supplies', 'shelter', 'routing']),
];

const REGIONAL: readonly RegionalRecord[] = [
  regional('SHL-AS-001', 'shelter', 'District Relief Shelter 01', 'Kamrup Metropolitan', 'open', 26.1445, 91.7362),
  regional('SHL-AS-002', 'shelter', 'Flood Relief Shelter 02', 'Nagaon', 'open', 26.3509, 92.6922),
  regional('MED-AS-001', 'medical', 'Emergency Medical Post 01', 'Dibrugarh', 'open', 27.4728, 94.9120),
  regional('FWD-AS-001', 'food-water', 'Relief Distribution Point 01', 'Morigaon', 'open', 26.2529, 92.3424),
  regional('SFZ-AS-001', 'safe-zone', 'Assembly Area 01', 'Kamrup Metropolitan', 'open', 26.1158, 91.7086),
  regional('HZD-AS-001', 'hazard', 'Flood Watch Sector 01', 'Nagaon', 'active', 26.4150, 92.7300),
  regional('RTE-AS-001', 'route', 'Relief Corridor 01', 'Kamrup Metropolitan', 'restricted', 26.1800, 91.7800),
  regional('SHL-AS-003', 'shelter', 'Barpeta Higher Secondary Shelter', 'Barpeta', 'open', 26.3232, 91.0054),
  regional('SHL-AS-004', 'shelter', 'Silchar College Relief Camp', 'Cachar', 'full', 24.8170, 92.7979),
  regional('MED-AS-002', 'medical', 'Nagaon Mobile Medical Camp', 'Nagaon', 'open', 26.3442, 92.6769),
  regional('MED-AS-003', 'medical', 'Silchar Emergency Field Post', 'Cachar', 'damaged', 24.8273, 92.7798),
  regional('FWD-AS-002', 'food-water', 'Barpeta Supply Distribution Point', 'Barpeta', 'open', 26.3216, 91.0019),
  regional('FWD-AS-003', 'food-water', 'Jorhat Relief Logistics Yard', 'Jorhat', 'open', 26.7509, 94.2037),
  regional('SFZ-AS-002', 'safe-zone', 'Dibrugarh Assembly Ground', 'Dibrugarh', 'open', 27.4721, 94.8991),
  regional('HZD-AS-002', 'hazard', 'Brahmaputra Erosion Watch', 'Dhubri', 'watch', 26.0211, 89.9744),
  regional('RTE-AS-002', 'route', 'NH-27 Barpeta Approach', 'Barpeta', 'blocked', 26.2871, 91.1172),
  regional('RTE-AS-003', 'route', 'Silchar Medical Access Route', 'Cachar', 'open', 24.8420, 92.8065),
];

const GATEWAYS = [
  ['GW-GUWAHATI', 'assam-guwahati'],
  ['GW-NAGAON', 'assam-nagaon'],
  ['GW-DIBRUGARH', 'assam-dibrugarh'],
  ['GW-SILCHAR', 'assam-silchar'],
] as const;

export function seedAssamDemo(store: SqliteBackendStore, ingest: IngestService): void {
  for (const [token, node] of GATEWAYS) store.registerGateway(token, node, REGION_CODE);
  for (const item of RESPONDERS) store.responders.set(item.responderRef, item);
  for (const item of REGIONAL) store.regionalRecords.set(item.objectId, item);
  store.saveOperations();

  seedActiveScenario(store, ingest);
  store.recordAudit({
    id: `AUDIT-${Date.now()}`,
    atMs: Date.now(),
    action: 'system.baseline-restored',
    subject: REGION_CODE,
    detail: `Synthetic Assam operations data restored (${ASSAM_SEED_VERSION})`,
  });
}

export function ensureAssamDemoPopulation(store: SqliteBackendStore, ingest: IngestService): void {
  for (const [token, node] of GATEWAYS) if (!store.gatewayTokens.has(token)) store.registerGateway(token, node, REGION_CODE);
  for (const item of RESPONDERS) if (!store.responders.has(item.responderRef)) store.responders.set(item.responderRef, item);
  for (const item of REGIONAL) if (!store.regionalRecords.has(item.objectId)) store.regionalRecords.set(item.objectId, item);
  const hasCurrentScenario = store.incidents.list().some((incident) => incident.incidentId.startsWith('INC-AS-V2-'));
  if (!hasCurrentScenario) seedActiveScenario(store, ingest);
  store.saveOperations();
}

function seedActiveScenario(store: SqliteBackendStore, ingest: IngestService): void {

  const nowMs = Date.now();
  const incidents = [
    buildSosCreate(
      { sourceId: 'a500000000000001', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 12 * 60_000) },
      {
        incidentId: 'INC-AS-V2-FLOOD-01',
        category: EmergencyCategory.FLOOD,
        severity: Severity.LIFE_CRITICAL,
        peopleTotal: 5,
        injured: 1,
        mobility: Mobility.LIMITED,
        location: { source: LocationSource.USER_PIN, latE7: 263501000, lonE7: 920003000, accuracyM: 35, ageS: 90 },
        replyCapabilities: ReplyCapability.TIER1_BLE,
        shortNote: 'Family isolated by rising water',
      },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000002', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 7 * 60_000) },
      {
        incidentId: 'INC-AS-V2-MED-02',
        category: EmergencyCategory.MEDICAL,
        severity: Severity.URGENT,
        peopleTotal: 2,
        injured: 1,
        mobility: Mobility.IMMOBILE,
        location: { source: LocationSource.CACHED_GNSS, latE7: 264901000, lonE7: 919201000, accuracyM: 60, ageS: 180 },
        replyCapabilities: ReplyCapability.TIER1_BLE,
        shortNote: 'Medical support requested',
      },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000003', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 4 * 60_000) },
      {
        incidentId: 'INC-AS-V2-LAND-03',
        category: EmergencyCategory.TRAPPED,
        severity: Severity.URGENT,
        peopleTotal: 3,
        mobility: Mobility.TRAPPED,
        location: { source: LocationSource.USER_PIN, latE7: 251702000, lonE7: 932106000, accuracyM: 80, ageS: 240 },
        replyCapabilities: ReplyCapability.TIER1_BLE,
        shortNote: 'Road access blocked after slope failure',
      },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000004', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 9 * 60_000) },
      { incidentId: 'INC-AS-V2-FLOOD-04', category: EmergencyCategory.FLOOD, severity: Severity.URGENT, peopleTotal: 8, injured: 0, mobility: Mobility.LIMITED, location: { source: LocationSource.USER_PIN, latE7: 263202000, lonE7: 910214000, accuracyM: 45, ageS: 120 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Two households cut off near embankment' },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000005', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 6 * 60_000) },
      { incidentId: 'INC-AS-V2-COLLAPSE-05', category: EmergencyCategory.STRUCTURAL_COLLAPSE, severity: Severity.LIFE_CRITICAL, peopleTotal: 4, injured: 2, mobility: Mobility.TRAPPED, location: { source: LocationSource.CACHED_GNSS, latE7: 261522000, lonE7: 917806000, accuracyM: 28, ageS: 75 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Wall collapse with people trapped' },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000006', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 16 * 60_000) },
      { incidentId: 'INC-AS-V2-MED-06', category: EmergencyCategory.MEDICAL, severity: Severity.ASSISTANCE, peopleTotal: 1, injured: 1, mobility: Mobility.IMMOBILE, location: { source: LocationSource.USER_PIN, latE7: 248288000, lonE7: 927916000, accuracyM: 55, ageS: 210 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Insulin and transport requested' },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000007', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 3 * 60_000) },
      { incidentId: 'INC-AS-V2-FIRE-07', category: EmergencyCategory.FIRE, severity: Severity.URGENT, peopleTotal: 6, injured: 0, mobility: Mobility.MOBILE, location: { source: LocationSource.USER_PIN, latE7: 267491000, lonE7: 942104000, accuracyM: 32, ageS: 45 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Electrical fire near relief storage' },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000008', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 14 * 60_000) },
      { incidentId: 'INC-AS-V2-MISSING-08', category: EmergencyCategory.MISSING_PERSON, severity: Severity.ASSISTANCE, peopleTotal: 1, injured: 0, mobility: Mobility.UNKNOWN, location: { source: LocationSource.CACHED_GNSS, latE7: 270922000, lonE7: 931684000, accuracyM: 120, ageS: 360 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Separated from family during evacuation' },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000009', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 5 * 60_000) },
      { incidentId: 'INC-AS-V2-TRAPPED-09', category: EmergencyCategory.TRAPPED, severity: Severity.LIFE_CRITICAL, peopleTotal: 7, injured: 2, mobility: Mobility.TRAPPED, location: { source: LocationSource.USER_PIN, latE7: 260182000, lonE7: 899802000, accuracyM: 70, ageS: 95 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Vehicle stranded in fast-moving water' },
    ),
    buildSosCreate(
      { sourceId: 'a50000000000000a', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 11 * 60_000) },
      { incidentId: 'INC-AS-V2-OTHER-10', category: EmergencyCategory.OTHER, severity: Severity.URGENT, peopleTotal: 12, injured: 0, mobility: Mobility.LIMITED, location: { source: LocationSource.USER_PIN, latE7: 254851000, lonE7: 935626000, accuracyM: 90, ageS: 160 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Evacuation transport needed before road closes' },
    ),
  ];

  for (const [gatewayIndex, [gatewayToken]] of GATEWAYS.entries()) {
    const selected = incidents.filter((_, index) => index % GATEWAYS.length === gatewayIndex || (index === 0 && gatewayIndex === 1));
    ingest.ingest(
      {
        gatewayToken,
        batchId: `SEED-${ASSAM_SEED_VERSION}-${gatewayIndex}`,
        items: selected.map((packet, index) => ({
        packetId: packet.packetId,
        bytes: packet.bytes,
        observation: {
          receivedAtMs: nowMs - (index + gatewayIndex + 1) * 22_000,
          transport: 'gateway' as const,
          hopCountOnArrival: index + 1,
        },
      })),
      },
      nowMs - gatewayIndex * 7_000,
    );
    store.recordGatewayTransfer({ gatewayToken, direction: 'upload', regionCode: REGION_CODE, itemCount: selected.length, atMs: nowMs - gatewayIndex * 7_000 });
    store.recordGatewayTransfer({ gatewayToken, direction: 'download', regionCode: REGION_CODE, itemCount: Math.max(1, gatewayIndex), atMs: nowMs - gatewayIndex * 11_000 });
  }
}

function responder(
  responderRef: string,
  name: string,
  district: string,
  capabilities: readonly string[],
): ResponderRecord {
  return {
    responderRef,
    name,
    district,
    capabilities,
    available: true,
    provisionedByDemo: true,
    status: 'available',
    lastUpdatedAtMs: Date.now(),
  };
}

function regional(
  objectId: string,
  kind: RegionalRecord['kind'],
  name: string,
  district: string,
  state: string,
  latitude: number,
  longitude: number,
): RegionalRecord {
  return {
    objectId,
    kind,
    name,
    district,
    state,
    latE7: Math.round(latitude * 1e7),
    lonE7: Math.round(longitude * 1e7),
    version: 1,
    updatedAtMs: Date.now(),
    synthetic: true,
  };
}
