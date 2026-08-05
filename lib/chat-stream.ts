import type { ChatSseEvent } from "./types";

export interface ChatTurn {
    role: string;
    content: string;
}

/**
 * SSE 텍스트 버퍼에서 완결된 이벤트(`\n\n` 구분)를 파싱해 콜백으로 넘기고,
 * 아직 완결되지 않은 잔여 버퍼를 반환한다. malformed 라인은 건너뛴다.
 */
export function drainSseBuffer(buffer: string, onEvent: (event: ChatSseEvent) => void): string {
    const parts = buffer.split("\n\n");
    const remaining = parts.pop() ?? "";
    for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        let event: ChatSseEvent;
        try {
            event = JSON.parse(part.slice(6)) as ChatSseEvent;
        } catch {
            continue;
        }
        onEvent(event);
    }
    return remaining;
}

export interface StreamChatResult {
    modelId: string;
    /** relay가 생성한 답변 요약 (best-effort — 실패 시 누락) */
    summary?: string;
}

/**
 * /api/chat SSE 스트림을 소비한다. chunk 텍스트를 onChunk로 흘리고,
 * done 이벤트의 modelId·summary를 반환한다. error 이벤트·HTTP 오류는 throw.
 */
export async function streamChat(
    sessionId: string,
    messages: ChatTurn[],
    onChunk: (text: string) => void,
    model?: string,
): Promise<StreamChatResult> {
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
    let summary: string | undefined;

    const handleEvent = (event: ChatSseEvent): void => {
        if (event.type === "chunk") {
            onChunk(event.text);
        } else if (event.type === "done") {
            // relay가 modelId를 생략해도 문자열 계약 유지
            modelId = event.modelId ?? "";
            summary = event.summary;
        } else if (event.type === "error") {
            throw new Error(event.message);
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            drainSseBuffer(buffer, handleEvent);
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = drainSseBuffer(buffer, handleEvent);
    }

    return summary !== undefined ? { modelId, summary } : { modelId };
}
