import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MESSAGE_LIMITS } from "@/lib/chat-history";
import { appendTranscript, ChatInput } from "./ChatInput";

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

    it("caps the textarea at the app message limit", () => {
        const html = render();
        expect(html).toContain(`maxLength="${MESSAGE_LIMITS.maxContentLength}"`);
    });
});

describe("appendTranscript — 음성 인식 이어붙이기 상한", () => {
    it("이어붙인 결과가 상한을 넘으면 잘라낸다 (maxLength 속성 우회 방어)", () => {
        const prev = "가".repeat(MESSAGE_LIMITS.maxContentLength - 2);
        const out = appendTranscript(prev, "나나나나나", MESSAGE_LIMITS.maxContentLength);
        expect(out.length).toBe(MESSAGE_LIMITS.maxContentLength);
        expect(out.startsWith(prev)).toBe(true);
    });

    it("기존 입력이 있으면 공백으로 잇고, 없으면 transcript만 반환한다", () => {
        expect(appendTranscript("어젯밤", "꿈을 꿨어", 4000)).toBe("어젯밤 꿈을 꿨어");
        expect(appendTranscript("", "꿈을 꿨어", 4000)).toBe("꿈을 꿨어");
    });

    it("절단 지점이 이모지(서로게이트 쌍) 중간이면 깨진 반쪽을 남기지 않는다", () => {
        const prev = "가".repeat(MESSAGE_LIMITS.maxContentLength - 2);
        // composed = prev + " " + "😀"(2 코드유닛) = 상한+1 → 절단 지점이 😀 한가운데
        const out = appendTranscript(prev, "😀", MESSAGE_LIMITS.maxContentLength);
        expect(out).toBe(`${prev} `);
        expect(out.length).toBe(MESSAGE_LIMITS.maxContentLength - 1);
    });
});
