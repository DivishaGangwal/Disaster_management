/**
 * HOME SCREEN — General Public Landing Screen
 * PNG ref: screen 2 (Home) - Style 4 Futuristic Emergency Tech
 * Route: Home (tab index)
 */

import React from 'react';
import { View, Text, TouchableOpacity, Dimensions, Alert, ScrollView } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mobileController } from '@/src/services/mobile-controller';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SOS_SIZE = Math.min(SCREEN_WIDTH * 0.62, 250);

export default function HomeScreen() {
  const router = useRouter();
  const {
    role,
    isLoggedIn,
    hasCompletedReadiness,
    relayActive,
    peersRecentlySeen,
    internetState,
    batteryPercent,
    batteryTemperatureC,
    thermalState,
    selectedRadio,
  } = useAppStore();

  const ChevronRightIcon = icons.chevronDown;

  if (!isLoggedIn) {
    return <Redirect href="/login" />;
  }

  if (!hasCompletedReadiness) {
    return <Redirect href="/readiness" />;
  }

  if (role === 'responder') {
    return <Redirect href="/(tabs)/nearby" />;
  }

  const handleSendSos = async () => {
    try {
      await mobileController.sendRapidSos();
      Alert.alert('SOS Triggered', 'Rapid SOS signal broadcasted to nearby peers & gateway.');
    } catch (reason) {
      Alert.alert('SOS failed', reason instanceof Error ? reason.message : String(reason));
    }
  };

  const battVal = batteryPercent ?? 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      {/* Header bar */}
      <View style={{ height: 52, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0, 242, 254, 0.12)' }}>
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '900', letterSpacing: 1 }}>
          Home
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, alignItems: 'center' }}>
        
        {/* Center Giant SOS Button */}
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          {/* Outer glowing halo ring */}
          <View
            style={{
              width: SOS_SIZE + 40,
              height: SOS_SIZE + 40,
              borderRadius: (SOS_SIZE + 40) / 2,
              backgroundColor: 'rgba(255, 0, 85, 0.06)',
              borderWidth: 1.5,
              borderColor: 'rgba(255, 0, 85, 0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {/* Middle glow ring */}
            <View
              style={{
                width: SOS_SIZE + 18,
                height: SOS_SIZE + 18,
                borderRadius: (SOS_SIZE + 18) / 2,
                backgroundColor: 'rgba(255, 0, 85, 0.12)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {/* Main SOS Circle */}
              <TouchableOpacity
                onPress={handleSendSos}
                activeOpacity={0.75}
                style={{
                  width: SOS_SIZE,
                  height: SOS_SIZE,
                  borderRadius: SOS_SIZE / 2,
                  backgroundColor: '#E11D48',
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#FF0055',
                  shadowOpacity: 0.6,
                  shadowRadius: 24,
                  elevation: 12,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 48, fontWeight: '900', letterSpacing: -1 }}>
                  SOS
                </Text>
                <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 4 }}>
                  TAP FOR HELP
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Detailed SOS Options Button */}
          <TouchableOpacity
            onPress={() => router.push('/sos/composer')}
            activeOpacity={0.8}
            style={{
              marginTop: 18,
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: '#0D1424',
              borderWidth: 1,
              borderColor: 'rgba(0, 242, 254, 0.3)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>
              Detailed SOS Options
            </Text>
            <Text style={{ color: '#00F2FE', fontSize: 14, fontWeight: '900' }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 4 Status Boxes Row (Matching reference home.jpeg) */}
        <View style={{ width: '100%', flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {/* Box 1: Relay Status */}
          <View style={{ flex: 1, backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }}>
            <Text style={{ color: '#00E676', fontSize: 11, fontWeight: '700' }}>Relay</Text>
            <Text style={{ color: relayActive ? '#00E676' : '#94A3B8', fontSize: 14, fontWeight: '900', marginTop: 2 }}>
              {relayActive ? 'Online' : 'Offline'}
            </Text>
          </View>

          {/* Box 2: Radio Status */}
          <View style={{ flex: 1, backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }}>
            <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '700' }}>Radio</Text>
            <Text style={{ color: '#38BDF8', fontSize: 14, fontWeight: '900', marginTop: 2 }}>
              {selectedRadio === 'simulated' ? 'LoRa' : selectedRadio}
            </Text>
          </View>

          {/* Box 3: Peers Count */}
          <View style={{ flex: 1, backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }}>
            <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '700' }}>Peers</Text>
            <Text style={{ color: '#38BDF8', fontSize: 16, fontWeight: '900', marginTop: 2 }}>
              {peersRecentlySeen ?? 0}
            </Text>
          </View>

          {/* Box 4: Battery & Thermal combined */}
          <View style={{ flex: 1, backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }}>
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700' }}>Battery</Text>
            <Text style={{ color: battVal < 20 ? '#FFB300' : '#EAB308', fontSize: 16, fontWeight: '900', marginTop: 2 }}>
              {battVal}%
            </Text>
          </View>
        </View>

        {/* Network Health Card */}
        <View style={{ width: '100%', backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Network Health</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '700' }}>{peersRecentlySeen ?? 0} Peers</Text>
              <Text style={{ color: relayActive ? '#00E676' : '#FFB300', fontSize: 14, fontWeight: '900' }}>
                {relayActive ? 'Active' : 'Standby'}
              </Text>
            </View>
          </View>

          {/* Waveform indicator */}
          <View style={{ height: 2, backgroundColor: '#00E676', width: '100%', opacity: 0.8, borderRadius: 1, marginVertical: 6 }} />

          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600' }}>
            Local Mesh Good · Internet via Gateway
          </Text>
        </View>

        {/* WavePX / Tier-2 Card */}
        <TouchableOpacity
          onPress={() => router.push('/tier2')}
          activeOpacity={0.8}
          style={{
            width: '100%',
            backgroundColor: '#0D1424',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#1E293B',
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0, 242, 254, 0.15)', borderWidth: 1, borderColor: '#00F2FE', justifyContent: 'center', alignItems: 'center' }}>
              <icons.mic size={18} color="#00F2FE" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>
                WavePX / Tier-2
              </Text>
              <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                Listening · Campaign: DRILL-2025
              </Text>
            </View>
          </View>

          <View style={{ backgroundColor: 'rgba(0, 242, 254, 0.1)', borderWidth: 1, borderColor: '#00F2FE', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 }}>
            <Text style={{ color: '#00F2FE', fontSize: 12, fontWeight: '800' }}>View</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
