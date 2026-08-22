/**
 * RELAY & GATEWAY STATUS
 * PNG ref: screen (18)
 * Route: RelayStatus
 *
 * Per newmd:
 * - Start Relay → appRuntime.startRelay() → RelayLoop.start()
 * - Stop Relay → appRuntime.stopRelay() → RelayLoop.stop()
 * - Probe Gateway → appRuntime.probeGateway() → GatewaySynchronizer.sync()
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mobileController } from '@/src/services/mobile-controller';

export default function RelayScreen() {
  const router = useRouter();
  const {
    relayActive,
    setRelayActive,
    internetState,
    setInternetState,
    peersRecentlySeen,
    storedPackets,
    selectedRadio,
    batteryPercent,
    batteryTemperatureC,
    thermalState,
  } = useAppStore();

  const ShieldIcon = icons.shield;
  const ArrowLeftIcon = icons.arrowLeft;

  const handleProbe = async () => {
    try { await mobileController.probeGateway(); }
    catch { setInternetState('unavailable'); }
  };

  const handleRelay = async (active: boolean) => {
    try { await mobileController.setRelay(active); }
    catch { setRelayActive(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D5A27' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ArrowLeftIcon size={20} color="#a1d494" />
        </TouchableOpacity>
        <ShieldIcon size={20} color="#a1d494" />
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2, marginLeft: 8 }}>GUARDIAN</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 24 }}>RELAY & GATEWAY{'\n'}STATUS</Text>

        {/* Relay Active row */}
        <View style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#AEAEB2', fontSize: 18, marginRight: 12 }}>📡</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>RELAY ACTIVE</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: relayActive ? '#a1d494' : '#AEAEB2', fontSize: 13, fontWeight: '700', marginRight: 8 }}>
              {relayActive ? 'ON' : 'OFF'}
            </Text>
            <Switch
              value={relayActive}
              onValueChange={(value) => void handleRelay(value)}
              trackColor={{ false: '#3A3A3C', true: '#2D5A27' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 16, marginBottom: 24 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>DEVICE RELAY CONDITIONS</Text>
          <Text style={{ color: '#FFFFFF' }}>{selectedRadio} · Battery {batteryPercent === undefined ? 'unknown' : `${batteryPercent}%`} · Temperature {batteryTemperatureC === undefined ? 'unavailable' : `${batteryTemperatureC.toFixed(1)}°C`} · Thermal {thermalState}</Text>
        </View>

        {/* Peers nearby */}
        <View style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#AEAEB2', fontSize: 18, marginRight: 12 }}>👥</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>PEERS NEARBY</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginRight: 8 }}>{peersRecentlySeen} PEERS</Text>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#a1d494' }} />
          </View>
        </View>

        {/* Internet / Gateway state with yellow left bar */}
        <View style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 24 }}>
          <View style={{ width: 4, backgroundColor: '#FFD60A' }} />
          <View style={{ flex: 1, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#AEAEB2', fontSize: 18, marginRight: 12 }}>🌐</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>INTERNET/GATEWAY{'\n'}STATE</Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: '#FFD60A', paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD60A', marginRight: 6 }} />
              <Text style={{ color: '#FFD60A', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                {internetState.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Queue summary */}
        <View style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 16, marginBottom: 24 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>QUEUE SUMMARY</Text>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>STORED</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>{storedPackets}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#3A3A3C' }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>QUEUED</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>—</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#3A3A3C' }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>FWD</Text>
              <Text style={{ color: '#a1d494', fontSize: 28, fontWeight: '700' }}>—</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom buttons */}
      <View style={{ flexDirection: 'row', padding: 20, gap: 8, backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#3A3A3C' }}>
        <TouchableOpacity
          onPress={() => void handleRelay(!relayActive)}
          style={{ flex: 1, backgroundColor: '#2C2C2E', paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1, borderColor: '#3A3A3C' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18, marginRight: 8 }}>⟳</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>{relayActive ? 'STOP RELAY' : 'START RELAY'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void handleProbe()}
          style={{ flex: 1, backgroundColor: '#2D5A27', paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18, marginRight: 8 }}>◎</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>PROBE GATEWAY</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
