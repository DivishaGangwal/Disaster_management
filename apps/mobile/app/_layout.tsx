import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useEffect } from 'react';
import { mobileController } from '@/src/services/mobile-controller';
import { useAppStore } from '@/store/useAppStore';

/**
 * Root layout. Pure black background, light status bar.
 * All screens inherit this layout.
 *
 * Tab screens: Home, Map, Nearby, Profile (consistent nav bar)
 * Stack screens: Readiness, SOS Composer, Active SOS, Responder Detail,
 *                Resource Detail, Relay, Tier 2, Diagnostics
 */
export default function RootLayout() {
  const role = useAppStore((state) => state.role);
  const setRuntimeError = useAppStore((state) => state.setRuntimeError);
  useEffect(() => {
    void mobileController.initialize(role).catch((reason: unknown) => setRuntimeError(reason instanceof Error ? reason.message : String(reason)));
  }, [role, setRuntimeError]);
  return (
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
  );
}
