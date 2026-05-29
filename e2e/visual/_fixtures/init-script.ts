/**
 * page.addInitScript 로 주입할 결정론 fixture.
 *
 * - IndexedDB(gugbab-dream) 초기화 → 매 spec 깨끗한 상태
 * - Math.random 시드 (xorshift32)
 * - crypto.randomUUID 고정값
 * - Date.now freeze (2026-05-22T00:00:00Z)
 */
export const FIXTURE_SCRIPT = `
  (() => {
    try {
      indexedDB.deleteDatabase('gugbab-dream');
    } catch {}

    let state = 42;
    Math.random = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };

    const FIXED_UUID = '00000000-0000-4000-8000-000000000000';
    if (crypto && 'randomUUID' in crypto) {
      crypto.randomUUID = () => FIXED_UUID;
    }

    const FROZEN = Date.UTC(2026, 4, 22, 0, 0, 0);
    Date.now = () => FROZEN;
  })();
`;

/**
 * 결정론 fixture entry 1건을 IndexedDB(gugbab-dream)에 미리 박는 스크립트.
 * tone 별로 entry id 만 다르고 텍스트는 동일.
 */
export function makeSeedIdbScript(opts: {
  id: string;
  tone: 'casual' | 'reflective' | 'traditional';
  dreamText: string;
}): string {
  return `
    indexedDB.deleteDatabase('gugbab-dream');
    const req = indexedDB.open('gugbab-dream', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.createObjectStore('entries', { keyPath: 'id' });
      store.createIndex('createdAt_idx', 'createdAt');
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('entries', 'readwrite');
      tx.objectStore('entries').put({
        id: ${JSON.stringify(opts.id)},
        createdAt: Date.UTC(2026, 4, 21, 0, 0, 0),
        dreamText: ${JSON.stringify(opts.dreamText)},
        tone: ${JSON.stringify(opts.tone)},
        interpretation: '',
        safetyVerdict: { category: 'null', confidence: 0 },
        modelId: '',
        schemaVersion: 1,
      });
    };
  `;
}
