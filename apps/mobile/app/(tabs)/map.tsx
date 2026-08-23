/**
 * MAP SCREEN — Offline Operational Map
 * PNG ref: screen (15)
 * Route: Map (tab)
 *
 * Per newmd:
 * - Tap Marker → Detail Sheet (read from local MapProjection)
 * - Switch to List View (local data)
 * All data from engine.projection (via mapObjects) — NO backend calls.
 *
 * This pass renders shelters/hospitals/food-water/safe-zones (green) and
 * SOS/incident pins (red, frozen at the location their SOS packet carried).
 * A live "locate me" position (blue) is a screen-local, manually-triggered
 * read — never auto-fetched, never polled. Responder/rescuer location is
 * explicitly out of scope for this pass.
 */

import React, { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, MapView, PointAnnotation, ShapeSource, CircleLayer, SymbolLayer, type CameraRef } from '@maplibre/maplibre-react-native';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { e7ToFloat } from '@dsm/codec';
import { mobileController } from '@/src/services/mobile-controller';

const REGION_CENTRE: [number, number] = [92.5, 26.1]; // IN-AS, matches the web console's default view
const REGION_ZOOM = 6.1;
const CLUSTER_MAX_ZOOM = 14;

const GREEN = '#2D5A27';
const AMBER = '#FFD60A';
const RED = '#FF3B30';
const BLUE = '#0A84FF';

const RASTER_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm-basemap', type: 'raster' as const, source: 'osm' }],
};

