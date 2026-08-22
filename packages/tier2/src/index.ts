/**
 * @dsm/tier2 -- ggwave Tier 2, authority-to-phone only.
 *
 * Owner: Workstream F.
 *
 * DEC-007: ggwave is Tier 2 ONLY. There is no phone-to-phone acoustic
 * fallback and no Tier 1 microphone transport. If Bluetooth fails, the answer
 * is the contingency Bluetooth adapter (DEC-006), never this package.
 *
 * DEC-008: one way. A check-in RESPONSE becomes a Tier 1 packet (T2-012).
 */

export * from './frame-codec.js';
export * from './receiver.js';
export * from './campaign-builder.js';
export * from './handle-resolver.js';
