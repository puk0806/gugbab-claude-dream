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

export function makeSeedSessionScript(opts: {
  id: string;
  summary: string;
  messages: Array<{ role: 'user' | 'model'; content: string; timestamp: number }>;
}): string {
  return `
    indexedDB.deleteDatabase('gugbab-dream');
    const req = indexedDB.open('gugbab-dream', 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) {
        const es = db.createObjectStore('entries', { keyPath: 'id' });
        es.createIndex('createdAt_idx', 'createdAt');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const ss = db.createObjectStore('sessions', { keyPath: 'id' });
        ss.createIndex('createdAt_idx', 'createdAt');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put(${JSON.stringify({
        id: opts.id,
        createdAt: Date.UTC(2026, 4, 21, 0, 0, 0),
        messages: opts.messages,
        summary: opts.summary,
        modelId: 'gemini-2.5-flash',
        schemaVersion: 2,
      })});
    };
  `;
}
