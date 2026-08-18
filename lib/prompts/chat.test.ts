import { describe, expect, it } from "vitest";
import { RELAY_LIMITS } from "@/lib/relay-limits";
import { getChatSystemPrompt } from "./chat";

describe("getChatSystemPrompt", () => {
    it("stays well under the relay systemPrompt cap (프롬프트 비대화 회귀 가드)", () => {
        // systemPrompt 상한 초과 400은 history-budget 재시도로 복구되지 않는 유형 —
        // 프롬프트 파일이 커져도 배포 전에 여기서 걸리게 한다 (현재 실측 ~600자 수준)
        expect(getChatSystemPrompt("casual").length).toBeLessThan(RELAY_LIMITS.maxCustomPromptChars);
        expect(getChatSystemPrompt("deep").length).toBeLessThan(RELAY_LIMITS.maxCustomPromptChars);
    });

    it("defaults to deep mode", () => {
        const prompt = getChatSystemPrompt();
        expect(prompt).toContain("꿈해몽가");
        expect(prompt).toContain("300~500자");
    });

    it("casual mode is shorter and more informal", () => {
        const prompt = getChatSystemPrompt("casual");
        expect(prompt).toContain("친구");
        expect(prompt).toContain("80~150자");
    });

    it("deep mode forbids perspective-labeled analysis and demands conversational flow", () => {
        const prompt = getChatSystemPrompt("deep");
        expect(prompt).toContain("관점 나열 금지");
        expect(prompt).toContain("이야기하듯");
        expect(prompt).not.toContain("여러 관점(전통·심리학·과학)으로 분석");
    });

    it("casual and deep prompts are different", () => {
        expect(getChatSystemPrompt("casual")).not.toBe(getChatSystemPrompt("deep"));
    });

    it("both modes forbid definitive predictions", () => {
        expect(getChatSystemPrompt("casual")).toContain("금지");
        expect(getChatSystemPrompt("deep")).toContain("금지");
    });
});
