import type { Route } from "@playwright/test";

const SAMPLE_AI_RESPONSE = `오 뱀 꿈이군요! 한국 전통 해몽에서 뱀은 재물이나 직관을 상징하는 경우가 많아요.
꿈에서 뱀이 어떤 상태였나요? 가만히 있었는지, 움직이고 있었는지에 따라 의미가 달라질 수 있어요 🐍`;

export function makeChunkedChatSse(text: string, sessionId: string, chunkSize = 30): string {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    const events = chunks.map((t) => `data: ${JSON.stringify({ type: "chunk", text: t })}\n\n`);
    events.push(`data: ${JSON.stringify({ type: "done", sessionId })}\n\n`);
    return events.join("");
}

export async function mockChatRoute(route: Route, sessionId = "test-session-id"): Promise<void> {
    await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
        body: makeChunkedChatSse(SAMPLE_AI_RESPONSE, sessionId),
    });
}
