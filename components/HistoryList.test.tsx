import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DreamSession } from "@/lib/types";
import { HistoryList } from "./HistoryList";

function makeSession(overrides: Partial<DreamSession> = {}): DreamSession {
    return {
        id: "01TEST",
        createdAt: 1752500000000,
        messages: [{ role: "user", content: "꿈", timestamp: 1 }],
        summary: "요약",
        modelId: "sonnet",
        schemaVersion: 2,
        ...overrides,
    };
}

describe("HistoryList — 예외·악성 데이터", () => {
    it("빈 목록이면 안내 문구를 보여준다", () => {
        const html = renderToString(<HistoryList sessions={[]} />);
        expect(html).toContain("아직 저장된 대화가 없어요");
    });

    it("악성 summary(script 주입)가 이스케이프된다", () => {
        const html = renderToString(
            <HistoryList sessions={[makeSession({ summary: "<script>document.location='//evil'</script>" })]} />,
        );
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("세션 id가 URL 특수문자를 담아도 href 속성을 탈출하지 못한다", () => {
        const html = renderToString(
            <HistoryList sessions={[makeSession({ id: `01"><img src=x onerror=alert(1)>` })]} />,
        );
        // 따옴표가 이스케이프되어 속성 밖으로 나가 실제 <img> 태그가 생기지 않아야 한다
        expect(html).not.toContain(`"><img`);
        expect(html).toContain("&quot;&gt;&lt;img");
    });

    it("메시지 0개 세션도 crash 없이 표시된다", () => {
        const html = renderToString(<HistoryList sessions={[makeSession({ messages: [] })]} />);
        // SSR은 텍스트 보간 사이에 주석(<!-- -->)을 넣으므로 정규식으로 확인
        expect(html).toMatch(/0(<!-- -->)?개 메시지/);
    });

    it("onDelete 미전달 시 삭제 버튼이 렌더링되지 않는다", () => {
        const html = renderToString(<HistoryList sessions={[makeSession()]} />);
        expect(html).not.toContain("삭제");
    });
});
