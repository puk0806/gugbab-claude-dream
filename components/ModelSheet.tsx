"use client";

import { useEffect } from "react";
import type { ModelInfo } from "@/lib/types";
import styles from "./ModelSheet.module.css";

interface ModelSheetProps {
    models: ModelInfo[];
    selected: string;
    onSelect: (alias: string) => void;
    onClose: () => void;
}

export default function ModelSheet({ models, selected, onSelect, onClose }: ModelSheetProps) {
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-close (ESC 별도 처리)
        <div
            className={styles.sheetBackdrop}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="모델 선택"
        >
            <div className={styles.sheet}>
                <div className={styles.sheetTitle}>
                    모델 선택 <small>다음 메시지부터 적용</small>
                </div>
                {models.map((m) => (
                    <button
                        key={m.alias}
                        type="button"
                        className={m.alias === selected ? styles.modelRowSelected : styles.modelRow}
                        onClick={() => onSelect(m.alias)}
                    >
                        <span className={styles.modelCheck} aria-hidden>
                            {m.alias === selected ? "✓" : ""}
                        </span>
                        <span className={styles.modelInfo}>
                            <span className={styles.modelName}>
                                {m.name}
                                {m.description.includes("비용 높음") && (
                                    <span className={styles.modelCostBadge}>비용 높음</span>
                                )}
                            </span>
                            <span className={styles.modelDesc}>{m.description}</span>
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
