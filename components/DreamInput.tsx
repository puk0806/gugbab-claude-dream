'use client';

import { useState } from 'react';
import type { Tone } from '@/lib/types';
import styles from './DreamInput.module.css';
import { ToneChips } from './ToneChips';

interface DreamInputProps {
  onSubmit: (dreamText: string, tone: Tone) => void;
  loading?: boolean;
}

const MAX_LEN = 2000;

export function DreamInput({ onSubmit, loading }: DreamInputProps) {
  const [text, setText] = useState('');
  const [tone, setTone] = useState<Tone>('reflective');

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_LEN && !loading;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(trimmed, tone);
      }}
    >
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
        placeholder="어젯밤 꿈을 적어보세요"
        rows={6}
        disabled={loading}
        aria-label="꿈 텍스트 입력"
      />
      <div className={styles.meta}>
        <span className={styles.counter}>
          {text.length}/{MAX_LEN}
        </span>
      </div>
      <ToneChips value={tone} onChange={setTone} disabled={loading} />
      <button type="submit" className={styles.submit} disabled={!canSubmit}>
        {loading ? '해석 중...' : '해석하기'}
      </button>
    </form>
  );
}
