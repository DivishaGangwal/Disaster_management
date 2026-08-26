/**
 * NATIVE RADIO BRIDGE CONTRACT  --  FROZEN (Gate II)
 *
 * Spec: 02-... "Native radio bridge specification", 04-BLUEPRINT 26.1.
 *
 * THIS IS THE EXPO GO / DEV BUILD SEAM.
 *
 * Two implementations must satisfy this contract and produce the same event
 * semantics (Gate II):
 *   1. packages/transport-core/src/simulated-adapter.ts -- runs in stock Expo
 *      Go and in the simulator. UI, domain, and map work never needs Android.
 *   2. native/android-radio-bridge -- the Expo development build module that
 *      does real BLE advertise/scan/GATT and the foreground relay service.
 *
 * DEC-004: stock Expo Go cannot provide the real Bluetooth mesh. Never claim
 * otherwise. The product layer must never call a platform radio API directly
 * from a screen (02-...: "Direct use of platform radio APIs from arbitrary
 * screens is prohibited").
 */

import type { EncodedPacket, TransportKind } from './envelope.js';

/** Reported at startup and on every Bluetooth state change. */
export interface CapabilityReport {
  readonly androidApiLevel: number;
  readonly bluetoothAvailable: boolean;
  readonly bluetoothEnabled: boolean;
  readonly bleScanSupported: boolean;
  readonly bleAdvertiseSupported: boolean;
  readonly multipleAdvertisementSupported: boolean;
  readonly gattClientSupported: boolean;
  readonly gattServerSupported: boolean;
  readonly extendedAdvertisingSupported: boolean;
  readonly codedPhySupported: boolean;
  readonly maxAdvertisingDataLength?: number;
  readonly audioInputAvailable: boolean;
  readonly permissions: PermissionSnapshot;
  readonly batteryPercent?: number;
  /** Battery sensor temperature when Android exposes ACTION_BATTERY_CHANGED. */
  readonly batteryTemperatureC?: number;
  readonly batteryOptimisationRestricted: boolean;
  readonly thermalThrottled: boolean;
  /** True for the simulated adapter so the UI can label the demo honestly. */
  readonly simulated: boolean;
  readonly observedAtMs: number;
}

export type PermissionState = 'granted' | 'denied' | 'never-asked' | 'restricted';

export interface PermissionSnapshot {
  readonly bluetoothScan: PermissionState;
  readonly bluetoothAdvertise: PermissionState;
  readonly bluetoothConnect: PermissionState;
  readonly location: PermissionState;
  readonly notifications: PermissionState;
  readonly microphone: PermissionState;
  readonly foregroundService: PermissionState;
}

/** 02-... "Relay service lifecycle" -- the eight states, no others. */
export type RelayServiceState =
  | 'stopped'
  | 'permission-required'
  | 'starting'
  | 'advertising-scanning'
  | 'session-active'
  | 'backing-off'
  | 'battery-limited'
  | 'error-user-action-required';

/**
 * BLE discovery advertisement contents.
 * 02-... FORBIDS name, phone number, SOS text, exact coordinates, exact
 * incident ID, permanent account ID, and full inventory in this structure.
 */
export interface DiscoverySummary {
  readonly protocolMajor: number;
  readonly protocolMinor: number;
  /** Rotating token, ADVERTISEMENT.TOKEN_ROTATION_MS. Not a permanent ID. */
  readonly nodeToken: string;
  readonly capabilityBits: number;
  readonly queueEpoch: number;
  readonly highestWaitingPriority: number;
  /** Cheap probabilistic hint that inventories differ. Not a packet list. */
  readonly inventoryHint: number;
  readonly gatewayProven: boolean;
  /** 0 fresh, 1 recent, 2 stale. Never an unqualified "connected" claim. */
  readonly gatewayFreshnessClass: number;
  readonly acceptingConnections: boolean;
}

export interface PeerObservedEvent {
  readonly kind: 'peer-observed';
  readonly nodeToken: string;
  readonly summary: DiscoverySummary;
  readonly rssi?: number;
  readonly observedAtMs: number;
}

export type SessionPhase =
  | 'establish'
  | 'hello'
  | 'inventory'
  | 'request'
  | 'transfer'
  | 'receipt'
  | 'reconciliation'
  | 'close';

