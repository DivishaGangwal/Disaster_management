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

export const MUMBAI_SEED_VERSION = 'mumbai-development-v2';

const RESPONDERS: readonly ResponderRecord[] = [
  responder('RSP-MUM-01', 'Mumbai Fire Brigade Rescue 01', 'Mumbai City', ['rescue', 'flood', 'first-aid']),
  responder('RSP-MUM-02', 'Municipal Medical Response 02', 'Mumbai Central', ['medical', 'triage']),
  responder('RSP-MUM-03', 'Eastern Suburbs Relief Unit 03', 'Kurla', ['shelter', 'supplies', 'evacuation']),
  responder('RSP-MUM-04', 'Western Suburbs Rescue 04', 'Andheri', ['flood', 'rescue']),
  responder('RSP-MUM-05', 'Urban Search Unit 05', 'Dadar', ['collapse', 'search', 'medical']),
  responder('RSP-MUM-06', 'Coastal Response Unit 06', 'Colaba', ['rescue', 'flood', 'evacuation']),
  responder('RSP-MUM-07', 'Mobile Medical Unit 07', 'Sion', ['medical', 'triage', 'transport']),
  responder('RSP-MUM-08', 'Relief Logistics Unit 08', 'Bandra', ['supplies', 'shelter', 'routing']),
];

const REGIONAL: readonly RegionalRecord[] = [
  // IDs, labels, coordinates and baseline state agree with MUMBAI_CONTENT_PACK.
  // Website edits then travel as canonical packets and replace this baseline on phones.
  regional('MUM-SHL-MMRDA', 'shelter', 'MMRDA Grounds, BKC', 'Bandra Kurla Complex', 'open', 19.0658, 72.8657),
  regional('MUM-SHL-WANK', 'shelter', 'Wankhede Stadium, Marine Lines', 'Marine Lines', 'open', 18.9398, 72.8251),
  regional('MUM-SHL-AZAD', 'shelter', 'Azad Maidan, Fort', 'Fort', 'open', 18.9370, 72.8328),
  regional('MUM-SHL-ANDHERI', 'shelter', 'Andheri Sports Complex', 'Andheri', 'open', 19.1196, 72.8458),
  regional('MUM-SHL-DHARAVI', 'shelter', 'Dharavi Community Hall', 'Dharavi', 'open', 19.0390, 72.8557),
  regional('MUM-MED-KEM', 'medical', 'KEM Hospital, Parel', 'Parel', 'open', 19.0013, 72.8413),
  regional('MUM-MED-NAIR', 'medical', 'Nair Hospital, Mumbai Central', 'Mumbai Central', 'open', 18.9649, 72.8161),
  regional('MUM-MED-SION', 'medical', 'Lokmanya Tilak Municipal Hospital, Sion', 'Sion', 'open', 19.0401, 72.8614),
  regional('MUM-MED-COOPER', 'medical', 'Cooper Hospital, Vile Parle', 'Vile Parle', 'open', 19.1127, 72.8367),
  regional('MUM-MED-JJH', 'medical', 'JJ Hospital, Byculla', 'Byculla', 'open', 18.9854, 72.8381),
  regional('MUM-FWD-DADAR', 'food-water', 'Dadar Relief Distribution Point', 'Dadar', 'open', 19.0182, 72.8329),
  regional('MUM-FWD-KURLA', 'food-water', 'Kurla Supply Distribution', 'Kurla', 'open', 19.0658, 72.8782),
  regional('MUM-FWD-BORIVALI', 'food-water', 'Borivali Supply Point', 'Borivali', 'open', 19.2290, 72.8565),
  regional('MUM-SFZ-MALABAR', 'safe-zone', 'Malabar Hill (High Ground)', 'Malabar Hill', 'open', 18.9520, 72.8078),
  regional('MUM-SFZ-POWAI', 'safe-zone', 'Powai Elevated Zone', 'Powai', 'open', 19.1177, 72.9060),
  regional('MUM-SFZ-AAREY', 'safe-zone', 'Aarey Colony High Ground', 'Aarey', 'open', 19.1548, 72.8758),
  regional('MUM-HZD-KURLA', 'hazard', 'Kurla Flood Watch Sector', 'Kurla', 'active', 19.0658, 72.8782),
  regional('MUM-HZD-MITHI', 'hazard', 'Mithi River Flood Watch', 'Mumbai Suburban', 'watch', 19.0710, 72.8840),
  regional('MUM-RTE-WE', 'route', 'Western Express Highway Corridor', 'Western Suburbs', 'open', 18.8980, 72.8251),
  regional('MUM-RTE-EE', 'route', 'Eastern Freeway Corridor', 'Eastern Suburbs', 'open', 18.9320, 72.8370),
  regional('MUM-RTE-LBS', 'route', 'LBS Marg East Corridor', 'Eastern Suburbs', 'open', 19.0070, 72.8810),
  regional('MUM-RTE-SL', 'route', 'Sion–Panvel Highway Corridor', 'Sion', 'open', 19.0380, 72.8617),
];

