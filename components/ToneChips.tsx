'use client';

import { ToggleGroup } from '@gugbab/styled-radix';
import type { Tone } from '@/lib/types';
import styles from './ToneChips.module.css';

interface ToneChipsProps {
  value: Tone;
  onChange: (next: Tone) => void;
  disabled?: boolean;
}

const TONE_LABELS: Record<Tone, string> = {
  casual: '캐주얼',
  reflective: '자기 성찰',
  traditional: '한국 전통',
};

export function ToneChips({ value, onChange, disabled }: ToneChipsProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as Tone);
      }}
      disabled={disabled}
      className={styles.root}
      aria-label="해몽 톤 선택"
    >
      {(Object.keys(TONE_LABELS) as Tone[]).map((tone) => (
        <ToggleGroup.Item key={tone} value={tone} className={styles.item}>
          {TONE_LABELS[tone]}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
