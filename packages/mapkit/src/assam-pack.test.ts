import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSAM_CONTENT_PACK } from './assam-pack.js';
import { PackResolver } from './content-pack.js';
import { MapProjection } from './projection.js';

test('Assam pack paints a populated offline operational picture', () => {
  const resolver = new PackResolver(ASSAM_CONTENT_PACK);
  const projection = new MapProjection(resolver);
  const visible = projection.visible(Math.floor(Date.now() / 1000));
  assert.equal(ASSAM_CONTENT_PACK.manifest.regionCode, 'IN-AS');
  assert.ok(visible.length >= 25);
  assert.ok(visible.some((object) => object.label.includes('Guwahati')));
  assert.ok(visible.every((object) => object.provenance === 'base-pack'));
  assert.ok(visible.filter((object) => object.kind === 'route').length >= 4);
});