export interface SessionEvent {
  readonly kind: 'session';
  readonly sessionId: string;
  readonly peerToken: string;
  readonly phase: SessionPhase;
  /** True when this node opened the connection. */
  readonly initiatedLocally: boolean;
  readonly atMs: number;
}

export interface RecordReceivedEvent {
  readonly kind: 'record-received';
  readonly sessionId: string;
  readonly peerToken: string;
  readonly transport: TransportKind;
  readonly bytes: Uint8Array;
  readonly rssi?: number;
  readonly atMs: number;
}

export interface RecordSentEvent {
  readonly kind: 'record-sent';
  readonly sessionId: string;
  readonly peerToken: string;
  readonly packetId: string;
  readonly byteCount: number;
  readonly atMs: number;
}

export interface SessionClosedEvent {
  readonly kind: 'session-closed';
  readonly sessionId: string;
  readonly peerToken: string;
  readonly reason: 'complete' | 'idle-timeout' | 'duration-budget' | 'byte-budget' | 'peer-closed' | 'error';
  readonly recordsAccepted: number;
  readonly bytesTransferred: number;
  readonly atMs: number;
}

export interface CapabilityChangedEvent {
  readonly kind: 'capability-changed';
  readonly report: CapabilityReport;
}

export interface RelayStateChangedEvent {
  readonly kind: 'relay-state-changed';
  readonly state: RelayServiceState;
  readonly detail?: string;
  readonly atMs: number;
}

export interface TransportErrorEvent {
  readonly kind: 'error';
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
  readonly atMs: number;
}

/** The complete normalized event surface. Nothing else crosses the boundary. */
export type TransportEvent =
  | CapabilityChangedEvent
  | RelayStateChangedEvent
  | PeerObservedEvent
  | SessionEvent
  | RecordReceivedEvent
  | RecordSentEvent
  | SessionClosedEvent
  | TransportErrorEvent;

export type TransportEventListener = (event: TransportEvent) => void;

/** Bounded command surface. Both adapters implement exactly this. */
export interface TransportAdapter {
  readonly id: string;
  readonly kind: TransportKind;

  getCapabilities(): Promise<CapabilityReport>;
  requestPermissions(): Promise<PermissionSnapshot>;

  /** REL-001: relay mode is explicit, visible, and stoppable. */
  startRelay(summary: DiscoverySummary): Promise<void>;
  stopRelay(): Promise<void>;

  /** Republish the advertisement after the queue epoch changes. */
  updateDiscoverySummary(summary: DiscoverySummary): Promise<void>;

  openSession(peerToken: string): Promise<string>;
  closeSession(sessionId: string): Promise<void>;

  /**
   * Queue one encoded record on an open session. Resolving means the transport
   * wrote it -- NOT that the peer accepted it (02-... "The sender must not
   * treat transport write success as packet acceptance").
   */
  sendRecord(sessionId: string, record: EncodedPacket): Promise<void>;
  cancelTransfer(sessionId: string): Promise<void>;

  addEventListener(listener: TransportEventListener): () => void;
}

/** Tier 2 audio input. Separate adapter: DEC-007 forbids acoustic Tier 1. */
export interface AudioInputAdapter {
  readonly id: string;
  /** T2-002: explicit, permissioned, visible, time-bounded. */
  startListening(options: { readonly timeoutMs: number }): Promise<void>;
  stopListening(): Promise<void>;
  /** T2-003: the direct clean-audio path, labelled a controlled demonstration. */
  feedDirectAudio(pcm: Float32Array, sampleRateHz: number): Promise<void>;
  addFrameListener(listener: (frame: Tier2RawFrame) => void): () => void;
  /** Native capture truth, including timeout and device-side failures. */
  addStateListener(listener: (event: AudioInputStateEvent) => void): () => void;
}

export interface AudioInputStateEvent {
  readonly state: 'listening' | 'stopped';
  readonly reason?: string;
  readonly timeoutMs?: number;
  readonly atMs: number;
}

export interface Tier2RawFrame {
  readonly bytes: Uint8Array;
  readonly source: 'tier2-mic' | 'tier2-direct';
  readonly receivedAtMs: number;
  /** Modem-reported quality, when the decoder exposes it. */
  readonly signalQuality?: number;
}
