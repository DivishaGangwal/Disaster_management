import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { DEPLOYMENT, TIME } from '@dsm/contracts';
import { e7ToFloat } from './coordinates';
import type { GatewayAudit, Incident, RegionalRecord } from './types';
import { isOperationallyUsable } from './operational-status';
import { reconcileKeyed } from './keyed-reconciler';

type Filter = 'incidents' | 'centres' | 'routes' | 'hazards' | 'gateways';

interface Props {
  incidents: Incident[];
  records: RegionalRecord[];
  gateways?: GatewayAudit;
  selected: string;
  onSelect: (id: string) => void;
  onQuickState?: (id: string, state: string) => void;
  /** Broadcast point being composed, in degrees. Shown as a draggable pin. */
  pick?: { lat: number; lon: number } | null;
  /** Supplying this turns the map into a location picker. */
  onPick?: (lat: number, lon: number) => void;
  /** Compact chrome for the campaign composer panel. */
  compact?: boolean;
}

type OperationFeature = GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>;

interface OperationMarker {
  readonly marker: maplibregl.Marker;
  readonly element: HTMLButtonElement;
  readonly glyph: HTMLSpanElement;
  readonly label: HTMLElement;
  properties: Record<string, string>;
  coordinates: [number, number];
}

export function OperationsMap({ incidents, records, gateways, selected, onSelect, onQuickState, pick, onPick, compact }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap>();
  const pickMarker = useRef<maplibregl.Marker>();
  const operationMarkers = useRef<Map<string, OperationMarker>>(new Map());
  const initialSelection = useRef(selected);
  const callbacks = useRef({ onSelect, onQuickState, onPick });
  const [ready, setReady] = useState(false);
  const [created, setCreated] = useState(false);
  const [filters, setFilters] = useState<Set<Filter>>(() => new Set(['incidents', 'centres', 'routes', 'hazards', 'gateways']));
  const [mapReadout, setMapReadout] = useState({ zoom: 10.2, lat: DEPLOYMENT.map.centerLat, lon: DEPLOYMENT.map.centerLon });
  callbacks.current = { onSelect, onQuickState, onPick };

  const data = useMemo(() => featureCollection(incidents, records, gateways, filters), [incidents, records, gateways, filters]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
        sources: {
          osm: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors © CARTO',
          },
        },
        layers: [
          { id: 'basemap-background', type: 'background', paint: { 'background-color': '#e7edf0' } },
          { id: 'osm-basemap', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.2, 'raster-contrast': 0.04, 'raster-opacity': 0.95 } },
        ],
      },
      center: [DEPLOYMENT.map.centerLon, DEPLOYMENT.map.centerLat],
      zoom: 10.2,
      minZoom: 7,
      maxZoom: 17,
      attributionControl: false,
    });
    map.current = instance;
    setCreated(true);
    // Picking is registered outside the load handler: an operator can still
    // place a point when the basemap tiles are slow or unreachable.
    instance.on('click', (event) => {
      if (!callbacks.current.onPick) return;
      callbacks.current.onPick(event.lngLat.lat, event.lngLat.lng);
    });
    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    instance.addControl(new maplibregl.FullscreenControl(), 'top-right');
    instance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    instance.on('load', () => {
      instance.on('mousemove', (event) => setMapReadout((current) => ({ ...current, lat: event.lngLat.lat, lon: event.lngLat.lng })));
      instance.on('zoomend', () => setMapReadout((current) => ({ ...current, zoom: instance.getZoom() })));
      setReady(true);
    });
    return () => { operationMarkers.current.forEach((entry) => entry.marker.remove()); operationMarkers.current.clear(); instance.remove(); map.current = undefined; setCreated(false); };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    const features = data.features.filter((feature): feature is OperationFeature => feature.geometry.type === 'Point' && Boolean(feature.properties));
    const update = (entry: OperationMarker, feature: OperationFeature) => {
      const properties = feature.properties as Record<string, string>;
      const coordinates = feature.geometry.coordinates as [number, number];
      entry.properties = properties;
      entry.coordinates = coordinates;
      entry.element.className = 'ops-map-marker marker-' + properties.featureType + ' status-' + properties.status;
      entry.element.classList.toggle('selected', properties.id === selected);
      entry.element.setAttribute('aria-label', properties.label + ': ' + properties.subtitle);
      entry.element.title = properties.label + ' — ' + properties.subtitle;
      entry.glyph.textContent = properties.glyph;
      entry.label.textContent = properties.label;
      entry.marker.setLngLat(coordinates);
    };
    reconcileKeyed(
      operationMarkers.current,
      features,
      (feature) => String(feature.properties?.id),
      (feature) => {
        const button = document.createElement('button');
        button.type = 'button';
        const glyph = document.createElement('span');
        const label = document.createElement('small');
        const entry: OperationMarker = {
          marker: new maplibregl.Marker({ element: button, anchor: 'center' }),
          element: button,
          glyph,
          label,
          properties: {},
          coordinates: [0, 0],
        };
        button.append(glyph, label);
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          callbacks.current.onSelect(entry.properties.id);
          showPopup(map.current!, entry.coordinates, entry.properties, callbacks.current.onQuickState);
        });
        update(entry, feature);
        entry.marker.addTo(map.current!);
        return entry;
      },
      update,
      (entry) => entry.marker.remove(),
    );
  }, [data, ready]);

  useEffect(() => {
    operationMarkers.current.forEach((entry, id) => entry.element.classList.toggle('selected', id === selected));
  }, [selected]);

  useEffect(() => {
    const instance = map.current;
    if (!created || !instance) return;
    instance.getCanvas().style.cursor = onPick ? 'crosshair' : '';
    if (!pick) { pickMarker.current?.remove(); pickMarker.current = undefined; return; }
    if (!pickMarker.current) {
      const marker = new maplibregl.Marker({ color: '#1565ff', draggable: Boolean(onPick), scale: 1.45 });
      marker.on('dragend', () => { const point = marker.getLngLat(); callbacks.current.onPick?.(point.lat, point.lng); });
      pickMarker.current = marker.setLngLat([pick.lon, pick.lat]).addTo(instance);
      return;
    }
    pickMarker.current.setLngLat([pick.lon, pick.lat]);
  }, [pick?.lat, pick?.lon, onPick, created]);

  useEffect(() => () => { pickMarker.current?.remove(); pickMarker.current = undefined; }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    if (selected === initialSelection.current) return;
    initialSelection.current = selected;
    const feature = data.features.find((item) => item.properties?.id === selected);
    if (feature?.geometry.type === 'Point') map.current.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: Math.max(map.current.getZoom(), 7.2), duration: 450 });
  }, [selected, data, ready]);

  const toggle = (filter: Filter) => setFilters((current) => { const next = new Set(current); next.has(filter) ? next.delete(filter) : next.add(filter); return next; });
  const unavailable = records.filter((record) => !isOperationallyUsable(record)).length;
  const selectedLabel = records.find((record) => record.objectId === selected)?.name ?? incidents.find((incident) => incident.incidentId === selected)?.incidentId ?? gateways?.gateways.find((gateway) => gateway.gatewayToken === selected)?.nodeToken;
  return <div className={compact ? 'maplibre-shell compact' : 'maplibre-shell'}>
    <div className="map-toolbar" aria-label="Map layers">{(['incidents', 'centres', 'routes', 'hazards', ...(gateways ? ['gateways' as const] : [])] as Filter[]).map((filter) => <button key={filter} aria-pressed={filters.has(filter)} className={filters.has(filter) ? 'active' : ''} onClick={() => toggle(filter)}><i aria-hidden="true">{filters.has(filter) ? '✓' : ''}</i>{filter}</button>)}<button onClick={() => map.current?.fitBounds([[DEPLOYMENT.map.minLonE7 / 1e7, DEPLOYMENT.map.minLatE7 / 1e7], [DEPLOYMENT.map.maxLonE7 / 1e7, DEPLOYMENT.map.maxLatE7 / 1e7]], { padding: 44, maxZoom: 12 })}>Fit Mumbai</button></div>
    <div ref={container} className="maplibre-canvas" />
    {!compact && <div className="map-overview"><span><b>{data.features.length}</b> visible</span>{records.length > 0 && <><span><b>{records.length - unavailable}</b> available</span><span><b>{unavailable}</b> restricted</span></>}<span className="map-selection">{selectedLabel ?? 'No selection'}</span></div>}
    {onPick && <div className="map-pick-hint">{pick ? 'Drag the pin or click the map to move the broadcast point' : 'Click the map, or a marker, to set the broadcast point'}</div>}
    <div className="map-readout">Z{mapReadout.zoom.toFixed(1)} · {mapReadout.lat.toFixed(4)}, {mapReadout.lon.toFixed(4)}</div>
    {!ready && <div className="map-loading">Loading operational basemap…</div>}
  </div>;
}

