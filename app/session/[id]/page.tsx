"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ChatScreen } from "@/components/ChatScreen";
import { getSession } from "@/lib/db";
import type { DreamSession } from "@/lib/types";
import styles from "./page.module.css";

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [session, setSession] = useState<DreamSession | null | "loading">("loading");

    useEffect(() => {
        // id 변경(세션 간 이동) 시 이전 세션 화면이 남지 않도록 로딩 상태로 리셋
        setSession("loading");
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

    // key로 세션 교체 시 ChatScreen을 remount — initialSession은 mount 시 1회만 읽히므로
    return <ChatScreen key={session.id} initialSession={session} />;
}
