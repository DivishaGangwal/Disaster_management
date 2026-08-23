import { buildSosCreate } from '../../packages/codec/src/builders';
import { validate } from '../../packages/validator/src/validate';
import { EmergencyCategory, Severity, Mobility, LocationSource, ReplyCapability, MessageType } from '../../packages/contracts/src';

function run() {
  const incidentId = 'SRC-12345';
  const encoded = buildSosCreate({
    sourceId: 'offline-source',
    sourceClass: 2,
    nowS: Math.floor(Date.now() / 1000),
  }, {
    incidentId,
    category: EmergencyCategory.OTHER,
    severity: Severity.URGENT,
    peopleTotal: 1,
    mobility: Mobility.UNKNOWN,
    location: { source: LocationSource.DEVICE_GPS, latE7: 190765000, lonE7: 728780000, ageS: 0 },
    replyCapabilities: ReplyCapability.TIER1_BLE,
  });

  const validation = validate(encoded.bytes, {
    nowS: Math.floor(Date.now() / 1000),
    transport: 'local',
    hopCountOnArrival: 0,
    isKnownDuplicate: false,
    streamTerminated: false,
    storagePressure: 'ok',
    queueDepth: 0,
    maxQueueDepth: 100,
  });

  console.log(JSON.stringify(validation, null, 2));
}

run();
