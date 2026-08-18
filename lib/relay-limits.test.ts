import { describe, expect, it } from "vitest";
import { OUTGOING_BUDGET_BYTES, RELAY_LIMITS, RETRY_BUDGET_BYTES, RETRY_MAX_MESSAGES } from "./relay-limits";

describe("relay-limits", () => {
    it("exposes relay 상한 상수 그대로", () => {
        expect(RELAY_LIMITS.maxMessageContentChars).toBe(20_000);
        expect(RELAY_LIMITS.maxMessagesCount).toBe(100);
        expect(RELAY_LIMITS.maxTotalContentBytes).toBe(100_000);
        expect(RELAY_LIMITS.maxCustomPromptChars).toBe(20_000);
    });

    it("사전 가드 예산은 relay 합산 상한보다 안전 마진만큼 작다", () => {
        expect(OUTGOING_BUDGET_BYTES).toBeLessThan(RELAY_LIMITS.maxTotalContentBytes);
        expect(OUTGOING_BUDGET_BYTES).toBe(90_000);
    });

    it("재시도 최대 메시지 수는 개수 상한보다 훨씬 작다 (최근 왕복만 유지)", () => {
        expect(RETRY_MAX_MESSAGES).toBeLessThan(RELAY_LIMITS.maxMessagesCount);
        expect(RETRY_MAX_MESSAGES).toBe(5);
    });

    it("재시도 바이트 예산은 사전 가드 예산보다 작다 (상수 drift 흡수)", () => {
        expect(RETRY_BUDGET_BYTES).toBeLessThan(OUTGOING_BUDGET_BYTES);
        expect(RETRY_BUDGET_BYTES).toBe(45_000);
    });
});
