import type { DBSchema, IDBPDatabase } from "idb";
import { openDB } from "idb";
import type { DreamEntry, DreamSession } from "./types";

const DB_NAME = "gugbab-dream";
const DB_VERSION = 2;
const SESSION_STORE = "sessions";
const ENTRY_STORE = "entries";
const LRU_LIMIT = 100;

interface DreamDB extends DBSchema {
    sessions: {
        key: string;
        value: DreamSession;
        indexes: { createdAt_idx: number };
    };
    entries: {
        key: string;
        value: DreamEntry;
        indexes: { createdAt_idx: number };
    };
}

let dbPromise: Promise<IDBPDatabase<DreamDB>> | null = null;

function getDB(): Promise<IDBPDatabase<DreamDB>> {
    if (!dbPromise) {
        dbPromise = openDB<DreamDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                if (oldVersion < 1) {
                    const entryStore = db.createObjectStore(ENTRY_STORE, { keyPath: "id" });
                    entryStore.createIndex("createdAt_idx", "createdAt");
                }
                if (oldVersion < 2) {
                    const sessionStore = db.createObjectStore(SESSION_STORE, { keyPath: "id" });
                    sessionStore.createIndex("createdAt_idx", "createdAt");
                }
            },
        });
    }
    return dbPromise;
}

// ── Sessions (v2) ──────────────────────────────────────────

export async function saveSession(session: DreamSession): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(SESSION_STORE, "readwrite");
    await tx.store.put(session);
    await tx.done;
    await enforceLruLimitSessions();
}

export async function getSession(id: string): Promise<DreamSession | undefined> {
    const db = await getDB();
    return db.get(SESSION_STORE, id);
}

export async function listSessionsDesc(limit = LRU_LIMIT): Promise<DreamSession[]> {
    const db = await getDB();
    const tx = db.transaction(SESSION_STORE, "readonly");
    const index = tx.store.index("createdAt_idx");
    const result: DreamSession[] = [];
    let cursor = await index.openCursor(null, "prev");
    while (cursor && result.length < limit) {
        result.push(cursor.value);
        cursor = await cursor.continue();
    }
    return result;
}

export async function deleteSession(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(SESSION_STORE, id);
}

export async function clearAll(): Promise<void> {
    const db = await getDB();
    await db.clear(SESSION_STORE);
}

async function enforceLruLimitSessions(): Promise<void> {
    const db = await getDB();
    const count = await db.count(SESSION_STORE);
    if (count <= LRU_LIMIT) return;
    const overflow = count - LRU_LIMIT;
    const tx = db.transaction(SESSION_STORE, "readwrite");
    const index = tx.store.index("createdAt_idx");
    let cursor = await index.openCursor(null, "next");
    let removed = 0;
    while (cursor && removed < overflow) {
        await cursor.delete();
        removed += 1;
        cursor = await cursor.continue();
    }
    await tx.done;
}

// ── Entries (v1, 읽기 전용) ────────────────────────────────

export async function getEntry(id: string): Promise<DreamEntry | undefined> {
    const db = await getDB();
    return db.get(ENTRY_STORE, id);
}

export async function listEntriesDesc(limit = LRU_LIMIT): Promise<DreamEntry[]> {
    const db = await getDB();
    const tx = db.transaction(ENTRY_STORE, "readonly");
    const index = tx.store.index("createdAt_idx");
    const result: DreamEntry[] = [];
    let cursor = await index.openCursor(null, "prev");
    while (cursor && result.length < limit) {
        result.push(cursor.value);
        cursor = await cursor.continue();
    }
    return result;
}
