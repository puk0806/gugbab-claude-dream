import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { UseChatSessionOptions, UseChatSessionReturn } from "./useChatSession";
import { useChatSession } from "./useChatSession";

// SSR 프로브 — 훅의 초기 상태를 마크업으로 노출해 검증
// (스트리밍 경로는 lib/chat-stream.test.ts가 단위 테스트로 커버)
function probe(render: (r: UseChatSessionReturn) => string, options: UseChatSessionOptions = {}) {
    function Probe() {
        const r = useChatSession(options);
        return createElement("output", null, render(r));
    }
    const html = renderToString(createElement(Probe));
    return html.replace(/<\/?output>/g, "");
}

describe("useChatSession", () => {
    it("starts with no session and no streaming", () => {
        expect(probe((r) => String(r.session))).toBe("null");
        expect(probe((r) => String(r.isStreaming))).toBe("false");
        expect(probe((r) => r.streamingText)).toBe("");
        expect(probe((r) => r.errorMsg)).toBe("");
    });

    it("exposes sendMessage and startNewSession functions", () => {
        expect(probe((r) => typeof r.sendMessage)).toBe("function");
        expect(probe((r) => typeof r.startNewSession)).toBe("function");
    });

    it("hydrates from initialSession when provided", () => {
        const initial = {
            id: "01TEST",
            createdAt: 1700000000000,
            messages: [
                { role: "user" as const, content: "이 빠지는 꿈", timestamp: 1700000000000 },
                { role: "model" as const, content: "치아 꿈은…", timestamp: 1700000001000 },
            ],
            summary: "이 빠지는 꿈",
            modelId: "haiku",
            schemaVersion: 2 as const,
        };
        expect(probe((r) => r.session?.id ?? "none", { initialSession: initial })).toBe("01TEST");
        expect(probe((r) => String(r.session?.messages.length), { initialSession: initial })).toBe("2");
    });
});
