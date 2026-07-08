import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
    it("renders header with model chip placeholder before models load", () => {
        const html = renderToString(<HomePage />);
        expect(html).toContain("꿈해몽");
        // 모델 목록 로드 전 칩은 "모델" 플레이스홀더 + disabled
        expect(html).toContain("모델");
        expect(html).toContain("히스토리");
    });

    it("renders chat input", () => {
        const html = renderToString(<HomePage />);
        expect(html).toContain("꿈을 이야기해보세요");
    });
});
