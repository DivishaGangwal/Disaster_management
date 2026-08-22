/**
 * READINESS & ROLE
 * PNG ref: screen (17)
 * Route: Readiness
 *
 * Per newmd:
 * - Select Role: General Public / Responder → local config
 * - Enable Bluetooth / Location / Microphone → OS permission API
 * - Go to Home → navigation
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mobileController } from '@/src/services/mobile-controller';

export default function ReadinessScreen() {
  const router = useRouter();
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

  const handleGoHome = () => {
    setHasCompletedReadiness(true);
    router.replace('/(tabs)');
  };

  const chooseRole = (nextRole: 'general-public' | 'responder') => {
    setRole(nextRole);
    void mobileController.reconfigureRole(nextRole).catch((reason: unknown) => Alert.alert('Runtime setup failed', reason instanceof Error ? reason.message : String(reason)));
  };

  const requestSystemAccess = async () => {
    try { await mobileController.requestPermissions(); }
    catch (reason) { Alert.alert('Permission request failed', reason instanceof Error ? reason.message : String(reason)); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
        <Text style={{ color: '#a1d494', fontSize: 22, fontWeight: '800', letterSpacing: 2 }}>TACTICAL.OS</Text>
        <Text style={{ color: '#AEAEB2', fontSize: 22 }}>⊙</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={{ color: '#AEAEB2', fontSize: 13, marginBottom: 24 }}>Configure operating parameters.</Text>

        {/* Operational Role */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>OPERATIONAL ROLE</Text>
        <View style={{ height: 2, backgroundColor: '#3A3A3C', marginBottom: 16 }} />

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
          {/* General Public */}
          <TouchableOpacity
            onPress={() => chooseRole('general-public')}
            style={{
              flex: 1,
              borderWidth: 2,
              borderColor: role === 'general-public' ? '#2D5A27' : '#3A3A3C',
              backgroundColor: role === 'general-public' ? '#111410' : '#000000',
              paddingVertical: 20,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: role === 'general-public' ? '#a1d494' : '#AEAEB2', fontSize: 28, marginBottom: 8 }}>⊕</Text>
            <Text style={{ color: role === 'general-public' ? '#a1d494' : '#AEAEB2', fontSize: 14, fontWeight: '600' }}>General Public</Text>
          </TouchableOpacity>

          {/* Responder */}
          <TouchableOpacity
            onPress={() => chooseRole('responder')}
            style={{
              flex: 1,
              borderWidth: 2,
              borderColor: role === 'responder' ? '#2D5A27' : '#3A3A3C',
              backgroundColor: role === 'responder' ? '#111410' : '#000000',
              paddingVertical: 20,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: role === 'responder' ? '#a1d494' : '#AEAEB2', fontSize: 28, marginBottom: 8 }}>⊕</Text>
            <Text style={{ color: role === 'responder' ? '#a1d494' : '#AEAEB2', fontSize: 14, fontWeight: '600' }}>Responder</Text>
          </TouchableOpacity>
        </View>

        {/* System Access */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>SYSTEM ACCESS</Text>
        <View style={{ height: 2, backgroundColor: '#3A3A3C', marginBottom: 16 }} />

        {/* Bluetooth */}
        <PermissionRow
          icon="✦"
          label="Bluetooth"
          granted={bluetoothEnabled}
          onToggle={(v) => { if (v) void requestSystemAccess(); else Alert.alert('Bluetooth access', 'Android permissions can be changed in system settings.'); }}
        />

        {/* Location */}
        <PermissionRow
          icon="◎"
          label="Location"
          granted={locationEnabled}
          onToggle={(v) => { if (v) void requestSystemAccess(); else Alert.alert('Location access', 'Android permissions can be changed in system settings.'); }}
        />

        {/* Microphone */}
        <PermissionRow
          icon="🎙"
          label="Microphone"
          granted={microphoneEnabled}
          onToggle={(v) => { if (v) void requestSystemAccess(); else Alert.alert('Microphone access', 'Android permissions can be changed in system settings.'); }}
        />

        {/* Status info block with green left bar */}
        <View style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginTop: 24 }}>
          <View style={{ width: 4, backgroundColor: '#2D5A27' }} />
          <View style={{ flex: 1, padding: 16 }}>
            <StatusLine label="OFFLINE PACK" value={`${selectedRegion.toUpperCase()} V${offlinePackVersion}`} />
            <StatusLine label="INTERNET STATE" value={internetState.toUpperCase()} valueColor={internetState === 'probing' ? '#FFD60A' : internetState === 'proven gateway' ? '#a1d494' : '#AEAEB2'} />
            <StatusLine label="TRANSPORT MODE" value={transportMode} />
          </View>
        </View>

        {/* Go to Home button */}
        <TouchableOpacity
          onPress={handleGoHome}
          style={{ backgroundColor: '#2D5A27', paddingVertical: 18, alignItems: 'center', marginTop: 32 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>GO TO HOME</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PermissionRow({ icon, label, granted, onToggle }: { icon: string; label: string; granted: boolean; onToggle: (v: boolean) => void }) {
  return (
    <View style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: '#AEAEB2', fontSize: 20, marginRight: 16 }}>{icon}</Text>
        <View>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>{label}</Text>
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
      <Text style={{ color: valueColor ?? '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
