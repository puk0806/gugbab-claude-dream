import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatInput } from "./ChatInput";

function render() {
    return renderToString(<ChatInput onSend={() => {}} ttsEnabled={false} onTtsToggle={() => {}} />);
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
});
