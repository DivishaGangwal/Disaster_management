/**
 * RESOURCE DETAIL
 * PNG ref: screen 8 (Resource Detail)
 * Route: ResourceDetail
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { e7ToFloat } from '@dsm/codec';

export default function ResourceDetailScreen() {
  const router = useRouter();
  const { mapObjects, selectedMapObjectId, setFocusMapObjectId, setNavigationDestinationObjectId } = useAppStore();
  const object = mapObjects.find((item) => item.objectId === selectedMapObjectId);

  const ArrowLeftIcon = icons.arrowLeft;
  const NavigationIcon = icons.navigation;
  const LocationIcon = icons.location;
  const AlertIcon = icons.alertCircle;
  const ShelterIcon = icons.shelter;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 242, 254, 0.15)' }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center' }}>
          <ArrowLeftIcon size={18} color="#00F2FE" style={{ marginRight: 6 }} />
          <Text style={{ color: '#00F2FE', fontSize: 14, fontWeight: '700' }}>BACK</Text>
        </TouchableOpacity>
        <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '900', letterSpacing: 1, flex: 1, textAlign: 'center' }}>RESOURCE DETAIL</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ backgroundColor: '#0D1424', borderWidth: 1, borderColor: 'rgba(0, 242, 254, 0.2)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 5, backgroundColor: 'rgba(0, 230, 118, 0.15)', borderLeftWidth: 3, borderColor: '#00E676', justifyContent: 'center', alignItems: 'center' }}>
                <ShelterIcon size={20} color="#00E676" />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900' }}>{object?.label ?? 'No resource selected'}</Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>{object?.kind ?? 'Open a resource from the map or list'}</Text>
              </View>
            </View>
            <View style={{ borderLeftWidth: 2, borderColor: '#64748B', paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: '#CBD5E1', fontSize: 11, fontWeight: '800' }}>{stateLabel(object?.state)}</Text>
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1E293B', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 12 }}>CAPACITY & OCCUPANCY</Text>
          <Text style={{ color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 10 }}>Capacity and occupancy are not present in the current map-object contract.</Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>Supplied</Text>
            <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>{object ? ageLabel(object.asOfS) : 'Unknown'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>Coordinates</Text>
            <Text style={{ color: '#00F2FE', fontSize: 12, fontWeight: '700', fontFamily: 'monospace' }}>{coordinateLabel(object?.latE7, object?.lonE7)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>Source & Age</Text>
            <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>{object ? `${object.provenance} · ${ageLabel(object.asOfS)}` : 'Unknown'}</Text>
          </View>
        </View>

        {/* Stale data warning banner */}
        {object && Math.round(Date.now() / 1000) - object.asOfS > 600 && <View style={{ backgroundColor: 'rgba(255, 179, 0, 0.08)', borderWidth: 1, borderLeftWidth: 3, borderColor: '#FFB300', borderRadius: 8, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <AlertIcon size={18} color="#FFB300" style={{ marginRight: 10 }} />
          <Text style={{ color: '#FFB300', fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 }}>
            Data may be stale — Information older than 10 minutes.
          </Text>
        </View>}
      </ScrollView>

      {/* Bottom buttons: Navigate & Open on Map */}
      <View style={{ flexDirection: 'row', padding: 20, gap: 10, backgroundColor: '#050811', borderTopWidth: 1, borderTopColor: 'rgba(0, 242, 254, 0.15)' }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Navigate to ${object?.label ?? 'selected resource'}`}
          onPress={() => {
            if (!object || object.latE7 === undefined || object.lonE7 === undefined) {
              Alert.alert('No coordinate available', 'This object has no coordinate in its packet.');
              return;
            }
            setNavigationDestinationObjectId(object.objectId);
            router.push('/(tabs)/map');
          }}
          activeOpacity={0.8}
          style={{ flex: 1, backgroundColor: '#00F2FE', paddingVertical: 14, borderRadius: 5, alignItems: 'center' }}
        >
          <Text style={{ color: '#050811', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>NAVIGATE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Open ${object?.label ?? 'selected resource'} on the operational map`}
          onPress={() => {
            if (object) setFocusMapObjectId(object.objectId);
            router.push('/(tabs)/map');
          }}
          activeOpacity={0.8}
          style={{ flex: 1, backgroundColor: 'rgba(255, 46, 147, 0.15)', borderWidth: 1, borderColor: '#FF2E93', paddingVertical: 14, borderRadius: 5, alignItems: 'center' }}
        >
          <Text style={{ color: '#FF2E93', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>OPEN ON MAP</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ageLabel(asOfS: number) { const age = Math.max(0, Math.round(Date.now() / 1000) - asOfS); return age < 60 ? 'just now' : age < 7 * 86_400 ? `${Math.floor(age / 60)}m ago` : 'over 7d old'; }
function coordinateLabel(latE7?: number, lonE7?: number) { return latE7 === undefined || lonE7 === undefined ? 'Not supplied' : `${e7ToFloat(latE7).toFixed(4)}, ${e7ToFloat(lonE7).toFixed(4)}`; }
function stateLabel(state?: number) { return ['Unknown', 'Open', 'Full', 'Closed', 'Unavailable', 'Damaged'][state ?? 0] ?? 'Unknown'; }