function featureCollection(incidents: Incident[], records: RegionalRecord[], gateways: GatewayAudit | undefined, filters: Set<Filter>): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  if (filters.has('incidents')) for (const item of incidents) if (item.latE7 != null && item.lonE7 != null) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [e7ToFloat(item.lonE7), e7ToFloat(item.latE7)] }, properties: { id: item.incidentId, featureType: 'incident', glyph: `S${item.severity}`, label: categoryName(item.category), subtitle: `${item.peopleTotal ?? 0} people · ${item.observationCount} gateway observation${item.observationCount === 1 ? '' : 's'} · position ${locationAge(item)} old${item.locationAccuracyM == null ? '' : ` · ±${item.locationAccuracyM}m`}`, status: item.severity >= 3 ? 'critical' : item.severity === 2 ? 'urgent' : item.severity === 1 ? 'assistance' : 'information', state: item.state, severity: item.severity } });
  for (const item of records) {
    const group: Filter = item.kind === 'route' ? 'routes' : item.kind === 'hazard' ? 'hazards' : 'centres';
    if (!filters.has(group)) continue;
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [e7ToFloat(item.lonE7), e7ToFloat(item.latE7)] }, properties: { id: item.objectId, featureType: 'record', glyph: markerGlyph(item.kind), label: item.name, subtitle: `${item.district} · ${item.kind} · version ${item.version}`, status: item.state, state: item.state, kind: item.kind } });
  }
  if (gateways && filters.has('gateways')) for (const gateway of gateways.gateways) {
    const point = gatewayPoint(gateway.gatewayToken);
    if (!point) continue;
    const activity = gatewayActivity(gateways, gateway.gatewayToken);
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [point.lon, point.lat] }, properties: { id: gateway.gatewayToken, featureType: 'gateway', glyph: 'G', label: gateway.nodeToken.replaceAll('-', ' '), subtitle: `Registered gateway · ${activity.uploads} uploaded · ${activity.downloads} downloaded · ${activity.observations} observations`, status: activity.ageMs < GATEWAY_ACTIVE_WINDOW_MS ? 'online' : 'stale', state: activity.ageMs < GATEWAY_ACTIVE_WINDOW_MS ? 'online' : 'stale', kind: 'gateway' } });
  }
  return { type: 'FeatureCollection', features };
}

