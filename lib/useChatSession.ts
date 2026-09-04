// 클라이언트 전용 — SSR에서 호출하지 않는다.
import { useCallback, useEffect, useRef, useState } from "react";
import { ulid } from "ulid";
import { toOutgoingMessages } from "./chat-history";
import { ChatStreamError, isAbortError, STREAM_ERROR_MESSAGES, streamChat } from "./chat-stream";
import { deleteSession, saveSession } from "./db";
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
    /**
     * 전송 결과 — true면 답변(부분 응답 포함)이 세션에 확정됐고,
     * false면 답변을 전혀 받지 못해 사용자 턴을 롤백했다 (입력 복원 대상)
     */
    readonly sendMessage: (text: string) => Promise<boolean>;
    readonly startNewSession: () => void;
}

/** IDB 저장은 best-effort — 프라이빗 모드·용량 초과 환경에서도 대화 자체는 계속되어야 한다 */
async function persist(session: DreamSession): Promise<void> {
    try {
        await saveSession(session);
    } catch {
        // 화면 상태가 진실 — 저장 실패는 조용히 넘긴다
    }
}

function toUserMessage(error: unknown, fallback: string): string {
    return error instanceof ChatStreamError ? error.message : fallback;
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
    // 진행 중 요청 — 중복 전송 가드 겸 언마운트 시 중단 핸들
    const abortRef = useRef<AbortController | null>(null);
    // 전송 시점이 아닌 완료 시점의 콜백을 호출 — 스트리밍 도중 TTS를 켜도 그 답변부터 반영
    const completeRef = useRef(onAssistantComplete);
    useEffect(() => {
        completeRef.current = onAssistantComplete;
    }, [onAssistantComplete]);

    // 화면을 떠나면 스트림을 끊는다 — 떠난 화면의 fetch가 relay를 계속 점유하지 않게
    useEffect(() => () => abortRef.current?.abort(), []);

    const sendMessage = useCallback(
        async (text: string): Promise<boolean> => {
            if (abortRef.current) return false;
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
            const controller = new AbortController();
            abortRef.current = controller;
            let accumulated = "";

            await persist(withUser);

            try {
                // 긴 해몽 답변이 쌓여도 API 한도(개수·글자수)를 넘지 않도록 압축해 전송
                // (오래된 model 턴은 relay 요약이 있으면 요약으로 대체 — chat-history 참조)
                const { modelId, summary } = await streamChat(
                    withUser.id,
                    toOutgoingMessages(
                        withUser.messages.map((m) => ({
                            role: m.role,
                            content: m.content,
                            summary: m.summary,
                            truncated: m.truncated,
                        })),
                    ),
                    (chunk) => {
                        accumulated += chunk;
                        setStreamingText(accumulated);
                    },
                    model,
                    controller.signal,
                );
                // done은 왔지만 텍스트가 한 글자도 없음 — 답변 없는 턴을 남기지 않고 롤백 경로로
                if (!accumulated) throw new ChatStreamError(STREAM_ERROR_MESSAGES.generic);

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
                completeRef.current?.(accumulated);
                await persist(finalSession);
                return true;
            } catch (e) {
                const aborted = isAbortError(e);

                if (accumulated) {
                    // 부분 응답은 버리지 않는다 — 읽고 있던 내용이 사라지지 않게 '끊김' 표시로 확정
                    const partial: ChatMessage = {
                        role: "model",
                        content: accumulated,
                        timestamp: Date.now(),
                        truncated: true,
                    };
                    const partialSession: DreamSession = {
                        ...withUser,
                        messages: [...withUser.messages, partial],
                        modelId: model ?? "",
                    };
                    setSession(partialSession);
                    await persist(partialSession);
                    if (!aborted) setErrorMsg(toUserMessage(e, STREAM_ERROR_MESSAGES.interrupted));
                    return true;
                }

                // 답변을 전혀 못 받음 — 낙관적 user 턴을 롤백해 답 없는 질문이 이력에 남지 않게
                setSession(session);
                if (current.messages.length === 0) {
                    try {
                        await deleteSession(current.id);
                    } catch {
                        // 저장 자체가 실패했을 수 있음 — 무시
                    }
                } else {
                    await persist(current);
                }
                if (!aborted) setErrorMsg(toUserMessage(e, STREAM_ERROR_MESSAGES.generic));
                return false;
            } finally {
                abortRef.current = null;
                setIsStreaming(false);
                setStreamingText("");
            }
        },
        [session, model],
    );

    const startNewSession = useCallback(() => {
        setSession(null);
        setErrorMsg("");
    }, []);

    return { session, streamingText, isStreaming, errorMsg, sendMessage, startNewSession };
}
