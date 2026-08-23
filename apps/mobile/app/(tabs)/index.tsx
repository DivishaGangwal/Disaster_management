/**
 * HOME SCREEN — Giant SOS Button
 * PNG ref: screen (20)
 * Route: Home (tab index)
 *
 * Per AGENT.md + newmd:
 * - 🔴 SEND SOS (large, primary) → buildSosCreate() → engine.createLocal()
 * - Add More Details → Navigation → SosComposer
 * - View Active SOS → Navigation → ActiveSos
 * - Open Map → Navigation → Map
 */

import React from 'react';
import { View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mobileController } from '@/src/services/mobile-controller';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SOS_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);

export default function HomeScreen() {
  const router = useRouter();
  const {
    role,
    hasActiveSos,
    relayActive,
    peersRecentlySeen,
    internetState,
    batteryPercent,
    batteryTemperatureC,
    thermalState,
    selectedRadio,
  } = useAppStore();

  const ShieldIcon = icons.shield;
  const AlertIcon = icons.alert;

  const handleSendSos = async () => {
    try {
      await mobileController.sendRapidSos();
      router.push('/sos/active');
    } catch (reason) {
      Alert.alert('SOS not saved', reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D5A27' }}>
        <ShieldIcon size={24} color="#a1d494" />
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2, marginLeft: 8 }}>
          GUARDIAN
        </Text>
        {hasActiveSos && (
          <TouchableOpacity
            onPress={() => router.push('/sos/active')}
            style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' }}
          >
            <AlertIcon size={18} color="#FF3B30" />
            <Text style={{ color: '#FF3B30', fontSize: 12, fontWeight: '700', marginLeft: 4, letterSpacing: 0.5 }}>
              ACTIVE
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status strip */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, paddingVertical: 10, gap: 16 }}>
        <StatusChip label="RELAY" value={relayActive ? 'ON' : 'OFF'} color={relayActive ? '#a1d494' : '#AEAEB2'} />
        <StatusChip label="LINK" value={`${selectedRadio} · ${peersRecentlySeen}`} color={relayActive ? '#a1d494' : '#AEAEB2'} />
        <StatusChip label="BATTERY" value={batteryPercent === undefined ? '—' : `${batteryPercent}%`} color={batteryPercent !== undefined && batteryPercent < 20 ? '#FFD60A' : '#a1d494'} />
        <StatusChip label="TEMP" value={batteryTemperatureC === undefined ? '—' : `${batteryTemperatureC.toFixed(1)}°C`} color="#a1d494" />
        <StatusChip label="THERMAL" value={thermalState.toUpperCase()} color={thermalState === 'limited' ? '#FFD60A' : '#a1d494'} />
        <StatusChip label="NET" value={internetState === 'proven gateway' ? 'GW' : internetState.toUpperCase()} color={internetState === 'proven gateway' ? '#a1d494' : '#FFD60A'} />
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open WavePX packet receiver"
        onPress={() => router.push('/tier2')}
        style={{ minHeight: 48, marginHorizontal: 20, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#101410', borderWidth: 1, borderColor: '#2D5A27' }}
      >
        <View><Text style={{ color: '#a1d494', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>WAVEPX PACKETS</Text><Text style={{ color: '#8F9991', fontSize: 11, marginTop: 3 }}>Listen, decode, and verify map changes</Text></View>
        <Text style={{ color: '#a1d494', fontSize: 20 }}>›</Text>
      </TouchableOpacity>

      {/* SOS Button — centered, with action buttons below */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {/* The giant SOS circle */}
        <TouchableOpacity
          onPress={handleSendSos}
          activeOpacity={0.8}
          style={{
            width: SOS_SIZE,
            height: SOS_SIZE,
            borderRadius: SOS_SIZE / 2,
            backgroundColor: '#FF3B30',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 48, fontWeight: '800', letterSpacing: -2 }}>
            SOS
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', letterSpacing: 1, marginTop: 4 }}>
            SEND ALERT
          </Text>
        </TouchableOpacity>

        {/* Quick action buttons BELOW the SOS circle */}
        {hasActiveSos && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 32 }}>
            <TouchableOpacity
              onPress={() => router.push('/sos/composer')}
              style={{ backgroundColor: '#1C1C1E', paddingHorizontal: 20, paddingVertical: 14, borderWidth: 1, borderColor: '#3A3A3C' }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>
                ADD DETAILS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/sos/active')}
              style={{ backgroundColor: '#1C1C1E', paddingHorizontal: 20, paddingVertical: 14, borderWidth: 1, borderColor: '#FF3B30' }}
            >
              <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>
                VIEW SOS
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function StatusChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
        {value}
      </Text>
    </View>
  );
}