function showPopup(map: MapLibreMap, coordinates: [number, number], properties: Record<string, string>, onQuickState?: (id: string, state: string) => void) {
  const root = document.createElement('div'); root.className = 'ops-popup';
  const type = document.createElement('span'); type.textContent = properties.featureType === 'incident' ? `SEVERITY ${properties.severity}` : properties.kind?.toUpperCase();
  const title = document.createElement('strong'); title.textContent = properties.label;
  const subtitle = document.createElement('p'); subtitle.textContent = properties.subtitle;
  const state = document.createElement('b'); state.textContent = properties.state;
  root.append(type, title, subtitle, state);
  if (properties.featureType === 'record' && onQuickState) {
    const next = properties.kind === 'route' ? (properties.state === 'blocked' ? 'open' : 'blocked') : properties.kind === 'hazard' ? (properties.state === 'cleared' ? 'active' : 'cleared') : (properties.state === 'closed' ? 'open' : 'closed');
    const button = document.createElement('button'); button.textContent = next === 'open' ? 'Re-open and publish' : `${next[0]!.toUpperCase()}${next.slice(1)} and publish`; button.onclick = () => { onQuickState(properties.id, next); popup.remove(); }; root.append(button);
  }
  const popup = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: '300px' }).setLngLat(coordinates).setDOMContent(root).addTo(map);
}

function categoryName(value: number): string { return ['Medical', 'Trapped', 'Fire', 'Flood', 'Violence', 'Structural collapse', 'Missing person', 'Other'][value] ?? 'Emergency'; }
function markerGlyph(kind: string): string { return kind === 'medical' ? '+' : kind === 'hazard' ? '!' : kind === 'route' ? 'R' : kind === 'shelter' ? 'S' : kind === 'safe-zone' ? 'A' : 'W'; }
function locationAge(item: Incident): string { const nowS = Math.floor((Date.now() - TIME.DEMO_EPOCH_MS) / 1000); const seconds = Math.max(0, nowS - (item.locationReportedAtS ?? item.updatedAtS) + (item.locationAgeS ?? 0)); return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`; }
const GATEWAY_ACTIVE_WINDOW_MS = 10 * 60_000;
function gatewayActivity(audit: GatewayAudit, token: string) { const transfers = audit.transfers.filter((item) => item.gatewayToken === token); const observations = audit.observations.filter((item) => item.gatewayToken === token); const lastAtMs = Math.max(0, ...transfers.map((item) => item.atMs), ...observations.map((item) => item.uploadedAtMs)); return { ageMs: lastAtMs ? Date.now() - lastAtMs : Number.POSITIVE_INFINITY, uploads: transfers.filter((item) => item.direction === 'upload').reduce((sum, item) => sum + item.itemCount, 0), downloads: transfers.filter((item) => item.direction === 'download').reduce((sum, item) => sum + item.itemCount, 0), observations: observations.length }; }
function gatewayPoint(token: string): { lat: number; lon: number } | undefined {
  // A gateway appears on the map only when its token has an explicitly
  // provisioned operational coordinate. Registration/heartbeat alone does
  // not justify inventing a phone location.
  const provisioned: Record<string, { lat: number; lon: number }> = {};
  return provisioned[token];
}
