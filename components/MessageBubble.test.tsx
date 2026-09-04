import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageBubble } from "./MessageBubble";

describe("MessageBubble — 악성 콘텐츠 이스케이프", () => {
    it("script 태그가 실행 가능한 형태로 렌더링되지 않는다", () => {
        const html = renderToString(
            <MessageBubble message={{ role: "user", content: "<script>alert('xss')</script>", timestamp: 1 }} />,
        );
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("이벤트 핸들러 주입(img onerror)이 속성으로 살아나지 않는다", () => {
        const html = renderToString(
            <MessageBubble
                message={{ role: "model", content: `<img src=x onerror="fetch('//evil')">`, timestamp: 1 }}
            />,
        );
        // 실제 태그로 살아나지 않고 이스케이프된 텍스트로만 존재해야 한다
        expect(html).not.toContain("<img");
        expect(html).toContain("&lt;img");
    });

    it("markdown 링크·javascript: URL도 텍스트로만 표시된다", () => {
        const html = renderToString(
            <MessageBubble
                message={{ role: "model", content: `<a href="javascript:alert(1)">클릭</a>`, timestamp: 1 }}
            />,
        );
        expect(html).not.toContain("<a href");
    });

    it("정상 꿈 텍스트는 그대로 보인다", () => {
        const html = renderToString(
            <MessageBubble message={{ role: "user", content: "물에 빠지는 꿈", timestamp: 1 }} />,
        );
        expect(html).toContain("물에 빠지는 꿈");
    });
});

describe("MessageBubble — 끊긴 답변 표시", () => {
    it("truncated 답변에는 끊김 안내가 붙는다", () => {
        const html = renderToString(
            <MessageBubble message={{ role: "model", content: "해몽을 시작하자면", timestamp: 1, truncated: true }} />,
        );
        expect(html).toContain("해몽을 시작하자면");
        expect(html).toContain("응답이 중간에 끊겼어요");
    });

    it("정상 답변에는 끊김 안내가 없다", () => {
        const html = renderToString(<MessageBubble message={{ role: "model", content: "완결 답변", timestamp: 1 }} />);
        expect(html).not.toContain("응답이 중간에 끊겼어요");
    });
});
