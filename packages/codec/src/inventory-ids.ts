/**
 * COMPACT INVENTORY IDS -- raw byte prefixes instead of hex strings.
 *
 * Spec: 02-... REL-003 "exchange COMPACT inventory information".
 *
 * A packet ID is 16 binary bytes, but every payload field that carried one was
 * a 32-CHARACTER hex string. In the value codec that is
 * TAG.TEXT(1) + uvarint(32)(1) + 32 = 34 bytes per ID, against ~164 usable
 * bytes in a 180-byte session-control payload -- so exactly FOUR IDs fit
 * (HD-012). Hex doubles a binary identifier for no benefit: the only consumer
 * is set membership, which never needs the characters back.
 *
 * Here the IDs travel as ONE concatenated byte blob -- TAG.BYTES(1) +
 * uvarint(len)(1) + 8N -- which costs 8 bytes per ID instead of 34 and raises
 * the same budget to ~19. One blob rather than an array of byte fields,
 * because an array pays the 2-byte tag+length per element and would stop at 16.
 *
 * WHY 8 BYTES IS ENOUGH: a 64-bit prefix over the STORAGE.MAX_STORED_PACKETS
 * ceiling of 2,000 packets gives a birthday-collision probability near 1e-8.
 * A collision costs one suppressed offer to one peer for one session, and the
 * packet still reaches that peer by any other path -- the copy budget is 12
 * and this is not the only route. It is not a correctness risk the way a
 * Bloom filter's false positives would be, because the failure is bounded to
 * a single link rather than poisoning a shared structure.
 */

/** Bytes of packet ID carried per compact inventory entry. */
export const INVENTORY_ID_PREFIX_BYTES = 8;

/** Hex characters of the prefix; the set-membership key is this substring. */
const PREFIX_CHARS = INVENTORY_ID_PREFIX_BYTES * 2;

/**
 * The comparison key for one packet ID.
 *
 * Both sides of a session MUST derive membership through this function --
 * announcing a prefix and testing a full ID would silently never match.
 */
export function packetIdPrefixKey(packetId: string): string {
  return packetId.slice(0, PREFIX_CHARS).toLowerCase();
}

/** Packs packet IDs into the concatenated prefix blob carried on the wire. */
export function packInventoryIds(packetIds: readonly string[]): Uint8Array {
  const out = new Uint8Array(packetIds.length * INVENTORY_ID_PREFIX_BYTES);
  packetIds.forEach((packetId, index) => {
    const base = index * INVENTORY_ID_PREFIX_BYTES;
    for (let byte = 0; byte < INVENTORY_ID_PREFIX_BYTES; byte += 1) {
      out[base + byte] = Number.parseInt(packetId.slice(byte * 2, byte * 2 + 2), 16) || 0;
    }
  });
  return out;
}

/**
 * Unpacks the blob back into comparison keys.
 *
 * Deliberately tolerant of a trailing partial entry: this comes off the radio,
 * and a short read must yield the entries that ARE complete rather than
 * throwing away a whole peer's inventory (INT-001 -- bounded, never fatal).
 */
export function unpackInventoryIds(blob: Uint8Array): string[] {
  const keys: string[] = [];
  const complete = Math.floor(blob.length / INVENTORY_ID_PREFIX_BYTES);
  for (let index = 0; index < complete; index += 1) {
    const base = index * INVENTORY_ID_PREFIX_BYTES;
    let key = '';
    for (let byte = 0; byte < INVENTORY_ID_PREFIX_BYTES; byte += 1) {
      key += blob[base + byte]!.toString(16).padStart(2, '0');
    }
    keys.push(key);
  }
  return keys;
}
