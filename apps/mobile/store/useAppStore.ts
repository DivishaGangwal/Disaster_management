import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'general-public' | 'responder';
export type InternetState = 'untested' | 'unavailable' | 'probing' | 'proven gateway';
export type TransportMode = 'SIMULATED' | 'native';

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
