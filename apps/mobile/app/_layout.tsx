import '../metro-shims/crypto-polyfill';
import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, View } from 'react-native';
import { useEffect } from 'react';
import { mobileController } from '@/src/services/mobile-controller';
import { useAppStore } from '@/store/useAppStore';

/**
 * Root layout. Pure black background, light status bar.
 * All screens inherit this layout.
 */
export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const role = useAppStore((state) => state.role);
  const isLoggedIn = useAppStore((state) => state.isLoggedIn);
  const hasCompletedReadiness = useAppStore((state) => state.hasCompletedReadiness);
  const setRuntimeError = useAppStore((state) => state.setRuntimeError);

  useEffect(() => {
    if (!isLoggedIn) return;
    void mobileController.initialize(role).catch((reason: unknown) => setRuntimeError(reason instanceof Error ? reason.message : String(reason)));
  }, [isLoggedIn, role, setRuntimeError]);

  useEffect(() => {
    if (isLoggedIn) void mobileController.startGatewaySync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isLoggedIn) {
        void mobileController.refreshPermissionStatus().catch((reason: unknown) => setRuntimeError(reason instanceof Error ? reason.message : String(reason)));
        void mobileController.startGatewaySync();
      }
      else mobileController.stopGatewaySync();
    });
    return () => {
      subscription.remove();
      mobileController.stopGatewaySync();
    };
  }, [isLoggedIn, setRuntimeError]);

  // Entry flow navigation guard
  useEffect(() => {
    const currentSegment = segments[0] as string | undefined;
    const timeout = setTimeout(() => {
      if (!isLoggedIn && currentSegment !== 'login') {
        router.replace('/login');
      } else if (isLoggedIn && !hasCompletedReadiness && currentSegment !== 'readiness') {
        router.replace('/readiness');
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, [isLoggedIn, hasCompletedReadiness, segments, router]);

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
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
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
