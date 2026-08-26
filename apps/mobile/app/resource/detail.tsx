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
  const { mapObjects, selectedMapObjectId, setFocusMapObjectId } = useAppStore();
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
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ArrowLeftIcon size={18} color="#00F2FE" style={{ marginRight: 6 }} />
          <Text style={{ color: '#00F2FE', fontSize: 14, fontWeight: '700' }}>BACK</Text>
        </TouchableOpacity>
        <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '900', letterSpacing: 1, flex: 1, textAlign: 'center' }}>RESOURCE DETAIL</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Type + Name + Status Header Card */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0, 242, 254, 0.2)', padding: 18, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0, 230, 118, 0.15)', borderWidth: 1, borderColor: '#00E676', justifyContent: 'center', alignItems: 'center' }}>
                <ShelterIcon size={20} color="#00E676" />
              </View>
              <View>
                <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900' }}>{object?.label ?? 'Community Shelter A'}</Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>{object?.kind ?? 'Shelter'} · 2.1 km away</Text>
              </View>
            </View>
            <View style={{ backgroundColor: 'rgba(0, 230, 118, 0.15)', borderWidth: 1, borderColor: '#00E676', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ color: '#00E676', fontSize: 11, fontWeight: '800' }}>Open</Text>
            </View>
          </View>
        </View>

        {/* Capacity grid */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 20, borderWidth: 1, borderColor: '#1E293B', padding: 18, marginBottom: 20 }}>
          <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 12 }}>CAPACITY & OCCUPANCY</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1, backgroundColor: '#141E33', borderRadius: 14, padding: 14 }}>
              <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '800' }}>TOTAL CAPACITY</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '900', marginTop: 4 }}>120 people</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#141E33', borderRadius: 14, padding: 14 }}>
              <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '800' }}>CURRENTLY OCCUPIED</Text>
              <Text style={{ color: '#00F2FE', fontSize: 22, fontWeight: '900', marginTop: 4 }}>35 people</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>Supplied</Text>
            <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>1 hr ago</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>Coordinates</Text>
            <Text style={{ color: '#00F2FE', fontSize: 12, fontWeight: '700', fontFamily: 'monospace' }}>{coordinateLabel(object?.latE7, object?.lonE7)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>Source & Age</Text>
            <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>{object?.provenance ?? 'Mesh'} · {ageLabel(object?.asOfS ?? Math.round(Date.now()/1000) - 480)}</Text>
          </View>
        </View>

        {/* Stale data warning banner */}
        <View style={{ backgroundColor: 'rgba(255, 179, 0, 0.12)', borderRadius: 16, borderWidth: 1, borderColor: '#FFB300', padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <AlertIcon size={18} color="#FFB300" style={{ marginRight: 10 }} />
          <Text style={{ color: '#FFB300', fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 }}>
            Data may be stale — Information older than 10 minutes.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom buttons: Navigate & Open on Map */}
      <View style={{ flexDirection: 'row', padding: 20, gap: 10, backgroundColor: '#050811', borderTopWidth: 1, borderTopColor: 'rgba(0, 242, 254, 0.15)' }}>
        <TouchableOpacity
          onPress={() => {
            if (!object || object.latE7 === undefined || object.lonE7 === undefined) {
              Alert.alert('No coordinate available', 'This object has no coordinate in its packet.');
              return;
            }
            setFocusMapObjectId(object.objectId);
            router.push('/(tabs)/map');
          }}
          activeOpacity={0.8}
          style={{ flex: 1, backgroundColor: '#00F2FE', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#050811', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>NAVIGATE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (object) setFocusMapObjectId(object.objectId);
            router.push('/(tabs)/map');
          }}
          activeOpacity={0.8}
          style={{ flex: 1, backgroundColor: 'rgba(255, 46, 147, 0.15)', borderWidth: 1, borderColor: '#FF2E93', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#FF2E93', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>OPEN ON MAP</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ageLabel(asOfS: number) { const age = Math.max(0, Math.round(Date.now() / 1000) - asOfS); return age < 60 ? 'just now' : `${Math.floor(age / 60)}m ago`; }
function coordinateLabel(latE7?: number, lonE7?: number) { return latE7 === undefined || lonE7 === undefined ? '19.2250, 72.9651' : `${e7ToFloat(latE7).toFixed(4)}, ${e7ToFloat(lonE7).toFixed(4)}`; }
