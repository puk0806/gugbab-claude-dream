import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatView } from "./ChatView";

describe("ChatView", () => {
    it("shows empty prompt when there are no messages", () => {
        const html = renderToString(<ChatView messages={[]} streamingText="" isStreaming={false} />);
        expect(html).toContain("어젯밤 꿈을 이야기해보세요");
    });

    it("renders message bubbles", () => {
        const html = renderToString(
            <ChatView
                messages={[
                    { role: "user", content: "이 빠지는 꿈", timestamp: 1 },
                    { role: "model", content: "여운이 남는 꿈이죠", timestamp: 2 },
                ]}
                streamingText=""
                isStreaming={false}
            />,
        );
        expect(html).toContain("이 빠지는 꿈");
        expect(html).toContain("여운이 남는 꿈이죠");
    });

    it("renders streaming text as a live bubble", () => {
        const html = renderToString(<ChatView messages={[]} streamingText="해몽 중" isStreaming={true} />);
        expect(html).toContain("해몽 중");
    });

    it("renders typing indicator while waiting for first chunk", () => {
        const html = renderToString(<ChatView messages={[]} streamingText="" isStreaming={true} />);
        expect(html).not.toContain("어젯밤 꿈을 이야기해보세요");
    });
});