const GATEWAYS = [
  ['GW-MUMBAI-SOUTH', 'mumbai-south'],
  ['GW-MUMBAI-CENTRAL', 'mumbai-central'],
  ['GW-MUMBAI-EAST', 'mumbai-east'],
  ['GW-MUMBAI-WEST', 'mumbai-west'],
] as const;

export function seedMumbaiOperations(store: SqliteBackendStore, ingest: IngestService): void {
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
    detail: `Mumbai development operations data restored (${MUMBAI_SEED_VERSION})`,
  });
}

export function ensureMumbaiPopulation(store: SqliteBackendStore, ingest: IngestService): void {
  for (const [token, node] of GATEWAYS) if (!store.gatewayTokens.has(token)) store.registerGateway(token, node, REGION_CODE);
  for (const item of RESPONDERS) if (!store.responders.has(item.responderRef)) store.responders.set(item.responderRef, item);
  for (const item of REGIONAL) {
    const current = store.regionalRecords.get(item.objectId);
    // A published website edit increments the version and wins. Version-one
    // baseline rows may be safely reconciled with the shared mobile pack.
    if (!current || current.version === 1) store.regionalRecords.set(item.objectId, item);
  }
  const hasCurrentScenario = store.incidents.list().some((incident) => incident.incidentId.startsWith('INC-MUM-V1-'));
  if (!hasCurrentScenario) seedActiveScenario(store, ingest);
  store.saveOperations();
}

