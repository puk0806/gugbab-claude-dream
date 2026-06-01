'use client';

import { Separator } from '@gugbab/styled-radix';
import Link from 'next/link';
import type { DreamEntry, Tone } from '@/lib/types';
import styles from './HistoryList.module.css';

interface HistoryListProps {
  entries: DreamEntry[];
  onDelete?: (id: string) => void;
}

const TONE_BADGE: Record<Tone, string> = {
  casual: '캐주얼',
  reflective: '자기 성찰',
  traditional: '한국 전통',
};

function formatDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function firstLine(s: string, n = 60): string {
  const trimmed = s.trim().replace(/\s+/g, ' ');
  return trimmed.length > n ? `${trimmed.slice(0, n)}…` : trimmed;
}

export function HistoryList({ entries, onDelete }: HistoryListProps) {
  if (entries.length === 0) {
    return <p className={styles.empty}>아직 저장된 해몽이 없어요.</p>;
  }

  return (
    <ul className={styles.list}>
      {entries.map((e, idx) => (
        <li key={e.id} className={styles.item}>
          <Link href={`/result/${e.id}`} className={styles.link}>
            <div className={styles.meta}>
              <span className={styles.date}>{formatDate(e.createdAt)}</span>
              <span className={styles.tone}>{TONE_BADGE[e.tone]}</span>
            </div>
            <p className={styles.preview}>{firstLine(e.dreamText)}</p>
          </Link>
          {onDelete && (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => onDelete(e.id)}
              aria-label={`${formatDate(e.createdAt)} 해몽 삭제`}
            >
              삭제
            </button>
          )}
          {idx < entries.length - 1 && <Separator className={styles.separator} />}
        </li>
      ))}
    </ul>
  );
}
