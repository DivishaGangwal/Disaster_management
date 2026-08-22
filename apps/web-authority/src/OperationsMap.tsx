import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Incident, RegionalRecord } from './types';

type Filter = 'incidents' | 'centres' | 'routes' | 'hazards';

interface Props {
  incidents: Incident[];
  records: RegionalRecord[];
  selected: string;
  onSelect: (id: string) => void;
  onQuickState?: (id: string, state: string) => void;
}

export function OperationsMap({ incidents, records, selected, onSelect, onQuickState }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap>();
  const callbacks = useRef({ onSelect, onQuickState });
  const [ready, setReady] = useState(false);
  const [filters, setFilters] = useState<Set<Filter>>(() => new Set(['incidents', 'centres', 'routes', 'hazards']));
  const [mapReadout, setMapReadout] = useState({ zoom: 6.1, lat: 26.1, lon: 92.5 });
  callbacks.current = { onSelect, onQuickState };

  const data = useMemo(() => featureCollection(incidents, records, filters), [incidents, records, filters]);

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
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          { id: 'basemap-background', type: 'background', paint: { 'background-color': '#e7edf0' } },
          { id: 'osm-basemap', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.45, 'raster-contrast': 0.06, 'raster-opacity': 0.86 } },
        ],
      },
      center: [92.5, 26.1],
      zoom: 6.1,
      minZoom: 4,
      maxZoom: 17,
      attributionControl: false,
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    instance.addControl(new maplibregl.FullscreenControl(), 'top-right');
    instance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    instance.on('load', () => {
      instance.addSource('operations', { type: 'geojson', data, cluster: true, clusterRadius: 44, clusterMaxZoom: 11 });
      instance.addLayer({ id: 'clusters', type: 'circle', source: 'operations', filter: ['has', 'point_count'], paint: { 'circle-color': '#132c3a', 'circle-radius': ['step', ['get', 'point_count'], 21, 8, 27, 20, 34], 'circle-stroke-width': 4, 'circle-stroke-color': '#ffffff' } });
      instance.addLayer({ id: 'cluster-count', type: 'symbol', source: 'operations', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 }, paint: { 'text-color': '#ffffff' } });
      instance.addLayer({ id: 'selected-halo', type: 'circle', source: 'operations', filter: ['==', ['get', 'id'], ''], paint: { 'circle-radius': 22, 'circle-color': 'rgba(21,101,255,.08)', 'circle-stroke-width': 4, 'circle-stroke-color': '#1565ff' } });
      instance.addLayer({ id: 'operation-points', type: 'circle', source: 'operations', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': ['case', ['==', ['get', 'featureType'], 'incident'], 13, 11], 'circle-color': ['match', ['get', 'status'], 'critical', '#c62d42', 'urgent', '#f0782d', 'closed', '#68727a', 'blocked', '#c62d42', 'active', '#d94b38', 'open', '#1a8f6a', '#1673c9'], 'circle-stroke-width': 3.5, 'circle-stroke-color': '#ffffff' } });
      instance.addLayer({ id: 'operation-glyphs', type: 'symbol', source: 'operations', filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'glyph'], 'text-size': 10, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#132c3a', 'text-halo-width': .5 } });
      instance.addLayer({ id: 'operation-labels', type: 'symbol', source: 'operations', filter: ['!', ['has', 'point_count']], minzoom: 6.7, layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0, 1.75], 'text-anchor': 'top', 'text-allow-overlap': false }, paint: { 'text-color': '#10212d', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      instance.on('click', 'clusters', async (event) => {
        const feature = instance.queryRenderedFeatures(event.point, { layers: ['clusters'] })[0];
        const clusterId = Number(feature?.properties?.cluster_id);
        const source = instance.getSource('operations') as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const coordinates = (feature?.geometry as GeoJSON.Point).coordinates as [number, number];
        instance.easeTo({ center: coordinates, zoom });
      });
      instance.on('click', 'operation-points', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const properties = feature.properties as Record<string, string>;
        const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        callbacks.current.onSelect(properties.id);
        showPopup(instance, coordinates, properties, callbacks.current.onQuickState);
      });
      for (const layer of ['clusters', 'operation-points']) {
        instance.on('mouseenter', layer, () => { instance.getCanvas().style.cursor = 'pointer'; });
        instance.on('mouseleave', layer, () => { instance.getCanvas().style.cursor = ''; });
      }
      instance.on('mousemove', (event) => setMapReadout((current) => ({ ...current, lat: event.lngLat.lat, lon: event.lngLat.lng })));
      instance.on('zoomend', () => setMapReadout((current) => ({ ...current, zoom: instance.getZoom() })));
      setReady(true);
    });
    return () => { instance.remove(); map.current = undefined; };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource('operations') as GeoJSONSource | undefined)?.setData(data);
  }, [data, ready]);

  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setFilter('selected-halo', ['==', ['get', 'id'], selected]);
    const feature = data.features.find((item) => item.properties?.id === selected);
    if (feature?.geometry.type === 'Point') map.current.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: Math.max(map.current.getZoom(), 9), duration: 600 });
  }, [selected, data, ready]);

  const toggle = (filter: Filter) => setFilters((current) => { const next = new Set(current); next.has(filter) ? next.delete(filter) : next.add(filter); return next; });
  const unavailable = records.filter((record) => ['closed', 'blocked', 'damaged', 'active'].includes(record.state)).length;
  const selectedLabel = records.find((record) => record.objectId === selected)?.name ?? incidents.find((incident) => incident.incidentId === selected)?.incidentId;
  return <div className="maplibre-shell">
    <div className="map-toolbar" aria-label="Map layers">{(['incidents', 'centres', 'routes', 'hazards'] as Filter[]).map((filter) => <button key={filter} aria-pressed={filters.has(filter)} className={filters.has(filter) ? 'active' : ''} onClick={() => toggle(filter)}><i>{filters.has(filter) ? '✓' : ''}</i>{filter}</button>)}<button onClick={() => map.current?.fitBounds([[89.6, 23.8], [96.2, 28.3]], { padding: 44, maxZoom: 8 })}>Fit Assam</button></div>
    <div ref={container} className="maplibre-canvas" />
    <div className="map-overview"><span><b>{data.features.length}</b> visible</span>{records.length > 0 && <><span><b>{records.length - unavailable}</b> available</span><span><b>{unavailable}</b> restricted</span></>}<span className="map-selection">{selectedLabel ?? 'No selection'}</span></div>
    <div className="map-readout">Z{mapReadout.zoom.toFixed(1)} · {mapReadout.lat.toFixed(4)}, {mapReadout.lon.toFixed(4)}</div>
    {!ready && <div className="map-loading">Loading operational basemap…</div>}
  </div>;
}

function featureCollection(incidents: Incident[], records: RegionalRecord[], filters: Set<Filter>): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  if (filters.has('incidents')) for (const item of incidents) if (item.latE7 != null && item.lonE7 != null) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [item.lonE7 / 1e7, item.latE7 / 1e7] }, properties: { id: item.incidentId, featureType: 'incident', glyph: `S${item.severity}`, label: categoryName(item.category), subtitle: `${item.peopleTotal ?? 0} people · ${item.observationCount} gateway observations`, status: item.severity >= 3 ? 'critical' : item.severity === 2 ? 'urgent' : 'active', state: item.state, severity: item.severity } });
  for (const item of records) {
    const group: Filter = item.kind === 'route' ? 'routes' : item.kind === 'hazard' ? 'hazards' : 'centres';
    if (!filters.has(group)) continue;
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [item.lonE7 / 1e7, item.latE7 / 1e7] }, properties: { id: item.objectId, featureType: 'record', glyph: markerGlyph(item.kind), label: item.name, subtitle: `${item.district} · ${item.kind} · version ${item.version}`, status: item.state, state: item.state, kind: item.kind } });
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
