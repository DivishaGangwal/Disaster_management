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

const mockSignals = [
  { title: 'System Sync', time: 'Just now', status: 'VALID', statusColor: '#a1d494', barColor: '#2D5A27' },
  { title: 'Unknown Origin Alert', time: '2m ago', status: 'CORRUPT', statusColor: '#FF453A', barColor: '#FF453A' },
  { title: 'Repeater Ping', time: '15m ago', status: 'DUPLICATE', statusColor: '#AEAEB2', barColor: '#3A3A3C' },
  { title: 'Node Status Update', time: '1h ago', status: 'VALID', statusColor: '#a1d494', barColor: '#2D5A27' },
];

export default function Tier2ListenScreen() {
  const router = useRouter();
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
            SCANNING T2 FREQUENCIES
          </Text>
        </View>

        {/* Received signals */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>RECEIVED SIGNALS</Text>
          <View style={{ height: 2, backgroundColor: '#2D5A27', marginBottom: 16 }} />

          {mockSignals.map((sig, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 8 }}
            >
              <View style={{ width: 4, backgroundColor: sig.barColor }} />
              <View style={{ flex: 1, padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{sig.title}</Text>
                  <Text style={{ color: '#AEAEB2', fontSize: 13 }}>{sig.time}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sig.statusColor, marginRight: 8 }} />
                  <Text style={{ color: sig.statusColor, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{sig.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
