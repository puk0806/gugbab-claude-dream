/**
 * 채팅 이력 전송 한도 — /api/chat zod 스키마와 클라이언트 전송 압축이 반드시 이 상수를 공유한다.
 * (긴 해몽 답변이 이력에 쌓이면 API가 400으로 거부해 방 전체가 막히는 문제 방지)
 */
export const MESSAGE_LIMITS = {
    maxContentLength: 4000,
    maxCount: 50,
} as const;

/** /api/chat로 전송하는 메시지 형태 */
export interface OutgoingMessage {
    role: "user" | "model";
    content: string;
}

// 전송 이력 상한 — API 상한(50)보다 낮게 잡아 여유를 둔다
const MAX_OUTGOING_COUNT = 30;
const TRUNCATION_MARK = "\n…(이하 생략)";

function clampContent(content: string): string {
    if (content.length <= MESSAGE_LIMITS.maxContentLength) return content;
    return content.slice(0, MESSAGE_LIMITS.maxContentLength - TRUNCATION_MARK.length) + TRUNCATION_MARK;
}

/**
 * 대화 이력을 API 전송용으로 압축한다.
 *
 * - 최근 {@link MAX_OUTGOING_COUNT}개만 남기고, 각 메시지는 글자수 상한 내로 잘라낸다
 * - relay 규약(첫 메시지는 user)을 위해 잘라낸 뒤 선두의 model 메시지는 제거한다
 */
export function toOutgoingMessages(messages: readonly OutgoingMessage[]): OutgoingMessage[] {
    const sliced = messages.slice(-MAX_OUTGOING_COUNT);
    const firstUserIdx = sliced.findIndex((m) => m.role === "user");
    const window = firstUserIdx > 0 ? sliced.slice(firstUserIdx) : sliced;
    return window.map((m) => ({ role: m.role, content: clampContent(m.content) }));
}
