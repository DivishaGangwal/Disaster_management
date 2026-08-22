/**
 * PACKET -> MAP OPERATION MATRIX
 *
 * Spec: 03-... Workstream D deliverable "packet-to-map operation matrix";
 * MAP-009 / DEC-013: Tier 1, gateway, and Tier 2 all arrive here.
 *
 * This is the ONLY translation from a packet into a map operation. If a family
 * has no row here it simply does not touch the map.
 */

import {
  MessageType,
  type MapOperation,
  type Packet,
  type TransportKind,
} from '@dsm/contracts';

const RESOURCE_KIND: Readonly<Record<number, 'shelter' | 'medical' | 'food-water' | 'safe-zone'>> = {
  [MessageType.SHELTER]: 'shelter',
  [MessageType.MEDICAL_POST]: 'medical',
  [MessageType.FOOD_WATER]: 'food-water',
  [MessageType.SAFE_ZONE]: 'safe-zone',
};

export function toMapOperations(packet: Packet, transport: TransportKind, nowS: number): readonly MapOperation[] {
  const p = packet.payload as Record<string, unknown>;
  const version = packet.sourceSequence ?? packet.header.createdAt;
  const base = {
    causedByPacketId: packet.header.packetId,
    transport,
    version,
    appliedAtS: packet.header.createdAt,
    ...(packet.header.expiresAt ? { expiresAtS: packet.header.expiresAt } : {}),
  } as const;

  const type = packet.header.type;

  if (RESOURCE_KIND[type]) {
    const loc = p['location'] as Record<string, unknown> | undefined;
    const objectId = str(p['objectId']);
    if (!objectId) return [];
    return [
      {
        ...base,
        kind: 'upsert-resource',
        objectId,
        objectType: RESOURCE_KIND[type]!,
        state: num(p['state']) ?? 0,
        ...(num(loc?.['latE7']) !== undefined ? { latE7: num(loc?.['latE7'])! } : {}),
        ...(num(loc?.['lonE7']) !== undefined ? { lonE7: num(loc?.['lonE7'])! } : {}),
        ...(num(p['capacityBand']) !== undefined ? { capacityBand: num(p['capacityBand'])! } : {}),
        ...(num(p['capabilityBits']) !== undefined ? { capabilityBits: num(p['capabilityBits'])! } : {}),
        // A temporary object is one the packet positions itself rather than
        // referencing a baseline pack entry.
        temporary: objectId.startsWith('TMP-'),
        ...(str(p['fallbackLabel']) ? { fallbackLabel: str(p['fallbackLabel'])! } : {}),
      } as MapOperation,
    ];
  }

  switch (type) {
    case MessageType.HAZARD: {
      const hazardId = str(p['hazardId']);
      if (!hazardId) return [];
      return [
        {
          ...base,
          kind: 'upsert-hazard',
          hazardId,
          hazardType: num(p['hazardType']) ?? 8,
          geometryKind: num(p['geometryKind']) ?? 0,
          ...(num(p['latE7']) !== undefined ? { latE7: num(p['latE7'])! } : {}),
          ...(num(p['lonE7']) !== undefined ? { lonE7: num(p['lonE7'])! } : {}),
          ...(num(p['radiusM']) !== undefined ? { radiusM: num(p['radiusM'])! } : {}),
          ...(Array.isArray(p['routeIds']) ? { routeIds: p['routeIds'] as string[] } : {}),
          severity: packet.header.severity,
          ...(str(p['fallbackLabel']) ? { fallbackLabel: str(p['fallbackLabel'])! } : {}),
        } as MapOperation,
      ];
    }
    case MessageType.ROUTE_STATE: {
      const routeId = str(p['routeId']);
      if (!routeId) return [];
      return [
        {
          ...base,
          kind: 'set-route-state',
          routeId,
          state: num(p['state']) ?? 0,
          ...(num(p['direction']) !== undefined ? { direction: num(p['direction'])! } : {}),
          ...(str(p['fallbackInstruction']) ? { fallbackLabel: str(p['fallbackInstruction'])! } : {}),
        } as MapOperation,
      ];
    }
    case MessageType.SOS_CREATE:
    case MessageType.SOS_UPDATE: {
      const incidentId = str(p['incidentId']);
      if (!incidentId) return [];
      const loc = p['location'] as Record<string, unknown> | undefined;
      const latE7 = num(loc?.['latE7']) ?? packet.geo?.latE7;
      const lonE7 = num(loc?.['lonE7']) ?? packet.geo?.lonE7;
      if (latE7 === undefined || lonE7 === undefined) return [];
      // The marker ages from the FIX time, not the packet time (02-...).
      const locationAtS = packet.header.createdAt - (num(loc?.['ageS']) ?? 0);
      return [
        {
          ...base,
          kind: 'upsert-incident-marker',
          incidentId,
          latE7,
          lonE7,
          ...(num(loc?.['accuracyM']) !== undefined ? { accuracyM: num(loc?.['accuracyM'])! } : {}),
          locationAtS,
          locationSource: num(loc?.['source']) ?? 0,
          severity: packet.header.severity,
          category: num(p['category']) ?? 7,
          ...(num(p['peopleTotal']) !== undefined ? { peopleTotal: num(p['peopleTotal'])! } : {}),
        } as MapOperation,
      ];
    }
    case MessageType.SOS_CANCEL: {
      const incidentId = str(p['incidentId']);
      if (!incidentId) return [];
      return [{ ...base, kind: 'set-incident-state', incidentId, state: 'cancelled' } as MapOperation];
    }
    case MessageType.RESOLVED: {
      const incidentId = str(p['incidentId']);
      if (!incidentId) return [];
      return [{ ...base, kind: 'set-incident-state', incidentId, state: 'resolved' } as MapOperation];
    }
    case MessageType.RESPONDER_ASSIGNED:
    case MessageType.RESPONDER_ACCEPTED:
    case MessageType.RESPONDER_EN_ROUTE:
    case MessageType.RESPONDER_ARRIVED: {
      const incidentId = str(p['incidentId']);
      const responderRef = str(p['responderRef']);
      const ops: MapOperation[] = [];

      if (incidentId) {
        const state =
          type === MessageType.RESPONDER_ASSIGNED
            ? 'assigned'
            : type === MessageType.RESPONDER_ACCEPTED
              ? 'accepted'
              : type === MessageType.RESPONDER_EN_ROUTE
                ? 'en-route'
                : 'arrived';
        ops.push({ ...base, kind: 'set-incident-state', incidentId, state } as MapOperation);
      }

      const loc = p['location'] as Record<string, unknown> | undefined;
      if (responderRef && num(loc?.['latE7']) !== undefined && num(loc?.['lonE7']) !== undefined) {
        ops.push({
          ...base,
          kind: 'upsert-responder-marker',
          responderRef,
          ...(incidentId ? { incidentId } : {}),
          status: type === MessageType.RESPONDER_EN_ROUTE ? 'en-route' : type === MessageType.RESPONDER_ARRIVED ? 'arrived' : 'assigned',
          latE7: num(loc?.['latE7'])!,
          lonE7: num(loc?.['lonE7'])!,
          ...(num(loc?.['accuracyM']) !== undefined ? { accuracyM: num(loc?.['accuracyM'])! } : {}),
          locationAtS: packet.header.createdAt - (num(loc?.['ageS']) ?? 0),
          locationSource: num(loc?.['source']) ?? 0,
        } as MapOperation);
      }
      return ops;
    }
    case MessageType.RECORD_TOMBSTONE: {
      const objectId = str(p['objectId']);
      if (!objectId) return [];
      return [
        {
          ...base,
          kind: 'tombstone-object',
          objectId,
          ...(num(p['reasonCode']) !== undefined ? { reasonCode: num(p['reasonCode'])! } : {}),
        } as MapOperation,
      ];
    }
    case MessageType.CONTENT_ACTIVATE: {
      const objectId = str(p['objectId']);
      const bundleId = str(p['bundleId']);
      if (!objectId || !bundleId) return [];
      return [
        {
          ...base,
          kind: 'activate-content',
          bundleId,
          objectId,
          opcode: num(p['opcode']) ?? 0,
          ...(str(p['fallbackText']) ? { fallbackLabel: str(p['fallbackText'])! } : {}),
        } as MapOperation,
      ];
    }
    default:
      // OFFICIAL_ALERT, CHECKIN_*, RESOURCE_REQUEST, FILE_* and the network
      // family drive UI surfaces, not the map projection.
      return [];
  }
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
