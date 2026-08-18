import { totalContentBytes } from "@gugbab/utils";
import { describe, expect, it } from "vitest";
import { OUTGOING_BUDGET_BYTES } from "@/lib/relay-limits";
import { MESSAGE_LIMITS, toOutgoingMessages } from "./chat-history";

interface Turn {
    role: "user" | "model";
    content: string;
}

function turns(count: number, contentFor?: (i: number) => string): Turn[] {
    return Array.from({ length: count }, (_, i) => ({
        role: i % 2 === 0 ? ("user" as const) : ("model" as const),
        content: contentFor?.(i) ?? `메시지 ${i}`,
    }));
}

describe("toOutgoingMessages", () => {
    it("짧은 이력은 원문 그대로 전달한다", () => {
        const messages = turns(5);
        expect(toOutgoingMessages(messages)).toEqual(messages);
    });

    it("글자수 상한을 넘는 메시지는 잘라낸다", () => {
        const long = "꿈".repeat(MESSAGE_LIMITS.maxContentLength + 500);
        const out = toOutgoingMessages([
            { role: "user", content: long },
            { role: "model", content: long },
            { role: "user", content: "그게 무슨 뜻이야?" },
        ]);
        for (const m of out) {
            expect(m.content.length).toBeLessThanOrEqual(MESSAGE_LIMITS.maxContentLength);
        }
        expect(out[1].content).toContain("…(이하 생략)");
        expect(out[2].content).toBe("그게 무슨 뜻이야?");
    });

    it("개수 상한을 넘으면 최근 것만 남긴다", () => {
        const messages = turns(81); // user로 끝나는 긴 이력
        const out = toOutgoingMessages(messages);
        expect(out.length).toBeLessThanOrEqual(MESSAGE_LIMITS.maxCount);
        expect(out.at(-1)?.content).toBe("메시지 80");
    });

    it("잘라낸 뒤 첫 메시지가 model이면 제거한다 (relay 규약: 첫 메시지는 user)", () => {
        // 81개 → 왕복 단위 드롭 후 user(메시지 52)부터 시작하는 29개가 남는다
        const messages = turns(81);
        const out = toOutgoingMessages(messages);
        expect(out.length).toBe(29);
        expect(out[0].role).toBe("user");
        expect(out[0].content).toBe("메시지 52");
    });

    it("잘라낸 뒤에도 relay 규약(첫·마지막 메시지는 user)을 지킨다", () => {
        // model로 끝나는 이력 — 꼬리 model도 제거되어야 한다
        const messages = turns(80);
        const out = toOutgoingMessages(messages);
        expect(out[0].role).toBe("user");
        expect(out.at(-1)?.role).toBe("user");
    });

    it("합산 바이트 예산을 넘으면 오래된 왕복부터 드롭한다", () => {
        // 요약 없는 4,000자(≈12KB) 메시지 31개 = 약 372KB — 예산(90KB)의 4배 이상
        const long = "꿈".repeat(MESSAGE_LIMITS.maxContentLength);
        const messages = turns(31, () => long);
        const out = toOutgoingMessages(messages);
        expect(totalContentBytes(out)).toBeLessThanOrEqual(OUTGOING_BUDGET_BYTES);
        expect(out.length).toBeLessThan(31);
        // 가장 최근 user 턴은 드롭되지 않는다
        expect(out.at(-1)?.role).toBe("user");
    });

    it("윈도우에 user 메시지가 하나도 없으면 빈 배열을 반환한다 (relay 규약 위반 방지)", () => {
        const allModel: Turn[] = Array.from({ length: 3 }, (_, i) => ({
            role: "model" as const,
            content: `답변 ${i}`,
        }));
        expect(toOutgoingMessages(allModel)).toEqual([]);
    });

    it("빈 이력은 빈 배열을 반환한다", () => {
        expect(toOutgoingMessages([])).toEqual([]);
    });
});

