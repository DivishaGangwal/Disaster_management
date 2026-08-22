/**
 * BLE DISCOVERY ADVERTISEMENT -- byte layout.
 *
 * Spec: 02-... "BLE discovery advertisement".
 *
 * WHY THIS EXISTS: `DiscoverySummary` was only ever passed around as a
 * JavaScript object. Nothing encoded it, so the 24-byte budget had never been
 * tested and Workstream B would have had to invent a layout -- guaranteeing
 * the native and simulated adapters diverged.
 *
 * ---------------------------------------------------------------------------
 * WHAT AN ADVERTISEMENT IS AND IS NOT
 * ---------------------------------------------------------------------------
 * It is NOT a message channel. A legacy advertising PDU holds 31 bytes of AD
 * data; an SOS packet is 115-148 bytes and physically cannot fit.
 *
 * The advertisement says only: "I speak this protocol, here is my rotating
 * token, my queue changed, and this is the highest priority I am holding."
 * The PACKET travels afterwards over a GATT connection, which uses the 37
 * DATA channels with adaptive frequency hopping -- not the advertising
 * channels at all.
 *
 * ---------------------------------------------------------------------------
 * CHANNELS AND COLLISIONS
 * ---------------------------------------------------------------------------
 * One advertising event is transmitted on ALL THREE primary channels
 * (37 = 2402 MHz, 38 = 2426 MHz, 39 = 2480 MHz) by the Bluetooth controller.
 * Android's BluetoothLeAdvertiser exposes mode, TX power, connectable and
 * timeout -- there is NO channel-selection API. So the three-channel
 * broadcast is automatic and cannot be configured from here.
 *
 * Collisions are real and only partly mitigable:
 *  - BLE advertising has no carrier sense; simultaneous advertisers on one
 *    channel collide and both are lost;
 *  - the controller adds a pseudo-random 0-10 ms advDelay per event;
 *  - 37/38/39 sit in the gaps between Wi-Fi channels 1/6/11, so Wi-Fi is
 *    usually the larger interferer;
 *  - a scanner listens to ONE channel at a time, so it can miss an
 *    advertisement even with zero collision.
 *
 * Discovery is therefore PROBABILISTIC. The protocol must tolerate missed
 * advertisements, which it does: nothing depends on a single one being heard,
 * and `queueEpoch` lets a peer notice it missed a change.
 *
 * ---------------------------------------------------------------------------
 * LAYOUT -- 11 bytes of the 24 available
 * ---------------------------------------------------------------------------
 *   0      magic 0xd5                 ignore foreign 0xffff manufacturer data
 *   1      protocol major<<4 | minor
 *   2..5   rotating node token        4 bytes, rotates every 15 min
 *   6      capability bits
 *   7..8   queue epoch                uint16
 *   9..10  inventory hint             uint16
 *   11     packed state:
 *            bits 0-2  highest waiting priority (0-7)
 *            bit  3    gateway proven
 *            bits 4-5  gateway freshness class (0 fresh, 1 recent, 2 stale)
 *            bit  6    accepting connections
 *            bit  7    reserved
 *
 * FORBIDDEN here, by 02-...: victim name, phone number, SOS text, exact
 * coordinates, exact incident ID, permanent account ID, full inventory. None
 * of those is representable in this structure, which is the point.
 */

import { ADVERTISEMENT, BLE_IDENTIFIERS, type DiscoverySummary } from '@dsm/contracts';

export const ADVERTISEMENT_BYTES = 12;

export type AdvertisementDecodeResult =
  | { readonly ok: true; readonly summary: DiscoverySummary }
  | { readonly ok: false; readonly reason: 'too-short' | 'bad-magic' | 'unsupported-protocol' };

