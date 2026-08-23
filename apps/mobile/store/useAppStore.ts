import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'general-public' | 'responder';
export type InternetState = 'untested' | 'unavailable' | 'probing' | 'proven gateway';
export type TransportMode = 'SIMULATED' | 'native';
export type RelayServiceState =
  | 'stopped'
  | 'starting'
  | 'active'
  | 'backing-off'
  | 'battery-limited'
  | 'permission-required'
  | 'error';

export interface DiagnosticEntry {
  readonly id: string;
  readonly category?: string;
  readonly name?: string;
  readonly severity?: string;
  readonly packetId?: string;
  readonly transport?: string;
  readonly bytes?: number;
  readonly reason?: string;
  readonly result?: string;
  readonly atMs: number;
  // transport-error fields
  readonly kind?: string;
  readonly code?: string;
  readonly message?: string;
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
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  internetState: InternetState;
  setInternetState: (s: InternetState) => void;
  relayActive: boolean;
  setRelayActive: (v: boolean) => void;
  /** Granular relay service state from TransportAdapter events. */
  relayState: RelayServiceState;
  setRelayState: (s: RelayServiceState) => void;
  peersRecentlySeen: number;
  setPeersRecentlySeen: (n: number | ((prev: number) => number)) => void;

  /** PacketId of the currently active SOS — null when none. */
  activeSosPacketId: string | null;
  setActiveSosPacketId: (id: string | null) => void;
  /** Source sequence for the active SOS — incremented on each update. */
  sosSequence: number;
  incrementSosSequence: () => void;
  resetSosSequence: () => void;

  /** Last 50 engine diagnostic events for the Diagnostics screen. */
  diagnosticEvents: DiagnosticEntry[];
  addDiagnosticEvent: (event: Record<string, unknown>) => void;
  clearDiagnosticEvents: () => void;

  // Transport
  transportMode: TransportMode;
  setTransportMode: (m: TransportMode) => void;

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
      backendUrl: 'http://localhost:8787',
      setBackendUrl: (url) => set({ backendUrl: url }),
      internetState: 'untested',
      setInternetState: (s) => set({ internetState: s }),
      relayActive: false,
      setRelayActive: (v) => set({ relayActive: v }),
      relayState: 'stopped',
      setRelayState: (s) => set({ relayState: s, relayActive: s === 'active' || s === 'starting' }),
      peersRecentlySeen: 0,
      setPeersRecentlySeen: (n) =>
        set((state) => ({ peersRecentlySeen: typeof n === 'function' ? n(state.peersRecentlySeen) : n })),

      activeSosPacketId: null,
      setActiveSosPacketId: (id) => set({ activeSosPacketId: id }),
      sosSequence: 1,
      incrementSosSequence: () => set((s) => ({ sosSequence: s.sosSequence + 1 })),
      resetSosSequence: () => set({ sosSequence: 1 }),

      diagnosticEvents: [],
      addDiagnosticEvent: (event) =>
        set((state) => ({
          diagnosticEvents: [
            { id: `${Date.now()}-${Math.random()}`, atMs: Date.now(), ...event } as DiagnosticEntry,
            ...state.diagnosticEvents,
          ].slice(0, 50),
        })),
      clearDiagnosticEvents: () => set({ diagnosticEvents: [] }),

      // Transport
      transportMode: 'SIMULATED',
      setTransportMode: (m) => set({ transportMode: m }),

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
        backendUrl: state.backendUrl,
      }),
    },
  ),
);
