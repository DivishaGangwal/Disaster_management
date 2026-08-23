import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  EmergencyCategory,
  LocationSource,
  MessageType,
  Mobility,
  ArrivalEvidence,
  ResolutionOutcome,
  ReplyCapability,
  Severity,
  type LocalProfile,
} from '@dsm/contracts';
import { buildResponderState, buildSosCancel, buildSosCreate, buildSosUpdate, decodePacket, floatToE7, newNodeToken, newSourceId, toEpochS } from '@dsm/codec';
import { MemoryEventSink } from '@dsm/store';
import { createNativeTransport } from '@dsm/android-radio-bridge';
import { HttpGatewayClient } from '@dsm/gateway-client';
import { GatewaySynchronizer } from '@dsm/node-runtime';
import { ASSAM_CONTENT_PACK, PackResolver } from '@dsm/mapkit';
import { AppRuntime } from './app-runtime';
import { openMobileRepositories } from './sqlite-repositories';
import { configureNotificationChannels, notifyPacketReceived } from './notifications';
import { offlineMapService } from './offline-map';
import { useAppStore, type UserRole } from '@/store/useAppStore';

const SOURCE_KEY = 'dsm-source-id-v1';
const NODE_KEY = 'dsm-node-token-v1';
const USER_KEY = 'dsm-local-user-id-v1';

export interface SosDraft {
  category: number;
  severity: number;
  peopleTotal: number;
  injured?: number;
  mobility: number;
  shortNote?: string;
  language?: string;
}

class MobileController {
  private runtime?: AppRuntime;
  private initializing?: Promise<AppRuntime>;
  private sequence = 1;

  async initialize(role: UserRole = useAppStore.getState().role) {
    if (this.runtime) return this.runtime;
    if (this.initializing) return this.initializing;
    this.initializing = this.create(role);
    try { this.runtime = await this.initializing; return this.runtime; }
    finally { this.initializing = undefined; }
  }

  async reconfigureRole(role: UserRole) {
    if (this.runtime?.relay.isRunning) await this.runtime.stopRelay();
    this.runtime = undefined;
    return this.initialize(role);
  }