export default function MapScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const { mapObjects, setSelectedMapObjectId, focusMapObjectId, setFocusMapObjectId } = useAppStore();
  const [myLocation, setMyLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const cameraRef = useRef<CameraRef>(null);

  const MapIcon = icons.map;
  const ListIcon = icons.list;
  const LocationIcon = icons.location;

  const resourcePoints = useMemo(() => toFeatureCollection(mapObjects.filter((item) => item.kind === 'resource'), GREEN), [mapObjects]);
  const hazardPoints = useMemo(() => toFeatureCollection(mapObjects.filter((item) => item.kind === 'hazard'), AMBER), [mapObjects]);
  const incidentPoints = useMemo(() => toFeatureCollection(mapObjects.filter((item) => item.kind === 'incident'), RED), [mapObjects]);

  // Navigate button (resource/detail.tsx) sets focusMapObjectId then routes here.
  React.useEffect(() => {
    if (!focusMapObjectId) return;
    const target = mapObjects.find((item) => item.objectId === focusMapObjectId);
    if (target?.latE7 !== undefined && target.lonE7 !== undefined) {
      cameraRef.current?.setCamera({
        centerCoordinate: [e7ToFloat(target.lonE7), e7ToFloat(target.latE7)],
        zoomLevel: CLUSTER_MAX_ZOOM,
        animationDuration: 500,
      });
    }
    setFocusMapObjectId(undefined);
  }, [focusMapObjectId, mapObjects, setFocusMapObjectId]);

  const handleLocateMe = async () => {
    setLocating(true);
    try {
      const location = await mobileController.locateMe();
      if (!location || location.latE7 === undefined || location.lonE7 === undefined) {
        Alert.alert('Location unavailable', 'No cached position is available. Grant location access on the Readiness screen and try again.');
        return;
      }
      const lat = e7ToFloat(location.latE7);
      const lon = e7ToFloat(location.lonE7);
      setMyLocation({ lat, lon });
      cameraRef.current?.setCamera({ centerCoordinate: [lon, lat], zoomLevel: CLUSTER_MAX_ZOOM, animationDuration: 500 });
    } finally {
      setLocating(false);
    }
  };

  const handleFeaturePress = (event: { features: GeoJSON.Feature[]; coordinates: { latitude: number; longitude: number } }) => {
    const feature = event.features[0];
    if (!feature) return;
    const properties = feature.properties as { cluster?: boolean; objectId?: string } | null;
    if (properties?.cluster) {
      cameraRef.current?.setCamera({ centerCoordinate: [event.coordinates.longitude, event.coordinates.latitude], zoomLevel: CLUSTER_MAX_ZOOM, animationDuration: 400 });
      return;
    }
    if (properties?.objectId) {
      setSelectedMapObjectId(properties.objectId);
      router.push('/resource/detail');
    }
  };

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
            <Text style={{ color: '#a1d494', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>ONLINE BASEMAP · PROJECTION IS LOCAL</Text>
          </View>

          {/* Switch to list button */}
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            style={{ position: 'absolute', top: 12, right: 20, zIndex: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#3A3A3C' }}
          >
            <ListIcon size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>SWITCH TO LIST VIEW</Text>
          </TouchableOpacity>

          <MapView style={{ flex: 1 }} mapStyle={RASTER_STYLE} logoEnabled={false} attributionEnabled={false}>
            <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: REGION_CENTRE, zoomLevel: REGION_ZOOM }} />

            {resourcePoints.features.length > 0 && (
              <ShapeSource id="resources" shape={resourcePoints} cluster clusterRadius={44} clusterMaxZoomLevel={CLUSTER_MAX_ZOOM} onPress={handleFeaturePress}>
                <CircleLayer id="resource-clusters" filter={['has', 'point_count']} style={{ circleColor: GREEN, circleRadius: 16, circleStrokeWidth: 2, circleStrokeColor: '#FFFFFF' }} />
                <SymbolLayer id="resource-cluster-count" filter={['has', 'point_count']} style={{ textField: '{point_count}', textSize: 12, textColor: '#FFFFFF', textAllowOverlap: true }} />
                <CircleLayer id="resource-points" filter={['!', ['has', 'point_count']]} style={{ circleColor: ['get', 'color'], circleRadius: 8, circleStrokeWidth: 2, circleStrokeColor: '#FFFFFF' }} />
              </ShapeSource>
            )}

            {hazardPoints.features.length > 0 && (
              <ShapeSource id="hazards" shape={hazardPoints} cluster clusterRadius={44} clusterMaxZoomLevel={CLUSTER_MAX_ZOOM} onPress={handleFeaturePress}>
                <CircleLayer id="hazard-clusters" filter={['has', 'point_count']} style={{ circleColor: AMBER, circleRadius: 16, circleStrokeWidth: 2, circleStrokeColor: '#000000' }} />
                <SymbolLayer id="hazard-cluster-count" filter={['has', 'point_count']} style={{ textField: '{point_count}', textSize: 12, textColor: '#000000', textAllowOverlap: true }} />
                <CircleLayer id="hazard-points" filter={['!', ['has', 'point_count']]} style={{ circleColor: ['get', 'color'], circleRadius: 8, circleStrokeWidth: 2, circleStrokeColor: '#000000' }} />
              </ShapeSource>
            )}

            {incidentPoints.features.length > 0 && (
              <ShapeSource id="incidents" shape={incidentPoints} cluster clusterRadius={44} clusterMaxZoomLevel={CLUSTER_MAX_ZOOM} onPress={handleFeaturePress}>
                <CircleLayer id="incident-clusters" filter={['has', 'point_count']} style={{ circleColor: RED, circleRadius: 16, circleStrokeWidth: 2, circleStrokeColor: '#FFFFFF' }} />
                <SymbolLayer id="incident-cluster-count" filter={['has', 'point_count']} style={{ textField: '{point_count}', textSize: 12, textColor: '#FFFFFF', textAllowOverlap: true }} />
                <CircleLayer id="incident-points" filter={['!', ['has', 'point_count']]} style={{ circleColor: ['get', 'color'], circleRadius: 8, circleStrokeWidth: 2, circleStrokeColor: '#FFFFFF' }} />
              </ShapeSource>
            )}

            {myLocation && (
              <PointAnnotation id="my-location" coordinate={[myLocation.lon, myLocation.lat]}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: BLUE, borderWidth: 3, borderColor: '#FFFFFF' }} />
              </PointAnnotation>
            )}
          </MapView>

          {/* Legend */}
          <View style={{ position: 'absolute', bottom: 88, left: 20, backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 1, borderColor: '#3A3A3C', paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}>
            <LegendRow color={GREEN} label="Shelter / medical / food-water / safe zone" />
            <LegendRow color={AMBER} label="Hazard" />
            <LegendRow color={RED} label="SOS" />
            <LegendRow color={BLUE} label="My location" />
          </View>

          {/* Locate me */}
          <TouchableOpacity
            onPress={() => void handleLocateMe()}
            disabled={locating}
            style={{ position: 'absolute', bottom: 20, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: locating ? '#1C1C1E' : '#2D5A27', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C' }}
          >
            <LocationIcon size={22} color="#FFFFFF" />
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
          {mapObjects.map((item) => (
            <TouchableOpacity
              key={item.objectId}
              onPress={() => { setSelectedMapObjectId(item.objectId); router.push('/resource/detail'); }}
              style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 8, flexDirection: 'row' }}
            >
              <View style={{ width: 4, backgroundColor: item.kind === 'hazard' ? AMBER : item.kind === 'incident' ? RED : GREEN }} />
              <View style={{ flex: 1, padding: 16 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{item.label}</Text>
                <Text style={{ color: '#AEAEB2', fontSize: 13, marginTop: 4 }}>{item.kind} · {item.provenance} · {ageLabel(item.asOfS)}</Text>
              </View>
              <View style={{ justifyContent: 'center', paddingRight: 16 }}>
                <Text style={{ color: item.kind === 'hazard' ? AMBER : '#a1d494', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{item.state === undefined ? '—' : String(item.state)}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {mapObjects.length === 0 && <Text style={{ color: '#AEAEB2', fontSize: 14 }}>No map-operation packets are stored on this phone.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 8 }} />
      <Text style={{ color: '#AEAEB2', fontSize: 10 }}>{label}</Text>
    </View>
  );
}

function toFeatureCollection(items: readonly { objectId: string; latE7?: number; lonE7?: number }[], color: string): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: items
      .filter((item) => item.latE7 !== undefined && item.lonE7 !== undefined)
      .map((item) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e7ToFloat(item.lonE7!), e7ToFloat(item.latE7!)] },
        properties: { objectId: item.objectId, color },
      })),
  };
}

function ageLabel(asOfS: number) { const age = Math.max(0, Math.round(Date.now() / 1000) - asOfS); return age < 60 ? 'just now' : `${Math.floor(age / 60)}m ago`; }
