import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MESSAGE_LIMITS } from "@/lib/chat-history";
import { ChatInput } from "./ChatInput";

// appendTranscript(이어붙이기·상한·서로게이트 절단)는 @gugbab/utils로 이전 — 패키지 테스트가 검증한다.

function render() {
    return renderToString(<ChatInput onSend={() => undefined} ttsEnabled={false} onTtsToggle={() => {}} />);
}

describe("ChatInput", () => {
    it("renders dream text input and send button", () => {
        const html = render();
        expect(html).toContain("꿈을 이야기해보세요");
        expect(html).toContain("전송");
    });

    it("no longer renders the removed deep/fast tier toggle", () => {
        const html = render();
        expect(html).not.toContain("깊은 해몽");
        expect(html).not.toContain("빠른 해몽");
    });

    it("caps the textarea at the app message limit", () => {
        const html = render();
        expect(html).toContain(`maxLength="${MESSAGE_LIMITS.maxContentLength}"`);
    });

    it("SSR에서는 마이크 버튼을 렌더하지 않는다 (지원 감지는 마운트 후 — hydration mismatch 방지)", () => {
        const html = render();
        expect(html).not.toContain("음성 입력");
    });
});
