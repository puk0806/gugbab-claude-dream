"use client";

import { capitalize } from "@gugbab/utils";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ulid } from "ulid";
import { ChatInput } from "@/components/ChatInput";
import { ChatView } from "@/components/ChatView";
import { InstallButton } from "@/components/install/InstallButton";
import ModelSheet from "@/components/ModelSheet";
import { saveSession } from "@/lib/db";
import { useSpeak } from "@/lib/speech";
import type { ChatMessage, ChatSseEvent, DreamSession, ModelInfo, ModelsResponse } from "@/lib/types";
import styles from "./page.module.css";

const MODEL_STORAGE_KEY = "gugbab-dream:model";
const FALLBACK_MODEL = "sonnet";

function loadStoredModel(): string {
    if (typeof window === "undefined") return FALLBACK_MODEL;
    try {
        return window.localStorage.getItem(MODEL_STORAGE_KEY) ?? FALLBACK_MODEL;
    } catch {
        return FALLBACK_MODEL;
    }
}

async function streamChat(
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
    onChunk: (text: string) => void,
    model?: string,
): Promise<string> {
    const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, messages, ...(model ? { model } : {}) }),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let modelId = "";

    const processBuffer = (buf: string): string => {
        const parts = buf.split("\n\n");
        const remaining = parts.pop() ?? "";
        for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            let event: ChatSseEvent;
            try {
                event = JSON.parse(part.slice(6)) as ChatSseEvent;
            } catch {
                continue;
            }
            if (event.type === "chunk") {
                onChunk(event.text);
            } else if (event.type === "done") {
                modelId = event.modelId;
            } else if (event.type === "error") {
                throw new Error(event.message);
            }
        }
        return remaining;
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            processBuffer(buffer);
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = processBuffer(buffer);
    }

    return modelId;
}

export default function HomePage() {
    const [session, setSession] = useState<DreamSession | null>(null);
    const [streamingText, setStreamingText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [models, setModels] = useState<ModelInfo[] | null>(null);
    const [model, setModel] = useState<string>(loadStoredModel);
    const [sheetOpen, setSheetOpen] = useState(false);

    // SSR hydration mismatch 방지 — 마운트 후 localStorage에서 읽음
    useEffect(() => {
        setTtsEnabled(localStorage.getItem("tts-enabled") === "true");
    }, []);
    const [errorMsg, setErrorMsg] = useState("");
    const { speak, supported: ttsSupported } = useSpeak();

    useEffect(() => {
        let cancelled = false;
        async function loadModels() {
            try {
                const res = await fetch("/api/models");
                if (!res.ok) return;
                const data = (await res.json()) as ModelsResponse;
                if (cancelled) return;
                setModels(data.models);
                // 저장된 alias가 폐기됐으면 relay 기본값으로 폴백
                setModel((prev) => (data.models.some((m) => m.alias === prev) ? prev : data.default));
            } catch {
                // 미로드 시 모델 미전달 — relay 기본값에 위임
            }
        }
        loadModels();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSelectModel = (alias: string) => {
        setModel(alias);
        try {
            localStorage.setItem(MODEL_STORAGE_KEY, alias);
        } catch {
            // localStorage 불가 환경 — 세션 내 상태로만 유지
        }
        setSheetOpen(false);
    };

    const sendMessage = useCallback(
        async (text: string) => {
            setErrorMsg("");
            const userMsg: ChatMessage = {
                role: "user",
                content: text,
                timestamp: Date.now(),
            };

            const current: DreamSession = session ?? {
                id: ulid(),
                createdAt: Date.now(),
                messages: [],
                summary: text.slice(0, 50),
                modelId: "",
                schemaVersion: 2,
            };
            const withUser = { ...current, messages: [...current.messages, userMsg] };
            setSession(withUser);

            setIsStreaming(true);
            setStreamingText("");
            let accumulated = "";

            try {
                await saveSession(withUser);

                const modelId = await streamChat(
                    withUser.id,
                    withUser.messages.map((m) => ({ role: m.role, content: m.content })),
                    (chunk) => {
                        accumulated += chunk;
                        setStreamingText(accumulated);
                    },
                    // 목록으로 검증된 경우에만 model 전달 — 미로드 시 relay 기본값에 위임 (폐기된 alias 전송 방지)
                    models ? model : undefined,
                );

                if (accumulated) {
                    const aiMsg: ChatMessage = {
                        role: "model",
                        content: accumulated,
                        timestamp: Date.now(),
                    };
                    const finalSession: DreamSession = {
                        ...withUser,
                        messages: [...withUser.messages, aiMsg],
                        modelId,
                    };
                    setSession(finalSession);
                    if (ttsEnabled && ttsSupported) speak(accumulated);
                    try {
                        await saveSession(finalSession);
                    } catch {
                        // IDB failure is non-critical — UI already updated
                    }
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.";
                setErrorMsg(msg);
            } finally {
                setIsStreaming(false);
                setStreamingText("");
            }
        },
        [session, ttsEnabled, models, model, speak, ttsSupported],
    );

    const handleNewSession = () => {
        setSession(null);
        setErrorMsg("");
    };

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

            {session && session.messages.length > 0 && !isStreaming && (
                <button type="button" onClick={handleNewSession} className={styles.newSessionBtn}>
                    새 꿈 이야기하기
                </button>
            )}

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
