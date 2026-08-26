import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  type CapabilityReport,
  type AudioInputAdapter,
  type AudioInputStateEvent,
  type DiscoverySummary,
  type EncodedPacket,
  type PermissionSnapshot,
  type TransportAdapter,
  type TransportEvent,
  type TransportEventListener,
  type TransportKind,
  type Tier2RawFrame,
} from '@dsm/contracts';
import { decodeAdvertisement, encodeAdvertisement, type AdapterSelection } from '@dsm/transport-core';

type NativeEvent = TransportEvent
  | { kind: 'peer-advertisement'; bytesBase64: string; rssi?: number; atMs: number }
  | { kind: 'record-received-native'; sessionId: string; peerToken: string; transport: 'tier1-ble' | 'tier1-classic'; bytesBase64: string; rssi?: number; atMs: number }
  | { kind: 'wavepx-frame-native'; bytesBase64: string; source: 'tier2-mic' | 'tier2-direct'; atMs: number }
  | { kind: 'wavepx-listening-state'; state: 'listening' | 'stopped'; reason?: string; timeoutMs?: number; atMs: number };
type NativeModuleShape = {
  getCapabilities(): Promise<CapabilityReport>;
  requestPermissions(): Promise<void>;
  requestWavePxPermission(): Promise<void>;
  startRelay(advertisementBase64: string, mode: 'ble' | 'classic'): Promise<void>;
  stopRelay(): Promise<void>;
  updateAdvertisement(advertisementBase64: string): Promise<void>;
  openSession(peerToken: string, mode: 'ble' | 'classic'): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  sendRecord(sessionId: string, packetId: string, bytesBase64: string): Promise<void>;
  cancelTransfer(sessionId: string): Promise<void>;
  startWavePxListening(timeoutMs: number): Promise<void>;
  stopWavePxListening(): Promise<void>;
  feedWavePxDirectPcm(pcmBase64: string, sampleRateHz: number): Promise<void>;
  addListener(eventName: 'onTransportEvent', listener: (event: NativeEvent) => void): { remove(): void };
};

const nativeModule = requireOptionalNativeModule<NativeModuleShape>('AndroidRadioBridge');
function moduleOrThrow() {
  if (!nativeModule) throw new Error('Android radio bridge is unavailable. Install an Expo development build; Expo Go cannot provide Bluetooth relay.');
  return nativeModule;
}

/** BLE is preferred. Classic is selected only when the required BLE roles are unavailable. */
export async function createNativeTransport(preference: AdapterSelection): Promise<NativeTransportAdapter> {
  const report = await moduleOrThrow().getCapabilities();
  const bleUsable = report.bluetoothEnabled && report.bleScanSupported && report.bleAdvertiseSupported && report.gattClientSupported && report.gattServerSupported;
  const selected = preference === 'native-classic' || !bleUsable ? 'classic' : 'ble';
  return new NativeTransportAdapter(selected);
}

export class NativeTransportAdapter implements TransportAdapter {
  readonly id: string;
  readonly kind: TransportKind;
  private listeners = new Set<TransportEventListener>();
  private subscription?: { remove(): void };

  constructor(readonly mode: 'ble' | 'classic') {
    this.id = `android-${mode}`;
    this.kind = mode === 'ble' ? 'tier1-ble' : 'tier1-classic';
  }

  getCapabilities() { return moduleOrThrow().getCapabilities(); }
  async requestPermissions(): Promise<PermissionSnapshot> { await moduleOrThrow().requestPermissions(); return (await moduleOrThrow().getCapabilities()).permissions; }
  startRelay(summary: DiscoverySummary) { return moduleOrThrow().startRelay(toBase64(encodeAdvertisement(summary)), this.mode); }
  stopRelay() { return moduleOrThrow().stopRelay(); }
  updateDiscoverySummary(summary: DiscoverySummary) { return moduleOrThrow().updateAdvertisement(toBase64(encodeAdvertisement(summary))); }
  openSession(peerToken: string) { return moduleOrThrow().openSession(peerToken, this.mode); }
  closeSession(sessionId: string) { return moduleOrThrow().closeSession(sessionId); }
  sendRecord(sessionId: string, record: EncodedPacket) { return moduleOrThrow().sendRecord(sessionId, record.packetId, toBase64(record.bytes)); }
  cancelTransfer(sessionId: string) { return moduleOrThrow().cancelTransfer(sessionId); }

