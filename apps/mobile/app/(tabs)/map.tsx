/**
 * MAP SCREEN — Operational Map
 *
 * Every coordinate-bearing object in the local packet projection is rendered.
 * GPS is screen-local and continuous while this screen is mounted; projected
 * packet data remains local and never depends on the location watcher.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, DimensionValue, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Camera, MapView, MarkerView, type CameraRef } from '@maplibre/maplibre-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { e7ToFloat } from '@dsm/codec';
import { DEPLOYMENT } from '@dsm/contracts';
import { icons } from '@/constants/icons';
import { useAppStore, type RuntimeMapObject } from '@/store/useAppStore';
import { MUMBAI_MAP_STYLE_URL } from '@/src/services/offline-map';

const MUMBAI_CENTRE: [number, number] = [DEPLOYMENT.map.centerLon, DEPLOYMENT.map.centerLat];
const REGION_ZOOM = 10.2;
const DETAIL_ZOOM = 15;

const COLORS = {
  background: '#050811', surface: '#0D1424', surfaceStrong: '#141E33', border: 'rgba(0, 242, 254, 0.15)',
  text: '#F8FAFC', muted: '#94A3B8', green: '#00E676', resource: '#10B981',
  hazard: '#FFB300', incident: '#FF0055', responder: '#00F2FE', peer: '#A855F7',
  route: '#00C6FF', content: '#64748B', gps: '#00F2FE',
};

const MAP_KINDS = ['resource', 'hazard', 'incident', 'responder', 'peer', 'route', 'content'] as const;
type MapKind = (typeof MAP_KINDS)[number];
type FilterState = Record<MapKind, boolean>;
type GpsStatus = 'checking' | 'permission-needed' | 'searching' | 'tracking' | 'services-off' | 'error';

interface DeviceLocation { lat: number; lon: number; accuracyM: number; updatedAt: number; }

const INITIAL_FILTERS: FilterState = {
  resource: true, hazard: true, incident: true, responder: true, peer: true, route: true, content: true,
};

export default function MapScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraRef>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription>();
  const centerNextFixRef = useRef(false);
  const mountedRef = useRef(true);

  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation>();
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('checking');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const { mapObjects, selectedRegion, setLocationEnabled, setSelectedMapObjectId, focusMapObjectId, setFocusMapObjectId } = useAppStore();
  const coordinateObjects = useMemo(() => mapObjects.filter(hasCoordinate), [mapObjects]);
  const visibleObjects = useMemo(() => coordinateObjects.filter((item) => filters[normaliseKind(item.kind)]), [coordinateObjects, filters]);
  const listObjects = useMemo(() => mapObjects.filter((item) => filters[normaliseKind(item.kind)]), [mapObjects, filters]);
  const counts = useMemo(() => {
    const result: Record<MapKind, number> = { resource: 0, hazard: 0, incident: 0, responder: 0, peer: 0, route: 0, content: 0 };
    for (const item of mapObjects) result[normaliseKind(item.kind)] += 1;
    return result;
  }, [mapObjects]);

  const applyLocation = useCallback((fix: Location.LocationObject) => {
    if (!mountedRef.current) return;
    const next = { lat: fix.coords.latitude, lon: fix.coords.longitude, accuracyM: Math.max(1, Math.round(fix.coords.accuracy ?? 100)), updatedAt: fix.timestamp };
    setDeviceLocation(next);
    setGpsStatus('tracking');
    if (!useAppStore.getState().locationEnabled) {
      useAppStore.getState().setLocationEnabled(true);
    }
    if (centerNextFixRef.current) {
      centerNextFixRef.current = false;
      cameraRef.current?.setCamera({ centerCoordinate: [next.lon, next.lat], zoomLevel: DETAIL_ZOOM, animationDuration: 650 });
    }
  }, []);

  const startLocationWatch = useCallback(async (centerOnFirstFix: boolean) => {
    if (!await Location.hasServicesEnabledAsync()) {
      setGpsStatus('services-off');
      if (useAppStore.getState().locationEnabled) setLocationEnabled(false);
      return;
    }
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      setGpsStatus('permission-needed');
      if (useAppStore.getState().locationEnabled) setLocationEnabled(false);
      return;
    }
    if (centerOnFirstFix) centerNextFixRef.current = true;
    setGpsStatus('searching');
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5_000, distanceInterval: 3 },
      applyLocation,
    );
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 500 });
    if (lastKnown) applyLocation(lastKnown);
  }, [applyLocation, setLocationEnabled]);

  const requestAndLocate = useCallback(async () => {
    try {
      if (!await Location.hasServicesEnabledAsync()) {
        setGpsStatus('services-off');
        Alert.alert('Turn on device location', 'GPS/location services are off. Enable them in Android settings, then tap the location button again.');
        return;
      }
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setGpsStatus('permission-needed');
        setLocationEnabled(false);
        Alert.alert('Location permission needed', 'Allow precise location so the map can show and follow your position.');
        return;
      }
      if (deviceLocation) cameraRef.current?.setCamera({ centerCoordinate: [deviceLocation.lon, deviceLocation.lat], zoomLevel: DETAIL_ZOOM, animationDuration: 500 });
      await startLocationWatch(!deviceLocation);
    } catch {
      setGpsStatus('error');
      Alert.alert('Location unavailable', 'The phone could not obtain a GPS fix. Move somewhere with a clearer sky view and try again.');
    }
  }, [deviceLocation, setLocationEnabled, startLocationWatch]);

  useEffect(() => {
    mountedRef.current = true;
    void startLocationWatch(true).catch(() => setGpsStatus('error'));
    return () => {
      mountedRef.current = false;
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = undefined;
    };
  }, [startLocationWatch]);

  useEffect(() => {
    if (!focusMapObjectId) return;
    const target = mapObjects.find((item) => item.objectId === focusMapObjectId);
    if (target && hasCoordinate(target)) {
      setViewMode('map');
      cameraRef.current?.setCamera({ centerCoordinate: [e7ToFloat(target.lonE7), e7ToFloat(target.latE7)], zoomLevel: DETAIL_ZOOM, animationDuration: 600 });
    }
    setFocusMapObjectId(undefined);
  }, [focusMapObjectId, mapObjects, setFocusMapObjectId]);

  const openObject = useCallback((item: RuntimeMapObject) => {
    setSelectedMapObjectId(item.objectId);
    router.push('/resource/detail');
  }, [router, setSelectedMapObjectId]);

  const fitVisible = useCallback(() => {
    const coordinates: [number, number][] = visibleObjects.map((item) => [e7ToFloat(item.lonE7), e7ToFloat(item.latE7)]);
    if (deviceLocation) coordinates.push([deviceLocation.lon, deviceLocation.lat]);
    if (coordinates.length === 0) return Alert.alert('Nothing to frame', 'Enable a map layer or obtain a GPS fix first.');
    if (coordinates.length === 1) {
      cameraRef.current?.setCamera({ centerCoordinate: coordinates[0], zoomLevel: DETAIL_ZOOM, animationDuration: 500 });
      return;
    }
    const lons = coordinates.map(([lon]) => lon);
    const lats = coordinates.map(([, lat]) => lat);
    cameraRef.current?.fitBounds([Math.max(...lons), Math.max(...lats)], [Math.min(...lons), Math.min(...lats)], [120, 48, 180, 48], 650);
  }, [deviceLocation, visibleObjects]);

  const toggleFilter = useCallback((kind: MapKind) => setFilters((current) => ({ ...current, [kind]: !current[kind] })), []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>OPERATIONAL PICTURE</Text>
          <Text style={styles.title} numberOfLines={1}>{selectedRegion}</Text>
        </View>
        <View style={styles.viewSwitch}>
          <ModeButton icon="map" active={viewMode === 'map'} label="Map" onPress={() => setViewMode('map')} />
          <ModeButton icon="list" active={viewMode === 'list'} label="List" onPress={() => setViewMode('list')} />
        </View>
      </View>

      <FilterBar filters={filters} counts={counts} onToggle={toggleFilter} />

      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          {!mapError ? (
            <MapView
              style={StyleSheet.absoluteFill}
              mapStyle={typeof MUMBAI_MAP_STYLE_URL === 'string' ? MUMBAI_MAP_STYLE_URL : JSON.stringify(MUMBAI_MAP_STYLE_URL)}
              logoEnabled={false}
              attributionEnabled={false}
              onDidFinishLoadingStyle={() => { setMapReady(true); setMapError(false); }}
              onDidFailLoadingMap={() => {
                setMapReady(false);
                setMapError(true);
              }}
            >
              <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: MUMBAI_CENTRE, zoomLevel: REGION_ZOOM }} />
              {visibleObjects.map((item) => <OperationalMarker key={item.objectId} item={item} onPress={() => openObject(item)} />)}
              {deviceLocation && (
                <MarkerView coordinate={[deviceLocation.lon, deviceLocation.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Your current location, accurate to approximately ${deviceLocation.accuracyM} metres`} onPress={() => void requestAndLocate()} style={styles.gpsMarkerTouch}>
                    <View style={styles.gpsPulse}><View style={styles.gpsDot} /></View>
                  </TouchableOpacity>
                </MarkerView>
              )}
            </MapView>
          ) : (
            <TacticalGridMap
              visibleObjects={visibleObjects}
              deviceLocation={deviceLocation}
              openObject={openObject}
              requestAndLocate={() => void requestAndLocate()}
            />
          )}

          {!mapReady && !mapError && <View style={styles.mapLoading} pointerEvents="none"><ActivityIndicator color={COLORS.green} /><Text style={styles.mapLoadingText}>Loading map</Text></View>}
          {mapError && (
            <View style={styles.mapErrorCard}>
              <icons.alertCircle size={18} color={COLORS.hazard} />
              <Text style={styles.mapErrorText}>Basemap tiles unavailable. Operational markers are shown on tactical grid.</Text>
              <TouchableOpacity onPress={() => { setMapError(false); setMapReady(false); }} style={{ backgroundColor: 'rgba(0, 242, 254, 0.2)', borderWidth: 1, borderColor: '#00F2FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ color: '#00F2FE', fontSize: 10, fontWeight: '800' }}>RETRY</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.mapStatusCard} pointerEvents="none">
            <View style={[styles.statusDot, { backgroundColor: gpsStatus === 'tracking' ? COLORS.green : gpsStatus === 'error' ? COLORS.incident : COLORS.hazard }]} />
            <View style={styles.statusCopy}><Text style={styles.statusTitle}>{gpsTitle(gpsStatus)}</Text><Text style={styles.statusDetail}>{gpsDetail(gpsStatus, deviceLocation)}</Text></View>
          </View>

          <View style={styles.mapActions}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Frame all visible map features" onPress={fitVisible} style={styles.mapActionButton}><icons.layers size={21} color={COLORS.text} /></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Find and centre my location" onPress={() => void requestAndLocate()} style={[styles.mapActionButton, styles.locationButton]}>
              {gpsStatus === 'searching' || gpsStatus === 'checking' ? <ActivityIndicator color="#FFFFFF" size="small" /> : <icons.navigation size={22} color="#FFFFFF" fill="#FFFFFF" />}
            </TouchableOpacity>
          </View>

          <View style={styles.mapSummary} pointerEvents="none">
            <Text style={styles.mapSummaryStrong}>{visibleObjects.length}</Text><Text style={styles.mapSummaryText}> visible on map</Text>
            {mapObjects.length > coordinateObjects.length && <Text style={styles.mapSummaryMuted}> · {mapObjects.length - coordinateObjects.length} list-only</Text>}
          </View>
        </View>
      ) : (
        <FlatList
          data={listObjects}
          keyExtractor={(item) => item.objectId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <MapListRow item={item} onPress={() => openObject(item)} />}
          ListEmptyComponent={<View style={styles.emptyState}><icons.map size={34} color={COLORS.muted} /><Text style={styles.emptyTitle}>No matching map features</Text><Text style={styles.emptyCopy}>Enable more layers above or receive regional packets through the mesh.</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

function FilterBar({ filters, counts, onToggle }: { filters: FilterState; counts: Record<MapKind, number>; onToggle: (kind: MapKind) => void }) {
  return (
    <FlatList
      horizontal data={MAP_KINDS} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterContent} style={styles.filterBar}
      renderItem={({ item }) => {
        const active = filters[item]; const Icon = iconForKind(item); const color = colorForKind(item);
        return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: active }} accessibilityLabel={`${kindLabel(item)} layer, ${counts[item]} items`} onPress={() => onToggle(item)} style={[styles.filterChip, active && { borderColor: color, backgroundColor: `${color}1F` }]}>
          <Icon size={15} color={active ? color : COLORS.muted} /><Text style={[styles.filterLabel, active && { color: COLORS.text }]}>{kindLabel(item)}</Text>
          <View style={[styles.countBadge, active && { backgroundColor: color }]}><Text style={[styles.countText, active && { color: '#FFFFFF' }]}>{counts[item]}</Text></View>
        </TouchableOpacity>;
      }}
    />
  );
}function TacticalGridMap({
  visibleObjects,
  deviceLocation,
  openObject,
  requestAndLocate,
}: {
  visibleObjects: (RuntimeMapObject & { latE7: number; lonE7: number })[];
  deviceLocation?: DeviceLocation;
  openObject: (item: RuntimeMapObject) => void;
  requestAndLocate: () => void;
}) {
  const minLon = 72.72;
  const maxLon = 73.08;
  const minLat = 18.88;
  const maxLat = 19.32;

  const getPos = (lat: number, lon: number): { left: DimensionValue; top: DimensionValue } => {
    const left = Math.max(6, Math.min(90, ((lon - minLon) / (maxLon - minLon)) * 100));
    const top = Math.max(6, Math.min(90, (1 - (lat - minLat) / (maxLat - minLat)) * 100));
    return { left: `${left.toFixed(2)}%` as unknown as DimensionValue, top: `${top.toFixed(2)}%` as unknown as DimensionValue };
  };

  return (
    <View style={styles.tacticalContainer}>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.gridLineH1} />
        <View style={styles.gridLineH2} />
        <View style={styles.gridLineV1} />
        <View style={styles.gridLineV2} />
        <Text style={styles.gridCoordTL}>19.30° N, 72.75° E</Text>
        <Text style={styles.gridCoordTR}>19.30° N, 73.05° E</Text>
        <Text style={styles.gridCoordBL}>18.90° N, 72.75° E</Text>
        <Text style={styles.gridCoordBR}>18.90° N, 73.05° E</Text>
        <Text style={styles.gridWatermark}>MUMBAI OPERATIONAL GRID</Text>
      </View>

      {visibleObjects.map((item) => {
        const lat = e7ToFloat(item.latE7);
        const lon = e7ToFloat(item.lonE7);
        const pos = getPos(lat, lon);
        const kind = normaliseKind(item.kind);
        const Icon = iconForObject(item);
        const color = colorForKind(kind);

        return (
          <TouchableOpacity
            key={item.objectId}
            accessibilityRole="button"
            accessibilityLabel={`${kindLabel(kind)}: ${item.label}`}
            onPress={() => openObject(item)}
            style={[styles.tacticalMarkerTouch, pos]}
          >
            <View style={[styles.tacticalMarkerCircle, { backgroundColor: color }]}>
              <Icon size={16} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <View style={styles.tacticalMarkerTag}>
              <Text style={styles.tacticalMarkerText} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {deviceLocation && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={requestAndLocate}
          style={[styles.tacticalGpsTouch, getPos(deviceLocation.lat, deviceLocation.lon)]}
        >
          <View style={styles.gpsPulse}>
            <View style={styles.gpsDot} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

function OperationalMarker({ item, onPress }: { item: RuntimeMapObject & { latE7: number; lonE7: number }; onPress: () => void }) {
  const kind = normaliseKind(item.kind); const Icon = iconForObject(item); const color = colorForKind(kind);
  return (
    <MarkerView coordinate={[e7ToFloat(item.lonE7), e7ToFloat(item.latE7)]} anchor={{ x: 0.5, y: 1 }} allowOverlap>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${kindLabel(kind)}: ${item.label}, updated ${ageLabel(item.asOfS)}`} onPress={onPress} activeOpacity={0.78} style={styles.markerTouch}>
        <View style={[styles.marker, { backgroundColor: color }]}><Icon size={20} color="#FFFFFF" strokeWidth={2.6} /></View>
        <View style={[styles.markerPointer, { borderTopColor: color }]} />
      </TouchableOpacity>
    </MarkerView>
  );
}

function MapListRow({ item, onPress }: { item: RuntimeMapObject; onPress: () => void }) {
  const kind = normaliseKind(item.kind); const Icon = iconForObject(item); const color = colorForKind(kind);
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.listRow}>
      <View style={[styles.listIcon, { backgroundColor: `${color}22`, borderColor: color }]}><Icon size={21} color={color} /></View>
      <View style={styles.listCopy}><Text style={styles.listKind}>{kindLabel(kind).toUpperCase()} · {item.provenance.toUpperCase()}</Text><Text style={styles.listTitle} numberOfLines={1}>{item.label}</Text><Text style={styles.listMeta}>{hasCoordinate(item) ? coordinateLabel(item) : 'No coordinate · list only'} · {ageLabel(item.asOfS)}</Text></View>
      <icons.arrowRight size={20} color={COLORS.muted} />
    </TouchableOpacity>
  );
}

function ModeButton({ icon, active, label, onPress }: { icon: 'map' | 'list'; active: boolean; label: string; onPress: () => void }) {
  const Icon = icons[icon];
  return <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}><Icon size={17} color={active ? COLORS.background : COLORS.muted} /><Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text></TouchableOpacity>;
}

function hasCoordinate(item: RuntimeMapObject): item is RuntimeMapObject & { latE7: number; lonE7: number } { return item.latE7 !== undefined && item.lonE7 !== undefined; }
function normaliseKind(kind: string): MapKind { return MAP_KINDS.includes(kind as MapKind) ? kind as MapKind : 'content'; }
function kindLabel(kind: MapKind) { switch (kind) { case 'resource': return 'Help'; case 'incident': return 'SOS'; case 'responder': return 'Responders'; case 'peer': return 'Phones'; case 'route': return 'Routes'; case 'hazard': return 'Hazards'; default: return 'Content'; } }
function colorForKind(kind: MapKind) { return COLORS[kind]; }
function iconForKind(kind: MapKind) { switch (kind) { case 'resource': return icons.shelter; case 'hazard': return icons.alert; case 'incident': return icons.sos; case 'responder': return icons.responder; case 'peer': return icons.users; case 'route': return icons.navigation; default: return icons.package; } }
function iconForObject(item: RuntimeMapObject) { const kind = normaliseKind(item.kind); if (kind !== 'resource') return iconForKind(kind); const label = item.label.toLowerCase(); if (label.includes('hospital') || label.includes('medical') || label.includes('clinic')) return icons.hospital; if (label.includes('food') || label.includes('water')) return icons.food; if (label.includes('safe')) return icons.shield; return icons.shelter; }
function gpsTitle(status: GpsStatus) { switch (status) { case 'tracking': return 'GPS tracking active'; case 'searching': return 'Finding your position'; case 'permission-needed': return 'Location permission needed'; case 'services-off': return 'Device location is off'; case 'error': return 'GPS unavailable'; default: return 'Checking location'; } }
function gpsDetail(status: GpsStatus, location?: DeviceLocation) { if (status === 'tracking' && location) return `Accuracy ±${location.accuracyM} m · updated ${ageLabel(Math.round(location.updatedAt / 1000))}`; if (status === 'permission-needed') return 'Tap the blue arrow to enable it'; if (status === 'services-off') return 'Enable GPS in Android settings'; if (status === 'error') return 'Tap the blue arrow to retry'; return 'Waiting for a reliable fix'; }
function ageLabel(asOfS: number) { const age = Math.max(0, Math.round(Date.now() / 1000) - asOfS); if (age < 10) return 'just now'; if (age < 60) return `${age}s ago`; if (age < 3_600) return `${Math.floor(age / 60)}m ago`; return `${Math.floor(age / 3_600)}h ago`; }
function coordinateLabel(item: RuntimeMapObject & { latE7: number; lonE7: number }) { return `${e7ToFloat(item.latE7).toFixed(4)}, ${e7ToFloat(item.lonE7).toFixed(4)}`; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { minHeight: 68, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerCopy: { flex: 1, marginRight: 12 }, eyebrow: { color: COLORS.responder, fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.5 }, title: { color: COLORS.text, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  viewSwitch: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }, modeButton: { minWidth: 64, minHeight: 38, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }, modeButtonActive: { backgroundColor: COLORS.responder }, modeLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' }, modeLabelActive: { color: '#050811' },
  filterBar: { maxHeight: 58, flexGrow: 0, backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.border }, filterContent: { paddingHorizontal: 14, paddingVertical: 9, gap: 8 }, filterChip: { minHeight: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }, filterLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' }, countBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: COLORS.surfaceStrong, alignItems: 'center', justifyContent: 'center' }, countText: { color: COLORS.muted, fontSize: 10, fontWeight: '900' },
  mapContainer: { flex: 1, overflow: 'hidden' }, mapLoading: { position: 'absolute', top: '42%', alignSelf: 'center', flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border }, mapLoadingText: { color: COLORS.text, fontSize: 13, fontWeight: '700' }, mapErrorCard: { position: 'absolute', top: 14, left: 14, right: 14, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(13,20,36,0.96)', borderWidth: 1, borderColor: COLORS.hazard }, mapErrorText: { flex: 1, color: COLORS.text, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  mapStatusCard: { position: 'absolute', top: 14, left: 14, maxWidth: 245, minHeight: 54, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(13,20,36,0.92)', borderWidth: 1, borderColor: COLORS.border }, statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 }, statusCopy: { flexShrink: 1 }, statusTitle: { color: COLORS.text, fontSize: 12, lineHeight: 16, fontWeight: '800' }, statusDetail: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 1 },
  mapActions: { position: 'absolute', right: 14, bottom: 74, gap: 10 }, mapActionButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,20,36,0.94)', borderWidth: 1, borderColor: COLORS.border, elevation: 5, shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, locationButton: { backgroundColor: COLORS.gps, borderColor: '#FFFFFF' },
  mapSummary: { position: 'absolute', left: 14, bottom: 16, minHeight: 42, flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(13,20,36,0.94)', borderWidth: 1, borderColor: COLORS.border }, mapSummaryStrong: { color: COLORS.text, fontSize: 17, fontWeight: '900' }, mapSummaryText: { color: COLORS.text, fontSize: 11, fontWeight: '700' }, mapSummaryMuted: { color: COLORS.muted, fontSize: 10, fontWeight: '600' },
  markerTouch: { width: 48, height: 58, alignItems: 'center', justifyContent: 'flex-end' }, marker: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', elevation: 7, shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } }, markerPointer: { width: 0, height: 0, marginTop: -1, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  gpsMarkerTouch: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' }, gpsPulse: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,242,254,0.22)', borderWidth: 2, borderColor: 'rgba(0,242,254,0.5)', alignItems: 'center', justifyContent: 'center' }, gpsDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.gps, borderWidth: 4, borderColor: '#FFFFFF', elevation: 5 },
  listContent: { padding: 14, paddingBottom: 100, gap: 10 }, listRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }, listIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginRight: 12 }, listCopy: { flex: 1, marginRight: 8 }, listKind: { color: COLORS.responder, fontSize: 9, lineHeight: 13, fontWeight: '900', letterSpacing: 0.8 }, listTitle: { color: COLORS.text, fontSize: 15, lineHeight: 21, fontWeight: '800' }, listMeta: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  emptyState: { paddingHorizontal: 32, paddingVertical: 70, alignItems: 'center' }, emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 14 }, emptyCopy: { color: COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  tacticalContainer: { flex: 1, backgroundColor: '#050811', position: 'relative', overflow: 'hidden' },
  gridLineH1: { position: 'absolute', top: '33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,242,254,0.1)' },
  gridLineH2: { position: 'absolute', top: '66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,242,254,0.1)' },
  gridLineV1: { position: 'absolute', left: '33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,242,254,0.1)' },
  gridLineV2: { position: 'absolute', left: '66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,242,254,0.1)' },
  gridCoordTL: { position: 'absolute', top: 12, left: 12, color: COLORS.muted, fontSize: 10, fontFamily: 'monospace' },
  gridCoordTR: { position: 'absolute', top: 12, right: 12, color: COLORS.muted, fontSize: 10, fontFamily: 'monospace' },
  gridCoordBL: { position: 'absolute', bottom: 12, left: 12, color: COLORS.muted, fontSize: 10, fontFamily: 'monospace' },
  gridCoordBR: { position: 'absolute', bottom: 12, right: 12, color: COLORS.muted, fontSize: 10, fontFamily: 'monospace' },
  gridWatermark: { position: 'absolute', bottom: '45%', alignSelf: 'center', color: 'rgba(0,242,254,0.06)', fontSize: 16, fontWeight: '900', letterSpacing: 4 },
  tacticalMarkerTouch: { position: 'absolute', alignItems: 'center', marginLeft: -18, marginTop: -18 },
  tacticalMarkerCircle: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', elevation: 4 },
  tacticalMarkerTag: { marginTop: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(13,20,36,0.92)', borderWidth: 1, borderColor: COLORS.border, maxWidth: 100 },
  tacticalMarkerText: { color: '#F8FAFC', fontSize: 9, fontWeight: '700' },
  tacticalGpsTouch: { position: 'absolute', marginLeft: -29, marginTop: -29 },
});
