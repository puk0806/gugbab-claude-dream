// 클라이언트 전용 — SSR에서 호출하지 않는다.
import { useCallback, useState } from "react";
import { ulid } from "ulid";
import { toOutgoingMessages } from "./chat-history";
import { streamChat } from "./chat-stream";
import { saveSession } from "./db";
import type { ChatMessage, DreamSession } from "./types";

export interface UseChatSessionOptions {
    /** 목록으로 검증된 경우에만 전달 — 미전달 시 relay 기본 모델에 위임 (폐기된 alias 전송 방지) */
    readonly model?: string;
    /** 어시스턴트 응답 완료 시 호출 (TTS 낭독 등) */
    readonly onAssistantComplete?: (text: string) => void;
    /** 과거 세션 이어하기 — 초기 세션 상태로 주입 (히스토리 → 세션 페이지) */
    readonly initialSession?: DreamSession | null;
}

export interface UseChatSessionReturn {
    readonly session: DreamSession | null;
    readonly streamingText: string;
    readonly isStreaming: boolean;
    readonly errorMsg: string;
    readonly sendMessage: (text: string) => Promise<void>;
    readonly startNewSession: () => void;
}

export function useChatSession({
    model,
    onAssistantComplete,
    initialSession,
}: UseChatSessionOptions): UseChatSessionReturn {
    const [session, setSession] = useState<DreamSession | null>(initialSession ?? null);
    const [streamingText, setStreamingText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

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

                // 긴 해몽 답변이 쌓여도 API 한도(개수·글자수)를 넘지 않도록 압축해 전송
                // (오래된 model 턴은 relay 요약이 있으면 요약으로 대체 — chat-history 참조)
                const { modelId, summary } = await streamChat(
                    withUser.id,
                    toOutgoingMessages(
                        withUser.messages.map((m) => ({ role: m.role, content: m.content, summary: m.summary })),
                    ),
                    (chunk) => {
                        accumulated += chunk;
                        setStreamingText(accumulated);
                    },
                    model,
                );

                if (accumulated) {
                    const aiMsg: ChatMessage = {
                        role: "model",
                        content: accumulated,
                        timestamp: Date.now(),
                        ...(summary !== undefined ? { summary } : {}),
                    };
                    const finalSession: DreamSession = {
                        ...withUser,
                        messages: [...withUser.messages, aiMsg],
                        modelId,
                    };
                    setSession(finalSession);
                    onAssistantComplete?.(accumulated);
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
        [session, model, onAssistantComplete],
    );

    const startNewSession = useCallback(() => {
        setSession(null);
        setErrorMsg("");
    }, []);

    return { session, streamingText, isStreaming, errorMsg, sendMessage, startNewSession };
}