  addEventListener(listener: TransportEventListener) {
    this.listeners.add(listener);
    if (!this.subscription) {
      this.subscription = moduleOrThrow().addListener('onTransportEvent', (event: NativeEvent) => {
        if (event.kind === 'peer-advertisement') {
          const decoded = decodeAdvertisement(fromBase64(event.bytesBase64));
          if (decoded.ok) this.emit({ kind: 'peer-observed', nodeToken: decoded.summary.nodeToken, summary: decoded.summary, ...(event.rssi !== undefined ? { rssi: event.rssi } : {}), observedAtMs: event.atMs });
          return;
        }
        if (event.kind === 'record-received-native') {
          this.emit({ kind: 'record-received', sessionId: event.sessionId, peerToken: event.peerToken, transport: event.transport, bytes: fromBase64(event.bytesBase64), ...(event.rssi !== undefined ? { rssi: event.rssi } : {}), atMs: event.atMs });
          return;
        }
        if (event.kind === 'wavepx-frame-native' || event.kind === 'wavepx-listening-state') return;
        this.emit(event);
      });
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) { this.subscription?.remove(); this.subscription = undefined; }
    };
  }

  private emit(event: TransportEvent) { for (const listener of this.listeners) listener(event); }
}

/** Native Android audio backend for WavePX. ggwave remains internal DSP only. */
export class NativeWavePxAudioInputAdapter implements AudioInputAdapter {
  readonly id = 'android-wavepx';
  private readonly listeners = new Set<(frame: Tier2RawFrame) => void>();
  private readonly stateListeners = new Set<(event: AudioInputStateEvent) => void>();
  private subscription?: { remove(): void };

  startListening(options: { readonly timeoutMs: number }): Promise<void> {
    this.ensureSubscribed();
    return moduleOrThrow().startWavePxListening(options.timeoutMs);
  }

  stopListening(): Promise<void> {
    return moduleOrThrow().stopWavePxListening();
  }

  feedDirectAudio(pcm: Float32Array, sampleRateHz: number): Promise<void> {
    this.ensureSubscribed();
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    return moduleOrThrow().feedWavePxDirectPcm(toBase64(bytes), sampleRateHz);
  }

  addFrameListener(listener: (frame: Tier2RawFrame) => void): () => void {
    this.listeners.add(listener);
    this.ensureSubscribed();
    return () => {
      this.listeners.delete(listener);
      this.releaseSubscriptionIfUnused();
    };
  }

  addStateListener(listener: (event: AudioInputStateEvent) => void): () => void {
    this.stateListeners.add(listener);
    this.ensureSubscribed();
    return () => {
      this.stateListeners.delete(listener);
      this.releaseSubscriptionIfUnused();
    };
  }

  private ensureSubscribed(): void {
    if (this.subscription) return;
    this.subscription = moduleOrThrow().addListener('onTransportEvent', (event: NativeEvent) => {
      if (event.kind === 'wavepx-frame-native') {
        const frame: Tier2RawFrame = { bytes: fromBase64(event.bytesBase64), source: event.source, receivedAtMs: event.atMs };
        for (const listener of this.listeners) listener(frame);
      } else if (event.kind === 'wavepx-listening-state') {
        const state: AudioInputStateEvent = {
          state: event.state,
          atMs: event.atMs,
          ...(event.reason ? { reason: event.reason } : {}),
          ...(event.timeoutMs !== undefined ? { timeoutMs: event.timeoutMs } : {}),
        };
        for (const listener of this.stateListeners) listener(state);
      }
    });
  }

  private releaseSubscriptionIfUnused(): void {
    if (this.listeners.size > 0 || this.stateListeners.size > 0) return;
    this.subscription?.remove();
    this.subscription = undefined;
  }
}

export function createNativeWavePxAudioInput(): AudioInputAdapter {
  return new NativeWavePxAudioInputAdapter();
}

export async function requestNativeWavePxPermission(): Promise<PermissionSnapshot['microphone']> {
  await moduleOrThrow().requestWavePxPermission();
  return (await moduleOrThrow().getCapabilities()).permissions.microphone;
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function fromBase64(value: string) { return Uint8Array.from(atob(value), (item) => item.charCodeAt(0)); }
