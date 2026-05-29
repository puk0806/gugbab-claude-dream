'use client';

import type { CrisisResource } from '@/lib/types';
import styles from './SafetyResourceCard.module.css';

interface SafetyResourceCardProps {
  resources: CrisisResource[];
}

export function SafetyResourceCard({ resources }: SafetyResourceCardProps) {
  return (
    <section className={styles.card} aria-labelledby="safety-title">
      <h2 id="safety-title" className={styles.title}>
        도움이 필요하시면 연락해보세요
      </h2>
      <p className={styles.lead}>
        지금 마음이 무거우시군요. 혼자가 아니에요. 아래 번호로 연결해서 이야기를 나눌 수 있어요.
      </p>
      <ul className={styles.list}>
        {resources.map((r) => (
          <li key={r.phone} className={styles.item}>
            <a href={`tel:${r.phone}`} className={styles.phone}>
              {r.phone}
            </a>
            <div className={styles.meta}>
              <span className={styles.name}>{r.name}</span>
              {r.description && <span className={styles.desc}>{r.description}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
