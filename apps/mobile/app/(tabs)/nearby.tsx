/**
 * NEARBY INCIDENTS — Tab Screen
 * PNG ref: screen 6 (Nearby Incidents)
 * Route: Nearby (tab)
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore, type RuntimeIncident } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const categoryInfo = [
  { label: 'Medical Emergency', iconKey: 'catMedical' as const },
  { label: 'Trapped', iconKey: 'catOther' as const },
  { label: 'Building Fire', iconKey: 'catFire' as const },
  { label: 'Flooding', iconKey: 'catFlood' as const },
  { label: 'Violence', iconKey: 'catViolence' as const },
  { label: 'Road Accident', iconKey: 'catBuildingCollapse' as const },
  { label: 'Gas Leak', iconKey: 'catOther' as const },
  { label: 'Other Emergency', iconKey: 'catOther' as const },
];

const sevConfig: Record<number, { label: string; color: string; bg: string }> = {
  3: { label: 'HIGH', color: '#FF0055', bg: 'rgba(255, 0, 85, 0.15)' },
  2: { label: 'MODERATE', color: '#FFB300', bg: 'rgba(255, 179, 0, 0.15)' },
  1: { label: 'MODERATE', color: '#00F2FE', bg: 'rgba(0, 242, 254, 0.15)' },
  0: { label: 'LOW', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' },
};

export default function NearbyScreen() {
  const router = useRouter();
  const { role, runtimeIncidents, setSelectedIncidentId } = useAppStore();

  const [activeFilter, setActiveFilter] = useState<'all' | 'my-area' | 'unread'>('all');
  const [sortOrder, setSortOrder] = useState<'high-to-low' | 'low-to-high'>('high-to-low');

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

  const incidentsSource = runtimeIncidents;

  // Filter logic
  const myAreaIncidents = incidentsSource.filter((inc) => inc.severity >= 2 || inc.category === 2 || inc.category === 6);
  const unreadIncidents = incidentsSource.filter((inc) => inc.severity >= 2);

  const displayedList = (
    activeFilter === 'my-area'
      ? myAreaIncidents
      : activeFilter === 'unread'
      ? unreadIncidents
      : incidentsSource
  ).slice().sort((a, b) => {
    if (sortOrder === 'high-to-low') {
      return b.severity - a.severity || b.updatedAtS - a.updatedAtS;
    } else {
      return a.severity - b.severity || a.updatedAtS - b.updatedAtS;
    }
  });

  const toggleSort = () => {
    setSortOrder(sortOrder === 'high-to-low' ? 'low-to-high' : 'high-to-low');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      {/* Header with Purple Shield */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 242, 254, 0.15)' }}>
        <ShieldIcon size={22} color="#9333EA" />
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '900', letterSpacing: 2, marginLeft: 8, flex: 1 }}>NEARBY INCIDENTS</Text>
        <AlertIcon size={20} color="#FFB300" />
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }}>
        
        {/* Interactive Filter chips bar (Purple Active Button Background) */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.8}
            style={{
              backgroundColor: activeFilter === 'all' ? '#9333EA' : '#0D1424',
              borderWidth: 1,
              borderColor: activeFilter === 'all' ? '#9333EA' : '#1E293B',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: activeFilter === 'all' ? '#FFFFFF' : '#94A3B8', fontSize: 12, fontWeight: '800' }}>
              All {incidentsSource.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('my-area')}
            activeOpacity={0.8}
            style={{
              backgroundColor: activeFilter === 'my-area' ? '#9333EA' : '#0D1424',
              borderWidth: 1,
              borderColor: activeFilter === 'my-area' ? '#9333EA' : '#1E293B',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: activeFilter === 'my-area' ? '#FFFFFF' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>
              My Area {myAreaIncidents.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('unread')}
            activeOpacity={0.8}
            style={{
              backgroundColor: activeFilter === 'unread' ? '#9333EA' : '#0D1424',
              borderWidth: 1,
              borderColor: activeFilter === 'unread' ? '#9333EA' : '#1E293B',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: activeFilter === 'unread' ? '#FFFFFF' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>
              Unread {unreadIncidents.length}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Title + Interactive Sort Button */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
            Sorted by Severity ({sortOrder === 'high-to-low' ? 'High → Low' : 'Low → High'})
          </Text>
          <TouchableOpacity
            onPress={toggleSort}
            activeOpacity={0.8}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D1424', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B' }}
          >
            <FilterIcon size={14} color="#9333EA" style={{ marginRight: 6 }} />
            <Text style={{ color: '#F8FAFC', fontSize: 11, fontWeight: '700' }}>Sort</Text>
          </TouchableOpacity>
        </View>

        {/* Incident Cards (No Left Highlight Color Bar, No Timeline Ago) */}
        {displayedList.map((inc) => {
          const sev = sevConfig[inc.severity] ?? sevConfig[0];
          const category = categoryInfo[inc.category] ?? categoryInfo[7];
          const CategoryIcon = icons[category.iconKey];

          return (
            <TouchableOpacity
              key={inc.id}
              onPress={() => handleTapIncident(inc.id)}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#0D1424',
                marginBottom: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#1E293B',
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              {/* Category icon circle */}
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: sev.bg, borderWidth: 1, borderColor: sev.color, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <CategoryIcon size={20} color={sev.color} />
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '800' }}>{category.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <LocationIcon size={12} color="#64748B" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                    {inc.peopleTotal ?? 2} people · {inc.injured ?? 1} injured
                  </Text>
                </View>
              </View>

              {/* Severity chip */}
              <View style={{ backgroundColor: sev.bg, borderWidth: 1, borderColor: sev.color, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: sev.color, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{sev.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {displayedList.length === 0 && (
          <View style={{ padding: 24, backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', alignItems: 'center' }}>
            <Text style={{ color: '#94A3B8', fontSize: 13 }}>No incident packets match this filter.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
