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
        expect(sentBody.wantSummary).toBe(true);
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

    it("preserves relay summary in the injected done event", async () => {
        mockRelaySse(
            'data: {"type":"chunk","text":"해몽"}\n\ndata: {"type":"done","summary":"뱀 꿈은 재물운이라는 해석."}\n\n',
        );

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
            { type: "chunk", text: "해몽" },
            { type: "done", sessionId: "s1", modelId: "sonnet", summary: "뱀 꿈은 재물운이라는 해석." },
        ]);
    });

    it("omits summary from done event when relay sends none (best-effort)", async () => {
        mockRelaySse('data: {"type":"done"}\n\n');

        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                messages: [{ role: "user", content: "뱀 꿈" }],
                sessionId: "s1",
            }) as never,
        );
        const text = await res.text();
        const done = text
            .split("\n\n")
            .filter((line) => line.startsWith("data: "))
            .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>)
            .find((e) => e.type === "done");

        expect(done).toBeDefined();
        expect(done).not.toHaveProperty("summary");
    });

    it("ignores non-string summary from relay (계약 위반 값 방어)", async () => {
        mockRelaySse('data: {"type":"done","summary":{"nested":"object"}}\n\n');

        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                messages: [{ role: "user", content: "뱀 꿈" }],
                sessionId: "s1",
            }) as never,
        );
        const text = await res.text();
        const done = text
            .split("\n\n")
            .filter((line) => line.startsWith("data: "))
            .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>)
            .find((e) => e.type === "done");

        expect(done).not.toHaveProperty("summary");
    });

    it("relay 스트림이 done 없이 끝나면 error 이벤트를 합성한다 (잘린 답변을 완결로 저장하지 않게)", async () => {
        mockRelaySse('data: {"type":"chunk","text":"해몽을 시작하자면"}\n\n');

        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                messages: [{ role: "user", content: "뱀 꿈" }],
                sessionId: "s1",
            }) as never,
        );
        const text = await res.text();
        const events = text
            .split("\n\n")
            .filter((line) => line.startsWith("data: "))
            .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);

        expect(events[0]).toEqual({ type: "chunk", text: "해몽을 시작하자면" });
        expect(events.at(-1)?.type).toBe("error");
        expect(events.some((e) => e.type === "done")).toBe(false);
    });

    it("종결자 없이 끝난 마지막 done도 이벤트로 처리한다 (error 합성 없음)", async () => {
        mockRelaySse('data: {"type":"chunk","text":"안녕"}\n\ndata: {"type":"done"}');

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

    it("EOF에서 종결자 없이 끝난 done의 한글이 청크 경계에 걸려도 error를 합성하지 않는다", async () => {
        const tail = 'data: {"type":"done","summary":"뱀 꿈은 재물운 해석."}';
        const bytes = new TextEncoder().encode(`data: {"type":"chunk","text":"안녕"}\n\n${tail}`);
        // 마지막 '해석'의 '석'(3바이트) 한가운데를 자른다
        const cut = bytes.length - 6;
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(bytes.slice(0, cut));
                controller.enqueue(bytes.slice(cut));
                controller.close();
            },
        });
        mockFetch.mockResolvedValueOnce(
            new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }),
        );

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
            { type: "done", sessionId: "s1", modelId: "sonnet", summary: "뱀 꿈은 재물운 해석." },
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

describe("relay 계약 미러링 — 첫·마지막 메시지는 user", () => {
    it("returns 400 when history ends with a model message", async () => {
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                messages: [
                    { role: "user", content: "뱀 꿈" },
                    { role: "model", content: "해몽 답변" },
                ],
                sessionId: "s1",
            }) as never,
        );
        expect(res.status).toBe(400);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns 400 when history starts with a model message", async () => {
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                messages: [
                    { role: "model", content: "고아 답변" },
                    { role: "user", content: "뱀 꿈" },
                ],
                sessionId: "s1",
            }) as never,
        );
        expect(res.status).toBe(400);
        expect(mockFetch).not.toHaveBeenCalled();
    });
});

describe("relay 입력 상한 대응", () => {
    // 4,000자 한글 = 12,000 UTF-8 bytes
    const bigContent = "가".repeat(4000);
    const bigHistory = (count: number) =>
        Array.from({ length: count }, (_, i) => ({
            role: i % 2 === 0 ? ("user" as const) : ("model" as const),
            content: bigContent,
        }));

    it("pre-guard: drops oldest turns so total content stays within budget", async () => {
        mockRelaySse('data: {"type":"done"}\n\n');
        const { POST } = await importRoute();
        // 9개 × 12KB = 108KB > 예산 90KB → 오래된 왕복 드롭
        const res = await POST(makeRequest({ messages: bigHistory(9), sessionId: "s1" }) as never);
        expect(res.status).toBe(200);

        const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        const sent = JSON.parse(options.body as string) as { messages: Array<{ role: string; content: string }> };
        const totalBytes = sent.messages.reduce((n, m) => n + new TextEncoder().encode(m.content).byteLength, 0);
        expect(totalBytes).toBeLessThanOrEqual(90_000);
        expect(sent.messages.length).toBeLessThan(9);
        expect(sent.messages[0]?.role).toBe("user");
        expect(sent.messages[sent.messages.length - 1]?.role).toBe("user");
    });

    it("retries once with tighter trim on 400 history-budget, then streams", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({ errorCode: "VALIDATION_ERROR", violation: "history-budget", message: "..." }),
                {
                    status: 400,
                    headers: { "content-type": "application/json" },
                },
            ),
        );
        mockRelaySse('data: {"type":"chunk","text":"이어서"}\n\ndata: {"type":"done"}\n\n');

        const { POST } = await importRoute();
        // 9개 → 사전 가드로 7개 전송 → 400 → 재시도는 5개 이하로 실제 추가 트림되는지 검증
        const res = await POST(makeRequest({ messages: bigHistory(9), sessionId: "s1" }) as never);
        expect(res.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        const [, firstOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
        const first = JSON.parse(firstOptions.body as string) as { messages: unknown[] };
        const [, retryOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
        const retried = JSON.parse(retryOptions.body as string) as { messages: unknown[] };
        expect(retried.messages.length).toBeLessThanOrEqual(5);
        expect(retried.messages.length).toBeLessThan(first.messages.length);
        const text = await res.text();
        expect(text).toContain("이어서");
    });

    it("does NOT retry on 400 message-size — returns guidance error event", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ errorCode: "VALIDATION_ERROR", violation: "message-size", message: "..." }), {
                status: 400,
                headers: { "content-type": "application/json" },
            }),
        );
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({ messages: [{ role: "user", content: "뱀 꿈" }], sessionId: "s1" }) as never,
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const text = await res.text();
        expect(text).toContain('"type":"error"');
        expect(text).toContain("줄여");
    });

    it("still returns generic error for non-limit 400 (retry disabled)", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ errorCode: "VALIDATION_ERROR", message: "bad model" }), {
                status: 400,
                headers: { "content-type": "application/json" },
            }),
        );
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({ messages: [{ role: "user", content: "뱀 꿈" }], sessionId: "s1" }) as never,
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const text = await res.text();
        expect(text).toContain("릴레이 서버 오류가 발생했어요");
    });
});
