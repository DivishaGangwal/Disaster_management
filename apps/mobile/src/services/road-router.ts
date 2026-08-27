import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseValhallaRoute, type RoadRoute, type RoadRoutePoint, type RoadTravelMode } from '@dsm/mapkit';

const CACHE_KEY = '@dsm/road-routes-v1';
const MAX_CACHED_ROUTES = 24;
const ROUTING_URL = process.env.EXPO_PUBLIC_DSM_ROUTING_URL ?? 'https://valhalla1.openstreetmap.de/route';

export interface CachedRoadRoute extends RoadRoute {
  readonly source: 'network' | 'offline-cache';
  readonly mode: RoadTravelMode;
  readonly cachedAtMs: number;
}

interface StoredRoutes { readonly [key: string]: Omit<CachedRoadRoute, 'source'>; }

export class RoadRouter {
  async route(start: RoadRoutePoint, destination: RoadRoutePoint, mode: RoadTravelMode): Promise<CachedRoadRoute> {
    const key = routeKey(start, destination, mode);
    const cache = await readCache();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      let response: Response;
      try {
        const request = {
          locations: [start, destination],
          costing: mode === 'walking' ? 'pedestrian' : 'auto',
          directions_options: { units: 'kilometers' },
        };
        response = await fetch(`${ROUTING_URL}?json=${encodeURIComponent(JSON.stringify(request))}`, { signal: controller.signal });
      } finally { clearTimeout(timeout); }
      if (!response.ok) throw new Error(`road routing returned HTTP ${response.status}`);
      const parsed = parseValhallaRoute(await response.json());
      const result: CachedRoadRoute = { ...parsed, source: 'network', mode, cachedAtMs: Date.now() };
      await writeCache({ ...cache, [key]: withoutSource(result) });
      return result;
    } catch (reason) {
      const cached = cache[key];
      if (cached) return { ...cached, source: 'offline-cache' };
      throw new Error(`A road route could not be calculated and this trip is not cached for offline use. ${messageOf(reason)}`);
    }
  }
}

function routeKey(start: RoadRoutePoint, destination: RoadRoutePoint, mode: RoadTravelMode) {
  const point = (value: RoadRoutePoint) => `${value.lat.toFixed(4)},${value.lon.toFixed(4)}`;
  return `${mode}:${point(start)}>${point(destination)}`;
}

async function readCache(): Promise<StoredRoutes> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as StoredRoutes : {};
  } catch { return {}; }
}

async function writeCache(routes: StoredRoutes) {
  const entries = Object.entries(routes).sort(([, a], [, b]) => b.cachedAtMs - a.cachedAtMs).slice(0, MAX_CACHED_ROUTES);
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
}

function withoutSource(route: CachedRoadRoute): Omit<CachedRoadRoute, 'source'> {
  const { source: _source, ...stored } = route;
  return stored;
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }

export const roadRouter = new RoadRouter();
