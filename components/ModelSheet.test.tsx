import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ModelInfo } from "@/lib/types";
import ModelSheet from "./ModelSheet";

const models: ModelInfo[] = [
    {
        id: "claude-haiku-4-5-20251001",
        alias: "haiku",
        name: "Claude Haiku 4.5",
        description: "빠르고 가벼움",
    },
    {
        id: "claude-fable-5",
        alias: "fable",
        name: "Claude Fable 5",
        description: "최상위 모델 — 가장 정교한 추론, 비용 높음",
    },
];

function render(selected: string) {
    return renderToString(<ModelSheet models={models} selected={selected} onSelect={() => {}} onClose={() => {}} />);
}

describe("ModelSheet", () => {
    it("renders every model name and description", () => {
        const html = render("haiku");
        expect(html).toContain("Claude Haiku 4.5");
        expect(html).toContain("빠르고 가벼움");
        expect(html).toContain("Claude Fable 5");
    });

    it("marks only the selected model with a check", () => {
        const html = render("fable");
        const checks = html.match(/✓/g) ?? [];
        expect(checks).toHaveLength(1);
    });

    it("shows cost badge for high-cost models", () => {
        const html = render("haiku");
        const badges = html.match(/비용 높음/g) ?? [];
        // description 원문 1회 + 배지 1회
        expect(badges.length).toBeGreaterThanOrEqual(2);
    });

    it("is announced as a model-selection dialog", () => {
        const html = render("haiku");
        expect(html).toContain('role="dialog"');
        expect(html).toContain('aria-label="모델 선택"');
    });
});
