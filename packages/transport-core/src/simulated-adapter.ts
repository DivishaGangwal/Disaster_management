/**
 * SIMULATED TRANSPORT ADAPTER
 *
 * This is the half of Gate II that runs in stock Expo Go, in Node, and in CI.
 * It implements @dsm/contracts TransportAdapter EXACTLY as the native Android
 * module must, and emits the same normalized events.
 *
 * DEC-004 / working rule 11: this is a SIMULATION. `simulated: true` in the
 * capability report is what the readiness screen renders, so the demo never
 * claims stock Expo Go is doing real BLE.
 *
 * Two adapters joined by a shared `RadioMedium` behave like two phones in
 * range. That is what makes multi-hop testable without hardware.
 */

import {
  type CapabilityReport,
  type DiscoverySummary,
  type EncodedPacket,
  type PermissionSnapshot,
  type RelayServiceState,
  type TransportAdapter,
  type TransportEvent,
  type TransportEventListener,
  type TransportKind,
} from '@dsm/contracts';

const ALL_GRANTED: PermissionSnapshot = {
  bluetoothScan: 'granted',
  bluetoothAdvertise: 'granted',
  bluetoothConnect: 'granted',
  location: 'granted',
  notifications: 'granted',
  microphone: 'granted',
  foregroundService: 'granted',
};

export interface MediumOptions {
  /** Probability that a record is dropped in flight, 0..1. */
  readonly lossRate?: number;
  /** One-way delivery latency in simulated milliseconds. */
  readonly latencyMs?: number;
  /** Deterministic RNG so simulator runs reproduce exactly. */
  readonly random?: () => number;
}

/**
 * A shared radio medium. Nodes must be explicitly placed "in range" of each
 * other, so store-carry-forward (a node moving between disconnected groups)
 * is expressible.
 */
export class RadioMedium {
  private readonly nodes = new Map<string, SimulatedTransportAdapter>();
  private readonly ranges = new Map<string, Set<string>>();
  private nowMs = 0;
  private readonly queue: { atMs: number; run: () => void }[] = [];

  constructor(private readonly options: MediumOptions = {}) {}

  get clockMs(): number {
    return this.nowMs;
  }

  register(adapter: SimulatedTransportAdapter): void {
    this.nodes.set(adapter.nodeToken, adapter);
    this.ranges.set(adapter.nodeToken, new Set());
  }

  /** Puts two nodes in mutual radio range. */
  connect(a: string, b: string): void {
    this.ranges.get(a)?.add(b);
    this.ranges.get(b)?.add(a);
  }

  /** Removes them from range: the store-carry-forward scenario. */
  disconnect(a: string, b: string): void {
    this.ranges.get(a)?.delete(b);
    this.ranges.get(b)?.delete(a);
  }

  peersInRange(token: string): readonly string[] {
    return [...(this.ranges.get(token) ?? [])];
  }

  schedule(delayMs: number, run: () => void): void {
    this.queue.push({ atMs: this.nowMs + delayMs, run });
  }

  /**
   * Advances simulated time and runs everything due.
   *
   * This is ASYNC on purpose. A scheduled callback emits a transport event,
   * and the relay loop handles those events asynchronously. If we advanced the
   * clock synchronously the simulated time would outrun the work in flight,
   * and multi-hop results would depend on microtask timing rather than on the
   * protocol. Draining after every callback keeps runs deterministic.
   */
  async advance(ms: number): Promise<void> {
    const target = this.nowMs + ms;
    while (true) {
      this.queue.sort((a, b) => a.atMs - b.atMs);
      const next = this.queue[0];
      if (!next || next.atMs > target) break;
      this.queue.shift();
      this.nowMs = next.atMs;
      next.run();
      await drainMicrotasks();
    }
    this.nowMs = target;
    await drainMicrotasks();
  }

  deliver(fromToken: string, toToken: string, sessionId: string, record: EncodedPacket): void {
    if (!this.ranges.get(fromToken)?.has(toToken)) return; // out of range: silent loss
    const random = this.options.random ?? Math.random;
    if (random() < (this.options.lossRate ?? 0)) return; // simulated corruption/loss
    const target = this.nodes.get(toToken);
    if (!target) return;
    this.schedule(this.options.latencyMs ?? 20, () => {
      target.receive(fromToken, sessionId, record, this.nowMs);
    });
  }

