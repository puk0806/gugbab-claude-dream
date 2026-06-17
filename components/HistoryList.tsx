"use client";

import { Separator } from "@gugbab/styled-radix";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { DreamSession } from "@/lib/types";
import styles from "./HistoryList.module.css";

interface HistoryListProps {
    sessions: DreamSession[];
    onDelete?: (id: string) => void;
}

export function HistoryList({ sessions, onDelete }: HistoryListProps) {
    if (sessions.length === 0) {
        return <p className={styles.empty}>아직 저장된 대화가 없어요.</p>;
    }

    return (
        <ul className={styles.list}>
            {sessions.map((s, idx) => (
                <li key={s.id} className={styles.item}>
                    <Link href={`/session/${s.id}`} className={styles.link}>
                        <div className={styles.meta}>
                            <span className={styles.date}>{formatDate(s.createdAt)}</span>
                            <span className={styles.msgCount}>{s.messages.length}개 메시지</span>
                        </div>
                        <p className={styles.preview}>{s.summary}</p>
                    </Link>
                    {onDelete && (
                        <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => onDelete(s.id)}
                            aria-label={`${formatDate(s.createdAt)} 대화 삭제`}
                        >
                            삭제
                        </button>
                    )}
                    {idx < sessions.length - 1 && <Separator className={styles.separator} />}
                </li>
            ))}
        </ul>
    );
}
