// Polyfill globalThis.crypto.getRandomValues for Hermes on older Expo Go.
// MUST run before any @dsm/codec call (newPacketId, newSourceId, newNodeToken).
if (typeof globalThis.crypto === 'undefined' || typeof (globalThis.crypto as Crypto).getRandomValues !== 'function') {
  (globalThis as Record<string, unknown>).crypto = {
    getRandomValues: <T extends ArrayBufferView>(buf: T): T => {
      const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      for (let i = 0; i < u8.length; i++) {
        u8[i] = Math.floor(Math.random() * 256);
      }
      return buf;
    },
  };
}

import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { RuntimeProvider } from '../src/contexts/RuntimeContext';
import { useAppStore } from '../store/useAppStore';

/**
 * Root layout. Pure black background, light status bar.
 * RuntimeProvider starts AppRuntime (simulated adapter) at app boot.
 *
 * Tab screens: Home, Map, Nearby, Profile (consistent nav bar)
 * Stack screens: Readiness, SOS Composer, Active SOS, Responder Detail,
 *                Resource Detail, Relay, Tier 2, Diagnostics
 */
export default function RootLayout() {
  const backendUrl = useAppStore((state) => state.backendUrl);
  return (
    <RuntimeProvider backendBaseUrl={backendUrl}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <StatusBar style="light" backgroundColor="#000000" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#000000' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="readiness" options={{ animation: 'fade' }} />
          <Stack.Screen name="sos/composer" options={{ presentation: 'modal' }} />
          <Stack.Screen name="sos/active" />
          <Stack.Screen name="responder/detail" />
          <Stack.Screen name="resource/detail" />
          <Stack.Screen name="relay" />
          <Stack.Screen name="tier2" />
          <Stack.Screen name="diagnostics" />
        </Stack>
      </View>
    </RuntimeProvider>
  );
}
