// 예외·경계 시나리오 — SSE 스트림 소비의 비정상 경로 검증
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatStreamError, STREAM_ERROR_MESSAGES, streamChat } from "./chat-stream";

function sseLine(event: object): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

function streamOf(...parts: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const part of parts) {
                controller.enqueue(typeof part === "string" ? encoder.encode(part) : part);
            }
            controller.close();
        },
    });
}

function stubFetch(body: ReadableStream<Uint8Array>) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, body }));
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("streamChat — 예외·경계 시나리오", () => {
    it("done 이벤트 없이 스트림이 끝나면 '끊김' 오류를 던진다 — 흘려보낸 청크는 유지", async () => {
        stubFetch(streamOf(sseLine({ type: "chunk", text: "잘리다 만 응답" })));
        const chunks: string[] = [];
        const err = await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t)).catch(
            (e: unknown) => e,
        );
        expect(chunks.join("")).toBe("잘리다 만 응답");
        expect(err).toBeInstanceOf(ChatStreamError);
        expect((err as Error).message).toBe(STREAM_ERROR_MESSAGES.interrupted);
    });

    it("비정형 페이로드(null·숫자·필드 타입 불일치)는 무시하고 스트림은 계속된다", async () => {
        stubFetch(
            streamOf(
                "data: null\n\n",
                "data: 5\n\n",
                'data: {"type":"chunk","text":123}\n\n',
                'data: {"type":"chunk"}\n\n',
                sseLine({ type: "chunk", text: "정상" }),
                sseLine({ type: "done", sessionId: "s1", modelId: "opus" }),
            ),
        );
        const chunks: string[] = [];
        const result = await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks).toEqual(["정상"]);
        expect(result.modelId).toBe("opus");
    });

    it("done 이벤트에 modelId가 없어도 문자열 계약을 유지한다", async () => {
        stubFetch(streamOf(sseLine({ type: "done", sessionId: "s1" })));
        const result = await streamChat("s1", [{ role: "user", content: "꿈" }], () => {});
        expect(result.modelId).toBe("");
        expect(typeof result.modelId).toBe("string");
    });

    it("한글 멀티바이트 문자가 네트워크 청크 경계에서 쪼개져도 깨지지 않는다", async () => {
        const line = sseLine({ type: "chunk", text: "꿈은 무의식의 편지예요" });
        const bytes = new TextEncoder().encode(line);
        // '꿈'(3바이트) 한가운데를 자름
        const cut = line.indexOf("꿈은") + 1;
        stubFetch(streamOf(bytes.slice(0, cut), bytes.slice(cut), sseLine({ type: "done", sessionId: "s1" })));

        const chunks: string[] = [];
        await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks.join("")).toBe("꿈은 무의식의 편지예요");
        expect(chunks.join("")).not.toContain("�"); // 대체 문자 없음
    });

    it("EOF에서 종결자 없이 끝난 done의 한글이 청크 경계에 걸려도 정상 완료로 처리한다", async () => {
        const tail = 'data: {"type":"done","sessionId":"s1","modelId":"opus","summary":"뱀 꿈 해석."}';
        const bytes = new TextEncoder().encode(`${sseLine({ type: "chunk", text: "안녕" })}${tail}`);
        // '해석.'의 '석'(3바이트) 한가운데를 자른다
        const cut = bytes.length - 3;
        stubFetch(streamOf(bytes.slice(0, cut), bytes.slice(cut)));

        const chunks: string[] = [];
        const result = await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks.join("")).toBe("안녕");
        expect(result).toEqual({ modelId: "opus", summary: "뱀 꿈 해석." });
    });

    it("청크 수신 후 늦게 도착한 error 이벤트도 throw 된다 (부분 응답 후 장애)", async () => {
        stubFetch(
            streamOf(
                sseLine({ type: "chunk", text: "해몽을 시작하자면" }),
                sseLine({ type: "error", message: "요금 한도 초과" }),
            ),
        );
        const chunks: string[] = [];
        await expect(streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t))).rejects.toThrow(
            "요금 한도 초과",
        );
        expect(chunks.join("")).toBe("해몽을 시작하자면"); // 이미 흘려보낸 청크는 유지
    });

    it("스트림 중간 네트워크 단절(reader 예외)은 내부 메시지 대신 '끊김' 문구로 던진다", async () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoder.encode(sseLine({ type: "chunk", text: "안녕" })));
                controller.error(new TypeError("network reset"));
            },
        });
        stubFetch(body);
        const err = await streamChat("s1", [{ role: "user", content: "꿈" }], () => {}).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(ChatStreamError);
        expect((err as Error).message).toBe(STREAM_ERROR_MESSAGES.interrupted);
        expect((err as Error).message).not.toContain("network reset");
    });

    it("'data:' 접두사 규격 위반(공백 없음)·주석 라인은 무시된다", async () => {
        stubFetch(
            streamOf(
                `data:{"type":"chunk","text":"공백없음"}\n\n: keep-alive\n\n${sseLine({ type: "chunk", text: "정상" })}`,
                sseLine({ type: "done", sessionId: "s1" }),
            ),
        );
        const chunks: string[] = [];
        await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks).toEqual(["정상"]);
    });

    it("대용량 단일 청크(100KB)도 정상 누적된다", async () => {
        const big = "꿈".repeat(50_000);
        stubFetch(
            streamOf(
                sseLine({ type: "chunk", text: big }),
                sseLine({ type: "done", sessionId: "s1", modelId: "opus" }),
            ),
        );
        const chunks: string[] = [];
        const result = await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks.join("").length).toBe(50_000);
        expect(result.modelId).toBe("opus");
    });

    it("알 수 없는 이벤트 타입은 무시하고 계속 진행한다 (전방 호환)", async () => {
        stubFetch(
            streamOf(
                sseLine({ type: "usage", tokens: 123 }),
                sseLine({ type: "chunk", text: "정상 응답" }),
                sseLine({ type: "done", sessionId: "s1", modelId: "sonnet" }),
            ),
        );
        const chunks: string[] = [];
        const result = await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks.join("")).toBe("정상 응답");
        expect(result.modelId).toBe("sonnet");
    });
});