describe("toOutgoingMessages — 요약 기반 압축", () => {
    const long = "긴 해몽 답변 ".repeat(600); // 4000자 초과

    it("최근 보존 왕복보다 오래된 model 메시지는 요약으로 대체한다", () => {
        const out = toOutgoingMessages([
            { role: "user", content: "뱀 꿈을 꿨어" },
            { role: "model", content: long, summary: "뱀 꿈은 재물운의 상징이라는 해석." },
            { role: "user", content: "그 다음은?" },
            { role: "model", content: "이어지는 답변" },
            { role: "user", content: "또 물었다" },
            { role: "model", content: "또 답했다" },
            { role: "user", content: "마지막 질문" },
        ]);
        expect(out[1].content).toBe("[이전 답변 요약] 뱀 꿈은 재물운의 상징이라는 해석.");
    });

    it("요약이 없는 오래된 model 메시지는 기존처럼 절삭한다 (best-effort 폴백)", () => {
        const out = toOutgoingMessages([
            { role: "user", content: "뱀 꿈" },
            { role: "model", content: long },
            { role: "user", content: "q2" },
            { role: "model", content: "a2" },
            { role: "user", content: "q3" },
            { role: "model", content: "a3" },
            { role: "user", content: "q4" },
        ]);
        expect(out[1].content.length).toBeLessThanOrEqual(MESSAGE_LIMITS.maxContentLength);
        expect(out[1].content).toContain("…(이하 생략)");
        expect(out[1].content).not.toContain("[이전 답변 요약]");
    });

    it("빈 문자열 요약은 없는 것으로 취급해 절삭 폴백한다", () => {
        const out = toOutgoingMessages([
            { role: "user", content: "뱀 꿈" },
            { role: "model", content: long, summary: "" },
            { role: "user", content: "q2" },
            { role: "model", content: "a2" },
            { role: "user", content: "q3" },
            { role: "model", content: "a3" },
            { role: "user", content: "q4" },
        ]);
        expect(out[1].content).toContain("…(이하 생략)");
    });

    it("최근 보존 왕복 안의 메시지는 요약이 있어도 원문을 유지한다", () => {
        // 원문이 요약보다 훨씬 커서, 보호 왕복이 아니라면 반드시 요약으로 교체될 형태 —
        // 교체 이득(isShorter) 판정이 아닌 보호 왕복(KEEP_RECENT_TURNS) 자체를 검증한다
        const recentLong = "아주 긴 최근 답변 ".repeat(100);
        const out = toOutgoingMessages([
            { role: "user", content: "최근 질문" },
            { role: "model", content: recentLong, summary: "짧은 요약" },
            { role: "user", content: "마지막 질문" },
        ]);
        expect(out[1].content).toBe(recentLong);
        expect(out[1].content).not.toContain("[이전 답변 요약]");
        expect(out[2].content).toBe("마지막 질문");
    });

    it("빈 content 메시지는 전송에서 제외한다 (zod min(1) 거부로 인한 방 브릭 방지)", () => {
        const out = toOutgoingMessages([
            { role: "user", content: "뱀 꿈" },
            { role: "model", content: "" },
            { role: "user", content: "왜 답이 없었지?" },
        ]);
        expect(out).toEqual([
            { role: "user", content: "뱀 꿈" },
            { role: "user", content: "왜 답이 없었지?" },
        ]);
    });

    it("전송 메시지에 summary 필드는 포함하지 않는다 ({ role, content }만 전송)", () => {
        const out = toOutgoingMessages([
            { role: "user", content: "질문", summary: "이상하게 붙은 요약" },
            { role: "model", content: "답변", summary: "요약" },
            { role: "user", content: "다음 질문" },
        ]);
        expect(out.length).toBe(3);
        for (const m of out) {
            expect(Object.keys(m).sort()).toEqual(["content", "role"]);
        }
    });

    it("요약이 원문보다 크면 원문을 유지한다 (교체 이득 없음 — 과대 요약 방어)", () => {
        const hugeSummary = "요".repeat(MESSAGE_LIMITS.maxContentLength + 100);
        const out = toOutgoingMessages([
            { role: "user", content: "q1" },
            { role: "model", content: long, summary: hugeSummary },
            { role: "user", content: "q2" },
            { role: "model", content: "a2" },
            { role: "user", content: "q3" },
            { role: "model", content: "a3" },
            { role: "user", content: "q4" },
        ]);
        expect(out[1].content.length).toBeLessThanOrEqual(MESSAGE_LIMITS.maxContentLength);
        expect(out[1].content).not.toContain("[이전 답변 요약]");
        expect(out[1].content).toContain("긴 해몽 답변");
    });
});
