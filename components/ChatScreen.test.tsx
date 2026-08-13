import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DreamSession } from "@/lib/types";
import { ChatScreen } from "./ChatScreen";

const pastSession: DreamSession = {
    id: "01PAST",
    createdAt: 1700000000000,
    messages: [
        { role: "user", content: "바다에서 헤엄치는 꿈", timestamp: 1700000000000 },
        { role: "model", content: "바다는 무의식을 상징하기도 해요", timestamp: 1700000001000 },
    ],
    summary: "바다에서 헤엄치는 꿈",
    modelId: "haiku",
    schemaVersion: 2,
};

describe("ChatScreen", () => {
    it("renders home header (title, model chip placeholder, history link)", () => {
        const html = renderToString(<ChatScreen />);
        expect(html).toContain("꿈해몽");
        expect(html).toContain("모델");
        expect(html).toContain("히스토리");
    });

    it("renders chat input", () => {
        const html = renderToString(<ChatScreen />);
        expect(html).toContain("꿈을 이야기해보세요");
    });

    it("renders past messages when initialSession is provided", () => {
        const html = renderToString(<ChatScreen initialSession={pastSession} />);
        expect(html).toContain("바다에서 헤엄치는 꿈");
        expect(html).toContain("바다는 무의식을 상징하기도 해요");
    });

    it("resume mode renders new-session control as a link to home", () => {
        const html = renderToString(<ChatScreen initialSession={pastSession} />);
        expect(html).toContain("새 꿈 이야기하기");
        expect(html).toMatch(/href="\/"/);
    });
});