  private async create(role: UserRole) {
    const repositories = await openMobileRepositories();
    // Fast perceived launch: paint whatever the persisted mirror already
    // holds before the (potentially slower) packet-log replay below runs.
    const persistedMapObjects = await repositories.mapObjects.list();
    if (persistedMapObjects.length > 0) useAppStore.getState().setMapObjects([...persistedMapObjects]);
    const [sourceId, nodeToken, localUserId] = await Promise.all([
      stableValue(SOURCE_KEY, newSourceId),
      stableValue(NODE_KEY, newNodeToken),
      stableValue(USER_KEY, () => `local-${Date.now().toString(36)}`),
    ]);
    const profile: LocalProfile = { localUserId, role, language: useAppStore.getState().language, responderProvisionedByDemo: role === 'responder' };
    const expoGo = Constants.appOwnership === 'expo';
    const runtime = await AppRuntime.create({
      profile,
      regionCode: 'IN-AS',
      adapter: expoGo ? 'simulated' : 'native-ble',
      localSourceId: sourceId,
      nodeToken,
      packets: repositories.packets,
      peers: repositories.peers,
      files: repositories.files,
      mapObjects: repositories.mapObjects,
      events: new MemoryEventSink(),
      ...(!expoGo ? { adapterFactory: createNativeTransport } : {}),
    }, new PackResolver(ASSAM_CONTENT_PACK));
    const report = await runtime.getCapabilities();
    const backendBaseUrl = process.env.EXPO_PUBLIC_DSM_BACKEND_URL?.replace(/\/$/, '');
    if (backendBaseUrl) {
      runtime.attachGateway(new GatewaySynchronizer({
        engine: runtime.engine,
        client: new HttpGatewayClient({ baseUrl: backendBaseUrl, expectedIdentity: 'dsm-backend-demo-v1' }),
        regionCode: 'IN-AS',
        now: () => Date.now(),
      }));
    }
    const state = useAppStore.getState();
    state.setTransportMode(report.simulated ? 'SIMULATED' : 'native');
    state.setSelectedRadio(report.simulated ? 'simulated' : runtime.adapter.kind === 'tier1-classic' ? 'Bluetooth Classic' : 'BLE');
    state.setBatteryPercent(report.batteryPercent);
    state.setBatteryTemperatureC(report.batteryTemperatureC);
    state.setThermalState(report.thermalThrottled ? 'limited' : 'normal');
    state.setBluetoothEnabled(report.bluetoothEnabled);
    // Packet log is the source of truth: re-derive the map projection from
    // it and reconcile the persisted mirror before the first refresh() reads
    // it, so the fast paint above never permanently drifts.
    const rebuilt = await runtime.engine.rebuildMapFromStoredPackets(Date.now());
    this.sequence = Math.max(1, rebuilt.maxSourceSequence);
    state.setActiveIncidentId(rebuilt.activeIncidentId);
    state.setHasActiveSos(Boolean(rebuilt.activeIncidentId));
    await runtime.engine.maintain(Date.now());
    await this.refresh(runtime);
    void this.refreshOfflineMap();
    await configureNotificationChannels();
    runtime.adapter.addEventListener((event) => {
      const current = useAppStore.getState();
      if (event.kind === 'peer-observed') void runtime.engine.peers.list(Date.now()).then((peers) => current.setPeersRecentlySeen(peers.length));
      if (event.kind === 'relay-state-changed') current.setRelayActive(!['stopped', 'permission-required', 'error-user-action-required'].includes(event.state));
      if (event.kind === 'capability-changed') { current.setBatteryPercent(event.report.batteryPercent); current.setBatteryTemperatureC(event.report.batteryTemperatureC); current.setThermalState(event.report.thermalThrottled ? 'limited' : 'normal'); }
      if (event.kind === 'record-received') {
        const decoded = decodePacket(event.bytes);
        if (decoded.ok) void notifyPacketReceived(decoded.packet.header.priority, decoded.packet.header.packetId);
      }
      if (event.kind === 'error') current.setRuntimeError(event.message);
    });
    return runtime;
  }

  async requestPermissions() {
    const runtime = await this.initialize();
    const [native, location, notifications] = await Promise.all([
      runtime.requestPermissions(),
      Location.requestForegroundPermissionsAsync(),
      Notifications.requestPermissionsAsync(),
    ]);
    const state = useAppStore.getState();
    state.setBluetoothEnabled(['granted'].includes(native.bluetoothScan) && ['granted'].includes(native.bluetoothConnect));
    state.setLocationEnabled(location.granted);
    state.setMicrophoneEnabled(native.microphone === 'granted');
    return native;
  }

  async sendRapidSos() {
    return this.saveSos({ category: EmergencyCategory.OTHER, severity: Severity.LIFE_CRITICAL, peopleTotal: 1, mobility: Mobility.UNKNOWN, language: useAppStore.getState().language });
  }

