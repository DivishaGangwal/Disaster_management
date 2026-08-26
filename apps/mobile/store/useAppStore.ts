import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tier2Metrics } from '@dsm/contracts';

export type UserRole = 'general-public' | 'responder';
export type InternetState = 'untested' | 'unavailable' | 'probing' | 'proven gateway';
export type TransportMode = 'SIMULATED' | 'native';
export type SelectedRadio = 'simulated' | 'BLE' | 'Bluetooth Classic';
export type OfflinePackStatus = 'checking' | 'downloading' | 'ready' | 'not-downloaded' | 'error';
export interface RuntimeIncident { id: string; category: number; severity: number; peopleTotal?: number; injured?: number; updatedAtS: number; }
export interface RuntimeMapObject { objectId: string; kind: string; label: string; state?: number; latE7?: number; lonE7?: number; asOfS: number; provenance: string; }
export interface RuntimeDiagnostic { category: string; name: string; severity: string; atMs: number; transport?: string; packetId?: string; result?: string; reason?: string; }
export interface ReceivedPacketImpact { kind: string; label: string; detail: string; objectId?: string; applied: boolean; }
export interface ReceivedPacketSummary {
  packetId: string;
  campaignId?: string;
  campaignVersion?: number;
  typeName: string;
  message: string;
  severity: number;
  receivedAtMs: number;
  transport: 'tier2-mic' | 'tier2-direct';
  outcome: 'applied' | 'stored' | 'duplicate' | 'rejected';
  payload: Record<string, unknown>;
  impacts: ReceivedPacketImpact[];
}

interface AppState {
  // Profile & role
  role: UserRole;
  setRole: (role: UserRole) => void;

  // Permissions
  bluetoothEnabled: boolean;
  setBluetoothEnabled: (v: boolean) => void;
  locationEnabled: boolean;
  setLocationEnabled: (v: boolean) => void;
  microphoneEnabled: boolean;
  setMicrophoneEnabled: (v: boolean) => void;

  // Network & relay
  internetState: InternetState;
  setInternetState: (s: InternetState) => void;
  relayActive: boolean;
  setRelayActive: (v: boolean) => void;
  peersRecentlySeen: number;
  setPeersRecentlySeen: (n: number) => void;

  // Transport
  transportMode: TransportMode;
  setTransportMode: (m: TransportMode) => void;
  selectedRadio: SelectedRadio;
  setSelectedRadio: (m: SelectedRadio) => void;
  batteryPercent?: number;
  setBatteryPercent: (value?: number) => void;
  batteryTemperatureC?: number;
  setBatteryTemperatureC: (value?: number) => void;
  thermalState: 'normal' | 'limited';
  setThermalState: (value: 'normal' | 'limited') => void;
  runtimeError?: string;
  setRuntimeError: (value?: string) => void;
  storedPackets: number;
  setStoredPackets: (value: number) => void;
  activeIncidentId?: string;
  setActiveIncidentId: (value?: string) => void;
  distinctPeerReceipts: number;
  setDistinctPeerReceipts: (value: number) => void;
  runtimeIncidents: RuntimeIncident[];
  setRuntimeIncidents: (value: RuntimeIncident[]) => void;
  mapObjects: RuntimeMapObject[];
  setMapObjects: (value: RuntimeMapObject[]) => void;
  diagnosticEvents: RuntimeDiagnostic[];
  setDiagnosticEvents: (value: RuntimeDiagnostic[]) => void;
  selectedIncidentId?: string;
  setSelectedIncidentId: (value?: string) => void;
  selectedMapObjectId?: string;
  setSelectedMapObjectId: (value?: string) => void;
  /** Object the Map screen should fly the camera to on next mount, then clear. */
  focusMapObjectId?: string;
  setFocusMapObjectId: (value?: string) => void;

  // Region
  selectedRegion: string;
  setSelectedRegion: (r: string) => void;
  offlinePackVersion: string;
  offlinePackStatus: OfflinePackStatus;
  setOfflinePackStatus: (s: OfflinePackStatus) => void;
  offlinePackProgress: number;
  offlinePackBytes: number;
  offlinePackResources: number;
  setOfflinePackSnapshot: (value: { status: OfflinePackStatus; progress: number; completedBytes: number; completedResources: number }) => void;

  // Tier 2
  tier2Listening: boolean;
  setTier2Listening: (v: boolean) => void;
  tier2Metrics?: Tier2Metrics;
  setTier2Metrics: (value: Tier2Metrics) => void;
  receivedPackets: ReceivedPacketSummary[];
  addReceivedPacket: (value: ReceivedPacketSummary) => void;

  // Language
  language: string;
  setLanguage: (l: string) => void;

  // Active SOS
  hasActiveSos: boolean;
  setHasActiveSos: (v: boolean) => void;

