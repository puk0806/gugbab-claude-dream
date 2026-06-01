'use client';

import { Progress } from '@gugbab/styled-radix';
import styles from './InterpretationView.module.css';

interface InterpretationViewProps {
  /** 누적된 markdown 텍스트 */
  text: string;
  /** 첫 chunk 도착 전 true */
  loading: boolean;
  /** 'done' 이벤트 받음 */
  done: boolean;
}

export function InterpretationView({ text, loading, done }: InterpretationViewProps) {
  if (loading && !text) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <Progress.Root className={styles.progressRoot}>
          <Progress.Indicator className={styles.progressIndicator} />
        </Progress.Root>
        <p className={styles.loadingText}>꿈을 풀어보는 중...</p>
      </div>
    );
  }

  return (
    <article className={styles.article} aria-live="polite" aria-busy={!done}>
      {text}
      {!done && (
        <span className={styles.caret} aria-hidden="true">
          ▍
        </span>
      )}
    </article>
  );
}
