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

export const ASSAM_SEED_VERSION = 'assam-synthetic-v1';

const RESPONDERS: readonly ResponderRecord[] = [
  responder('RSP-AS-01', 'River Rescue Unit 01', 'Kamrup Metropolitan', ['rescue', 'flood', 'first-aid']),
  responder('RSP-AS-02', 'Medical Response Unit 02', 'Nagaon', ['medical', 'triage']),
  responder('RSP-AS-03', 'Relief Field Unit 03', 'Dibrugarh', ['shelter', 'supplies', 'evacuation']),
  responder('RSP-AS-04', 'Hill Response Unit 04', 'Dima Hasao', ['landslide', 'rescue']),
];

const REGIONAL: readonly RegionalRecord[] = [
  regional('SHL-AS-001', 'shelter', 'District Relief Shelter 01', 'Kamrup Metropolitan', 'open', 26.1445, 91.7362),
  regional('SHL-AS-002', 'shelter', 'Flood Relief Shelter 02', 'Nagaon', 'open', 26.3509, 92.6922),
  regional('MED-AS-001', 'medical', 'Emergency Medical Post 01', 'Dibrugarh', 'open', 27.4728, 94.9120),
  regional('FWD-AS-001', 'food-water', 'Relief Distribution Point 01', 'Morigaon', 'open', 26.2529, 92.3424),
  regional('SFZ-AS-001', 'safe-zone', 'Assembly Area 01', 'Kamrup Metropolitan', 'open', 26.1158, 91.7086),
  regional('HZD-AS-001', 'hazard', 'Flood Watch Sector 01', 'Nagaon', 'active', 26.4150, 92.7300),
  regional('RTE-AS-001', 'route', 'Relief Corridor 01', 'Kamrup Metropolitan', 'restricted', 26.1800, 91.7800),
];

export function seedAssamDemo(store: SqliteBackendStore, ingest: IngestService): void {
  store.registerGateway('GW-ASSAM-OPS', 'assam-ops', REGION_CODE);
  for (const item of RESPONDERS) store.responders.set(item.responderRef, item);
  for (const item of REGIONAL) store.regionalRecords.set(item.objectId, item);
  store.saveOperations();

  const nowMs = Date.now();
  const incidents = [
    buildSosCreate(
      { sourceId: 'a500000000000001', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 12 * 60_000) },
      {
        incidentId: 'INC-AS-FLOOD-01',
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
        incidentId: 'INC-AS-MED-02',
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
        incidentId: 'INC-AS-LAND-03',
        category: EmergencyCategory.TRAPPED,
        severity: Severity.URGENT,
        peopleTotal: 3,
        mobility: Mobility.TRAPPED,
        location: { source: LocationSource.USER_PIN, latE7: 251702000, lonE7: 932106000, accuracyM: 80, ageS: 240 },
        replyCapabilities: ReplyCapability.TIER1_BLE,
        shortNote: 'Road access blocked after slope failure',
      },
    ),
  ];

  ingest.ingest(
    {
      gatewayToken: 'GW-ASSAM-OPS',
      batchId: `SEED-${ASSAM_SEED_VERSION}`,
      items: incidents.map((packet, index) => ({
        packetId: packet.packetId,
        bytes: packet.bytes,
        observation: {
          receivedAtMs: nowMs - (index + 1) * 45_000,
          transport: 'gateway' as const,
          hopCountOnArrival: index + 1,
        },
      })),
    },
    nowMs,
  );
  store.recordAudit({
    id: `AUDIT-${Date.now()}`,
    atMs: Date.now(),
    action: 'system.baseline-restored',
    subject: REGION_CODE,
    detail: `Synthetic Assam operations data restored (${ASSAM_SEED_VERSION})`,
  });
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
