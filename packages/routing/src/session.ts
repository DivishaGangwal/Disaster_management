/**
 * SESSION STATE MACHINE (transport-independent)
 *
 * Spec: 02-... "Session phases", "Session flow control"; 04-BLUEPRINT 26.5.
 *
 * This is the eight-phase protocol logic. Workstream B's native adapter and
 * the simulated adapter both drive it; neither one re-implements it. That is
 * what lets BLE be swapped for Bluetooth Classic (DEC-006) without touching
 * packet, store, policy, map, or UI contracts.
 */

import { SESSION, type SessionPhase } from '@dsm/contracts';

export interface SessionLimits {
  readonly maxDurationMs: number;
  readonly idleTimeoutMs: number;
  readonly maxBytes: number;
  readonly maxRecords: number;
  readonly maxInFlight: number;
}

export const DEFAULT_SESSION_LIMITS: SessionLimits = {
  maxDurationMs: SESSION.MAX_DURATION_MS,
  idleTimeoutMs: SESSION.IDLE_TIMEOUT_MS,
  maxBytes: SESSION.MAX_BYTES,
  maxRecords: SESSION.MAX_RECORDS,
  maxInFlight: SESSION.MAX_IN_FLIGHT_RECORDS,
};

export type SessionCloseReason =
  | 'complete'
  | 'idle-timeout'
  | 'duration-budget'
  | 'byte-budget'
  | 'incompatible'
  | 'no-useful-difference'
  | 'peer-closed'
  | 'error';

const PHASE_ORDER: readonly SessionPhase[] = [
  'establish',
  'hello',
  'inventory',
  'request',
  'transfer',
  'receipt',
  'reconciliation',
  'close',
];

export class SessionStateMachine {
  private phaseIndex = 0;
  private startedAtMs: number;
  private lastActivityMs: number;
  private bytes = 0;
  private records = 0;
  private inFlight = 0;
  private closed?: SessionCloseReason;

  constructor(
    readonly sessionId: string,
    readonly peerToken: string,
    readonly initiatedLocally: boolean,
    nowMs: number,
    private readonly limits: SessionLimits = DEFAULT_SESSION_LIMITS,
  ) {
    this.startedAtMs = nowMs;
    this.lastActivityMs = nowMs;
  }

  get phase(): SessionPhase {
    return PHASE_ORDER[this.phaseIndex]!;
  }

  get isClosed(): boolean {
    return this.closed !== undefined;
  }

  get closeReason(): SessionCloseReason | undefined {
    return this.closed;
  }

  get bytesTransferred(): number {
    return this.bytes;
  }

  get recordsTransferred(): number {
    return this.records;
  }

  advance(nowMs: number): SessionPhase {
    this.lastActivityMs = nowMs;
    if (this.phaseIndex < PHASE_ORDER.length - 1) this.phaseIndex += 1;
    return this.phase;
  }

  /** Protocol range check at the hello phase. */
  negotiate(peerMin: number, peerMax: number, localVersion: number): boolean {
    if (localVersion < peerMin || localVersion > peerMax) {
      this.close('incompatible');
      return false;
    }
    return true;
  }

  /**
   * REL-003: continue only when inventories actually differ. Skipping a
   * pointless session is a feature, not a failure.
   */
  hasUsefulDifference(localIds: ReadonlySet<string>, peerIds: ReadonlySet<string>, criticalPending: number): boolean {
    if (criticalPending > 0) return true;
    for (const id of localIds) if (!peerIds.has(id)) return true;
    for (const id of peerIds) if (!localIds.has(id)) return true;
    this.close('no-useful-difference');
    return false;
  }

  /** Flow control: only maxInFlight unacknowledged records at a time. */
  canSend(byteCount: number): boolean {
    if (this.closed) return false;
    if (this.inFlight >= this.limits.maxInFlight) return false;
    if (this.records >= this.limits.maxRecords) return false;
    if (this.bytes + byteCount > this.limits.maxBytes) return false;
    return true;
  }

  recordSent(byteCount: number, nowMs: number): void {
    this.inFlight += 1;
    this.bytes += byteCount;
    this.lastActivityMs = nowMs;
  }

  /**
   * A receipt is issued only after complete parsing, integrity validation, and
   * durable acceptance (02-...). Transport write success is NOT acceptance.
   */
  recordAcknowledged(nowMs: number): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.records += 1;
    this.lastActivityMs = nowMs;
  }

  /** Control records may interrupt fragment batches. */
  allowControlInterrupt(): boolean {
    return !this.closed;
  }

  /** Returns a close reason when any bound is exceeded. */
  checkBudgets(nowMs: number): SessionCloseReason | undefined {
    if (this.closed) return this.closed;
    if (nowMs - this.startedAtMs > this.limits.maxDurationMs) return this.close('duration-budget');
    if (nowMs - this.lastActivityMs > this.limits.idleTimeoutMs) return this.close('idle-timeout');
    if (this.bytes >= this.limits.maxBytes) return this.close('byte-budget');
    return undefined;
  }

  close(reason: SessionCloseReason): SessionCloseReason {
    this.closed ??= reason;
    this.phaseIndex = PHASE_ORDER.length - 1;
    return this.closed;
  }
}
