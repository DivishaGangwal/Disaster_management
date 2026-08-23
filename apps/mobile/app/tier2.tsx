/**
 * TIER 2 LISTENING (Radio Broadcast Receiver)
 * PNG ref: screen (14)
 * Route: Tier2Listen
 *
 * Wired to the real engine:
 * - Shows recent diagnostic events that arrived via 'tier2' transport
 * - Polls engine.events.recent() every 2 s
 * - When no real Tier2 events exist (simulated mode) shows an honest
 *   "Simulated — no ggwave in Expo Go" notice (DEC-004)
 *
 * NOTE: Real Tier2 audio requires ggwave + microphone in an Expo dev build.
 * The simulated adapter never emits tier2 transport events.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useRuntime } from '@/src/contexts/RuntimeContext';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DiagnosticEvent } from '@dsm/contracts';

export default function Tier2ListenScreen() {
  const router = useRouter();
  const { runtime } = useRuntime();
  const [tier2Events, setTier2Events] = useState<DiagnosticEvent[]>([]);
  const [allPackets, setAllPackets] = useState(0);

  const ArrowLeftIcon = icons.arrowLeft;

  // Poll engine events for tier2 transport entries every 2 s.
  useEffect(() => {
    if (!runtime) return;
    const tick = () => {
      const recent = runtime.engine.events.recent(100);
      // Filter: only accepted packets that arrived via tier2 transport.
      const t2 = recent.filter(
        (ev) =>
          (ev as unknown as Record<string, unknown>)['transport'] === 'tier2' ||
          (ev.name === 'accepted' && (ev as unknown as Record<string, unknown>)['transport'] === 'tier2'),
      );
      setTier2Events([...t2]);
      void runtime.engine.packets.count().then(setAllPackets);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [runtime]);

  const isSimulated = !runtime || tier2Events.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeftIcon size={20} color="#a1d494" />
        </TouchableOpacity>
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2 }}>Listening Mode</Text>
        <Text style={{ color: '#AEAEB2', fontSize: 22 }}>⚙</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Antenna graphic */}
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: isSimulated ? '#3A3A3C' : '#2D5A27', backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: isSimulated ? '#3A3A3C' : '#a1d494', fontSize: 48 }}>((•))</Text>
          </View>
          <Text style={{ color: isSimulated ? '#3A3A3C' : '#a1d494', fontSize: 13, fontWeight: '700', letterSpacing: 2, marginTop: 16 }}>
            {isSimulated ? 'SIMULATED MODE' : 'SCANNING T2 FREQUENCIES'}
          </Text>
        </View>

        {/* Simulated mode notice */}
        {isSimulated && (
          <View style={{ marginHorizontal: 20, backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#FFD60A', padding: 16, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD60A', marginRight: 8 }} />
              <Text style={{ color: '#FFD60A', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>SIMULATED ADAPTER (DEC-004)</Text>
            </View>
            <Text style={{ color: '#AEAEB2', fontSize: 13, lineHeight: 20 }}>
              Tier 2 audio reception (ggwave) requires a microphone and an Expo development build.{'\n\n'}
              The simulated adapter never emits Tier 2 transport events — this is the honest behaviour per spec.{'\n\n'}
              Real Tier 2 signals will appear here when using a dev build with a real radio medium.
            </Text>
          </View>
        )}

        {/* Engine packet count */}
        <View style={{ marginHorizontal: 20, flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 16, marginBottom: 16, justifyContent: 'space-between' }}>
          <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>TOTAL PACKETS IN ENGINE</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{allPackets}</Text>
        </View>

        {/* Received signals — real tier2 events when present */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>
            {tier2Events.length > 0 ? 'RECEIVED SIGNALS' : 'NO TIER 2 SIGNALS YET'}
          </Text>
          <View style={{ height: 2, backgroundColor: '#2D5A27', marginBottom: 16 }} />

          {tier2Events.map((ev, i) => {
            const e = ev as unknown as Record<string, unknown>;
            const packetId = (e['packetId'] as string | undefined) ?? '';
            const atMs = (e['atMs'] as number | undefined) ?? Date.now();
            const valid = ev.name === 'accepted';
            return (
              <View key={`${packetId}-${i}`} style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 8 }}>
                <View style={{ width: 4, backgroundColor: valid ? '#2D5A27' : '#FF453A' }} />
                <View style={{ flex: 1, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                      {String(e['packetType'] ?? 'Tier 2 Packet')}
                    </Text>
                    <Text style={{ color: '#AEAEB2', fontSize: 13 }}>{new Date(atMs).toLocaleTimeString()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: valid ? '#a1d494' : '#FF453A', marginRight: 8 }} />
                    <Text style={{ color: valid ? '#a1d494' : '#FF453A', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                      {valid ? 'VALID' : ev.name?.toUpperCase() ?? 'EVENT'}
                    </Text>
                    {packetId && (
                      <Text style={{ color: '#3A3A3C', fontSize: 11, marginLeft: 8, fontFamily: 'monospace' }}>
                        {packetId.slice(0, 8)}…
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
