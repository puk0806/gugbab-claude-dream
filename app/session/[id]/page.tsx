"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ChatView } from "@/components/ChatView";
import { getSession } from "@/lib/db";
import { formatDate } from "@/lib/format";
import type { DreamSession } from "@/lib/types";
import styles from "./page.module.css";

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [session, setSession] = useState<DreamSession | null | "loading">("loading");

    useEffect(() => {
        getSession(id)
            .then((s) => setSession(s ?? null))
            .catch(() => setSession(null));
    }, [id]);

    if (session === "loading") return null;

    if (!session) {
        return (
            <main className={styles.page}>
                <header className={styles.header}>
                    <Link href="/history" className={styles.back}>
                        ← 히스토리
                    </Link>
                </header>
                <p className={styles.notFound}>대화를 찾을 수 없어요.</p>
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <Link href="/history" className={styles.back}>
                    ← 히스토리
                </Link>
                <div className={styles.meta}>
                    <div>{formatDate(session.createdAt)}</div>
                    <div>{session.messages.length}개 메시지</div>
                </div>
            </header>

            <ChatView messages={session.messages} streamingText="" isStreaming={false} />

            <p className={styles.readonlyNote}>
                읽기 전용 — 이어서 대화하려면{" "}
                <Link href="/" style={{ color: "var(--gugbab-color-accent-base, #0090ff)" }}>
                    홈으로
                </Link>
            </p>
        </main>
    );
}
