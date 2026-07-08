import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockGetChatSystemPrompt = vi.fn((_mode: string) => "mock system prompt");
vi.mock("@/lib/prompts/chat", () => ({
    getChatSystemPrompt: (mode: string) => mockGetChatSystemPrompt(mode),
}));

beforeEach(() => {
    vi.clearAllMocks();
    process.env.RELAY_URL = "https://relay.example.com";
    process.env.RELAY_SECRET = "test-secret";
});

async function importRoute() {
    vi.resetModules();
    const mod = await import("../route");
    return mod;
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
    });
}

function mockRelaySse(sseBody: string) {
    mockFetch.mockResolvedValueOnce(
        new Response(sseBody, {
            status: 200,
            headers: { "content-type": "text/event-stream" },
        }),
    );
}

describe("POST /api/chat (dream relay proxy)", () => {
    it("returns 400 when messages is missing", async () => {
        const { POST } = await importRoute();
        const res = await POST(makeRequest({ sessionId: "s1" }) as never);
        expect(res.status).toBe(400);
    });

    it("returns 400 when messages is empty", async () => {
        const { POST } = await importRoute();
        const res = await POST(makeRequest({ messages: [], sessionId: "s1" }) as never);
        expect(res.status).toBe(400);
    });

    it("returns 503 when RELAY_URL is not set", async () => {
        delete process.env.RELAY_URL;
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                messages: [{ role: "user", content: "뱀 꿈" }],
                sessionId: "s1",
            }) as never,
        );
        expect(res.status).toBe(503);
    });

    it("forwards model alias to relay and streams SSE back", async () => {
        mockRelaySse('data: {"type":"chunk","text":"안녕"}\n\ndata: {"type":"done"}\n\n');

        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                messages: [{ role: "user", content: "뱀 꿈" }],
                sessionId: "s1",
                model: "opus",
            }) as never,
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/event-stream");

        const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://relay.example.com/api/chat");
        const sentBody = JSON.parse(options.body as string);
        expect(sentBody.app).toBe("dream");
        expect(sentBody.model).toBe("opus");
        expect((options.headers as Record<string, string>)["X-Relay-Secret"]).toBe("test-secret");
        expect(mockGetChatSystemPrompt).toHaveBeenCalledWith("deep");
    });

    it("omits model when not provided — relay default applies", async () => {
        mockRelaySse('data: {"type":"done"}\n\n');

        const { POST } = await importRoute();
        await POST(
            makeRequest({
                messages: [{ role: "user", content: "테스트" }],
                sessionId: "s1",
            }) as never,
        );

        const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        const sentBody = JSON.parse(options.body as string);
        expect(sentBody).not.toHaveProperty("model");
    });

    it("uses casual prompt only for haiku", async () => {
        mockRelaySse('data: {"type":"done"}\n\n');

        const { POST } = await importRoute();
        await POST(
            makeRequest({
                messages: [{ role: "user", content: "테스트" }],
                sessionId: "s1",
                model: "haiku",
            }) as never,
        );

        expect(mockGetChatSystemPrompt).toHaveBeenCalledWith("casual");
    });

    it("injects sessionId and modelId into done event, passes chunks through", async () => {
        mockRelaySse('data: {"type":"chunk","text":"안녕"}\n\ndata: {"type":"done"}\n\n');

        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                messages: [{ role: "user", content: "뱀 꿈" }],
                sessionId: "s1",
                model: "sonnet",
            }) as never,
        );
        const text = await res.text();
        const events = text
            .split("\n\n")
            .filter((line) => line.startsWith("data: "))
            .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);

        expect(events).toEqual([
            { type: "chunk", text: "안녕" },
            { type: "done", sessionId: "s1", modelId: "sonnet" },
        ]);
    });

    it("returns SSE error stream when relay fetch throws", async () => {
        mockFetch.mockRejectedValueOnce(new Error("network down"));

        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                messages: [{ role: "user", content: "뱀 꿈" }],
                sessionId: "s1",
                model: "sonnet",
            }) as never,
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/event-stream");
        const text = await res.text();
        expect(text).toContain('"type":"error"');
    });
});
