import { buildSosCreate } from '../../packages/codec/src/builders';
import { toMapOperations } from '../../packages/mapkit/src/packet-to-map';
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

  const packet = {
    header: {
      packetId: encoded.packetId,
      type: MessageType.SOS_CREATE,
      createdAt: Math.floor(Date.now() / 1000),
      severity: Severity.URGENT,
    },
    payload: {
      incidentId,
      category: EmergencyCategory.OTHER,
      severity: Severity.URGENT,
      peopleTotal: 1,
      mobility: Mobility.UNKNOWN,
      location: { source: LocationSource.DEVICE_GPS, latE7: 190765000, lonE7: 728780000, ageS: 0 },
      replyCapabilities: ReplyCapability.TIER1_BLE,
    }
  } as any;

  const ops = toMapOperations(packet, 'local', Math.floor(Date.now() / 1000));
  console.log("Map Operations:", JSON.stringify(ops, null, 2));
}

run();
