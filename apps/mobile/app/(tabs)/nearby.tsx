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

const categoryInfo = [
  { label: 'Medical Emergency', iconKey: 'catMedical' as const }, { label: 'Trapped', iconKey: 'catOther' as const },
  { label: 'Structure Fire', iconKey: 'catFire' as const }, { label: 'Flood', iconKey: 'catFlood' as const },
  { label: 'Violence', iconKey: 'catViolence' as const }, { label: 'Building Collapse', iconKey: 'catBuildingCollapse' as const },
  { label: 'Missing Person', iconKey: 'catOther' as const }, { label: 'Other Emergency', iconKey: 'catOther' as const },
];

const sevConfig: Record<number, { label: string; color: string; barColor: string }> = {
  3: { label: 'CRITICAL', color: '#FF453A', barColor: '#FF453A' },
  2: { label: 'URGENT', color: '#FFD60A', barColor: '#FF8C00' },
  1: { label: 'MODERATE', color: '#FFD60A', barColor: '#FFD60A' },
  0: { label: 'INFO', color: '#AEAEB2', barColor: '#AEAEB2' },
};

export default function NearbyScreen() {
  const router = useRouter();
  const { role, runtimeIncidents, setSelectedIncidentId } = useAppStore();
  const ShieldIcon = icons.shield;
  const AlertIcon = icons.alert;
  const FilterIcon = icons.filter;
  const LocationIcon = icons.location;

  const handleTapIncident = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
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
        {runtimeIncidents.slice().sort((a, b) => b.severity - a.severity || b.updatedAtS - a.updatedAtS).map((inc) => {
          const sev = sevConfig[inc.severity] ?? sevConfig[0];
          const category = categoryInfo[inc.category] ?? categoryInfo[7];
          const CategoryIcon = icons[category.iconKey];

          return (
            <TouchableOpacity
              key={inc.id}
              onPress={() => handleTapIncident(inc.id)}
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
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{category.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <LocationIcon size={12} color="#AEAEB2" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#AEAEB2', fontSize: 13 }}>Locally received packet</Text>
                    <Text style={{ color: '#AEAEB2', fontSize: 13, marginLeft: 12 }}>⏱ {ageLabel(inc.updatedAtS)}</Text>
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
        {runtimeIncidents.length === 0 && <Text style={{ color: '#AEAEB2', fontSize: 14 }}>No incident packets are stored on this phone.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function ageLabel(updatedAtS: number) { const seconds = Math.max(0, Math.round(Date.now() / 1000) - updatedAtS); return seconds < 60 ? 'just now' : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`; }
