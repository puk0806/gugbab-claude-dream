'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HistoryList } from '@/components/HistoryList';
import { clearAll, deleteEntry, listEntriesDesc } from '@/lib/db';
import type { DreamEntry } from '@/lib/types';
import styles from './page.module.css';

export default function HistoryPage() {
  const [entries, setEntries] = useState<DreamEntry[]>([]);

  useEffect(() => {
    listEntriesDesc(100)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClearAll = async () => {
    if (!window.confirm('모든 히스토리를 삭제할까요?')) return;
    await clearAll();
    setEntries([]);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← 홈으로
        </Link>
        <h1 className={styles.title}>히스토리</h1>
        {entries.length > 0 && (
          <button type="button" onClick={handleClearAll} className={styles.clearBtn}>
            전체 삭제
          </button>
        )}
      </header>
      <HistoryList entries={entries} onDelete={handleDelete} />
    </main>
  );
}
