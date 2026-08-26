/**
 * @dsm/contracts -- the ONE shared surface between all six workstreams.
 *
 * RULES OF THIS PACKAGE (docs/CONTRACT-FREEZE.md):
 *  - It has ZERO runtime dependencies and contains no behaviour, only types,
 *    numeric registries, and bounded limits.
 *  - Everyone imports from here. Nobody redefines a message code, a limit, or
 *    a reason string locally.
 *  - Changing an exported numeric value or an interface shape is a GATE change
 *    and needs the owners listed in .github/CODEOWNERS.
 */

export * from './registry.js';
export * from './limits.js';
export * from './enums.js';
export * from './envelope.js';
export * from './payloads.js';
export * from './reasons.js';
export * from './profile.js';
export * from './policy-types.js';
export * from './map-ops.js';
export * from './native-bridge.js';
export * from './gateway-api.js';
export * from './campaign.js';
export * from './ports.js';
export * from './events.js';
export * from './content-pack.js';
export * from './deployment.js';
