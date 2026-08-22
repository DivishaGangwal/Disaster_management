/**
 * PROFILE — Tab Screen
 * PNG ref: screen (16)
 * Route: Profile (tab)
 *
 * Per newmd:
 * - Select District/Region → local state
 * - Update Offline Map → gateway HTTP (when internet exists)
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const regions = [
  'NORTH DISTRICT',
  'SOUTH DISTRICT',
  'EAST DISTRICT',
  'WEST DISTRICT',
  'CENTRAL DISTRICT',
];

export default function ProfileScreen() {
  const router = useRouter();
  const {
    selectedRegion,
    setSelectedRegion,
    offlinePackVersion,
    offlinePackStatus,
    setOfflinePackStatus,
  } = useAppStore();

  const [showRegionPicker, setShowRegionPicker] = useState(false);

  const ShieldIcon = icons.shield;
  const CheckIcon = icons.check;
  const DownloadIcon = icons.download;
  const ChevronIcon = icons.chevronDown;

  const handleUpdateMap = () => Alert.alert(
    'Map renderer deferred',
    'The packet-to-map projection is active, but no licensed offline basemap bundle is installed. This control does not pretend to download one.',
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D5A27' }}>
        <ShieldIcon size={20} color="#a1d494" />
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2, marginLeft: 8 }}>GUARDIAN</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginBottom: 24 }}>PROFILE</Text>

        {/* District / Region */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>DISTRICT / REGION</Text>
        <TouchableOpacity
          onPress={() => setShowRegionPicker(!showRegionPicker)}
          style={{ backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#3A3A3C', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>{selectedRegion.toUpperCase()}</Text>
          <ChevronIcon size={18} color="#AEAEB2" />
        </TouchableOpacity>

        {showRegionPicker && (
          <View style={{ marginBottom: 16 }}>
            {regions.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => { setSelectedRegion(r); setShowRegionPicker(false); setOfflinePackStatus('not-downloaded'); }}
                style={{ backgroundColor: selectedRegion === r ? '#1C1C1E' : '#000000', borderWidth: 1, borderColor: selectedRegion === r ? '#2D5A27' : '#3A3A3C', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 4 }}
              >
                <Text style={{ color: selectedRegion === r ? '#a1d494' : '#FFFFFF', fontSize: 14, fontWeight: '600' }}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Offline map version */}
        <View style={{ flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#2D5A27', backgroundColor: '#1C1C1E', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 }}>
          <CheckIcon size={18} color="#a1d494" style={{ marginRight: 12 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1 }}>
            LOCAL DATA PACK: {selectedRegion} V{offlinePackVersion.replace(/\./g, '.')} ({offlinePackStatus === 'downloaded' ? 'READY' : 'PLACEHOLDER'})
          </Text>
        </View>

        {/* Update button */}
        <TouchableOpacity
          onPress={handleUpdateMap}
          disabled={offlinePackStatus === 'downloading'}
          style={{
            backgroundColor: offlinePackStatus === 'downloading' ? '#3A3A3C' : '#2D5A27',
            paddingVertical: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: offlinePackStatus === 'downloading' ? '#3A3A3C' : '#2D5A27',
            marginBottom: 32,
          }}
        >
          <DownloadIcon size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>
            REVIEW OFFLINE MAP STATUS
          </Text>
        </TouchableOpacity>

        {/* Operative Data */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>OPERATIVE DATA</Text>
        <View style={{ borderTopWidth: 1, borderTopColor: '#3A3A3C' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
            <Text style={{ color: '#AEAEB2', fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>CALLSIGN</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>LOCAL DEVICE</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
            <Text style={{ color: '#AEAEB2', fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>SYS. STATUS</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, backgroundColor: '#a1d494', marginRight: 8 }} />
              <Text style={{ color: '#a1d494', fontSize: 13, fontWeight: '600' }}>PROTOTYPE</Text>
            </View>
          </View>
        </View>

        {/* Menu items — Relay, Diagnostics, Readiness accessed from here */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 32, marginBottom: 8 }}>SYSTEM</Text>
        {[
          { label: 'RELAY & GATEWAY', route: '/relay' as const },
          { label: 'TIER 2 LISTENING', route: '/tier2' as const },
          { label: 'READINESS & SETUP', route: '/readiness' as const },
          { label: 'DIAGNOSTICS', route: '/diagnostics' as const },
        ].map((item) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.push(item.route)}
            style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', paddingHorizontal: 16, paddingVertical: 16, marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 }}>{item.label}</Text>
            <Text style={{ color: '#AEAEB2', fontSize: 16 }}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
