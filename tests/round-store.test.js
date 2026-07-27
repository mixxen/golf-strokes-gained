import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoundStore, ROUND_COLLECTION_KEY } from '../js/round-store.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test('stores multiple rounds without overwriting other rounds', () => {
  const store = createRoundStore(memoryStorage(), { now: () => '2026-07-26T12:00:00.000Z' });
  store.save({ id: 'one', date: '2026-07-25', holes: [] });
  store.save({ id: 'two', date: '2026-07-26', holes: [] });
  store.save({ id: 'one', date: '2026-07-25', courseName: 'Updated', holes: [] });

  assert.equal(store.list().length, 2);
  assert.equal(store.get('one').courseName, 'Updated');
  assert.equal(store.get('two').date, '2026-07-26');
});

test('lists rounds from newest playing date to oldest', () => {
  let timestamp = 0;
  const store = createRoundStore(memoryStorage(), {
    now: () => `2026-07-26T12:00:0${timestamp++}.000Z`
  });
  store.save({ id: 'older', date: '2026-07-20' });
  store.save({ id: 'newer-a', date: '2026-07-26' });
  store.save({ id: 'newer-b', date: '2026-07-26' });

  assert.deepEqual(store.list().map((round) => round.id), ['newer-b', 'newer-a', 'older']);
});

test('migrates one legacy round only once', () => {
  const storage = memoryStorage({
    legacy: JSON.stringify({ courseName: 'Legacy course', date: '2026-07-21' })
  });
  const store = createRoundStore(storage, { now: () => '2026-07-26T12:00:00.000Z' });

  const first = store.migrateLegacy(['legacy'], (round) => ({ ...round, id: 'legacy-round' }));
  const second = store.migrateLegacy(['legacy'], (round) => ({ ...round, id: 'duplicate' }));

  assert.equal(first.id, 'legacy-round');
  assert.equal(second, null);
  assert.equal(store.list().length, 1);
  assert.ok(storage.getItem(ROUND_COLLECTION_KEY));
});

test('deleting a round leaves the other rounds intact', () => {
  const store = createRoundStore(memoryStorage());
  store.save({ id: 'one', date: '2026-07-25' });
  store.save({ id: 'two', date: '2026-07-26' });

  assert.equal(store.remove('one'), true);
  assert.equal(store.get('one'), null);
  assert.equal(store.get('two').id, 'two');
});
