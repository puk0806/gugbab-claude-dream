'use client';

import { useEffect, useRef } from 'react';
import styles from './InstallButton.module.css';

export interface IosInstallGuideProps {
  readonly onClose: () => void;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function IosInstallGuide({ onClose }: IosInstallGuideProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-close (ESC 별도 처리)
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-guide-title"
    >
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.modalHeader}>
          <h2 id="install-guide-title" className={styles.modalTitle}>
            iPhone에 앱 설치하기
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            <span className={styles.stepText}>
              Safari 화면 하단의 <strong>공유 버튼</strong> ⎙ 을 누르세요.
              (위로 향한 화살표 아이콘)
            </span>
          </li>
          <li>
            <span className={styles.stepNum}>2</span>
            <span className={styles.stepText}>
              아래로 스크롤해서 <strong>"홈 화면에 추가"</strong>를 선택하세요.
            </span>
          </li>
          <li>
            <span className={styles.stepNum}>3</span>
            <span className={styles.stepText}>
              앱 이름을 확인하고 우측 상단 <strong>"추가"</strong>를 누르세요.
            </span>
          </li>
          <li>
            <span className={styles.stepNum}>4</span>
            <span className={styles.stepText}>
              홈 화면의 <strong>꿈해몽</strong> 아이콘을 누르면 앱처럼 실행됩니다.
            </span>
          </li>
        </ol>
        <p className={styles.note}>
          ※ Chrome 등 다른 브라우저는 iOS에서 앱 설치를 지원하지 않아요. 반드시 Safari로
          접속해 주세요.
        </p>
      </div>
    </div>
  );
}
