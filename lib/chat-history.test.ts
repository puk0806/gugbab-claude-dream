import { describe, expect, it } from "vitest";
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
        const messages = turns(80);
        const out = toOutgoingMessages(messages);
        expect(out.length).toBeLessThanOrEqual(MESSAGE_LIMITS.maxCount);
        expect(out.at(-1)?.content).toBe("메시지 79");
    });

    it("잘라낸 뒤 첫 메시지가 model이면 제거한다 (relay 규약: 첫 메시지는 user)", () => {
        // 81개: slice(-30)이 인덱스 51(model)에서 시작 → 드롭 분기가 실제로 실행됨
        const messages = turns(81);
        const out = toOutgoingMessages(messages);
        expect(out.length).toBe(29); // 30개 중 선두 model 1개 제거
        expect(out[0].role).toBe("user");
        expect(out[0].content).toBe("메시지 52");
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

    it("최근 4개보다 오래된 model 메시지는 요약으로 대체한다", () => {
        const out = toOutgoingMessages([
            { role: "user", content: "뱀 꿈을 꿨어" },
            { role: "model", content: long, summary: "뱀 꿈은 재물운의 상징이라는 해석." },
            { role: "user", content: "그 다음은?" },
            { role: "model", content: "이어지는 답변" },
            { role: "user", content: "또 물었다" },
            { role: "model", content: "또 답했다" },
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
        ]);
        expect(out[1].content).toContain("…(이하 생략)");
    });

    it("최근 4개 메시지는 요약이 있어도 원문을 유지한다 (클램프만 적용)", () => {
        const out = toOutgoingMessages([
            { role: "user", content: "옛 질문" },
            { role: "model", content: "옛 답변", summary: "옛 요약" },
            { role: "user", content: "최근 질문" },
            { role: "model", content: "최근 답변", summary: "최근 요약" },
            { role: "user", content: "마지막 질문" },
        ]);
        // 뒤에서 4개(인덱스 1~4)는 원문 — 인덱스 1의 model도 최근 범위라 요약 미적용
        expect(out[1].content).toBe("옛 답변");
        expect(out[3].content).toBe("최근 답변");
        expect(out[4].content).toBe("마지막 질문");
    });

    it("전송 메시지에 summary 필드는 포함하지 않는다 ({ role, content }만 전송)", () => {
        const out = toOutgoingMessages([
            { role: "user", content: "질문", summary: "이상하게 붙은 요약" },
            { role: "model", content: "답변", summary: "요약" },
        ]);
        for (const m of out) {
            expect(Object.keys(m).sort()).toEqual(["content", "role"]);
        }
    });

    it("요약 대체 후에도 글자수 상한을 지킨다 (과대 요약 방어)", () => {
        const hugeSummary = "요".repeat(MESSAGE_LIMITS.maxContentLength + 100);
        const out = toOutgoingMessages([
            { role: "user", content: "q1" },
            { role: "model", content: long, summary: hugeSummary },
            { role: "user", content: "q2" },
            { role: "model", content: "a2" },
            { role: "user", content: "q3" },
            { role: "model", content: "a3" },
        ]);
        expect(out[1].content.length).toBeLessThanOrEqual(MESSAGE_LIMITS.maxContentLength);
        expect(out[1].content.startsWith("[이전 답변 요약] ")).toBe(true);
    });
});