  // Onboarding
  hasCompletedReadiness: boolean;
  setHasCompletedReadiness: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Profile
      role: 'general-public',
      setRole: (role) => set({ role }),

      // Permissions
      bluetoothEnabled: false,
      setBluetoothEnabled: (v) => set({ bluetoothEnabled: v }),
      locationEnabled: false,
      setLocationEnabled: (v) => set({ locationEnabled: v }),
      microphoneEnabled: false,
      setMicrophoneEnabled: (v) => set({ microphoneEnabled: v }),

      // Network
      internetState: 'untested',
      setInternetState: (s) => set({ internetState: s }),
      relayActive: false,
      setRelayActive: (v) => set({ relayActive: v }),
      peersRecentlySeen: 0,
      setPeersRecentlySeen: (n) => set({ peersRecentlySeen: n }),

      // Transport
      transportMode: 'SIMULATED',
      setTransportMode: (m) => set({ transportMode: m }),
      selectedRadio: 'simulated',
      setSelectedRadio: (selectedRadio) => set({ selectedRadio }),
      batteryPercent: undefined,
      setBatteryPercent: (batteryPercent) => set({ batteryPercent }),
      batteryTemperatureC: undefined,
      setBatteryTemperatureC: (batteryTemperatureC) => set({ batteryTemperatureC }),
      thermalState: 'normal',
      setThermalState: (thermalState) => set({ thermalState }),
      runtimeError: undefined,
      setRuntimeError: (runtimeError) => set({ runtimeError }),
      storedPackets: 0,
      setStoredPackets: (storedPackets) => set({ storedPackets }),
      activeIncidentId: undefined,
      setActiveIncidentId: (activeIncidentId) => set({ activeIncidentId }),
      distinctPeerReceipts: 0,
      setDistinctPeerReceipts: (distinctPeerReceipts) => set({ distinctPeerReceipts }),
      runtimeIncidents: [],
      setRuntimeIncidents: (runtimeIncidents) => set({ runtimeIncidents }),
      mapObjects: [],
      setMapObjects: (mapObjects) => set({ mapObjects }),
      diagnosticEvents: [],
      setDiagnosticEvents: (diagnosticEvents) => set({ diagnosticEvents }),
      selectedIncidentId: undefined,
      setSelectedIncidentId: (selectedIncidentId) => set({ selectedIncidentId }),
      selectedMapObjectId: undefined,
      setSelectedMapObjectId: (selectedMapObjectId) => set({ selectedMapObjectId }),
      focusMapObjectId: undefined,
      setFocusMapObjectId: (focusMapObjectId) => set({ focusMapObjectId }),

      // Region
      selectedRegion: 'Mumbai Operational Region',
      setSelectedRegion: (r) => set({ selectedRegion: r }),
      offlinePackVersion: 'mumbai-v1',
      offlinePackStatus: 'not-downloaded',
      setOfflinePackStatus: (s) => set({ offlinePackStatus: s }),
      offlinePackProgress: 0,
      offlinePackBytes: 0,
      offlinePackResources: 0,
      setOfflinePackSnapshot: (value) => set({ offlinePackStatus: value.status, offlinePackProgress: value.progress, offlinePackBytes: value.completedBytes, offlinePackResources: value.completedResources }),

      // Tier 2
      tier2Listening: false,
      setTier2Listening: (v) => set({ tier2Listening: v }),
      tier2Metrics: undefined,
      setTier2Metrics: (tier2Metrics) => set({ tier2Metrics }),
      receivedPackets: [],
      addReceivedPacket: (value) => set((state) => ({ receivedPackets: [value, ...state.receivedPackets.filter((item) => item.packetId !== value.packetId)].slice(0, 20) })),

      // Language
      language: 'en',
      setLanguage: (l) => set({ language: l }),

      // Active SOS
      hasActiveSos: false,
      setHasActiveSos: (v) => set({ hasActiveSos: v }),

      // Onboarding
      hasCompletedReadiness: false,
      setHasCompletedReadiness: (v) => set({ hasCompletedReadiness: v }),
    }),
    {
      name: 'dsm-app-state',
      version: 4,
      migrate: (persisted) => {
        const previous = persisted as Partial<AppState>;
        const staleRegion = !previous.selectedRegion || previous.selectedRegion.includes('Assam') || previous.selectedRegion.endsWith('DISTRICT');
        return { ...previous, ...(staleRegion ? { selectedRegion: 'Mumbai Operational Region' } : {}) } as AppState;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        role: state.role,
        selectedRegion: state.selectedRegion,
        language: state.language,
        hasCompletedReadiness: state.hasCompletedReadiness,
        transportMode: state.transportMode,
        activeIncidentId: state.activeIncidentId,
        hasActiveSos: state.hasActiveSos,
        receivedPackets: state.receivedPackets,
      }),
    },
  ),
);
