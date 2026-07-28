export const ROUND_COLLECTION_KEY = 'golf-strokes-gained-rounds-v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createRoundStore(storage, options = {}) {
  const now = options.now || (() => new Date().toISOString());

  function readCollection() {
    try {
      const parsed = JSON.parse(storage.getItem(ROUND_COLLECTION_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCollection(rounds) {
    storage.setItem(ROUND_COLLECTION_KEY, JSON.stringify(rounds));
  }

  function list() {
    return readCollection()
      .map(clone)
      .sort((left, right) => {
        const dateOrder = String(right.date || '').localeCompare(String(left.date || ''));
        if (dateOrder !== 0) return dateOrder;
        return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
      });
  }

  function get(roundId) {
    const round = readCollection().find((item) => item.id === roundId);
    return round ? clone(round) : null;
  }

  function save(round) {
    if (!round?.id) throw new Error('A round id is required.');

    const rounds = readCollection();
    const index = rounds.findIndex((item) => item.id === round.id);
    const prior = index >= 0 ? rounds[index] : null;
    const saved = clone({
      ...round,
      date: round.date || prior?.date || '',
      createdAt: round.createdAt || now(),
      updatedAt: now()
    });

    if (index >= 0) rounds[index] = saved;
    else rounds.push(saved);

    writeCollection(rounds);
    return clone(saved);
  }

  function remove(roundId) {
    const rounds = readCollection();
    const remaining = rounds.filter((item) => item.id !== roundId);
    if (remaining.length === rounds.length) return false;
    writeCollection(remaining);
    return true;
  }

  function migrateLegacy(keys, transform) {
    if (readCollection().length > 0) return null;

    for (const key of keys) {
      const raw = storage.getItem(key);
      if (!raw) continue;

      try {
        const migrated = transform(JSON.parse(raw));
        const saved = save(migrated);
        return saved;
      } catch {
        // Continue looking for the next valid legacy record.
      }
    }

    return null;
  }

  return { get, list, migrateLegacy, remove, save };
}