  broadcastDiscovery(fromToken: string, summary: DiscoverySummary): void {
    for (const peerToken of this.peersInRange(fromToken)) {
      const peer = this.nodes.get(peerToken);
      if (!peer) continue;
      this.schedule(5, () => {
        peer.observePeer(fromToken, summary, this.nowMs);
      });
    }
  }

  /**
   * Tells the accepting side that a session opened against it.
   *
   * A Tier 1 session is BIDIRECTIONAL (DEC-005, 02-... "Mesh-to-mesh flow":
   * "Each node requests only missing, eligible items"). Without this the
   * lower-token node would only ever push, and responder state could never
   * travel back to the victim.
   */
  notifySessionOpened(fromToken: string, toToken: string, sessionId: string): void {
    if (!this.ranges.get(fromToken)?.has(toToken)) return;
    const target = this.nodes.get(toToken);
    if (!target) return;
    // Delay 0: a GATT server learns of the connection at establish time. If
    // this lagged behind the close notification the acceptor would register a
    // session that nothing ever closes, and it would stop accepting peers.
    this.schedule(0, () => {
      target.acceptSession(fromToken, sessionId, this.nowMs);
    });
  }

  /**
   * A disconnect is observed at BOTH ends. Without this the accepting side
   * would keep the session slot forever and eventually advertise
   * "not accepting connections", silently killing multi-hop relay.
   */
  notifySessionClosed(fromToken: string, toToken: string, sessionId: string): void {
    const target = this.nodes.get(toToken);
    if (!target) return;
    this.schedule(1, () => {
      target.remoteClosed(sessionId, fromToken, this.nowMs);
    });
  }
}

/**
 * Lets every pending promise chain settle before simulated time moves on.
 *
 * A single microtask tick is not enough: handling one received record runs a
 * long async chain (validate -> store -> policy -> project -> reduce -> send a
 * receipt). We flush whole macrotasks so the chain completes, which is what
 * makes multi-hop results depend on the protocol instead of on scheduling.
 */
function yieldMacrotask(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof setImmediate === 'function') setImmediate(resolve);
    else setTimeout(resolve, 0);
  });
}

async function drainMicrotasks(): Promise<void> {
  for (let i = 0; i < 3; i += 1) await yieldMacrotask();
}

export class SimulatedTransportAdapter implements TransportAdapter {
  readonly id: string;
  readonly kind: TransportKind = 'tier1-ble';

  private listeners = new Set<TransportEventListener>();
  private relayState: RelayServiceState = 'stopped';
  private summary?: DiscoverySummary;
  private sessionCounter = 0;
  private readonly openSessions = new Set<string>();
  /** sessionId -> the OTHER end. Never derive this from the id string. */
  private readonly sessionPeers = new Map<string, string>();
  /** Sessions already torn down, so a late "opened" notice cannot revive one. */
  private readonly closedSessions = new Set<string>();

  constructor(
    readonly nodeToken: string,
    private readonly medium: RadioMedium,
    private readonly capabilityOverrides: Partial<CapabilityReport> = {},
  ) {
    this.id = `sim-${nodeToken}`;
    medium.register(this);
  }

  async getCapabilities(): Promise<CapabilityReport> {
    return {
      androidApiLevel: 34,
      bluetoothAvailable: true,
      bluetoothEnabled: true,
      bleScanSupported: true,
      bleAdvertiseSupported: true,
      multipleAdvertisementSupported: true,
      gattClientSupported: true,
      gattServerSupported: true,
      extendedAdvertisingSupported: false,
      codedPhySupported: false,
      audioInputAvailable: true,
      permissions: ALL_GRANTED,
      batteryPercent: 80,
      batteryTemperatureC: 31.5,
      batteryOptimisationRestricted: false,
      thermalThrottled: false,
      // Never lie about this: the readiness screen renders it verbatim.
      simulated: true,
      observedAtMs: this.medium.clockMs,
      ...this.capabilityOverrides,
    };
  }

  async requestPermissions(): Promise<PermissionSnapshot> {
    return ALL_GRANTED;
  }

  async startRelay(summary: DiscoverySummary): Promise<void> {
    this.summary = summary;
    this.setRelayState('starting');
    this.setRelayState('advertising-scanning');
    this.medium.broadcastDiscovery(this.nodeToken, summary);
  }

  async stopRelay(): Promise<void> {
    this.summary = undefined;
    for (const sessionId of [...this.openSessions]) await this.closeSession(sessionId);
    this.setRelayState('stopped');
  }

