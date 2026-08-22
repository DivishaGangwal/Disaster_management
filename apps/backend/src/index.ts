/**
 * @dsm/backend -- coordination backend (Workstream E).
 *
 * 02-...: "The backend is a coordination enhancement. It is not in the
 * critical path for local SOS creation, relay, display, or local responder
 * action." Every offline behaviour must keep working with this process down.
 */

export * from './services.js';
export * from './server.js';
