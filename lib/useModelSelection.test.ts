import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { UseModelSelectionReturn } from "./useModelSelection";
import { useModelSelection } from "./useModelSelection";

// SSR 프로브 — 훅의 초기 상태를 마크업으로 노출해 검증 (effect 미실행 구간)
function probe(render: (r: UseModelSelectionReturn) => string) {
    function Probe() {
        const r = useModelSelection();
        return createElement("output", null, render(r));
    }
    const html = renderToString(createElement(Probe));
    return html.replace(/<\/?output>/g, "");
}

describe("useModelSelection", () => {
    it("starts with fallback model before localStorage/effect (SSR-safe)", () => {
        expect(probe((r) => r.model)).toBe("sonnet");
    });

    it("starts with null models until /api/models loads", () => {
        expect(probe((r) => String(r.models))).toBe("null");
    });

    it("exposes a selectModel function", () => {
        expect(probe((r) => typeof r.selectModel)).toBe("function");
    });
});
