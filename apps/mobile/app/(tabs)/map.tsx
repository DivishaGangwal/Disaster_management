/**
 * MAP SCREEN — Offline Operational Map
 * PNG ref: screen (15)
 * Route: Map (tab)
 *
 * Per newmd:
 * - Tap Marker → Detail Sheet (read from local MapProjection)
 * - Switch to List View (local data)
 * All data from engine.projection — NO backend calls.
 *
 * Map canvas: Leaflet.js + OpenStreetMap via WebView.
 * No Google Maps API key required — works in Expo Go.
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useRuntime } from '@/src/contexts/RuntimeContext';
import { icons } from '@/constants/icons';
import { toEpochS } from '@dsm/codec';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VisibleObject } from '@dsm/mapkit';

// Default map centre — Mumbai (matches demo region)
const DEFAULT_LAT = 19.076;
const DEFAULT_LON = 72.8777;
const DEFAULT_ZOOM = 13;

function buildLeafletHtml(markers: { lat: number; lon: number; label: string; kind: string }[]): string {
  const markerJs = markers
    .map(
      (m) => `
      L.circleMarker([${m.lat}, ${m.lon}], {
        radius: 10,
        color: '${kindColor(m.kind)}',
        fillColor: '${kindColor(m.kind)}',
        fillOpacity: 0.85,
        weight: 2,
      }).addTo(map).bindPopup('<b>${m.label.replace(/'/g, "\\'")}</b><br/>${m.kind.toUpperCase()}');
    `,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map { height:100%; margin:0; padding:0; background:#000; }
  .leaflet-tile { filter: brightness(0.85) saturate(1.1); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true }).setView([${DEFAULT_LAT}, ${DEFAULT_LON}], ${DEFAULT_ZOOM});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);
  ${markerJs}
</script>
</body>
</html>`;
}

function kindColor(kind: string): string {
  switch (kind) {
    case 'hazard': return '#FF3B30';
    case 'incident': return '#FFD60A';
    case 'responder': return '#32D74B';
    default: return '#2D5A27';
  }
}

export default function MapScreen() {
  const router = useRouter();
  const { runtime } = useRuntime();
  const [showSheet, setShowSheet] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<VisibleObject | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [entities, setEntities] = useState<readonly { object: VisibleObject; ageS: number }[]>([]);
  const webViewRef = useRef<WebView>(null);

  const ListIcon = icons.list;
  const MapIcon = icons.map;
  const NavigationIcon = icons.navigation;
  const CloseIcon = icons.close;

  // Poll engine map projection every 2s
  useEffect(() => {
    if (!runtime) return;
    const tick = () => {
      const list = runtime.engine.projection.asList(toEpochS(Date.now()));
      setEntities(list);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [runtime]);

  const markers = entities
    .filter((e) => e.object.latE7 !== undefined && e.object.lonE7 !== undefined)
    .map((e) => ({
      lat: e.object.latE7! / 1e7,
      lon: e.object.lonE7! / 1e7,
      label: e.object.label,
      kind: e.object.kind,
    }));

  console.log('MARKERS TO RENDER:', markers);

  const leafletHtml = useMemo(() => buildLeafletHtml(markers), [JSON.stringify(markers)]);
  const webViewSource = useMemo(() => ({ html: leafletHtml }), [leafletHtml]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D5A27' }}>
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2 }}>
          TACTICAL MAP
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
            style={{ backgroundColor: '#1C1C1E', paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#3A3A3C', flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            {viewMode === 'map' ? <ListIcon size={14} color="#AEAEB2" /> : <MapIcon size={14} color="#AEAEB2" />}
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
              {viewMode === 'map' ? 'LIST' : 'MAP'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Entity count badge */}
      <View style={{ backgroundColor: '#0A0A0A', paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1C1C1E' }}>
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '600' }}>
          {entities.length} active {entities.length === 1 ? 'entity' : 'entities'} on mesh
        </Text>
        <Text style={{ color: '#3A3A3C', fontSize: 12 }}>OpenStreetMap · Leaflet</Text>
      </View>

      {viewMode === 'map' ? (
        <View style={{ flex: 1 }}>
          {/* Leaflet map via WebView */}
          <WebView
            ref={webViewRef}
            source={webViewSource}
            style={{ flex: 1, backgroundColor: '#000000' }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            onError={(e) => console.warn('WebView error', e.nativeEvent)}
          />

          {/* Bottom sheet (marker detail) */}
          {showSheet && selectedEntity && (
            <View style={{ backgroundColor: '#1C1C1E', borderTopWidth: 2, borderTopColor: kindColor(selectedEntity.kind), padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, backgroundColor: kindColor(selectedEntity.kind), marginRight: 8 }} />
                  <Text style={{ color: kindColor(selectedEntity.kind), fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
                    {selectedEntity.state !== undefined ? `STATE ${selectedEntity.state}` : 'ACTIVE'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowSheet(false)}>
                  <CloseIcon size={20} color="#AEAEB2" />
                </TouchableOpacity>
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 12 }}>
                {selectedEntity.label}
              </Text>
              <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 12 }}>
                <View style={{ flex: 1, padding: 12, borderRightWidth: 1, borderRightColor: '#3A3A3C' }}>
                  <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>SOURCE</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 14 }}>
                    {selectedEntity.provenance === 'tier1' ? 'Mesh Network' : selectedEntity.provenance.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, padding: 12 }}>
                  <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>LAST UPDATE</Text>
                  <Text style={{ color: '#a1d494', fontSize: 14 }}>
                    {formatAge(Math.max(0, Date.now() / 1000 - selectedEntity.asOfS))}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/resource/detail')}
                style={{ backgroundColor: '#2D5A27', paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
              >
                <NavigationIcon size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>VIEW DETAILS</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        /* List View */
        <ScrollView style={{ flex: 1, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700' }}>Map Entities</Text>
          </View>
          {entities.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ color: '#3A3A3C', fontSize: 40, marginBottom: 16 }}>◎</Text>
              <Text style={{ color: '#AEAEB2', fontSize: 14, fontWeight: '600', letterSpacing: 1 }}>NO ENTITIES YET</Text>
              <Text style={{ color: '#3A3A3C', fontSize: 12, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
                Start relay and fire an SOS to see mesh objects appear here
              </Text>
            </View>
          ) : (
            entities.map((ent, i) => {
              const { object, ageS } = ent;
              const barColor = kindColor(object.kind);
              const stateText = object.state !== undefined ? `STATE ${object.state}` : 'ACTIVE';
              const stateColor = object.state === 1 ? '#a1d494' : '#FFD60A';

              return (
                <TouchableOpacity
                  key={`${object.objectId}-${i}`}
                  onPress={() => {
                    setSelectedEntity(object);
                    setShowSheet(true);
                    setViewMode('map');
                  }}
                  style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 8, flexDirection: 'row' }}
                >
                  <View style={{ width: 4, backgroundColor: barColor }} />
                  <View style={{ flex: 1, padding: 16 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{object.label}</Text>
                    <Text style={{ color: '#AEAEB2', fontSize: 13, marginTop: 4 }}>
                      {object.kind.toUpperCase()} · Updated {formatAge(ageS)}
                    </Text>
                    {object.missingFromPack && (
                      <Text style={{ color: '#FF3B30', fontSize: 11, marginTop: 4 }}>Missing from offline pack</Text>
                    )}
                  </View>
                  <View style={{ justifyContent: 'center', paddingRight: 16 }}>
                    <Text style={{ color: stateColor, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{stateText}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