function seedActiveScenario(store: SqliteBackendStore, ingest: IngestService): void {

  const nowMs = Date.now();
  const incidents = [
    buildSosCreate(
      { sourceId: 'a500000000000001', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 12 * 60_000) },
      {
        incidentId: 'INC-MUM-V1-FLOOD-01',
        category: EmergencyCategory.FLOOD,
        severity: Severity.LIFE_CRITICAL,
        peopleTotal: 5,
        injured: 1,
        mobility: Mobility.LIMITED,
        location: { source: LocationSource.USER_PIN, latE7: 190658000, lonE7: 728782000, accuracyM: 35, ageS: 90 },
        replyCapabilities: ReplyCapability.TIER1_BLE,
        shortNote: 'Family isolated by rising water',
      },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000002', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 7 * 60_000) },
      {
        incidentId: 'INC-MUM-V1-MED-02',
        category: EmergencyCategory.MEDICAL,
        severity: Severity.URGENT,
        peopleTotal: 2,
        injured: 1,
        mobility: Mobility.IMMOBILE,
        location: { source: LocationSource.CACHED_GNSS, latE7: 190401000, lonE7: 728614000, accuracyM: 60, ageS: 180 },
        replyCapabilities: ReplyCapability.TIER1_BLE,
        shortNote: 'Medical support requested',
      },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000003', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 4 * 60_000) },
      {
        incidentId: 'INC-MUM-V1-TRAPPED-03',
        category: EmergencyCategory.TRAPPED,
        severity: Severity.URGENT,
        peopleTotal: 3,
        mobility: Mobility.TRAPPED,
        location: { source: LocationSource.USER_PIN, latE7: 190390000, lonE7: 728557000, accuracyM: 80, ageS: 240 },
        replyCapabilities: ReplyCapability.TIER1_BLE,
        shortNote: 'Road access blocked after structural failure',
      },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000004', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 9 * 60_000) },
      { incidentId: 'INC-MUM-V1-FLOOD-04', category: EmergencyCategory.FLOOD, severity: Severity.URGENT, peopleTotal: 8, injured: 0, mobility: Mobility.LIMITED, location: { source: LocationSource.USER_PIN, latE7: 190710000, lonE7: 728840000, accuracyM: 45, ageS: 120 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Two households cut off near Mithi River' },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000005', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 6 * 60_000) },
      { incidentId: 'INC-MUM-V1-COLLAPSE-05', category: EmergencyCategory.STRUCTURAL_COLLAPSE, severity: Severity.LIFE_CRITICAL, peopleTotal: 4, injured: 2, mobility: Mobility.TRAPPED, location: { source: LocationSource.CACHED_GNSS, latE7: 190182000, lonE7: 728329000, accuracyM: 28, ageS: 75 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Wall collapse with people trapped' },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000006', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 16 * 60_000) },
      { incidentId: 'INC-MUM-V1-MED-06', category: EmergencyCategory.MEDICAL, severity: Severity.ASSISTANCE, peopleTotal: 1, injured: 1, mobility: Mobility.IMMOBILE, location: { source: LocationSource.USER_PIN, latE7: 189649000, lonE7: 728161000, accuracyM: 55, ageS: 210 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Insulin and transport requested' },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000007', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 3 * 60_000) },
      { incidentId: 'INC-MUM-V1-FIRE-07', category: EmergencyCategory.FIRE, severity: Severity.URGENT, peopleTotal: 6, injured: 0, mobility: Mobility.MOBILE, location: { source: LocationSource.USER_PIN, latE7: 191120000, lonE7: 728540000, accuracyM: 32, ageS: 45 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Electrical fire near relief storage' },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000008', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 14 * 60_000) },
      { incidentId: 'INC-MUM-V1-MISSING-08', category: EmergencyCategory.MISSING_PERSON, severity: Severity.ASSISTANCE, peopleTotal: 1, injured: 0, mobility: Mobility.UNKNOWN, location: { source: LocationSource.CACHED_GNSS, latE7: 192290000, lonE7: 728565000, accuracyM: 120, ageS: 360 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Separated from family during evacuation' },
    ),
    buildSosCreate(
      { sourceId: 'a500000000000009', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 5 * 60_000) },
      { incidentId: 'INC-MUM-V1-TRAPPED-09', category: EmergencyCategory.TRAPPED, severity: Severity.LIFE_CRITICAL, peopleTotal: 7, injured: 2, mobility: Mobility.TRAPPED, location: { source: LocationSource.USER_PIN, latE7: 191177000, lonE7: 729060000, accuracyM: 70, ageS: 95 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Vehicle stranded in fast-moving water' },
    ),
    buildSosCreate(
      { sourceId: 'a50000000000000a', sourceClass: SourceClass.GENERAL_PUBLIC, nowS: toEpochS(nowMs - 11 * 60_000) },
      { incidentId: 'INC-MUM-V1-OTHER-10', category: EmergencyCategory.OTHER, severity: Severity.URGENT, peopleTotal: 12, injured: 0, mobility: Mobility.LIMITED, location: { source: LocationSource.USER_PIN, latE7: 191548000, lonE7: 728758000, accuracyM: 90, ageS: 160 }, replyCapabilities: ReplyCapability.TIER1_BLE, shortNote: 'Evacuation transport needed before road closes' },
    ),
  ];

  for (const [gatewayIndex, [gatewayToken]] of GATEWAYS.entries()) {
    const selected = incidents.filter((_, index) => index % GATEWAYS.length === gatewayIndex || (index === 0 && gatewayIndex === 1));
    ingest.ingest(
      {
        gatewayToken,
        batchId: `SEED-${MUMBAI_SEED_VERSION}-${gatewayIndex}`,
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
