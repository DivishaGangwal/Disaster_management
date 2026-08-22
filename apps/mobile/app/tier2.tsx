/**
 * TIER 2 LISTENING (Radio Broadcast Receiver)
 * PNG ref: screen (14)
 * Route: Tier2Listen
 *
 * Per newmd:
 * - No user controls — display only
 * - History of all messages received from gg waves
 * - Active campaign ID and version when detected
 * - Frames: detected / valid / corrupt / duplicate / missing
 * - Packets recovered vs expected manifest
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';

export default function Tier2ListenScreen() {
  const router = useRouter();
  const { diagnosticEvents, tier2Listening } = useAppStore();
  const tier2Events = diagnosticEvents.filter((event) => event.category === 'tier2' || event.transport === 'tier2-mic' || event.transport === 'tier2-direct');
  const ArrowLeftIcon = icons.arrowLeft;

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
        {/* Large radio icon */}
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <View style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            borderWidth: 2,
            borderColor: '#2D5A27',
            backgroundColor: '#1C1C1E',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{ color: '#a1d494', fontSize: 48 }}>((•))</Text>
          </View>
          <Text style={{ color: '#a1d494', fontSize: 13, fontWeight: '700', letterSpacing: 2, marginTop: 16 }}>
            {tier2Listening ? 'LISTENING FOR WAVEPX FRAMES' : 'TIER 2 LISTENER INACTIVE'}
          </Text>
        </View>

        {/* Received signals */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>RECEIVED SIGNALS</Text>
          <View style={{ height: 2, backgroundColor: '#2D5A27', marginBottom: 16 }} />

          {tier2Events.map((event, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 8 }}
            >
              <View style={{ width: 4, backgroundColor: event.severity === 'warn' || event.severity === 'error' ? '#FF453A' : '#2D5A27' }} />
              <View style={{ flex: 1, padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{event.name}</Text>
                  <Text style={{ color: '#AEAEB2', fontSize: 13 }}>{new Date(event.atMs).toLocaleTimeString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: event.severity === 'warn' || event.severity === 'error' ? '#FF453A' : '#a1d494', marginRight: 8 }} />
                  <Text style={{ color: event.severity === 'warn' || event.severity === 'error' ? '#FF453A' : '#a1d494', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{(event.result ?? event.reason ?? event.severity).toUpperCase()}</Text>
                </View>
              </View>
            </View>
          ))}
          {tier2Events.length === 0 && <Text style={{ color: '#AEAEB2', fontSize: 14 }}>No WavePX frame has been observed on this phone. The web receiving station supports both microphone and WAV-file input.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
