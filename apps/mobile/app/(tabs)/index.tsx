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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SOS_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);

export default function HomeScreen() {
  const router = useRouter();
  const {
    role,
    hasActiveSos,
    setHasActiveSos,
    relayActive,
    peersRecentlySeen,
    internetState,
  } = useAppStore();

  const ShieldIcon = icons.shield;
  const AlertIcon = icons.alert;

  const handleSendSos = () => {
    setHasActiveSos(true);
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
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 16 }}>
        <StatusChip label="RELAY" value={relayActive ? 'ON' : 'OFF'} color={relayActive ? '#a1d494' : '#AEAEB2'} />
        <StatusChip label="PEERS" value={String(peersRecentlySeen)} color="#a1d494" />
        <StatusChip label="NET" value={internetState === 'proven gateway' ? 'GW' : internetState.toUpperCase()} color={internetState === 'proven gateway' ? '#a1d494' : '#FFD60A'} />
      </View>

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
