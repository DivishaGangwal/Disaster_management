/**
 * Degrees x 1e7 <-> plain float degrees.
 *
 * Every coordinate on the wire (envelope.ts GeoExtension, payloads.ts
 * LocationState, map-ops.ts operations) is an integer, degrees x 1e7. UI and
 * map layers need plain float degrees; this is the one shared conversion
 * between the two, replacing the same `* 1e7` / `/ 1e7` arithmetic that used
 * to be reimplemented independently at each call site.
 */

const E7 = 1e7;

/** Wire-format integer degrees x 1e7 -> plain float degrees. */
export function e7ToFloat(e7: number): number {
  return e7 / E7;
}

/** Plain float degrees -> wire-format integer degrees x 1e7. */
export function floatToE7(deg: number): number {
  return Math.round(deg * E7);
}