/** Encodes the manufacturer-data payload (without the AD element header). */
export function encodeAdvertisement(summary: DiscoverySummary): Uint8Array {
  if (summary.nodeToken.length !== ADVERTISEMENT.NODE_TOKEN_BYTES * 2) {
    throw new Error(`node token must be ${ADVERTISEMENT.NODE_TOKEN_BYTES} bytes of hex`);
  }

  const out = new Uint8Array(ADVERTISEMENT_BYTES);
  const view = new DataView(out.buffer);

  out[0] = BLE_IDENTIFIERS.ADVERTISEMENT_MAGIC;
  out[1] = ((summary.protocolMajor & 0x0f) << 4) | (summary.protocolMinor & 0x0f);

  for (let i = 0; i < ADVERTISEMENT.NODE_TOKEN_BYTES; i += 1) {
    out[2 + i] = Number.parseInt(summary.nodeToken.slice(i * 2, i * 2 + 2), 16);
  }

  out[6] = summary.capabilityBits & 0xff;
  view.setUint16(7, summary.queueEpoch & 0xffff, false);
  view.setUint16(9, summary.inventoryHint & 0xffff, false);

  out[11] =
    (summary.highestWaitingPriority & 0x07) |
    (summary.gatewayProven ? 0x08 : 0) |
    ((summary.gatewayFreshnessClass & 0x03) << 4) |
    (summary.acceptingConnections ? 0x40 : 0);

  return out;
}

export function decodeAdvertisement(bytes: Uint8Array): AdvertisementDecodeResult {
  if (bytes.length < ADVERTISEMENT_BYTES) return { ok: false, reason: 'too-short' };
  if (bytes[0] !== BLE_IDENTIFIERS.ADVERTISEMENT_MAGIC) return { ok: false, reason: 'bad-magic' };

  const major = (bytes[1]! >> 4) & 0x0f;
  if (major !== 1) return { ok: false, reason: 'unsupported-protocol' };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let nodeToken = '';
  for (let i = 0; i < ADVERTISEMENT.NODE_TOKEN_BYTES; i += 1) {
    nodeToken += bytes[2 + i]!.toString(16).padStart(2, '0');
  }
  const packed = bytes[11]!;

  return {
    ok: true,
    summary: {
      protocolMajor: major,
      protocolMinor: bytes[1]! & 0x0f,
      nodeToken,
      capabilityBits: bytes[6]!,
      queueEpoch: view.getUint16(7, false),
      inventoryHint: view.getUint16(9, false),
      highestWaitingPriority: packed & 0x07,
      gatewayProven: (packed & 0x08) !== 0,
      gatewayFreshnessClass: (packed >> 4) & 0x03,
      acceptingConnections: (packed & 0x40) !== 0,
    },
  };
}

/**
 * The complete AD payload Android hands to `BluetoothLeAdvertiser`.
 *
 * Returned so the budget can be asserted against a REAL PDU rather than
 * against our payload alone.
 */
export function buildAdvertisingPdu(summary: DiscoverySummary): Uint8Array {
  const payload = encodeAdvertisement(summary);

  // AD element 1: Flags (LE General Discoverable + BR/EDR not supported).
  const flags = Uint8Array.from([0x02, 0x01, 0x06]);

  // AD element 2: manufacturer-specific data, company id 0xffff (SIG-reserved
  // for testing -- we have no assigned ID and will not squat on another's).
  const manufacturer = new Uint8Array(2 + 2 + payload.length);
  manufacturer[0] = 1 + 2 + payload.length; // length byte excludes itself
  manufacturer[1] = 0xff;
  manufacturer[2] = BLE_IDENTIFIERS.COMPANY_ID & 0xff; // little-endian company id
  manufacturer[3] = (BLE_IDENTIFIERS.COMPANY_ID >> 8) & 0xff;
  manufacturer.set(payload, 4);

  const pdu = new Uint8Array(flags.length + manufacturer.length);
  pdu.set(flags, 0);
  pdu.set(manufacturer, flags.length);

  if (pdu.length > ADVERTISEMENT.PDU_BYTES) {
    throw new Error(`advertising PDU is ${pdu.length}B, over the ${ADVERTISEMENT.PDU_BYTES}B limit`);
  }
  return pdu;
}
