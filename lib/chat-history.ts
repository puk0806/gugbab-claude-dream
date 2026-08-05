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

/** 압축 입력 형태 — model 메시지는 relay가 생성한 요약(best-effort)을 가질 수 있다 */
export interface HistoryMessage extends OutgoingMessage {
    summary?: string;
}

// 전송 이력 상한 — API 상한(50)보다 낮게 잡아 여유를 둔다
const MAX_OUTGOING_COUNT = 30;
// 최근 N개는 원문 유지 — 직전 턴의 뉘앙스가 답변 품질에 직결되므로 요약 대체 대상에서 제외
const RECENT_VERBATIM_COUNT = 4;
const TRUNCATION_MARK = "\n…(이하 생략)";
const SUMMARY_PREFIX = "[이전 답변 요약] ";

function clampContent(content: string): string {
    if (content.length <= MESSAGE_LIMITS.maxContentLength) return content;
    return content.slice(0, MESSAGE_LIMITS.maxContentLength - TRUNCATION_MARK.length) + TRUNCATION_MARK;
}

/**
 * 대화 이력을 API 전송용으로 압축한다.
 *
 * - 최근 {@link MAX_OUTGOING_COUNT}개만 남기고, 각 메시지는 글자수 상한 내로 잘라낸다
 * - relay 규약(첫 메시지는 user)을 위해 잘라낸 뒤 선두의 model 메시지는 제거한다
 * - 최근 {@link RECENT_VERBATIM_COUNT}개보다 오래된 model 메시지는 요약이 있으면 요약으로
 *   대체한다 (요약은 best-effort — 없으면 기존처럼 원문 절삭)
 * - 반환값은 {@link OutgoingMessage}만 포함한다 — summary 필드는 전송하지 않는다
 */
export function toOutgoingMessages(messages: readonly HistoryMessage[]): OutgoingMessage[] {
    const sliced = messages.slice(-MAX_OUTGOING_COUNT);
    const firstUserIdx = sliced.findIndex((m) => m.role === "user");
    // user 메시지가 하나도 없으면 빈 배열 — relay 규약 위반 payload를 만들지 않는다
    if (firstUserIdx === -1) return [];
    const window = sliced.slice(firstUserIdx);
    return window.map((m, i) => {
        const isRecent = i >= window.length - RECENT_VERBATIM_COUNT;
        if (!isRecent && m.role === "model" && m.summary) {
            return { role: m.role, content: clampContent(SUMMARY_PREFIX + m.summary) };
        }
        return { role: m.role, content: clampContent(m.content) };
    });
}
