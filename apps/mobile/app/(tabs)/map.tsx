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

export default function MapScreen() {
  const router = useRouter();
  const [showSheet, setShowSheet] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const MapIcon = icons.map;
  const ListIcon = icons.list;
  const LocationIcon = icons.location;
  const NavigationIcon = icons.navigation;
  const CloseIcon = icons.close;

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
            <Text style={{ color: '#AEAEB2', fontSize: 13, marginTop: 12, letterSpacing: 0.5 }}>MapLibre GL — workstream pending</Text>
          </View>

          {/* Bottom sheet (marker detail) */}
          {showSheet && (
            <View style={{ backgroundColor: '#1C1C1E', borderTopWidth: 2, borderTopColor: '#2D5A27', padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, backgroundColor: '#a1d494', marginRight: 8 }} />
                  <Text style={{ color: '#a1d494', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>OPEN</Text>
                </View>
                <TouchableOpacity onPress={() => setShowSheet(false)}>
                  <CloseIcon size={20} color="#AEAEB2" />
                </TouchableOpacity>
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 12 }}>EMERGENCY SHELTER</Text>
              <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 12 }}>
                <View style={{ flex: 1, padding: 12, borderRightWidth: 1, borderRightColor: '#3A3A3C' }}>
                  <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>SOURCE</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Mesh Network Peer</Text>
                </View>
                <View style={{ flex: 1, padding: 12 }}>
                  <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>LAST UPDATE</Text>
                  <Text style={{ color: '#a1d494', fontSize: 14 }}>2m ago</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {}}
                style={{ backgroundColor: '#2D5A27', paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1, borderColor: '#2D5A27' }}
              >
                <NavigationIcon size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>NAVIGATE</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tap to show sheet demo */}
          <TouchableOpacity
            onPress={() => setShowSheet(true)}
            style={{ position: 'absolute', bottom: showSheet ? 260 : 20, left: 20, backgroundColor: '#2D5A27', paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#a1d494' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>TAP FOR DEMO MARKER</Text>
          </TouchableOpacity>
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
          {[
            { name: 'District Hospital', type: 'Hospital', distance: '2.1 km', state: 'OPEN', barColor: '#2D5A27' },
            { name: 'Relief Camp A', type: 'Shelter', distance: '3.4 km', state: 'OPEN', barColor: '#2D5A27' },
            { name: 'Flooded Bridge', type: 'Hazard', distance: '0.9 km', state: 'ACTIVE', barColor: '#FF3B30' },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => router.push('/resource/detail')}
              style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 8, flexDirection: 'row' }}
            >
              <View style={{ width: 4, backgroundColor: item.barColor }} />
              <View style={{ flex: 1, padding: 16 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: '#AEAEB2', fontSize: 13, marginTop: 4 }}>{item.type} · {item.distance}</Text>
              </View>
              <View style={{ justifyContent: 'center', paddingRight: 16 }}>
                <Text style={{ color: item.state === 'ACTIVE' ? '#FFD60A' : '#a1d494', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{item.state}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