  async saveSos(draft: SosDraft) {
    const runtime = await this.initialize();
    const state = useAppStore.getState();
    const existing = state.activeIncidentId;
    const location = await bestEffortLocation();
    let result;
    if (existing) {
      this.sequence += 1;
      const packet = buildSosUpdate(context(runtime), existing, this.sequence, boundedSeverity(draft.severity), {
        category: boundedCategory(draft.category), peopleTotal: Math.max(0, Math.min(999, Math.trunc(draft.peopleTotal))),
        mobility: Math.max(0, Math.min(4, Math.trunc(draft.mobility))), ...(draft.injured !== undefined ? { injured: draft.injured } : {}),
        ...(draft.shortNote ? { shortNote: draft.shortNote } : {}), ...(location ? { location } : {}),
      });
      result = await runtime.engine.createLocal(packet, existing);
    } else {
      const incidentId = `INC-${Date.now().toString(36).toUpperCase()}-${runtime.engine.nodeToken}`;
      const packet = buildSosCreate(context(runtime), {
        incidentId, category: boundedCategory(draft.category), severity: boundedSeverity(draft.severity), peopleTotal: Math.max(0, Math.min(999, Math.trunc(draft.peopleTotal))),
        injured: Math.max(0, Math.min(999, Math.trunc(draft.injured ?? 0))), mobility: Math.max(0, Math.min(4, Math.trunc(draft.mobility))),
        location: location ?? { source: LocationSource.UNKNOWN, ageS: 0 }, replyCapabilities: ReplyCapability.TIER1_BLE,
        ...(draft.shortNote ? { shortNote: draft.shortNote } : {}), ...(draft.language ? { language: draft.language } : {}),
      });
      result = await runtime.engine.createLocal(packet, incidentId);
      if (result.accepted) state.setActiveIncidentId(incidentId);
    }
    if (!result.validation.ok) throw new Error(result.validation.reason);
    state.setHasActiveSos(true);
    await runtime.startRelay();
    state.setRelayActive(true);
    await runtime.relay.refreshAdvertisement();
    await this.refresh(runtime);
    void runtime.probeGateway().then(async (proven) => {
      if (proven) await runtime.relay.refreshAdvertisement();
      useAppStore.getState().setInternetState(proven ? 'proven gateway' : 'unavailable');
      await this.refresh(runtime);
    }).catch((reason: unknown) => {
      useAppStore.getState().setInternetState('unavailable');
      useAppStore.getState().setRuntimeError(reason instanceof Error ? reason.message : String(reason));
    });
    return result;
  }

  async cancelSos() {
    const runtime = await this.initialize();
    const state = useAppStore.getState();
    if (!state.activeIncidentId) return;
    this.sequence += 1;
    const packet = buildSosCancel(context(runtime), state.activeIncidentId, this.sequence, 0, 7200);
    const result = await runtime.engine.createLocal(packet, state.activeIncidentId);
    if (!result.validation.ok) throw new Error(result.validation.reason);
    state.setHasActiveSos(false);
    state.setActiveIncidentId(undefined);
    await runtime.relay.refreshAdvertisement();
    await this.refresh(runtime);
  }

  async setRelay(active: boolean) {
    const runtime = await this.initialize();
    if (active) await runtime.startRelay(); else await runtime.stopRelay();
    useAppStore.getState().setRelayActive(active);
  }

  async responderTransition(action: 'accepted' | 'declined' | 'en-route' | 'arrived' | 'resolved') {
    const runtime = await this.initialize('responder');
    const incidentId = useAppStore.getState().selectedIncidentId;
    if (!incidentId) throw new Error('Select a locally stored incident first');
    this.sequence += 1;
    const assignmentId = `ASG-${incidentId}`.slice(0, 32);
    const responderRef = runtime.engine.localSourceId.slice(0, 16);
    const type = action === 'accepted' ? MessageType.RESPONDER_ACCEPTED : action === 'declined' ? MessageType.RESPONDER_DECLINED : action === 'en-route' ? MessageType.RESPONDER_EN_ROUTE : action === 'arrived' ? MessageType.RESPONDER_ARRIVED : MessageType.RESOLVED;
    const responderLocation = action === 'en-route' ? await bestEffortLocation() : undefined;
    const payload = action === 'accepted' ? { assignmentId, responderRef }
      : action === 'declined' ? { assignmentId, responderRef, reasonCode: 0 }
        : action === 'arrived' ? { evidence: ArrivalEvidence.DECLARED }
          : action === 'resolved' ? { resolverRef: responderRef, outcome: ResolutionOutcome.ASSISTED_ON_SITE, terminalRetentionS: 86_400 }
            : responderLocation ? { location: responderLocation } : {};
    const packet = buildResponderState(context(runtime), type, incidentId, this.sequence, payload);
    const result = await runtime.engine.createLocal(packet);
    if (!result.validation.ok) throw new Error(result.validation.reason);
    if (!runtime.relay.isRunning) await runtime.startRelay();
    await runtime.relay.refreshAdvertisement();
    await this.refresh(runtime);
    return result;
  }

  /** One-shot cached read of this device's own position, for the map's "Locate me" button. */
  async locateMe() {
    return bestEffortLocation();
  }

