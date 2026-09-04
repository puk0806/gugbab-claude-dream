import type { ChatSseEvent } from "./types";

export interface ChatTurn {
    role: "user" | "model";
    content: string;
}

/** 사용자에게 그대로 노출 가능한 스트림 오류 문구 — 기술 정보(HTTP 코드·스택)는 담지 않는다 */
export const STREAM_ERROR_MESSAGES = {
    network: "네트워크 연결을 확인해주세요.",
    interrupted: "응답이 중간에 끊겼어요. 다시 시도해주세요.",
    generic: "잠시 후 다시 시도해주세요.",
} as const;

/**
 * message가 사용자 표시용으로 검증된 스트림 오류.
 * 이 타입이 아닌 예외(IDB DOMException·TypeError 등)는 UI에서 일반 문구로 치환해야 한다.
 */
export class ChatStreamError extends Error {
    override readonly name = "ChatStreamError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/** fetch/reader가 AbortSignal로 중단된 경우 — 사용자 이탈이므로 오류로 표시하지 않는다 */
export function isAbortError(error: unknown): boolean {
    return isRecord(error) && error.name === "AbortError";
}

/**
 * JSON.parse 결과를 ChatSseEvent 계약으로 좁힌다.
 * `data: null`·필드 타입 불일치·알 수 없는 type은 null을 반환해 호출부가 건너뛰게 한다 (전방 호환).
 */
export function toChatSseEvent(value: unknown): ChatSseEvent | null {
    if (!isRecord(value) || typeof value.type !== "string") return null;
    switch (value.type) {
        case "chunk":
            return typeof value.text === "string" ? { type: "chunk", text: value.text } : null;
        case "done":
            return {
                type: "done",
                sessionId: typeof value.sessionId === "string" ? value.sessionId : "",
                // relay가 modelId를 생략해도 문자열 계약 유지
                modelId: typeof value.modelId === "string" ? value.modelId : "",
                // 비문자열 summary가 IDB로 흘러들지 않게 가드
                ...(typeof value.summary === "string" ? { summary: value.summary } : {}),
            };
        case "error":
            return { type: "error", message: typeof value.message === "string" ? value.message : "" };
        default:
            return null;
    }
}

/**
 * SSE 텍스트 버퍼에서 완결된 이벤트(`\n\n` 구분)를 파싱해 콜백으로 넘기고,
 * 아직 완결되지 않은 잔여 버퍼를 반환한다. malformed 라인·비정형 페이로드는 건너뛴다.
 */
export function drainSseBuffer(buffer: string, onEvent: (event: ChatSseEvent) => void): string {
    const parts = buffer.split("\n\n");
    const remaining = parts.pop() ?? "";
    for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        let parsed: unknown;
        try {
            parsed = JSON.parse(part.slice(6));
        } catch {
            continue;
        }
        const event = toChatSseEvent(parsed);
        if (event) onEvent(event);
    }
    return remaining;
}

export interface StreamChatResult {
    modelId: string;
    /** relay가 생성한 답변 요약 (best-effort — 실패 시 누락) */
    summary?: string;
}

async function readErrorMessage(res: Response): Promise<string> {
    try {
        const body: unknown = await res.json();
        if (isRecord(body) && typeof body.error === "string" && body.error) return body.error;
    } catch {
        // 본문이 JSON이 아님 — 일반 문구로
    }
    return STREAM_ERROR_MESSAGES.generic;
}

/**
 * /api/chat SSE 스트림을 소비한다. chunk 텍스트를 onChunk로 흘리고,
 * done 이벤트의 modelId·summary를 반환한다.
 *
 * 실패는 항상 {@link ChatStreamError}(사용자 표시용 문구)로 던진다 — 단, signal 중단은
 * AbortError를 그대로 전파해 호출부가 "오류"가 아닌 "취소"로 구분할 수 있게 한다.
 * done 없이 스트림이 끝나면 부분 응답으로 간주해 interrupted 오류를 던진다.
 */
export async function streamChat(
    sessionId: string,
    messages: ChatTurn[],
    onChunk: (text: string) => void,
    model?: string,
    signal?: AbortSignal,
): Promise<StreamChatResult> {
    let res: Response;
    try {
        res = await fetch("/api/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId, messages, ...(model ? { model } : {}) }),
            signal,
        });
    } catch (e) {
        if (isAbortError(e)) throw e;
        throw new ChatStreamError(STREAM_ERROR_MESSAGES.network);
    }
    if (!res.ok || !res.body) throw new ChatStreamError(await readErrorMessage(res));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let modelId = "";
    let summary: string | undefined;
    let sawDone = false;

    const handleEvent = (event: ChatSseEvent): void => {
        if (event.type === "chunk") {
            onChunk(event.text);
        } else if (event.type === "done") {
            sawDone = true;
            modelId = event.modelId;
            summary = event.summary;
        } else if (event.type === "error") {
            throw new ChatStreamError(event.message || STREAM_ERROR_MESSAGES.generic);
        }
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                // 디코더가 물고 있는 멀티바이트 꼬리 바이트를 비운 뒤 종결자 없는 마지막 이벤트까지 파싱
                buffer += decoder.decode();
                drainSseBuffer(`${buffer}\n\n`, handleEvent);
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            buffer = drainSseBuffer(buffer, handleEvent);
        }
    } catch (e) {
        if (e instanceof ChatStreamError || isAbortError(e)) throw e;
        // reader 예외(네트워크 리셋 등) — 내부 메시지를 노출하지 않는다
        throw new ChatStreamError(STREAM_ERROR_MESSAGES.interrupted);
    }

    if (!sawDone) throw new ChatStreamError(STREAM_ERROR_MESSAGES.interrupted);
    return summary !== undefined ? { modelId, summary } : { modelId };
}
