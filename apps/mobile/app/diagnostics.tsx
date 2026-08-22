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
import { View, Text, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';

type TransportFilter = 'all' | 'ble' | 'gateway' | 't2' | 'local';

export default function DiagnosticsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<TransportFilter>('all');
  const diagnosticEvents = useAppStore((state) => state.diagnosticEvents);

  const ArrowLeftIcon = icons.arrowLeft;
  const FilterIcon = icons.filter;

  const rows = diagnosticEvents.map((event) => ({
    transport: transportLabel(event.transport), id: event.packetId ?? `${event.category}:${event.name}`,
    status: (event.reason ?? event.result ?? event.severity).toUpperCase(),
    statusColor: event.severity === 'error' || event.severity === 'warn' ? '#FF453A' : event.severity === 'info' ? '#a1d494' : '#AEAEB2',
    barColor: event.severity === 'error' || event.severity === 'warn' ? '#FF453A' : '#2D5A27',
  }));
  const filtered = filter === 'all' ? rows : rows.filter((row) => row.transport.toLowerCase() === filter);

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
            onPress={() => void Share.share({ title: 'Disaster SOS Mesh diagnostics', message: JSON.stringify(diagnosticEvents, null, 2) })}
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
          {filtered.length === 0 && <Text style={{ color: '#AEAEB2', fontSize: 14 }}>No matching runtime events have been recorded.</Text>}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function transportLabel(value?: string): 'BLE' | 'GATEWAY' | 'T2' | 'LOCAL' {
  if (value === 'tier1-ble' || value === 'tier1-classic') return 'BLE';
  if (value === 'gateway') return 'GATEWAY';
  if (value === 'tier2-mic' || value === 'tier2-direct') return 'T2';
  return 'LOCAL';
}
