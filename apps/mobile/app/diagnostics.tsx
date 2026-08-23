/**
 * DIAGNOSTICS
 * PNG ref: screen (17)
 * Route: Diagnostics
 *
 * Wired to the real engine:
 * - Live event log from engine.events (EventSink)
 * - Packet count from engine.packets.count()
 * - Queue stats from engine.packets.listRelayable()
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { useRuntime } from '@/src/contexts/RuntimeContext';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DiagnosticsScreen() {
  const router = useRouter();
  const { runtime } = useRuntime();
  const { diagnosticEvents, clearDiagnosticEvents, relayState, peersRecentlySeen, backendUrl, setBackendUrl } = useAppStore();

  const [packetCount, setPacketCount] = useState(0);
  const [relayableCount, setRelayableCount] = useState(0);

  const ShieldIcon = icons.shield;
  const ArrowLeftIcon = icons.arrowLeft;

  // Poll engine stats every 3 s.
  useEffect(() => {
    if (!runtime) return;
    const tick = async () => {
      setPacketCount(await runtime.engine.packets.count());
      setRelayableCount((await runtime.engine.packets.listRelayable(256)).length);
    };
    void tick();
    const id = setInterval(() => void tick(), 3000);
    return () => clearInterval(id);
  }, [runtime]);

  const severityColor: Record<string, string> = {
    debug: '#AEAEB2',
    info: '#a1d494',
    warn: '#FFD60A',
    error: '#FF453A',
  };

  const categoryColor: Record<string, string> = {
    validation: '#7B9FFF',
    policy: '#FFB340',
    incident: '#FF6B6B',
    gateway: '#4ECDC4',
    transfer: '#a1d494',
    relay: '#C77DFF',
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D5A27' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ArrowLeftIcon size={20} color="#a1d494" />
        </TouchableOpacity>
        <ShieldIcon size={20} color="#a1d494" />
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2, marginLeft: 8, flex: 1 }}>
          GUARDIAN
        </Text>
        <TouchableOpacity
          onPress={clearDiagnosticEvents}
          style={{ backgroundColor: '#1C1C1E', paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#3A3A3C' }}
        >
          <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>CLEAR</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: '#3A3A3C', paddingHorizontal: 20, paddingVertical: 12, gap: 24 }}>
        <StatBox label="PACKETS" value={String(packetCount)} />
        <StatBox label="RELAYABLE" value={String(relayableCount)} />
        <StatBox label="PEERS" value={String(peersRecentlySeen)} />
        <StatBox label="RELAY" value={relayState.toUpperCase().slice(0, 4)} color={relayState === 'active' ? '#a1d494' : '#AEAEB2'} />
      </View>

      {/* Backend Config row */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
        <Text style={{ color: '#AEAEB2', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>BACKEND SYNC URL (FOR PHYSICAL DEVICES)</Text>
        <TextInput
          style={{ backgroundColor: '#1C1C1E', color: '#FFFFFF', padding: 12, borderWidth: 1, borderColor: '#3A3A3C', fontSize: 14 }}
          value={backendUrl}
          onChangeText={setBackendUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.x:8787"
          placeholderTextColor="#3A3A3C"
        />
        <Text style={{ color: '#AEAEB2', fontSize: 11, marginTop: 6 }}>
          Update this to your computer's local Wi-Fi IP address when testing on a real phone instead of the simulator.
        </Text>
      </View>

      <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        DIAGNOSTICS
      </Text>

      {diagnosticEvents.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 }}>
          <Text style={{ color: '#3A3A3C', fontSize: 40, marginBottom: 16 }}>◉</Text>
          <Text style={{ color: '#AEAEB2', fontSize: 14, fontWeight: '600', letterSpacing: 1 }}>
            NO EVENTS YET
          </Text>
          <Text style={{ color: '#3A3A3C', fontSize: 12, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
            Start relay or send SOS to see real engine events
          </Text>
        </View>
      ) : (
        <FlatList
          data={diagnosticEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 8, padding: 12, backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#1C1C1E', borderLeftWidth: 3, borderLeftColor: categoryColor[item.category ?? ''] ?? '#3A3A3C' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {item.category && (
                    <Text style={{ color: categoryColor[item.category] ?? '#AEAEB2', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                      {item.category.toUpperCase()}
                    </Text>
                  )}
                  {item.name && (
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>
                      {item.name}
                    </Text>
                  )}
                </View>
                <Text style={{ color: severityColor[item.severity ?? 'debug'] ?? '#AEAEB2', fontSize: 10, fontWeight: '700' }}>
                  {item.severity?.toUpperCase() ?? 'DEBUG'}
                </Text>
              </View>
              {item.packetId && (
                <Text style={{ color: '#AEAEB2', fontSize: 11, fontFamily: 'monospace' }} numberOfLines={1}>
                  {item.packetId.slice(0, 16)}…
                </Text>
              )}
              {(item.reason ?? item.result) && (
                <Text style={{ color: '#7D8899', fontSize: 11, marginTop: 2 }}>
                  {item.reason ?? item.result}
                </Text>
              )}
              <Text style={{ color: '#3A3A3C', fontSize: 10, marginTop: 4 }}>
                {new Date(item.atMs).toLocaleTimeString()}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function StatBox({ label, value, color = '#FFFFFF' }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: '#AEAEB2', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 2 }}>{label}</Text>
      <Text style={{ color, fontSize: 18, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}
