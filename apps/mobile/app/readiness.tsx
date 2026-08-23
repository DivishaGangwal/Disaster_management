/**
 * READINESS & ROLE
 * PNG ref: screen (17)
 * Route: Readiness
 *
 * Wired to the real engine:
 * - Shows real CapabilityReport from adapter.getCapabilities()
 * - Correctly labels transport as SIMULATED (DEC-004 — never hide this)
 * - Permission rows now reflect real capability state, not just toggle state
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { useRuntime } from '@/src/contexts/RuntimeContext';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CapabilityReport } from '@dsm/contracts';

export default function ReadinessScreen() {
  const router = useRouter();
  const { runtime, initializing } = useRuntime();
  const {
    role, setRole,
    bluetoothEnabled, setBluetoothEnabled,
    locationEnabled, setLocationEnabled,
    microphoneEnabled, setMicrophoneEnabled,
    internetState,
    transportMode,
    offlinePackVersion,
    selectedRegion,
    setHasCompletedReadiness,
  } = useAppStore();

  const [capabilities, setCapabilities] = useState<CapabilityReport | null>(null);

  // Load capability report from the adapter once mounted.
  useEffect(() => {
    if (!runtime) return;
    runtime.adapter.getCapabilities().then(setCapabilities).catch(() => setCapabilities(null));
  }, [runtime]);

  const handleGoHome = () => {
    setHasCompletedReadiness(true);
    router.replace('/(tabs)');
  };

  const isSimulated = capabilities?.simulated ?? true;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
        <Text style={{ color: '#a1d494', fontSize: 22, fontWeight: '800', letterSpacing: 2 }}>TACTICAL.OS</Text>
        {isSimulated && (
          <View style={{ backgroundColor: '#FFD60A', paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: '#000000', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>SIMULATED</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={{ color: '#AEAEB2', fontSize: 13, marginBottom: 24 }}>Configure operating parameters.</Text>

        {/* Operational Role */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>OPERATIONAL ROLE</Text>
        <View style={{ height: 2, backgroundColor: '#3A3A3C', marginBottom: 16 }} />

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
          <RoleCard
            emoji="⊕"
            label="General Public"
            selected={role === 'general-public'}
            onPress={() => setRole('general-public')}
          />
          <RoleCard
            emoji="⊕"
            label="Responder"
            selected={role === 'responder'}
            onPress={() => setRole('responder')}
          />
        </View>

        {/* System Access — reflects real adapter capabilities */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>SYSTEM ACCESS</Text>
        <View style={{ height: 2, backgroundColor: '#3A3A3C', marginBottom: 16 }} />

        <PermissionRow
          icon="✦"
          label="Bluetooth"
          sublabel={
            isSimulated
              ? 'Simulated (DEC-004)'
              : capabilities?.bluetoothEnabled
              ? 'Hardware available'
              : 'Not available'
          }
          granted={isSimulated ? bluetoothEnabled : (capabilities?.bluetoothEnabled ?? false)}
          onToggle={(v) => {
            setBluetoothEnabled(v);
            if (isSimulated && v) {
              Alert.alert('Bluetooth', 'Simulated BLE active.\nReal radio requires an Expo development build (DEC-004).');
            }
          }}
        />

        <PermissionRow
          icon="◎"
          label="Location"
          sublabel="Expo Go — simulated"
          granted={locationEnabled}
          onToggle={(v) => {
            setLocationEnabled(v);
            if (v) Alert.alert('Location', 'Location is simulated in Expo Go.\nUse a dev build for real GPS.');
          }}
        />

        <PermissionRow
          icon="🎙"
          label="Microphone (Tier 2)"
          sublabel={
            capabilities?.audioInputAvailable
              ? 'Available'
              : 'Not available'
          }
          granted={microphoneEnabled}
          onToggle={(v) => {
            setMicrophoneEnabled(v);
            if (v) Alert.alert('Microphone', 'Microphone permissions managed by the OS.\nTier 2 (ggwave) works in dev builds.');
          }}
        />

        {/* Capability report block */}
        <View style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginTop: 24 }}>
          <View style={{ width: 4, backgroundColor: isSimulated ? '#FFD60A' : '#2D5A27' }} />
          <View style={{ flex: 1, padding: 16 }}>
            <StatusLine label="OFFLINE PACK" value={`${selectedRegion.toUpperCase()} V${offlinePackVersion}`} />
            <StatusLine
              label="INTERNET STATE"
              value={internetState.toUpperCase()}
              valueColor={internetState === 'proven gateway' ? '#a1d494' : internetState === 'probing' ? '#FFD60A' : '#AEAEB2'}
            />
            <StatusLine
              label="TRANSPORT MODE"
              value={isSimulated ? 'SIMULATED (not real Bluetooth)' : 'NATIVE BLE'}
              valueColor={isSimulated ? '#FFD60A' : '#a1d494'}
            />
            {initializing && (
              <StatusLine label="ENGINE" value="INITIALIZING…" valueColor="#FFD60A" />
            )}
            {!initializing && runtime && (
              <StatusLine label="ENGINE" value="READY" valueColor="#a1d494" />
            )}
            {capabilities && (
              <>
                <StatusLine
                  label="BLE ADVERTISE"
                  value={capabilities.bleAdvertiseSupported ? 'SUPPORTED' : 'NOT SUPPORTED'}
                  valueColor={capabilities.bleAdvertiseSupported ? '#a1d494' : '#AEAEB2'}
                />
                <StatusLine
                  label="GATT SERVER"
                  value={capabilities.gattServerSupported ? 'AVAILABLE' : 'UNAVAILABLE'}
                  valueColor={capabilities.gattServerSupported ? '#a1d494' : '#AEAEB2'}
                />
              </>
            )}
          </View>
        </View>

        {/* Go to Home */}
        <TouchableOpacity
          onPress={handleGoHome}
          disabled={initializing}
          style={{ backgroundColor: initializing ? '#1C1C1E' : '#2D5A27', paddingVertical: 18, alignItems: 'center', marginTop: 32, opacity: initializing ? 0.5 : 1 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>
            {initializing ? 'STARTING ENGINE…' : 'GO TO HOME'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function RoleCard({ emoji, label, selected, onPress }: { emoji: string; label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flex: 1, borderWidth: 2, borderColor: selected ? '#2D5A27' : '#3A3A3C', backgroundColor: selected ? '#111410' : '#000000', paddingVertical: 20, alignItems: 'center' }}
    >
      <Text style={{ color: selected ? '#a1d494' : '#AEAEB2', fontSize: 28, marginBottom: 8 }}>{emoji}</Text>
      <Text style={{ color: selected ? '#a1d494' : '#AEAEB2', fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function PermissionRow({ icon, label, sublabel, granted, onToggle }: { icon: string; label: string; sublabel: string; granted: boolean; onToggle: (v: boolean) => void }) {
  return (
    <View style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: '#AEAEB2', fontSize: 20, marginRight: 16 }}>{icon}</Text>
        <View>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>{label}</Text>
          <Text style={{ color: '#AEAEB2', fontSize: 11, marginTop: 2 }}>{sublabel}</Text>
          <Text style={{ color: granted ? '#a1d494' : '#FF453A', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 }}>
            {granted ? 'GRANTED' : 'DENIED'}
          </Text>
        </View>
      </View>
      <Switch
        value={granted}
        onValueChange={onToggle}
        trackColor={{ false: '#3A3A3C', true: '#2D5A27' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function StatusLine({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color: valueColor ?? '#FFFFFF', fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 8 }}>{value}</Text>
    </View>
  );
}
