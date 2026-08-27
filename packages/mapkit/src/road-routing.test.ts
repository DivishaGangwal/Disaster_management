import assert from 'node:assert/strict';
import test from 'node:test';

import { decodePolyline6, parseValhallaRoute } from './road-routing.js';

test('Valhalla road route parsing preserves road geometry, distance, ETA and instructions', () => {
  const route = parseValhallaRoute({
    trip: {
      summary: { length: 1.417, time: 1028.363 },
      legs: [{ shape: 'ovhkc@meb_jCbQo[', maneuvers: [{ instruction: 'Walk southeast.' }] }],
    },
  });
  assert.equal(route.distanceM, 1417);
  assert.equal(route.durationS, 1028.363);
  assert.deepEqual(route.instructions, ['Walk southeast.']);
  assert.ok(route.coordinates.length >= 2);
  assert.ok(route.coordinates.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)));
});

test('corrupt road geometry and missing routes fail closed', () => {
  assert.throws(() => decodePolyline6('~'), /corrupt/);
  assert.throws(() => parseValhallaRoute({ trip: { legs: [] } }), /No road route/);
});
