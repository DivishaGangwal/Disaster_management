import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  type CapabilityReport,
  type DiscoverySummary,
  type EncodedPacket,
  type PermissionSnapshot,
  type TransportAdapter,
  type TransportEvent,
  type TransportEventListener,
  type TransportKind,
} from '@dsm/contracts';
import { decodeAdvertisement, encodeAdvertisement, type AdapterSelection } from '@dsm/transport-core';

type NativeEvent = TransportEvent
  | { kind: 'peer-advertisement'; bytesBase64: string; rssi?: number; atMs: number }
  | { kind: 'record-received-native'; sessionId: string; peerToken: string; transport: 'tier1-ble' | 'tier1-classic'; bytesBase64: string; rssi?: number; atMs: number };
type NativeModuleShape = {
  getCapabilities(): Promise<CapabilityReport>;
  requestPermissions(): Promise<void>;
  startRelay(advertisementBase64: string, mode: 'ble' | 'classic'): Promise<void>;
  stopRelay(): Promise<void>;
  updateAdvertisement(advertisementBase64: string): Promise<void>;
  openSession(peerToken: string, mode: 'ble' | 'classic'): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  sendRecord(sessionId: string, packetId: string, bytesBase64: string): Promise<void>;
  cancelTransfer(sessionId: string): Promise<void>;
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

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function fromBase64(value: string) { return Uint8Array.from(atob(value), (item) => item.charCodeAt(0)); }
