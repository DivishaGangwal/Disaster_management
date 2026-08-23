/**
 * NEARBY INCIDENTS
 * PNG ref: screen (3)
 * Route: Nearby (tab)
 *
 * Wired to the real engine:
 * - engine.incidents.activeIncidents() → live incident list
 * - Refreshes every 5 s when mounted
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useRuntime } from '@/src/contexts/RuntimeContext';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IncidentView } from '@dsm/incident';
import { EmergencyCategory } from '@dsm/contracts';

const categoryLabels: Record<number, string> = {
  [EmergencyCategory.MEDICAL]: 'Medical Emergency',
  [EmergencyCategory.TRAPPED]: 'Trapped',
  [EmergencyCategory.FIRE]: 'Fire',
  [EmergencyCategory.FLOOD]: 'Flood',
  [EmergencyCategory.VIOLENCE]: 'Violence',
  [EmergencyCategory.STRUCTURAL_COLLAPSE]: 'Building Collapse',
  [EmergencyCategory.MISSING_PERSON]: 'Missing Person',
  [EmergencyCategory.OTHER]: 'Emergency',
};

const severityColor: Record<number, string> = {
  0: '#AEAEB2', // INFO
  1: '#FFD60A', // MODERATE
  2: '#C55A11', // URGENT
  3: '#FF453A', // LIFE_CRITICAL
};

const severityLabel: Record<number, string> = {
  0: 'INFO',
  1: 'MODERATE',
  2: 'URGENT',
  3: 'CRITICAL',
};

export default function NearbyScreen() {
  const router = useRouter();
  const { runtime } = useRuntime();
  const [incidents, setIncidents] = useState<IncidentView[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const ShieldIcon = icons.shield;

  const loadIncidents = () => {
    if (!runtime) return;
    // list() returns all incidents; filter to non-terminal ones for "nearby"
    const all = runtime.engine.incidents.list();
    const active = all.filter(
      (i) => i.state !== 'resolved' && i.state !== 'cancelled' && i.state !== 'expired',
    );
    setIncidents(active);
  };

  useEffect(() => {
    if (!runtime) return;
    loadIncidents();
    // Poll every 2 seconds so incident state (accepted/en-route/arrived) stays fresh.
    const id = setInterval(loadIncidents, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime]);

  const handleRefresh = async () => {
    setRefreshing(true);
    loadIncidents();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D5A27' }}>
        <ShieldIcon size={20} color="#a1d494" />
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2, marginLeft: 8 }}>GUARDIAN</Text>
      </View>

      <ScrollView
        style={{ flex: 1, padding: 20 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#a1d494"
          />
        }
      >
        <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginBottom: 4 }}>NEARBY</Text>
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 24 }}>
          {incidents.length} ACTIVE {incidents.length === 1 ? 'INCIDENT' : 'INCIDENTS'}
        </Text>

        {incidents.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ color: '#3A3A3C', fontSize: 64, marginBottom: 16 }}>◎</Text>
            <Text style={{ color: '#AEAEB2', fontSize: 16, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
              ALL CLEAR
            </Text>
            <Text style={{ color: '#3A3A3C', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              No active incidents in the mesh.{'\n'}Start relay to discover nearby devices.
            </Text>
          </View>
        ) : (
          incidents.map((incident) => (
            <IncidentCard
              key={incident.incidentId}
              incident={incident}
              onPress={() => router.push({ pathname: '/responder/detail', params: { incidentId: incident.incidentId } })}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function IncidentCard({
  incident,
  onPress,
}: {
  incident: IncidentView;
  onPress: () => void;
}) {
  const sev = incident.severity ?? 0;
  const col = severityColor[sev] ?? '#AEAEB2';
  const category = incident.category ?? EmergencyCategory.OTHER;
  const people = incident.peopleTotal ?? 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 8 }}
    >
      <View style={{ width: 4, backgroundColor: col }} />
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>
              {categoryLabels[category] ?? 'EMERGENCY'}
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>
              {(categoryLabels[category] ?? 'EMERGENCY').toUpperCase()}
            </Text>
          </View>
          <View style={{ backgroundColor: col, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: col === '#FFD60A' ? '#000000' : '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
              {severityLabel[sev] ?? 'INFO'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 16 }}>
          {people > 0 && (
            <Text style={{ color: '#AEAEB2', fontSize: 13 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{people}</Text> people
            </Text>
          )}
          <Text style={{ color: '#AEAEB2', fontSize: 13 }}>
            State: <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{incident.state}</Text>
          </Text>
        </View>

        <Text style={{ color: '#3A3A3C', fontSize: 11, marginTop: 8 }}>
          ID: {incident.incidentId.slice(0, 12)}…
        </Text>
      </View>
      <View style={{ justifyContent: 'center', paddingRight: 16 }}>
        <Text style={{ color: '#AEAEB2', fontSize: 20 }}>›</Text>
      </View>
    </TouchableOpacity>
  );
}
