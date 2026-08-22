/**
 * @dsm/node-runtime -- the composition root of one participating phone.
 *
 * The mobile app, the simulator, and every integration test drive THIS.
 * Nothing here imports React, Expo, Android, or ggwave: the engine is the
 * product, the adapters are replaceable (02-... "Definition of architectural
 * correctness").
 */

export * from './node-engine.js';
export * from './relay-loop.js';
export * from './gateway-sync.js';
export * from './file-assembler.js';
