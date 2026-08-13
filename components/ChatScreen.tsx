"use client";

import { capitalize } from "@gugbab/utils";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { ChatView } from "@/components/ChatView";
import { InstallButton } from "@/components/install/InstallButton";
import ModelSheet from "@/components/ModelSheet";
import { useSpeak } from "@/lib/speech";
import type { DreamSession } from "@/lib/types";
import { useChatSession } from "@/lib/useChatSession";
import { useModelSelection } from "@/lib/useModelSelection";
import styles from "./ChatScreen.module.css";

interface ChatScreenProps {
    /** 과거 세션 이어하기 — 전달 시 해당 대화가 채워진 상태로 시작 */
    initialSession?: DreamSession;
}

export function ChatScreen({ initialSession }: ChatScreenProps) {
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const { speak, supported: ttsSupported } = useSpeak();
    const { models, model, selectModel } = useModelSelection();

    // SSR hydration mismatch 방지 — 마운트 후 localStorage에서 읽음
    useEffect(() => {
        setTtsEnabled(localStorage.getItem("tts-enabled") === "true");
    }, []);

    const handleAssistantComplete = useCallback(
        (text: string) => {
            if (ttsEnabled && ttsSupported) speak(text);
        },
        [ttsEnabled, ttsSupported, speak],
    );

    const { session, streamingText, isStreaming, errorMsg, sendMessage, startNewSession } = useChatSession({
        // 목록으로 검증된 경우에만 model 전달 — 미로드 시 relay 기본값에 위임 (폐기된 alias 전송 방지)
        model: models ? model : undefined,
        onAssistantComplete: handleAssistantComplete,
        initialSession,
    });

    const handleSelectModel = (alias: string) => {
        selectModel(alias);
        setSheetOpen(false);
    };

    const showNewSession = session && session.messages.length > 0 && !isStreaming;

    return (
        <main className={styles.home}>
            <header className={styles.header}>
                <h1 className={styles.title}>꿈해몽 💬</h1>
                <nav className={styles.headerActions}>
                    <button
                        type="button"
                        className={styles.modelChip}
                        onClick={() => setSheetOpen(true)}
                        disabled={isStreaming || !models}
                        aria-haspopup="dialog"
                    >
                        {models ? capitalize(model) : "모델"} <span aria-hidden>▾</span>
                    </button>
                    <InstallButton />
                    <Link href="/history" className={styles.historyLink}>
                        히스토리
                    </Link>
                </nav>
            </header>

            <ChatView messages={session?.messages ?? []} streamingText={streamingText} isStreaming={isStreaming} />

            {errorMsg && (
                <div className={styles.errorBanner} role="alert">
                    <span aria-hidden>⚠️</span>
                    <span>{errorMsg}</span>
                </div>
            )}

            {showNewSession &&
                // resume 모드에서 새 대화를 시작하면 URL(/session/[id])과 state가 어긋나므로 홈으로 이동
                (initialSession ? (
                    <Link href="/" className={styles.newSessionBtn}>
                        새 꿈 이야기하기
                    </Link>
                ) : (
                    <button type="button" onClick={startNewSession} className={styles.newSessionBtn}>
                        새 꿈 이야기하기
                    </button>
                ))}

            <ChatInput
                onSend={sendMessage}
                disabled={isStreaming}
                ttsEnabled={ttsEnabled}
                onTtsToggle={() =>
                    setTtsEnabled((v) => {
                        const next = !v;
                        localStorage.setItem("tts-enabled", String(next));
                        return next;
                    })
                }
            />

            {sheetOpen && models && (
                <ModelSheet
                    models={models}
                    selected={model}
                    onSelect={handleSelectModel}
                    onClose={() => setSheetOpen(false)}
                />
            )}
        </main>
    );
}
