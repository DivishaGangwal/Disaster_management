/**
 * RELAY & GATEWAY STATUS
 * PNG ref: screen (18)
 * Route: RelayStatus
 *
 * Wired to the real engine:
 * - Start Relay → appRuntime.startRelay() → RelayLoop.start()
 * - Stop Relay  → appRuntime.stopRelay()  → RelayLoop.stop()
 * - Probe Gateway → appRuntime.probeGateway() → GatewaySynchronizer.sync()
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { useRuntime } from '@/src/contexts/RuntimeContext';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RelayScreen() {
  const router = useRouter();
  const { runtime } = useRuntime();
  const {
    relayActive,
    relayState,
    internetState,
    setInternetState,
    peersRecentlySeen,
  } = useAppStore();

  const [probing, setProbing] = useState(false);
  const [togglingRelay, setTogglingRelay] = useState(false);
  const [queueStats, setQueueStats] = useState({ stored: 0, queued: 0, forwarded: 0 });

  const ShieldIcon = icons.shield;
  const ArrowLeftIcon = icons.arrowLeft;

  // Poll engine queue stats every 2 s when relay is active.
  useEffect(() => {
    if (!runtime || !relayActive) return;
    const tick = async () => {
      const count = await runtime.engine.packets.count();
      const relayable = (await runtime.engine.packets.listRelayable(256)).length;
      setQueueStats((prev) => ({
        stored: count,
        queued: relayable,
        forwarded: prev.forwarded,
      }));
    };
    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => clearInterval(id);
  }, [runtime, relayActive]);

  const handleToggleRelay = async (value: boolean) => {
    if (!runtime || togglingRelay) return;
    setTogglingRelay(true);
    try {
      if (value) {
        await runtime.startRelay();
      } else {
        await runtime.stopRelay();
      }
    } finally {
      setTogglingRelay(false);
    }
  };

  const handleProbe = async () => {
    if (!runtime || probing) return;
    setProbing(true);
    setInternetState('probing');
    try {
      const proven = await runtime.probeGateway();
      setInternetState(proven ? 'proven gateway' : 'unavailable');
    } catch {
      setInternetState('unavailable');
    } finally {
      setProbing(false);
    }
  };

  const relayStateLabel: Record<string, string> = {
    stopped: 'STOPPED',
    starting: 'STARTING…',
    active: 'ACTIVE',
    'backing-off': 'BACKING OFF',
    'battery-limited': 'BATTERY LIMITED',
    'permission-required': 'PERMISSION REQUIRED',
    error: 'ERROR',
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
            <View>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>RELAY ACTIVE</Text>
              <Text style={{ color: relayActive ? '#a1d494' : '#AEAEB2', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                {relayStateLabel[relayState] ?? relayState.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {togglingRelay && <ActivityIndicator size="small" color="#a1d494" style={{ marginRight: 8 }} />}
            <Switch
              value={relayActive}
              onValueChange={handleToggleRelay}
              disabled={togglingRelay}
              trackColor={{ false: '#3A3A3C', true: '#2D5A27' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Peers nearby */}
        <View style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#AEAEB2', fontSize: 18, marginRight: 12 }}>👥</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>PEERS NEARBY</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginRight: 8 }}>{peersRecentlySeen} PEERS</Text>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: peersRecentlySeen > 0 ? '#a1d494' : '#3A3A3C' }} />
          </View>
        </View>

        {/* Internet / Gateway state */}
        <View style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 24 }}>
          <View style={{ width: 4, backgroundColor: internetState === 'proven gateway' ? '#a1d494' : '#FFD60A' }} />
          <View style={{ flex: 1, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#AEAEB2', fontSize: 18, marginRight: 12 }}>🌐</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>INTERNET/GATEWAY{'\n'}STATE</Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: internetState === 'proven gateway' ? '#a1d494' : '#FFD60A', paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}>
              {probing && <ActivityIndicator size="small" color="#FFD60A" style={{ marginRight: 6 }} />}
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: internetState === 'proven gateway' ? '#a1d494' : '#FFD60A', marginRight: 6 }} />
              <Text style={{ color: internetState === 'proven gateway' ? '#a1d494' : '#FFD60A', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
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
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>{queueStats.stored}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#3A3A3C' }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>RELAYABLE</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>{queueStats.queued}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#3A3A3C' }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>PEERS</Text>
              <Text style={{ color: '#a1d494', fontSize: 28, fontWeight: '700' }}>{peersRecentlySeen}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom buttons */}
      <View style={{ flexDirection: 'row', padding: 20, gap: 8, backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#3A3A3C' }}>
        <TouchableOpacity
          onPress={() => handleToggleRelay(!relayActive)}
          disabled={togglingRelay}
          style={{ flex: 1, backgroundColor: relayActive ? '#8B1A1A' : '#2C2C2E', paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1, borderColor: '#3A3A3C' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18, marginRight: 8 }}>{relayActive ? '◼' : '⟳'}</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>
            {relayActive ? 'STOP RELAY' : 'START RELAY'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleProbe}
          disabled={probing}
          style={{ flex: 1, backgroundColor: '#2D5A27', paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
        >
          {probing ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 18, marginRight: 8 }}>◎</Text>
          )}
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>PROBE GATEWAY</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