  async refreshOfflineMap() {
    const state = useAppStore.getState();
    state.setOfflinePackStatus('checking');
    const snapshot = await offlineMapService.snapshot();
    state.setOfflinePackSnapshot(snapshot);
    return snapshot;
  }

  async downloadOfflineMap() {
    const state = useAppStore.getState();
    state.setOfflinePackStatus('downloading');
    try {
      const snapshot = await offlineMapService.download((progress) => useAppStore.getState().setOfflinePackSnapshot(progress));
      useAppStore.getState().setOfflinePackSnapshot(snapshot);
      return snapshot;
    } catch (reason) {
      state.setOfflinePackStatus('error');
      state.setRuntimeError(reason instanceof Error ? reason.message : String(reason));
      throw reason;
    }
  }

  async probeGateway() {
    const state = useAppStore.getState();
    state.setInternetState('probing');
    const runtime = await this.initialize();
    const proven = await runtime.probeGateway();
    if (proven) {
      await runtime.relay.refreshAdvertisement();
      await this.refresh(runtime);
    }
    state.setInternetState(proven ? 'proven gateway' : 'unavailable');
    return proven;
  }

  async refresh(runtime?: AppRuntime) {
    runtime ??= await this.initialize();
    const state = useAppStore.getState();
    state.setStoredPackets(await runtime.engine.packets.count());
    state.setPeersRecentlySeen((await runtime.engine.peers.list(Date.now())).length);
    const incidentId = state.activeIncidentId;
    if (incidentId) state.setDistinctPeerReceipts(runtime.engine.incidents.view(incidentId)?.delivery.distinctPeerReceipts ?? 0);
    state.setRuntimeIncidents(runtime.engine.incidents.list().map((incident) => ({ id: incident.incidentId, category: incident.category, severity: incident.severity, ...(incident.peopleTotal !== undefined ? { peopleTotal: incident.peopleTotal } : {}), ...(incident.injured !== undefined ? { injured: incident.injured } : {}), updatedAtS: incident.updatedAtS })));
    state.setMapObjects(runtime.engine.projection.visible(toEpochS(Date.now())).map((object) => ({ objectId: object.objectId, kind: object.kind, label: object.label, ...(object.state !== undefined ? { state: object.state } : {}), ...(object.latE7 !== undefined ? { latE7: object.latE7 } : {}), ...(object.lonE7 !== undefined ? { lonE7: object.lonE7 } : {}), asOfS: object.asOfS, provenance: object.provenance })));
    state.setDiagnosticEvents(runtime.engine.events.recent(100).map((event) => ({ category: event.category, name: event.name, severity: event.severity, atMs: event.atMs, ...(event.transport ? { transport: event.transport } : {}), ...(event.packetId ? { packetId: event.packetId } : {}), ...(event.result ? { result: event.result } : {}), ...(event.reason ? { reason: event.reason } : {}) })));
  }
}

function context(runtime: AppRuntime) { return { sourceId: runtime.engine.localSourceId, sourceClass: runtime.sourceClass, nowS: toEpochS(Date.now()) }; }
function boundedSeverity(value: number) { return Math.max(0, Math.min(3, Math.trunc(value))) as 0 | 1 | 2 | 3; }
function boundedCategory(value: number) { return Math.max(0, Math.min(7, Math.trunc(value))); }
async function stableValue(key: string, create: () => string) { const existing = await AsyncStorage.getItem(key); if (existing) return existing; const value = create(); await AsyncStorage.setItem(key, value); return value; }
async function bestEffortLocation() {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return undefined;
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 250 });
    const fix = recent ?? await currentPositionWithTimeout();
    if (!fix) return undefined;
    return { source: recent ? LocationSource.CACHED_GNSS : LocationSource.FRESH_GNSS, latE7: floatToE7(fix.coords.latitude), lonE7: floatToE7(fix.coords.longitude), accuracyM: Math.round(fix.coords.accuracy ?? 500), ageS: Math.max(0, Math.round((Date.now() - fix.timestamp) / 1000)) };
  } catch { return undefined; }
}

async function currentPositionWithTimeout() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<undefined>((resolve) => { timeout = setTimeout(() => resolve(undefined), 8_000); }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export const mobileController = new MobileController();
