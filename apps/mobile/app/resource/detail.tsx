/**
 * RESOURCE DETAIL
 * PNG ref: screen (5)
 * Route: ResourceDetail
 *
 * Per newmd:
 * - Navigate → open offline route context
 * - Back → return to map or list
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';

export default function ResourceDetailScreen() {
  const router = useRouter();
  const { mapObjects, selectedMapObjectId } = useAppStore();
  const object = mapObjects.find((item) => item.objectId === selectedMapObjectId);

  const ArrowLeftIcon = icons.arrowLeft;
  const NavigationIcon = icons.navigation;
  const LocationIcon = icons.location;
  const AlertIcon = icons.alertCircle;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ArrowLeftIcon size={18} color="#a1d494" style={{ marginRight: 6 }} />
          <Text style={{ color: '#a1d494', fontSize: 14, fontWeight: '700' }}>BACK</Text>
        </TouchableOpacity>
        <Text style={{ color: '#AEAEB2', fontSize: 16, fontWeight: '700', letterSpacing: 1, flex: 1, textAlign: 'center' }}>RESOURCE</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Type + Name + Status */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{object?.kind.toUpperCase() ?? 'NO LOCAL RECORD'}</Text>
          <View style={{ backgroundColor: '#2D5A27', paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>{object?.state === undefined ? 'UNKNOWN' : String(object.state)}</Text>
          </View>
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 8 }}>{object?.label ?? 'No object selected'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 13 }}>⏱ {object ? `Packet time ${ageLabel(object.asOfS)} · ${object.provenance}` : 'No packet evidence'}</Text>
        </View>

        {/* Capacity card with green left bar */}
        <View style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 24 }}>
          <View style={{ width: 4, backgroundColor: '#2D5A27' }} />
          <View style={{ flex: 1, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#AEAEB2', fontSize: 20, marginRight: 8 }}>🛏</Text>
                <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>CAPACITY</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>NOT SUPPLIED</Text>
              </View>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#3A3A3C', paddingTop: 12, flexDirection: 'row', alignItems: 'center' }}>
              <AlertIcon size={16} color="#AEAEB2" style={{ marginRight: 8 }} />
              <Text style={{ color: '#AEAEB2', fontSize: 14, flex: 1 }}>No capacity or facility claim is shown unless it is present in a validated packet.</Text>
            </View>
          </View>
        </View>

        {/* Location section */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>LOCATION</Text>
        <View style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 24 }}>
          {/* Map placeholder */}
          <View style={{ height: 160, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#3A3A3C', justifyContent: 'center', alignItems: 'center' }}>
              <LocationIcon size={22} color="#AEAEB2" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#3A3A3C' }}>
            <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{coordinateLabel(object?.latE7, object?.lonE7)}</Text>
            <NavigationIcon size={18} color="#AEAEB2" />
          </View>
        </View>
      </ScrollView>

      {/* Bottom navigate button */}
      <View style={{ padding: 20, backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#3A3A3C' }}>
        <TouchableOpacity
          onPress={() => Alert.alert('Map renderer deferred', 'The validated coordinate is stored locally. Turn-by-turn map rendering is the one deferred implementation.')}
          style={{ backgroundColor: '#2D5A27', paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1, borderColor: '#2D5A27' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18, marginRight: 8 }}>△</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>NAVIGATE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ageLabel(asOfS: number) { const age = Math.max(0, Math.round(Date.now() / 1000) - asOfS); return age < 60 ? 'just now' : `${Math.floor(age / 60)}m ago`; }
function coordinateLabel(latE7?: number, lonE7?: number) { return latE7 === undefined || lonE7 === undefined ? 'NO COORDINATE IN PACKET' : `${(latE7 / 1e7).toFixed(5)}, ${(lonE7 / 1e7).toFixed(5)}`; }
