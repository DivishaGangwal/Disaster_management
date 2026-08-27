import assert from 'node:assert/strict';
import test from 'node:test';
import { directOfflineGuidance, haversineDistanceM, initialBearingDeg } from './offline-guidance.js';

test('direct offline guidance returns GeoJSON-order coordinates, distance and bearing', () => {
  const start = { lat: 19.076, lon: 72.8777 };
  const destination = { lat: 19.0013, lon: 72.8413 };
  const route = directOfflineGuidance(start, destination);
  assert.deepEqual(route.coordinates, [[72.8777, 19.076], [72.8413, 19.0013]]);
  assert.ok(route.distanceM > 8_000 && route.distanceM < 10_000);
  assert.ok(route.initialBearingDeg > 180 && route.initialBearingDeg < 230);
});

test('distance is symmetric and cardinal bearings are stable', () => {
  const a = { lat: 19, lon: 72.8 };
  const north = { lat: 19.01, lon: 72.8 };
  assert.ok(Math.abs(haversineDistanceM(a, north) - haversineDistanceM(north, a)) < 0.001);
  assert.ok(initialBearingDeg(a, north) < 0.01 || initialBearingDeg(a, north) > 359.99);
});

test('invalid coordinates are rejected', () => {
  assert.throws(() => directOfflineGuidance({ lat: 91, lon: 0 }, { lat: 0, lon: 0 }), /outside valid/);
});
