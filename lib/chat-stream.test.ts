import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatStreamError, drainSseBuffer, STREAM_ERROR_MESSAGES, streamChat } from "./chat-stream";
import type { ChatSseEvent } from "./types";

function sseLine(event: object): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

function streamOf(...parts: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const part of parts) {
                controller.enqueue(encoder.encode(part));
            }
            controller.close();
        },
    });
}

describe("drainSseBuffer", () => {
    it("parses complete events and returns the incomplete remainder", () => {
        const events: ChatSseEvent[] = [];
        const remaining = drainSseBuffer(`${sseLine({ type: "chunk", text: "안녕" })}data: {"type":"chu`, (e) =>
            events.push(e),
        );
        expect(events).toEqual([{ type: "chunk", text: "안녕" }]);
        expect(remaining).toBe('data: {"type":"chu');
    });

    it("parses multiple events in one buffer", () => {
        const events: ChatSseEvent[] = [];
        drainSseBuffer(sseLine({ type: "chunk", text: "a" }) + sseLine({ type: "chunk", text: "b" }), (e) =>
            events.push(e),
        );
        expect(events.map((e) => (e.type === "chunk" ? e.text : ""))).toEqual(["a", "b"]);
    });

    it("skips malformed JSON and non-data lines", () => {
        const events: ChatSseEvent[] = [];
        drainSseBuffer(`data: {broken\n\n: comment\n\n${sseLine({ type: "chunk", text: "ok" })}`, (e) =>
            events.push(e),
        );
        expect(events).toEqual([{ type: "chunk", text: "ok" }]);
    });
});

describe("streamChat", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function stubFetch(body: ReadableStream<Uint8Array> | null, ok = true, status = 200) {
        const fetchMock = vi.fn().mockResolvedValue({ ok, status, body });
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    it("accumulates chunk events and returns modelId from done event", async () => {
        stubFetch(
            streamOf(
                sseLine({ type: "chunk", text: "꿈은 " }),
                sseLine({ type: "chunk", text: "마음의 거울이에요" }),
                sseLine({ type: "done", sessionId: "s1", modelId: "sonnet" }),
            ),
        );

        const chunks: string[] = [];
        const result = await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks.join("")).toBe("꿈은 마음의 거울이에요");
        expect(result.modelId).toBe("sonnet");
        expect(result.summary).toBeUndefined();
    });

    it("returns summary when done event carries one", async () => {
        stubFetch(
            streamOf(
                sseLine({ type: "chunk", text: "해몽 답변" }),
                sseLine({ type: "done", sessionId: "s1", modelId: "sonnet", summary: "뱀 꿈 재물운 해석." }),
            ),
        );

        const result = await streamChat("s1", [{ role: "user", content: "꿈" }], () => {});
        expect(result).toEqual({ modelId: "sonnet", summary: "뱀 꿈 재물운 해석." });
    });

    it("omits summary key when done event has none (best-effort 누락 허용)", async () => {
        stubFetch(streamOf(sseLine({ type: "done", sessionId: "s1", modelId: "opus" })));

        const result = await streamChat("s1", [{ role: "user", content: "꿈" }], () => {});
        expect(result).toEqual({ modelId: "opus" });
        expect("summary" in result).toBe(false);
    });

    it("handles an event split across network chunks", async () => {
        const line = sseLine({ type: "chunk", text: "분할 전송" });
        stubFetch(
            streamOf(line.slice(0, 10), line.slice(10), sseLine({ type: "done", sessionId: "s1", modelId: "opus" })),
        );

        const chunks: string[] = [];
        await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks.join("")).toBe("분할 전송");
    });

    it("throws on error event with server message", async () => {
        stubFetch(streamOf(sseLine({ type: "error", message: "릴레이 서버 오류가 발생했어요" })));
        await expect(streamChat("s1", [{ role: "user", content: "꿈" }], () => {})).rejects.toThrow(
            "릴레이 서버 오류가 발생했어요",
        );
    });

    it("non-OK HTTP 응답은 상태 코드를 노출하지 않고 일반 문구로 던진다", async () => {
        stubFetch(null, false, 503);
        const err = await streamChat("s1", [{ role: "user", content: "꿈" }], () => {}).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(ChatStreamError);
        expect((err as Error).message).toBe(STREAM_ERROR_MESSAGES.generic);
        expect((err as Error).message).not.toContain("503");
    });

    it("non-OK HTTP 응답에 서버 error 문구가 있으면 그 문구를 사용자에게 보여준다", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 503,
                body: null,
                json: () => Promise.resolve({ error: "릴레이 서버가 설정되지 않았어요" }),
            }),
        );
        await expect(streamChat("s1", [{ role: "user", content: "꿈" }], () => {})).rejects.toThrow(
            "릴레이 서버가 설정되지 않았어요",
        );
    });

    it("signal로 전송을 취소하면 AbortError가 그대로 전파된다 (오류가 아닌 취소)", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(new DOMException("The user aborted a request.", "AbortError")),
        );
        const controller = new AbortController();
        controller.abort();
        const err = await streamChat(
            "s1",
            [{ role: "user", content: "꿈" }],
            () => {},
            undefined,
            controller.signal,
        ).catch((e: unknown) => e);
        expect(err).not.toBeInstanceOf(ChatStreamError);
        expect((err as { name?: string }).name).toBe("AbortError");
    });

    it("sends model only when provided", async () => {
        // 호출마다 새 스트림 — 같은 ReadableStream 재사용 시 locked 오류
        const fetchMock = vi.fn().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                body: streamOf(sseLine({ type: "done", sessionId: "s1", modelId: "opus" })),
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        await streamChat("s1", [{ role: "user", content: "꿈" }], () => {}, "opus");
        const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
        expect(body.model).toBe("opus");

        await streamChat("s1", [{ role: "user", content: "꿈" }], () => {});
        const body2 = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string) as Record<string, unknown>;
        expect("model" in body2).toBe(false);
    });
});
