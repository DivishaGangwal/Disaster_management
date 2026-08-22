/**
 * MAP SCREEN — Offline Operational Map
 * PNG ref: screen (15)
 * Route: Map (tab)
 *
 * Per newmd:
 * - Tap Marker → Detail Sheet (read from local MapProjection)
 * - Switch to List View (local data)
 * All data from engine.projection — NO backend calls.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';

export default function MapScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const { mapObjects, setSelectedMapObjectId } = useAppStore();

  const MapIcon = icons.map;
  const ListIcon = icons.list;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D5A27' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#a1d494', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>≡</Text>
          <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2, marginLeft: 16 }}>GUARDIAN</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 4, height: 12, backgroundColor: '#a1d494', marginRight: 2 }} />
          <View style={{ width: 4, height: 18, backgroundColor: '#a1d494', marginRight: 2 }} />
          <View style={{ width: 4, height: 8, backgroundColor: '#a1d494' }} />
        </View>
      </View>

      {viewMode === 'map' ? (
        <View style={{ flex: 1 }}>
          {/* Offline cache badge */}
          <View style={{ position: 'absolute', top: 12, left: 20, zIndex: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#3A3A3C' }}>
            <View style={{ width: 8, height: 8, backgroundColor: '#a1d494', marginRight: 8 }} />
            <Text style={{ color: '#a1d494', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>OFFLINE CACHE ACTIVE</Text>
          </View>

          {/* Switch to list button */}
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            style={{ position: 'absolute', top: 12, right: 20, zIndex: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#3A3A3C' }}
          >
            <ListIcon size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>SWITCH TO LIST VIEW</Text>
          </TouchableOpacity>

          {/* Map placeholder */}
          <View style={{ flex: 1, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center' }}>
            <MapIcon size={48} color="#3A3A3C" />
            <Text style={{ color: '#AEAEB2', fontSize: 13, marginTop: 12, letterSpacing: 0.5 }}>Map renderer deferred · packet projection is active</Text>
          </View>
        </View>
      ) : (
        /* List View */
        <ScrollView style={{ flex: 1, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700' }}>Map Entities</Text>
            <TouchableOpacity onPress={() => setViewMode('map')} style={{ backgroundColor: '#2C2C2E', paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#3A3A3C' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>MAP VIEW</Text>
            </TouchableOpacity>
          </View>
          {mapObjects.map((item) => (
            <TouchableOpacity
              key={item.objectId}
              onPress={() => { setSelectedMapObjectId(item.objectId); router.push('/resource/detail'); }}
              style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 8, flexDirection: 'row' }}
            >
              <View style={{ width: 4, backgroundColor: item.kind === 'hazard' ? '#FF3B30' : '#2D5A27' }} />
              <View style={{ flex: 1, padding: 16 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{item.label}</Text>
                <Text style={{ color: '#AEAEB2', fontSize: 13, marginTop: 4 }}>{item.kind} · {item.provenance} · {ageLabel(item.asOfS)}</Text>
              </View>
              <View style={{ justifyContent: 'center', paddingRight: 16 }}>
                <Text style={{ color: item.kind === 'hazard' ? '#FFD60A' : '#a1d494', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{item.state === undefined ? '—' : String(item.state)}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {mapObjects.length === 0 && <Text style={{ color: '#AEAEB2', fontSize: 14 }}>No map-operation packets are stored on this phone.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ageLabel(asOfS: number) { const age = Math.max(0, Math.round(Date.now() / 1000) - asOfS); return age < 60 ? 'just now' : `${Math.floor(age / 60)}m ago`; }
