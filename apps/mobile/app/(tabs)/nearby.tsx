/**
 * NEARBY INCIDENTS — Tab Screen
 * PNG ref: screen (13)
 * Route: Nearby (tab)
 *
 * Per newmd:
 * - Sort by Severity → local sort
 * - Tap Incident → Navigation → ResponderIncident (responder) or detail (public)
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const mockIncidents = [
  { id: '1', category: 'Medical Emergency', severity: 3, distance: '0.2km away', timeAgo: '2m ago', iconKey: 'catMedical' as const },
  { id: '2', category: 'Structure Fire', severity: 2, distance: '1.5km away', timeAgo: '12m ago', iconKey: 'catFire' as const },
  { id: '3', category: 'Minor Flooding', severity: 1, distance: '3.8km away', timeAgo: '45m ago', iconKey: 'catFlood' as const },
  { id: '4', category: 'Traffic Collision', severity: 1, distance: '5.1km away', timeAgo: '1h ago', iconKey: 'catOther' as const },
];

const sevConfig: Record<number, { label: string; color: string; barColor: string }> = {
  3: { label: 'CRITICAL', color: '#FF453A', barColor: '#FF453A' },
  2: { label: 'URGENT', color: '#FFD60A', barColor: '#FF8C00' },
  1: { label: 'MODERATE', color: '#FFD60A', barColor: '#FFD60A' },
  0: { label: 'INFO', color: '#AEAEB2', barColor: '#AEAEB2' },
};

export default function NearbyScreen() {
  const router = useRouter();
  const { role } = useAppStore();
  const ShieldIcon = icons.shield;
  const AlertIcon = icons.alert;
  const FilterIcon = icons.filter;
  const LocationIcon = icons.location;

  const handleTapIncident = () => {
    if (role === 'responder') {
      router.push('/responder/detail');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D5A27' }}>
        <ShieldIcon size={20} color="#a1d494" />
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2, marginLeft: 8, flex: 1 }}>GUARDIAN</Text>
        <AlertIcon size={20} color="#FFD60A" />
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }}>
        {/* Title + sort */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700' }}>Nearby Incidents</Text>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#3A3A3C' }}>
            <FilterIcon size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Severity</Text>
          </TouchableOpacity>
        </View>

        {/* Incident Cards */}
        {mockIncidents.map((inc) => {
          const sev = sevConfig[inc.severity] ?? sevConfig[0];
          const CategoryIcon = icons[inc.iconKey];

          return (
            <TouchableOpacity
              key={inc.id}
              onPress={handleTapIncident}
              style={{ backgroundColor: '#1C1C1E', marginBottom: 8, flexDirection: 'row', borderWidth: 1, borderColor: '#3A3A3C' }}
            >
              {/* Left severity bar */}
              <View style={{ width: 4, backgroundColor: sev.barColor }} />

              <View style={{ flex: 1, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                {/* Category icon circle */}
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#2C2C2E', borderWidth: 2, borderColor: '#3A3A3C', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                  <CategoryIcon size={22} color={sev.barColor} />
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{inc.category}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <LocationIcon size={12} color="#AEAEB2" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#AEAEB2', fontSize: 13 }}>{inc.distance}</Text>
                    <Text style={{ color: '#AEAEB2', fontSize: 13, marginLeft: 12 }}>⏱ {inc.timeAgo}</Text>
                  </View>
                </View>

                {/* Severity chip */}
                <View style={{ borderWidth: 1, borderColor: sev.color, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: sev.color, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{sev.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
