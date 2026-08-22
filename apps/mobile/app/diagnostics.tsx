/**
 * DIAGNOSTICS — Packet Inspector
 * PNG ref: screen (8)
 * Route: Diagnostics
 *
 * Per newmd:
 * - View Packet → inspect packet journey (engine.events)
 * - Filter by Transport → BLE / gateway / Tier 2 / local
 * - Export Log → read from engine.events
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';

type TransportFilter = 'all' | 'ble' | 'gateway' | 't2' | 'local';

const mockPackets = [
  { transport: 'BLE', id: 'PKT-8F2D-X9', status: 'VALID', statusColor: '#a1d494', barColor: '#2D5A27' },
  { transport: 'GATEWAY', id: 'PKT-A1B2-C3', status: 'RELAYED', statusColor: '#AEAEB2', barColor: '#3A3A3C' },
  { transport: 'T2', id: 'PKT-9K4L-M1', status: 'DROPPED', statusColor: '#FF453A', barColor: '#FF453A' },
  { transport: 'BLE', id: 'PKT-2Y7U-P0', status: 'VALID', statusColor: '#a1d494', barColor: '#2D5A27' },
  { transport: 'GATEWAY', id: 'PKT-4R5T-Y6', status: 'VALID', statusColor: '#a1d494', barColor: '#2D5A27' },
  { transport: 'T2', id: 'PKT-7I80-P9', status: 'RELAYED', statusColor: '#AEAEB2', barColor: '#3A3A3C' },
];

export default function DiagnosticsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<TransportFilter>('all');

  const ArrowLeftIcon = icons.arrowLeft;
  const FilterIcon = icons.filter;

  const filtered = filter === 'all'
    ? mockPackets
    : mockPackets.filter((p) => p.transport.toLowerCase() === filter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeftIcon size={20} color="#a1d494" />
        </TouchableOpacity>
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2 }}>GUARDIAN</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={{ flex: 1, padding: 20 }}>
        {/* Filter + Export buttons */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => {
              const nextMap: Record<TransportFilter, TransportFilter> = { all: 'ble', ble: 'gateway', gateway: 't2', t2: 'local', local: 'all' };
              setFilter(nextMap[filter]);
            }}
            style={{ flex: 1, backgroundColor: '#2C2C2E', paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C', flexDirection: 'row', justifyContent: 'center' }}
          >
            <FilterIcon size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
              {filter === 'all' ? 'FILTER BY TRANSPORT' : filter.toUpperCase()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Export', 'Diagnostic log exported.')}
            style={{ flex: 1, backgroundColor: '#2C2C2E', paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>EXPORT LOG</Text>
          </TouchableOpacity>
        </View>

        {/* Table header */}
        <View style={{ flexDirection: 'row', paddingVertical: 8, marginBottom: 8 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, flex: 1 }}>TRANSPORT</Text>
          <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, flex: 1.5 }}>PACKET ID</Text>
          <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, flex: 1, textAlign: 'right' }}>STATUS</Text>
        </View>

        {/* Packet rows */}
        <ScrollView>
          {filtered.map((pkt, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 4 }}
            >
              <View style={{ width: 4, backgroundColor: pkt.barColor }} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', flex: 1 }}>{pkt.transport}</Text>
                <Text style={{ color: '#AEAEB2', fontSize: 13, fontFamily: 'monospace', flex: 1.5 }}>{pkt.id}</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View style={{ borderWidth: 1, borderColor: pkt.statusColor, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: pkt.statusColor, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{pkt.status}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
