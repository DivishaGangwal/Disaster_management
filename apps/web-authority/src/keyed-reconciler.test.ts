import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileKeyed } from './keyed-reconciler.ts';

test('polling updates keyed values in place instead of recreating them', () => {
  type Item = { id: string; label: string };
  type Value = { label: string };
  const current = new Map<string, Value>();
  const removed: Value[] = [];
  let creates = 0;
  const run = (items: Item[]) => reconcileKeyed(
    current,
    items,
    (item) => item.id,
    (item) => { creates += 1; return { label: item.label }; },
    (value, item) => { value.label = item.label; },
    (value) => removed.push(value),
  );

  run([{ id: 'a', label: 'first' }, { id: 'b', label: 'second' }]);
  const originalA = current.get('a');
  run([{ id: 'a', label: 'updated' }, { id: 'b', label: 'second' }]);

  assert.equal(creates, 2);
  assert.equal(current.get('a'), originalA);
  assert.equal(current.get('a')?.label, 'updated');

  run([{ id: 'a', label: 'updated' }]);
  assert.equal(removed.length, 1);
  assert.equal(removed[0]?.label, 'second');
});
