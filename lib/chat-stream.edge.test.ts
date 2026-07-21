// 예외·경계 시나리오 — SSE 스트림 소비의 비정상 경로 검증
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamChat } from "./chat-stream";

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
    it("done 이벤트 없이 스트림이 끝나면 빈 modelId를 반환한다 (crash 없음)", async () => {
        stubFetch(streamOf(sseLine({ type: "chunk", text: "잘리다 만 응답" })));
        const chunks: string[] = [];
        const modelId = await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks.join("")).toBe("잘리다 만 응답");
        expect(modelId).toBe("");
    });

    it("done 이벤트에 modelId가 없어도 문자열 계약을 유지한다", async () => {
        stubFetch(streamOf(sseLine({ type: "done", sessionId: "s1" })));
        const modelId = await streamChat("s1", [{ role: "user", content: "꿈" }], () => {});
        expect(modelId).toBe("");
        expect(typeof modelId).toBe("string");
    });

    it("한글 멀티바이트 문자가 네트워크 청크 경계에서 쪼개져도 깨지지 않는다", async () => {
        const line = sseLine({ type: "chunk", text: "꿈은 무의식의 편지예요" });
        const bytes = new TextEncoder().encode(line);
        // '꿈'(3바이트) 한가운데를 자름
        const cut = line.indexOf("꿈은") + 1;
        stubFetch(streamOf(bytes.slice(0, cut), bytes.slice(cut)));

        const chunks: string[] = [];
        await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks.join("")).toBe("꿈은 무의식의 편지예요");
        expect(chunks.join("")).not.toContain("�"); // 대체 문자 없음
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

    it("스트림 중간 네트워크 단절(reader 예외)이 상위로 전파된다", async () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoder.encode(sseLine({ type: "chunk", text: "안녕" })));
                controller.error(new TypeError("network reset"));
            },
        });
        stubFetch(body);
        await expect(streamChat("s1", [{ role: "user", content: "꿈" }], () => {})).rejects.toThrow("network reset");
    });

    it("'data:' 접두사 규격 위반(공백 없음)·주석 라인은 무시된다", async () => {
        stubFetch(
            streamOf(
                `data:{"type":"chunk","text":"공백없음"}\n\n: keep-alive\n\n${sseLine({ type: "chunk", text: "정상" })}`,
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
        const modelId = await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks.join("").length).toBe(50_000);
        expect(modelId).toBe("opus");
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
        const modelId = await streamChat("s1", [{ role: "user", content: "꿈" }], (t) => chunks.push(t));
        expect(chunks.join("")).toBe("정상 응답");
        expect(modelId).toBe("sonnet");
    });
});
