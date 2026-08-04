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
        const messages = turns(80);
        const out = toOutgoingMessages(messages);
        expect(out[0].role).toBe("user");
    });

    it("빈 이력은 빈 배열을 반환한다", () => {
        expect(toOutgoingMessages([])).toEqual([]);
    });
});
