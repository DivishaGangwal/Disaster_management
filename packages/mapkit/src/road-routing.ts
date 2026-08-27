export type RoadTravelMode = 'walking' | 'driving';

export interface RoadRoutePoint {
  readonly lat: number;
  readonly lon: number;
}

export interface RoadRoute {
  readonly coordinates: readonly [number, number][];
  readonly distanceM: number;
  readonly durationS: number;
  readonly instructions: readonly string[];
}

/** Converts one Valhalla route response into the app's stable routing shape. */
export function parseValhallaRoute(value: unknown): RoadRoute {
  if (!value || typeof value !== 'object') throw new Error('Routing service returned an invalid response.');
  const trip = (value as Record<string, unknown>)['trip'];
  if (!trip || typeof trip !== 'object') throw new Error('No road route was found between these points.');
  const record = trip as Record<string, unknown>;
  const summary = record['summary'];
  const legs = record['legs'];
  if (!summary || typeof summary !== 'object' || !Array.isArray(legs) || legs.length === 0) {
    throw new Error('No road route was found between these points.');
  }
  const firstLeg = legs[0];
  if (!firstLeg || typeof firstLeg !== 'object') throw new Error('Routing service omitted the route geometry.');
  const leg = firstLeg as Record<string, unknown>;
  const shape = leg['shape'];
  if (typeof shape !== 'string' || shape.length === 0) throw new Error('Routing service omitted the route geometry.');
  const tripSummary = summary as Record<string, unknown>;
  const distanceKm = Number(tripSummary['length']);
  const durationS = Number(tripSummary['time']);
  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationS)) throw new Error('Routing service omitted distance or travel time.');
  const maneuvers = Array.isArray(leg['maneuvers']) ? leg['maneuvers'] : [];
  return {
    coordinates: decodePolyline6(shape),
    distanceM: Math.max(0, distanceKm * 1_000),
    durationS: Math.max(0, durationS),
    instructions: maneuvers
      .map((item) => item && typeof item === 'object' ? String((item as Record<string, unknown>)['instruction'] ?? '') : '')
      .filter(Boolean),
  };
}

/** Valhalla returns Google-encoded polyline precision 6 in latitude/longitude order. */
export function decodePolyline6(encoded: string): readonly [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    const latitude = decodeDelta(encoded, index);
    index = latitude.index;
    const longitude = decodeDelta(encoded, index);
    index = longitude.index;
    lat += latitude.delta;
    lon += longitude.delta;
    coordinates.push([lon / 1e6, lat / 1e6]);
  }
  if (coordinates.length < 2) throw new Error('Road route geometry is incomplete.');
  return coordinates;
}

function decodeDelta(encoded: string, start: number): { readonly delta: number; readonly index: number } {
  let result = 0;
  let shift = 0;
  let index = start;
  let byte = 0;
  do {
    if (index >= encoded.length || shift > 30) throw new Error('Road route geometry is corrupt.');
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  return { delta: (result & 1) ? ~(result >> 1) : result >> 1, index };
}
