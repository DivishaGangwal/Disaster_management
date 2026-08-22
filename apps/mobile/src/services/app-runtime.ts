/**
 * APP RUNTIME -- the single place the mobile app touches the engine.
 *
 * Screens NEVER import a transport, a codec, or a repository directly. They
 * call this service. That is what enforces 02-...: "Direct use of platform
 * radio APIs from arbitrary screens is prohibited" and "Bluetooth details must
 * not leak into the map, incident, or UI models."
 *
 * RUNTIME SELECTION (DEC-004):
 *   Expo Go        -> 'simulated'  : full UI, domain, map, and SOS flows, no
 *                                    Android build needed. Labelled as a
 *                                    simulation on the readiness screen.
 *   Expo dev build -> 'native-ble' : the judged runtime, real BLE + ggwave.
 *
 * Workstream A owns the screens above this line.
 * Workstream B owns the native adapter below it.
 * Neither has to wait for the other.
 */

import {
  SourceClass,
  type CapabilityReport,
  type LocalProfile,
  type TransportAdapter,
} from '@dsm/contracts';
import { NodeEngine, RelayLoop, GatewaySynchronizer } from '@dsm/node-runtime';
import { RadioMedium, SimulatedTransportAdapter, type AdapterSelection } from '@dsm/transport-core';
import { MapProjection, PackResolver } from '@dsm/mapkit';
import { newNodeToken, newSourceId } from '@dsm/codec';

export interface RuntimeConfig {
  readonly profile: LocalProfile;
  readonly regionCode: string;
  readonly adapter: AdapterSelection;
  readonly backendBaseUrl?: string;
}

export class AppRuntime {
  readonly engine: NodeEngine;
  readonly relay: RelayLoop;
  private gatewaySync?: GatewaySynchronizer;

  private constructor(
    readonly config: RuntimeConfig,
    engine: NodeEngine,
    adapter: TransportAdapter,
    readonly resolver: PackResolver | undefined,
  ) {
    this.engine = engine;
    this.relay = new RelayLoop({
      engine,
      adapter,
      now: () => Date.now(),
      gatewayProven: () => engine.isGatewayProven(Date.now()),
    });
  }

  static async create(config: RuntimeConfig, resolver?: PackResolver): Promise<AppRuntime> {
    const adapter = await selectAdapter(config.adapter);

    const engine = new NodeEngine({
      profile: config.profile,
      localSourceId: newSourceId(),
      nodeToken: newNodeToken(),
      regionCode: config.regionCode,
      projection: new MapProjection(resolver),
    });

    return new AppRuntime(config, engine, adapter, resolver);
  }

  get sourceClass() {
    return this.config.profile.role === 'responder'
      ? SourceClass.RESPONDER_PROVISIONED
      : SourceClass.GENERAL_PUBLIC;
  }

  /** REL-001: relay mode is explicit, visible, and stoppable. */
  async startRelay(): Promise<void> {
    await this.relay.start();
  }

  async stopRelay(): Promise<void> {
    await this.relay.stop();
  }

  attachGateway(sync: GatewaySynchronizer): void {
    this.gatewaySync = sync;
  }

  /** GTW-001: nothing else in the app may declare a gateway. */
  async probeGateway(): Promise<boolean> {
    if (!this.gatewaySync) return false;
    const report = await this.gatewaySync.sync();
    return report.proven;
  }
}

async function selectAdapter(selection: AdapterSelection): Promise<TransportAdapter> {
  if (selection === 'simulated') {
    // One isolated medium: a single Expo Go device sees no real peers, which
    // is the honest behaviour. The simulator package is what wires many nodes.
    return new SimulatedTransportAdapter(newNodeToken(), new RadioMedium());
  }

  // ---------------------------------------------------------------------
  // WORKSTREAM B: implement native/android-radio-bridge and import it here.
  // It must satisfy the same TransportAdapter interface, nothing more.
  //
  //   const { NativeTransportAdapter } = await import('@dsm/android-radio-bridge');
  //   return new NativeTransportAdapter(selection);
  //
  // Until then, fail loudly rather than silently pretending Expo Go does BLE
  // (working rule 11).
  // ---------------------------------------------------------------------
  throw new Error(
    `Transport "${selection}" needs the native module from an Expo development build. ` +
      'Stock Expo Go cannot provide real Bluetooth (DEC-004). Use "simulated" in Expo Go.',
  );
}

/** What the readiness screen renders. It must never soften `simulated`. */
export function describeCapabilities(report: CapabilityReport): readonly string[] {
  const lines: string[] = [];
  lines.push(report.simulated ? 'Transport: SIMULATED (not real Bluetooth)' : 'Transport: native Android Bluetooth');
  lines.push(`Bluetooth available: ${report.bluetoothAvailable ? 'yes' : 'no'}`);
  lines.push(`Bluetooth enabled: ${report.bluetoothEnabled ? 'yes' : 'no'}`);
  lines.push(`BLE advertise: ${report.bleAdvertiseSupported ? 'supported' : 'not supported'}`);
  lines.push(`BLE scan: ${report.bleScanSupported ? 'supported' : 'not supported'}`);
  lines.push(`GATT server: ${report.gattServerSupported ? 'available' : 'unavailable'}`);
  lines.push(`Microphone: ${report.audioInputAvailable ? 'available' : 'unavailable'}`);
  return lines;
}
