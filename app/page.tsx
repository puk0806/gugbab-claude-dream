'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ulid } from 'ulid';
import { DreamInput } from '@/components/DreamInput';
import { HistoryList } from '@/components/HistoryList';
import { listEntriesDesc, saveEntry } from '@/lib/db';
import type { DreamEntry, Tone } from '@/lib/types';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const [recent, setRecent] = useState<DreamEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listEntriesDesc(3)
      .then(setRecent)
      .catch(() => setRecent([]));
  }, []);

  const handleSubmit = async (dreamText: string, tone: Tone) => {
    setSubmitting(true);
    const id = ulid();
    const pending: DreamEntry = {
      id,
      createdAt: Date.now(),
      dreamText,
      tone,
      interpretation: '',
      safetyVerdict: { category: 'null', confidence: 0 },
      modelId: '',
      schemaVersion: 1,
    };
    await saveEntry(pending);
    router.push(`/result/${id}`);
  };

  return (
    <main className={styles.home}>
      <h1 className={styles.title}>꿈해몽</h1>
      <p className={styles.subtitle}>어젯밤 꿈을 적고 톤을 골라 누르면 Claude가 해석해드려요.</p>

      <DreamInput onSubmit={handleSubmit} loading={submitting} />

      {recent.length > 0 && (
        <section className={styles.recent} aria-labelledby="recent-title">
          <h2 id="recent-title" className={styles.recentTitle}>
            최근 해몽
          </h2>
          <HistoryList entries={recent} />
        </section>
      )}
    </main>
  );
}
