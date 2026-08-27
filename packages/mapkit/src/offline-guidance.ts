export interface GuidancePoint {
  readonly lat: number;
  readonly lon: number;
}

export interface DirectGuidance {
  readonly coordinates: readonly [number, number][];
  readonly distanceM: number;
  readonly initialBearingDeg: number;
}

/**
 * Minimal no-network guidance. This deliberately does not claim road routing:
 * it provides a geodesic direction and remaining distance between two points.
 */
export function directOfflineGuidance(start: GuidancePoint, destination: GuidancePoint): DirectGuidance {
  assertPoint(start);
  assertPoint(destination);
  return {
    coordinates: [[start.lon, start.lat], [destination.lon, destination.lat]],
    distanceM: haversineDistanceM(start, destination),
    initialBearingDeg: initialBearingDeg(start, destination),
  };
}

export function haversineDistanceM(a: GuidancePoint, b: GuidancePoint): number {
  assertPoint(a);
  assertPoint(b);
  const toRad = Math.PI / 180;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function initialBearingDeg(a: GuidancePoint, b: GuidancePoint): number {
  assertPoint(a);
  assertPoint(b);
  const toRad = Math.PI / 180;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function assertPoint(point: GuidancePoint) {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || point.lat < -90 || point.lat > 90 || point.lon < -180 || point.lon > 180) {
    throw new Error('guidance point is outside valid latitude/longitude bounds');
  }
}
