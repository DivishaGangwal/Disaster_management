import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  EmergencyCategory,
  EventCategory,
  LocationSource,
  MessageType,
  Mobility,
  ArrivalEvidence,
  CheckinStatus,
  DEPLOYMENT,
  GATEWAY,
  ResolutionOutcome,
  ReplyCapability,
  Severity,
  TIER2,
  messageTypeName,
  type MapOperation,
  type AudioInputAdapter,
  type LocalProfile,
  type Tier2RawFrame,
} from '@dsm/contracts';
import { buildCheckinResponse, buildResponderState, buildSosCancel, buildSosCreate, buildSosUpdate, decodePacket, floatToE7, newNodeToken, newSourceId, toEpochS } from '@dsm/codec';
import { MemoryEventSink } from '@dsm/store';
import { createNativeTransport, createNativeWavePxAudioInput, requestNativeWavePxPermission } from '@dsm/android-radio-bridge';
import { HttpGatewayClient } from '@dsm/gateway-client';
import { GatewaySynchronizer } from '@dsm/node-runtime';
import { MUMBAI_CONTENT_PACK, PackResolver, toMapOperations } from '@dsm/mapkit';
import { Tier2Receiver } from '@dsm/tier2';
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
  private wavePxInput?: AudioInputAdapter;
  private readonly wavePxReceiver = new Tier2Receiver();
  private wavePxTimeout?: ReturnType<typeof setTimeout>;
  private removeWavePxFrameListener?: () => void;
  private removeAdapterListener?: () => void;
  private gatewaySyncTimer?: ReturnType<typeof setInterval>;
  private gatewaySyncInFlight?: Promise<boolean>;
  private gatewaySyncGeneration = 0;

  async initialize(role: UserRole = useAppStore.getState().role) {
    if (this.runtime) return this.runtime;
    if (this.initializing) return this.initializing;
    this.initializing = this.create(role);
    try { this.runtime = await this.initializing; return this.runtime; }
    finally { this.initializing = undefined; }
  }

  async reconfigureRole(role: UserRole) {
    await this.stopWavePxListening();
    this.removeWavePxFrameListener?.();
    this.removeWavePxFrameListener = undefined;
    this.wavePxInput = undefined;
    this.removeAdapterListener?.();
    this.removeAdapterListener = undefined;
    if (this.runtime?.relay.isRunning) await this.runtime.stopRelay();
    this.runtime = undefined;
    return this.initialize(role);
  }

  /**
   * Keep the optional website/backend channel opportunistic. A successful
   * cycle uploads local mesh packets and downloads authority/map packets; an
   * offline failure leaves SQLite custody untouched and Bluetooth operational.
   */
  async startGatewaySync() {
    if (this.gatewaySyncTimer) return;
    const generation = ++this.gatewaySyncGeneration;
    const runtime = await this.initialize();
    if (!runtime.gatewayConfigured || generation !== this.gatewaySyncGeneration || this.gatewaySyncTimer) return;
    await this.syncGateway(false);
    if (generation !== this.gatewaySyncGeneration || this.gatewaySyncTimer) return;
    this.gatewaySyncTimer = setInterval(() => { void this.syncGateway(false); }, GATEWAY.SYNC_INTERVAL_MS);
  }

  stopGatewaySync() {
    this.gatewaySyncGeneration += 1;
    clearInterval(this.gatewaySyncTimer);
    this.gatewaySyncTimer = undefined;
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
      regionCode: DEPLOYMENT.regionCode,
      adapter: expoGo ? 'simulated' : 'native-ble',
      localSourceId: sourceId,
      nodeToken,
      packets: repositories.packets,
      peers: repositories.peers,
      files: repositories.files,
      mapObjects: repositories.mapObjects,
      events: new MemoryEventSink(),
      // 01-... "Notification policy" is the policy engine's job, so the alert
      // decision is taken there and merely rendered here. Duplicates never
      // re-notify (REL-006).
      onIngested: (result, transport) => {
        if (!result.accepted || result.storeOutcome === 'duplicate') return;
        if (!result.policy || !result.packetId) return;
        // Locally created packets are confirmed by the SOS screen itself; a
        // notification for your own action is noise.
        if (transport === 'local') return;
        void notifyPacketReceived(result.policy.alert, result.packetId, transport);
      },
      ...(!expoGo ? { adapterFactory: createNativeTransport } : {}),
    }, new PackResolver(MUMBAI_CONTENT_PACK));
    const report = await runtime.getCapabilities();
    const backendBaseUrl = process.env.EXPO_PUBLIC_DSM_BACKEND_URL?.replace(/\/$/, '');
    if (backendBaseUrl) {
      runtime.attachGateway(new GatewaySynchronizer({
        engine: runtime.engine,
        client: new HttpGatewayClient({ baseUrl: backendBaseUrl, expectedIdentity: DEPLOYMENT.backendIdentity }),
        regionCode: DEPLOYMENT.regionCode,
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
    // Handle retained so reconfigureRole() can detach it. Without this the
    // listener leaked on every role change: create() registers a new one,
    // the old adapter subscription stays live, and each native transport
    // event is then delivered N times -- which is why relay/peer/session
    // rows appeared 7-8x in the diagnostics log while locally-created
    // packet rows (emitted by NodeEngine, not the transport) appeared once.
    this.removeAdapterListener?.();
    this.removeAdapterListener = runtime.adapter.addEventListener((event) => {
      const current = useAppStore.getState();
      if (event.kind === 'peer-observed') void runtime.engine.peers.list(Date.now()).then((peers) => current.setPeersRecentlySeen(peers.length));
      if (event.kind === 'relay-state-changed') current.setRelayActive(!['stopped', 'permission-required', 'error-user-action-required'].includes(event.state));
      if (event.kind === 'capability-changed') { current.setBatteryPercent(event.report.batteryPercent); current.setBatteryTemperatureC(event.report.batteryTemperatureC); current.setThermalState(event.report.thermalThrottled ? 'limited' : 'normal'); }
      // Notifications are NOT raised here any more. This event fires for every
      // record off the radio -- including INVENTORY -- so notifying from it
      // meant an emergency-channel alert per inventory exchange. The engine's
      // onIngested hook carries the policy decision instead.
      if (event.kind === 'error') current.setRuntimeError(event.message);
    });
    if (!expoGo) {
      this.wavePxInput = createNativeWavePxAudioInput();
      this.removeWavePxFrameListener = this.wavePxInput.addFrameListener((frame) => { void this.acceptWavePxFrame(runtime, frame); });
    }
    state.setTier2Metrics(this.wavePxReceiver.metrics());
    return runtime;
  }

  async startWavePxListening() {
    await this.initialize();
    if (!this.wavePxInput) throw new Error('WavePX microphone listening requires the Android development build; Expo Go has no native audio decoder.');
    const microphone = await requestNativeWavePxPermission();
    useAppStore.getState().setMicrophoneEnabled(microphone === 'granted');
    if (microphone !== 'granted') throw new Error('Grant microphone permission before starting WavePX listening.');
    clearTimeout(this.wavePxTimeout);
    this.wavePxReceiver.reset();
    const nowMs = Date.now();
    this.wavePxReceiver.startListening('tier2-mic', nowMs);
    useAppStore.getState().setTier2Metrics(this.wavePxReceiver.metrics());
    await this.wavePxInput.startListening({ timeoutMs: TIER2.MICROPHONE_TIMEOUT_MS });
    useAppStore.getState().setTier2Listening(true);
    this.wavePxTimeout = setTimeout(() => { void this.stopWavePxListening(); }, TIER2.MICROPHONE_TIMEOUT_MS);
  }

  async stopWavePxListening() {
    clearTimeout(this.wavePxTimeout);
    this.wavePxTimeout = undefined;
    await this.wavePxInput?.stopListening();
    this.wavePxReceiver.stop();
    const state = useAppStore.getState();
    state.setTier2Listening(false);
    state.setTier2Metrics(this.wavePxReceiver.metrics());
  }

  private async acceptWavePxFrame(runtime: AppRuntime, frame: Tier2RawFrame) {
    const recovered = this.wavePxReceiver.accept(frame);
    runtime.engine.events.emit({
      category: EventCategory.TIER2,
      name: recovered.packet ? 'packet-reassembled' : 'frame-observed',
      severity: recovered.reason.includes('corrupt') ? 'warn' : 'info',
      atMs: frame.receivedAtMs,
      reason: recovered.reason,
      transport: frame.source,
      bytes: frame.bytes.length,
      ...(recovered.packet ? { packetId: recovered.packet.packetId } : {}),
    });
    useAppStore.getState().setTier2Metrics(this.wavePxReceiver.metrics());
    if (!recovered.packet) { await this.refresh(runtime); return; }
    const decoded = decodePacket(recovered.packet.bytes);
    const mapOperations = decoded.ok ? toMapOperations(decoded.packet, recovered.packet.source, toEpochS(recovered.packet.recoveredAtMs)) : [];
    const result = await runtime.engine.ingest(recovered.packet.bytes, recovered.packet.source, {
      atMs: recovered.packet.recoveredAtMs,
      ...(this.wavePxReceiver.metrics().campaignId ? { campaignId: this.wavePxReceiver.metrics().campaignId } : {}),
    });
    if (result.accepted) {
      // No notify() here: engine.ingest() already fired the onIngested hook for
      // this packet, using the policy engine's alert decision. Calling again
      // would double-notify every Tier 2 recovery.
      if (runtime.relay.isRunning) await runtime.relay.refreshAdvertisement();
    }
    if (decoded.ok) {
      const payload = jsonSafePayload(decoded.packet.payload) as Record<string, unknown>;
      const campaignId = this.wavePxReceiver.metrics().campaignId ?? stringValue(payload['campaignId']);
      useAppStore.getState().addReceivedPacket({
        packetId: decoded.packet.header.packetId,
        ...(campaignId ? { campaignId } : {}),
        ...(this.wavePxReceiver.metrics().campaignVersion !== undefined ? { campaignVersion: this.wavePxReceiver.metrics().campaignVersion } : {}),
        typeName: messageTypeName(decoded.packet.header.type) ?? `TYPE_${decoded.packet.header.type}`,
        message: packetMessage(payload, messageTypeName(decoded.packet.header.type)),
        severity: decoded.packet.header.severity,
        receivedAtMs: recovered.packet.recoveredAtMs,
        transport: recovered.packet.source,
        outcome: !result.accepted ? 'rejected' : result.storeOutcome === 'duplicate' ? 'duplicate' : result.mapOperationsApplied > 0 ? 'applied' : 'stored',
        payload,
        impacts: packetImpacts(mapOperations, result.mapOperationsApplied),
      });
    }
    await this.refresh(runtime);
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
    void this.syncGateway(false);
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
    const state = useAppStore.getState();
    state.setRelayActive(active);
    // Peer count is only ever refreshed by a peer-observed event, and peer
    // records stay inside PEER_OBSERVATION_RETENTION_S (30 min) regardless.
    // So a stopped relay -- or a switched-off radio -- kept reporting the
    // last seen count indefinitely. Not scanning means no current peers.
    if (!active) state.setPeersRecentlySeen(0);
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

  /** Check-in responses leave through Tier 1 and an optional gateway, never Tier 2. */
  async respondToCheckin(campaignId: string, status: number) {
    const runtime = await this.initialize();
    const boundedStatus = Math.max(CheckinStatus.SAFE, Math.min(CheckinStatus.DISPLACED, Math.trunc(status))) as 0 | 1 | 2 | 3 | 4;
    const location = await bestEffortLocation();
    const packet = buildCheckinResponse(context(runtime), campaignId, {
      status: boundedStatus,
      sourceRef: runtime.engine.localSourceId.slice(0, 16),
      ...(location ? { location } : {}),
    });
    const result = await runtime.engine.createLocal(packet, campaignId);
    if (!result.validation.ok) throw new Error(result.validation.reason);
    if (!runtime.relay.isRunning) await runtime.startRelay();
    await runtime.relay.refreshAdvertisement();
    await this.refresh(runtime);
    void this.syncGateway(false);
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
    return this.syncGateway(true);
  }

  private async syncGateway(showProbing: boolean): Promise<boolean> {
    if (this.gatewaySyncInFlight) return this.gatewaySyncInFlight;
    const task = (async () => {
      const state = useAppStore.getState();
      const runtime = await this.initialize();
      if (!runtime.gatewayConfigured) {
        state.setInternetState('untested');
        return false;
      }
      if (showProbing) state.setInternetState('probing');
      try {
        const proven = await runtime.probeGateway();
        state.setInternetState(proven ? 'proven gateway' : 'unavailable');
        if (proven && runtime.relay.isRunning) await runtime.relay.refreshAdvertisement();
        await this.refresh(runtime);
        return proven;
      } catch (reason) {
        state.setInternetState('unavailable');
        state.setRuntimeError(reason instanceof Error ? reason.message : String(reason));
        return false;
      }
    })();
    this.gatewaySyncInFlight = task;
    try { return await task; }
    finally { this.gatewaySyncInFlight = undefined; }
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

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function jsonSafePayload(value: unknown): unknown {
  if (value instanceof Uint8Array) return { bytes: Array.from(value), byteLength: value.length };
  if (Array.isArray(value)) return value.map(jsonSafePayload);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafePayload(item)]));
  return value;
}

function packetMessage(payload: Record<string, unknown>, typeName?: string): string {
  return stringValue(payload['fallbackText'])
    ?? stringValue(payload['fallbackLabel'])
    ?? stringValue(payload['fallbackPrompt'])
    ?? stringValue(payload['name'])
    ?? `${typeName ?? 'Packet'} received and validated.`;
}

function packetImpacts(operations: readonly MapOperation[], appliedCount: number) {
  if (operations.length === 0) return [];
  return operations.map((operation, index) => ({
    kind: operation.kind,
    label: mobileMapOperationLabel(operation.kind),
    detail: mobileMapOperationDetail(operation),
    ...('objectId' in operation ? { objectId: operation.objectId } : 'hazardId' in operation ? { objectId: operation.hazardId } : 'routeId' in operation ? { objectId: operation.routeId } : {}),
    applied: index < appliedCount,
  }));
}

function mobileMapOperationLabel(kind: MapOperation['kind']): string {
  return ({
    'upsert-resource': 'Resource added or updated',
    'set-resource-state': 'Resource availability changed',
    'set-capacity': 'Resource capacity changed',
    'upsert-hazard': 'Hazard added or updated',
    'clear-hazard': 'Hazard cleared',
    'set-route-state': 'Route status changed',
    'upsert-incident-marker': 'Incident marker updated',
    'upsert-responder-marker': 'Responder marker updated',
    'upsert-peer-marker': 'Peer marker updated',
    'set-incident-state': 'Incident status changed',
    'activate-content': 'Offline content activated',
    'tombstone-object': 'Map object removed',
  } as Record<MapOperation['kind'], string>)[kind];
}

function mobileMapOperationDetail(operation: MapOperation): string {
  const target = 'objectId' in operation ? operation.objectId : 'hazardId' in operation ? operation.hazardId : 'routeId' in operation ? operation.routeId : 'incidentId' in operation ? operation.incidentId : 'responderRef' in operation ? operation.responderRef : 'peerToken' in operation ? operation.peerToken : 'local map';
  const state = 'state' in operation ? ` · state ${operation.state}` : '';
  const coordinate = 'latE7' in operation && 'lonE7' in operation && typeof operation.latE7 === 'number' && typeof operation.lonE7 === 'number' ? ` · ${(operation.latE7 / 1e7).toFixed(5)}, ${(operation.lonE7 / 1e7).toFixed(5)}` : '';
  return `${target}${state}${coordinate}`;
}

export const mobileController = new MobileController();
