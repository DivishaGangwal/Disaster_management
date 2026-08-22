/**
 * @dsm/transport-core -- the transport SEAM.
 *
 * ==========================================================================
 *  THE EXPO GO vs DEV BUILD BOUNDARY LIVES HERE.
 *
 *  Expo Go / Node / CI  ->  SimulatedTransportAdapter (this package)
 *  Expo dev build       ->  NativeTransportAdapter    (native/android-radio-bridge)
 *
 *  Both satisfy the same @dsm/contracts TransportAdapter interface, so the
 *  domain, map, incident, and UI layers cannot tell them apart. That is the
 *  definition of architectural correctness in 02-...: "an agent can replace
 *  the Bluetooth adapter ... without changing the packet meaning, local
 *  policy, incident model, or map-update behavior."
 *
 *  DEC-006: a Bluetooth Classic contingency adapter also plugs in here,
 *  without touching a single higher-level rule.
 * ==========================================================================
 */

import { ADVERTISEMENT, type DiscoverySummary, type TransportAdapter } from '@dsm/contracts';

export * from './simulated-adapter.js';

/** How the app chooses an adapter at startup. */
export type AdapterSelection = 'native-ble' | 'native-classic' | 'simulated';

export interface AdapterFactory {
  create(selection: AdapterSelection): Promise<TransportAdapter>;
}

/**
 * Builds a discovery advertisement.
 *
 * 02-... FORBIDS victim name, phone number, SOS text, exact coordinates, exact
 * incident ID, permanent account ID, and full inventory in an advertisement.
 * Everything this function can emit is bounded and non-identifying by
 * construction -- there is no parameter that could carry those.
 */
export function buildDiscoverySummary(input: {
  readonly nodeToken: string;
  readonly queueEpoch: number;
  readonly highestWaitingPriority: number;
  readonly inventoryHint: number;
  readonly gatewayProven: boolean;
  readonly gatewayFreshnessClass: number;
  readonly acceptingConnections: boolean;
  readonly capabilityBits: number;
}): DiscoverySummary {
  if (input.nodeToken.length !== ADVERTISEMENT.NODE_TOKEN_BYTES * 2) {
    throw new Error(`node token must be ${ADVERTISEMENT.NODE_TOKEN_BYTES} bytes of hex`);
  }
  return {
    protocolMajor: 1,
    protocolMinor: 0,
    nodeToken: input.nodeToken,
    capabilityBits: input.capabilityBits,
    queueEpoch: input.queueEpoch & 0xffff,
    highestWaitingPriority: Math.min(7, Math.max(0, input.highestWaitingPriority)),
    inventoryHint: input.inventoryHint & 0xffff,
    gatewayProven: input.gatewayProven,
    gatewayFreshnessClass: input.gatewayFreshnessClass,
    acceptingConnections: input.acceptingConnections,
  };
}

/** Capability bits advertised in discovery. */
export const CapabilityBit = {
  GATT_SERVER: 1 << 0,
  GATT_CLIENT: 1 << 1,
  FRAGMENTS: 1 << 2,
  GATEWAY_CAPABLE: 1 << 3,
  RESPONDER_MODE: 1 << 4,
  CODED_PHY: 1 << 5,
} as const;
