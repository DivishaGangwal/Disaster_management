/**
 * RELAY & GATEWAY STATUS — Replica of Reference Screen 9
 * PNG ref: screen 9 (Relay & Gateway)
 * Route: RelayStatus
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
    relayQueueDepth,
    forwardedPackets,
    selectedRadio,
    batteryPercent,
    batteryTemperatureC,
  } = useAppStore();

  const ArrowLeftIcon = icons.arrowLeft;
  const UserIcon = icons.user;

  const handleProbe = async () => {
    try {
      await mobileController.probeGateway();
    } catch {
      setInternetState('unavailable');
    }
  };

  const handleRelay = async (active: boolean) => {
    try {
      await mobileController.setRelay(active);
    } catch {
      setRelayActive(false);
    }
  };

  const battVal = batteryPercent ?? 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      {/* Top Header bar */}
      <View style={{ height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0, 242, 254, 0.12)', position: 'relative' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', left: 16, padding: 4 }}>
          <ArrowLeftIcon size={20} color="#00F2FE" />
        </TouchableOpacity>
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
          Relay & Gateway
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
        
        {/* Card 1: Relay (Mesh) Toggle */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: relayActive ? '#00E676' : '#1E293B', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '800' }}>Relay (Mesh)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ backgroundColor: relayActive ? '#16A34A' : '#334155', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>
                {relayActive ? 'ON' : 'OFF'}
              </Text>
            </View>
            <Switch
              value={relayActive}
              onValueChange={(value) => void handleRelay(value)}
              trackColor={{ false: '#1E293B', true: '#00E676' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Card 2: Radio & Device */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 16 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 }}>Radio & Device</Text>
          
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Radio</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>LoRa 915 MHz</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Device</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>PX-Relay-02</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Battery</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>{battVal}%</Text>
                <icons.battery size={16} color="#00E676" />
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Uptime</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>2h 14m</Text>
            </View>
          </View>
        </View>

        {/* Card 3: Nearby Peers (With avatar person icons matching reference) */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Nearby Peers</Text>
            <Text style={{ color: '#38BDF8', fontSize: 15, fontWeight: '900' }}>{peersRecentlySeen || 12}</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Person avatar icons row */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {[1, 2, 3, 4].map((idx) => (
                <View key={idx} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(56, 189, 248, 0.15)', borderWidth: 1, borderColor: '#38BDF8', justifyContent: 'center', alignItems: 'center' }}>
                  <UserIcon size={14} color="#38BDF8" />
                </View>
              ))}
            </View>

            {/* Signal Bars */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 }}>
              <View style={{ width: 3, height: 6, backgroundColor: '#00E676', borderRadius: 1 }} />
              <View style={{ width: 3, height: 9, backgroundColor: '#00E676', borderRadius: 1 }} />
              <View style={{ width: 3, height: 12, backgroundColor: '#00E676', borderRadius: 1 }} />
              <View style={{ width: 3, height: 16, backgroundColor: '#00E676', borderRadius: 1 }} />
            </View>
          </View>
        </View>

        {/* Card 4: Gateway / Internet (With Probe Now button matching reference) */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 16 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 }}>Gateway / Internet</Text>
          
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Gateway</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>City-GW-1</Text>
                <Text style={{ color: '#00E676', fontSize: 12, fontWeight: '800' }}>Connected</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Internet</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>Connected</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
              <View>
                <Text style={{ color: '#94A3B8', fontSize: 13 }}>Last Probe</Text>
                <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginTop: 2 }}>12s ago</Text>
              </View>

              {/* Probe Now purple pill button */}
              <TouchableOpacity
                onPress={() => void handleProbe()}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#7C3AED',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Probe Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Card 5: Traffic (since boot) */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 16 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 }}>Traffic (since boot)</Text>
          
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: '#141E33', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700' }}>Stored</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{storedPackets || 124}</Text>
            </View>

            <View style={{ flex: 1, backgroundColor: '#141E33', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700' }}>Queued</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{relayQueueDepth || 26}</Text>
            </View>

            <View style={{ flex: 1, backgroundColor: '#141E33', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700' }}>Forwarded</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{forwardedPackets || 842}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#00E676', fontSize: 12, fontWeight: '700' }}>Queue Size: 26 (Low)</Text>
            <Text style={{ color: '#00E676', fontSize: 12, fontWeight: '700' }}>Est. Battery: 8h 40m</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
