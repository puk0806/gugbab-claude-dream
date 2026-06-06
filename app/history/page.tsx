'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HistoryList } from '@/components/HistoryList';
import { clearAll, deleteSession, listSessionsDesc } from '@/lib/db';
import type { DreamSession } from '@/lib/types';
import styles from './page.module.css';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<DreamSession[]>([]);

  useEffect(() => {
    listSessionsDesc(100)
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // IDB failure — leave UI unchanged
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('모든 대화를 삭제할까요?')) return;
    try {
      await clearAll();
      setSessions([]);
    } catch {
      // IDB failure — leave UI unchanged
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← 홈으로
        </Link>
        <h1 className={styles.title}>히스토리</h1>
        {sessions.length >= 3 && (
          <button type="button" onClick={handleClearAll} className={styles.clearBtn}>
            전체 삭제
          </button>
        )}
      </header>
      <HistoryList sessions={sessions} onDelete={handleDelete} />
    </main>
  );
}
