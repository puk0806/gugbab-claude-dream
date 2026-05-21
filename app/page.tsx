import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.home}>
      <h1 className={styles.title}>꿈해몽</h1>
      <p className={styles.subtitle}>어젯밤 꿈을 적고 톤을 골라 누르면 Claude가 해석해드려요.</p>
      <p className={styles.hint}>(Phase 1 부트스트랩 셸 — Phase 2에서 입력 폼 추가)</p>
    </main>
  );
}
