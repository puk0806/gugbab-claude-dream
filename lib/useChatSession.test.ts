import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { UseChatSessionReturn } from "./useChatSession";
import { useChatSession } from "./useChatSession";

// SSR 프로브 — 훅의 초기 상태를 마크업으로 노출해 검증
// (스트리밍 경로는 lib/chat-stream.test.ts가 단위 테스트로 커버)
function probe(render: (r: UseChatSessionReturn) => string) {
    function Probe() {
        const r = useChatSession({});
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
});
