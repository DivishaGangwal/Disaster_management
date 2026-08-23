import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'general-public' | 'responder';
export type InternetState = 'untested' | 'unavailable' | 'probing' | 'proven gateway';
export type TransportMode = 'SIMULATED' | 'native';
export type SelectedRadio = 'simulated' | 'BLE' | 'Bluetooth Classic';
export interface RuntimeIncident { id: string; category: number; severity: number; peopleTotal?: number; injured?: number; updatedAtS: number; }
export interface RuntimeMapObject { objectId: string; kind: string; label: string; state?: number; latE7?: number; lonE7?: number; asOfS: number; provenance: string; }
export interface RuntimeDiagnostic { category: string; name: string; severity: string; atMs: number; transport?: string; packetId?: string; result?: string; reason?: string; }

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
  offlinePackStatus: 'downloaded' | 'downloading' | 'not-downloaded';
  setOfflinePackStatus: (s: 'downloaded' | 'downloading' | 'not-downloaded') => void;

  // Tier 2
  tier2Listening: boolean;
  setTier2Listening: (v: boolean) => void;

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
      selectedRegion: 'Mumbai Metropolitan Region',
      setSelectedRegion: (r) => set({ selectedRegion: r }),
      offlinePackVersion: '1.0.0',
      offlinePackStatus: 'downloaded',
      setOfflinePackStatus: (s) => set({ offlinePackStatus: s }),

      // Tier 2
      tier2Listening: false,
      setTier2Listening: (v) => set({ tier2Listening: v }),

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
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        role: state.role,
        selectedRegion: state.selectedRegion,
        language: state.language,
        hasCompletedReadiness: state.hasCompletedReadiness,
        transportMode: state.transportMode,
      }),
    },
  ),
);
