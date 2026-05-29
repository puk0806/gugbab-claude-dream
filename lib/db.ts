/**
 * IndexedDB (gugbab-dream v1) 래퍼.
 * - store: entries (keyPath: id, index: createdAt_idx)
 * - LRU 100건 유지: 추가 시 초과분 자동 삭제
 */
import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { DreamEntry } from './types';

const DB_NAME = 'gugbab-dream';
const DB_VERSION = 1;
const STORE = 'entries';
const LRU_LIMIT = 100;

interface DreamDB extends DBSchema {
  [STORE]: {
    key: string;
    value: DreamEntry;
    indexes: { createdAt_idx: number };
  };
}

let dbPromise: Promise<IDBPDatabase<DreamDB>> | null = null;

function getDB(): Promise<IDBPDatabase<DreamDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DreamDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt_idx', 'createdAt');
      },
    });
  }
  return dbPromise;
}

export async function saveEntry(entry: DreamEntry): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  await tx.store.put(entry);
  await tx.done;
  await enforceLruLimit();
}

export async function getEntry(id: string): Promise<DreamEntry | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

export async function listEntriesDesc(limit = LRU_LIMIT): Promise<DreamEntry[]> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readonly');
  const index = tx.store.index('createdAt_idx');
  const result: DreamEntry[] = [];
  let cursor = await index.openCursor(null, 'prev');
  while (cursor && result.length < limit) {
    result.push(cursor.value);
    cursor = await cursor.continue();
  }
  return result;
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

async function enforceLruLimit(): Promise<void> {
  const db = await getDB();
  const count = await db.count(STORE);
  if (count <= LRU_LIMIT) return;
  const overflow = count - LRU_LIMIT;
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.store.index('createdAt_idx');
  let cursor = await index.openCursor(null, 'next');
  let removed = 0;
  while (cursor && removed < overflow) {
    await cursor.delete();
    removed += 1;
    cursor = await cursor.continue();
  }
  await tx.done;
}
