import assert from 'node:assert/strict';
import test from 'node:test';
import { DEPLOYMENT } from '@dsm/contracts';
import { PackResolver } from './content-pack.js';
import { MUMBAI_CONTENT_PACK } from './mumbai-pack.js';
import { MapProjection } from './projection.js';

test('Mumbai pack is the canonical current deployment and paints its baseline', () => {
  const { manifest } = MUMBAI_CONTENT_PACK;
  assert.equal(manifest.regionCode, DEPLOYMENT.regionCode);
  assert.equal(manifest.packId, DEPLOYMENT.contentPackId);
  assert.deepEqual(manifest.languages, DEPLOYMENT.languages);
  assert.ok(MUMBAI_CONTENT_PACK.forms.some((form) => form.objectId === 'MUM-FORM-CHECKIN'));

  const ids = MUMBAI_CONTENT_PACK.objects.map((object) => object.objectId);
  assert.equal(new Set(ids).size, ids.length, 'object IDs must be unique');
  for (const object of MUMBAI_CONTENT_PACK.objects) {
    if (object.latE7 === undefined || object.lonE7 === undefined) continue;
    assert.ok(object.latE7 >= manifest.bounds.minLatE7 && object.latE7 <= manifest.bounds.maxLatE7, `${object.objectId} latitude is inside Mumbai bounds`);
    assert.ok(object.lonE7 >= manifest.bounds.minLonE7 && object.lonE7 <= manifest.bounds.maxLonE7, `${object.objectId} longitude is inside Mumbai bounds`);
  }

  const projection = new MapProjection(new PackResolver(MUMBAI_CONTENT_PACK));
  assert.ok(projection.visible(Math.floor(Date.now() / 1000)).some((object) => object.objectId === 'MUM-MED-KEM'));
});