  async updateDiscoverySummary(summary: DiscoverySummary): Promise<void> {
    this.summary = summary;
    if (this.relayState === 'advertising-scanning' || this.relayState === 'session-active') {
      this.medium.broadcastDiscovery(this.nodeToken, summary);
    }
  }

  async openSession(peerToken: string): Promise<string> {
    if (!this.medium.peersInRange(this.nodeToken).includes(peerToken)) {
      throw new Error(`peer ${peerToken} is not in range`);
    }
    this.sessionCounter += 1;
    const sessionId = `${this.nodeToken}-${peerToken}-${this.sessionCounter}`;
    this.openSessions.add(sessionId);
    this.sessionPeers.set(sessionId, peerToken);
    this.setRelayState('session-active');
    this.emit({
      kind: 'session',
      sessionId,
      peerToken,
      phase: 'establish',
      initiatedLocally: true,
      atMs: this.medium.clockMs,
    });
    this.medium.notifySessionOpened(this.nodeToken, peerToken, sessionId);
    return sessionId;
  }

  /** Called by the medium on the accepting side of a session. */
  acceptSession(fromToken: string, sessionId: string, atMs: number): void {
    // Guard against an out-of-order close arriving first.
    if (this.closedSessions.has(sessionId)) return;
    this.openSessions.add(sessionId);
    this.sessionPeers.set(sessionId, fromToken);
    this.emit({
      kind: 'session',
      sessionId,
      peerToken: fromToken,
      phase: 'establish',
      initiatedLocally: false,
      atMs,
    });
  }

  async closeSession(sessionId: string): Promise<void> {
    if (!this.openSessions.delete(sessionId)) return;
    const peerToken = this.sessionPeers.get(sessionId) ?? '';
    this.sessionPeers.delete(sessionId);
    this.emit({
      kind: 'session-closed',
      sessionId,
      peerToken,
      reason: 'complete',
      recordsAccepted: 0,
      bytesTransferred: 0,
      atMs: this.medium.clockMs,
    });
    if (this.openSessions.size === 0 && this.summary) this.setRelayState('advertising-scanning');
    this.medium.notifySessionClosed(this.nodeToken, peerToken, sessionId);
  }

  /** The far end closed. Release the slot; never notify back (no ping-pong). */
  remoteClosed(sessionId: string, peerToken: string, atMs: number): void {
    this.closedSessions.add(sessionId);
    if (!this.openSessions.delete(sessionId)) return;
    this.sessionPeers.delete(sessionId);
    this.emit({
      kind: 'session-closed',
      sessionId,
      peerToken,
      reason: 'peer-closed',
      recordsAccepted: 0,
      bytesTransferred: 0,
      atMs,
    });
    if (this.openSessions.size === 0 && this.summary) this.setRelayState('advertising-scanning');
  }

  async sendRecord(sessionId: string, record: EncodedPacket): Promise<void> {
    if (!this.openSessions.has(sessionId)) throw new Error(`session ${sessionId} is not open`);
    const peerToken = this.sessionPeers.get(sessionId);
    if (!peerToken) throw new Error(`session ${sessionId} has no peer binding`);
    this.medium.deliver(this.nodeToken, peerToken, sessionId, record);
    this.emit({
      kind: 'record-sent',
      sessionId,
      peerToken,
      packetId: record.packetId,
      byteCount: record.totalBytes,
      atMs: this.medium.clockMs,
    });
  }

  async cancelTransfer(sessionId: string): Promise<void> {
    await this.closeSession(sessionId);
  }

  addEventListener(listener: TransportEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- called by the medium -------------------------------------------------

  receive(fromToken: string, sessionId: string, record: EncodedPacket, atMs: number): void {
    this.openSessions.add(sessionId);
    this.sessionPeers.set(sessionId, fromToken);
    this.emit({
      kind: 'record-received',
      sessionId,
      peerToken: fromToken,
      transport: this.kind,
      bytes: record.bytes,
      rssi: -60,
      atMs,
    });
  }

  observePeer(peerToken: string, summary: DiscoverySummary, atMs: number): void {
    this.emit({ kind: 'peer-observed', nodeToken: peerToken, summary, rssi: -60, observedAtMs: atMs });
  }

  private setRelayState(state: RelayServiceState): void {
    this.relayState = state;
    this.emit({ kind: 'relay-state-changed', state, atMs: this.medium.clockMs });
  }

  private emit(event: TransportEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
