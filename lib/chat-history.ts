import { compressHistory, fitMessagesToBudget } from "@gugbab/utils";
import { OUTGOING_BUDGET_BYTES } from "@/lib/relay-limits";

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
// 원문을 그대로 보존할 최근 왕복 수 — 직전 턴의 뉘앙스가 답변 품질에 직결되므로 요약 대체 대상에서 제외.
// 3왕복은 리팩터링 이전의 "최근 4개 메시지" 보호 범위를 항상 포함한다 (동작 회귀 방지)
const KEEP_RECENT_TURNS = 3;
const TRUNCATION_MARK = "\n…(이하 생략)";
const SUMMARY_PREFIX = "[이전 답변 요약] ";

function clampContent(content: string): string {
    if (content.length <= MESSAGE_LIMITS.maxContentLength) return content;
    return content.slice(0, MESSAGE_LIMITS.maxContentLength - TRUNCATION_MARK.length) + TRUNCATION_MARK;
}

/**
 * 대화 이력을 API 전송용으로 압축한다.
 * 바이트 계산·요약 교체·드롭 로직은 @gugbab/utils에 위임하고,
 * 앱은 정책 값(보존 왕복 수·개수·바이트 예산)만 결정한다.
 *
 * - 최근 {@link KEEP_RECENT_TURNS} 왕복은 원문 유지, 그보다 오래된 model 답변은
 *   요약이 있고 원문보다 작을 때만 요약으로 교체 (compressHistory)
 * - 각 메시지는 글자수 상한 내로 잘라낸다 (요약 없는 오래된 답변의 절삭 폴백 포함)
 * - 바이트({@link OUTGOING_BUDGET_BYTES})·개수 예산 초과 시 오래된 왕복부터 드롭하고
 *   relay 규약(첫·마지막 메시지는 user)을 보장 (fitMessagesToBudget)
 * - 반환값은 {@link OutgoingMessage}만 포함한다 — summary 필드는 전송하지 않는다
 */
export function toOutgoingMessages(messages: readonly HistoryMessage[]): OutgoingMessage[] {
    // 전송 불가 메시지 제거 — 빈 content는 API zod(min 1)가 요청 전체를 거부해
    // 방이 영구 전송 불가(브릭)가 된다 (health 앱과 동일한 방어)
    const sendable = messages.filter((m) => m.content.length > 0);
    // @gugbab/utils의 role 계약은 "user" | "assistant" — model을 매핑했다가 되돌린다
    const normalized = sendable.map((m) => ({
        role: m.role === "model" ? ("assistant" as const) : ("user" as const),
        content: m.content,
        summary: m.summary,
    }));
    const compressed = compressHistory(normalized, {
        getSummary: (m) => (m.summary ? SUMMARY_PREFIX + m.summary : undefined),
        keepRecentTurns: KEEP_RECENT_TURNS,
    });
    const clamped = compressed.map((m) => ({ role: m.role, content: clampContent(m.content) }));
    const fitted = fitMessagesToBudget(clamped, OUTGOING_BUDGET_BYTES, MAX_OUTGOING_COUNT);
    return fitted.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        content: m.content,
    }));
}
