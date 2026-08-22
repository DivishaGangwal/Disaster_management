/**
 * @dsm/codec -- typed packets <-> canonical bytes.
 *
 * Owner: Workstream C. Consumed by mobile, backend, Tier 2, and the simulator.
 * It performs NO policy: 02-... "It does not decide whether the user should
 * see, relay, or act on a packet."
 */

export * from './integrity.js';
export * from './varint.js';
export * from './field-maps.js';
export * from './value-codec.js';
export * from './envelope-codec.js';
export * from './size-limits.js';
export * from './packet-codec.js';
export * from './builders.js';
