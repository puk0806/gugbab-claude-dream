import type { ChatRequest, SSEError } from "@gugbab/relay-types";
import { toSSELine } from "@gugbab/utils";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getChatSystemPrompt } from "@/lib/prompts/chat";
import type { ChatSseEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MessageSchema = z.object({
    role: z.enum(["user", "model"]),
    content: z.string().min(1).max(4000),
});

const ChatRequestSchema = z.object({
    messages: z.array(MessageSchema).min(1).max(50),
    // ulid 26자 기준 여유 상한 — done 이벤트에 반사되므로 과대 값 차단
    sessionId: z.string().min(1).max(64),
    // 형식만 검증하고 그대로 relay에 전달 — 모델 유효성의 단일 소스는 relay
    model: z.string().min(1).max(64).optional(),
});

// model은 문자열 그대로 전달 — 값 유효성의 단일 소스는 relay이므로 alias union으로 좁히지 않는다
type RelayChatBody = Omit<ChatRequest, "model"> & { model?: string };

const SSE_HEADERS = {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
} as const;

function errorStream(message: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        start(controller) {
            const event: SSEError = { type: "error", message };
            controller.enqueue(encoder.encode(toSSELine(event)));
            controller.close();
        },
    });
}

// relay의 done 이벤트에 sessionId·modelId를 주입해 클라이언트 SSE 계약(ChatSseEvent)을 유지한다
function injectDoneFields(
    body: ReadableStream<Uint8Array>,
    sessionId: string,
    modelId: string,
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = "";

    return body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                buffer += decoder.decode(chunk, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";

                for (const part of parts) {
                    if (part.startsWith("data: ")) {
                        try {
                            const event = JSON.parse(part.slice(6)) as Record<string, unknown>;
                            if (event.type === "done") {
                                const doneEvent: ChatSseEvent = { type: "done", sessionId, modelId };
                                controller.enqueue(encoder.encode(toSSELine(doneEvent)));
                                continue;
                            }
                        } catch {
                            // malformed SSE line — pass through as-is
                        }
                    }
                    controller.enqueue(encoder.encode(`${part}\n\n`));
                }
            },
            flush(controller) {
                if (buffer) controller.enqueue(encoder.encode(buffer));
            },
        }),
    );
}

export async function POST(req: NextRequest): Promise<Response> {
    let parsed: z.infer<typeof ChatRequestSchema>;
    try {
        const body = (await req.json()) as unknown;
        parsed = ChatRequestSchema.parse(body);
    } catch {
        return new Response(JSON.stringify({ error: "입력을 확인해주세요" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }

    const relayUrl = process.env.RELAY_URL;
    const relaySecret = process.env.RELAY_SECRET;

    if (!relayUrl || !relaySecret) {
        return new Response(JSON.stringify({ error: "릴레이 서버가 설정되지 않았어요" }), {
            status: 503,
            headers: { "content-type": "application/json" },
        });
    }

    // haiku(경량)만 캐주얼 프롬프트 — 그 외 모델은 심층 해몽 프롬프트
    const mode = parsed.model === "haiku" ? "casual" : "deep";
    const systemPrompt = getChatSystemPrompt(mode);

    const messages = parsed.messages.map((m) => ({
        role: m.role === "model" ? ("assistant" as const) : ("user" as const),
        content: m.content,
    }));

    let relayRes: Response;
    try {
        relayRes = await fetch(`${relayUrl}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Relay-Secret": relaySecret,
            },
            body: JSON.stringify({
                app: "dream",
                systemPrompt,
                messages,
                ...(parsed.model ? { model: parsed.model } : {}),
            } satisfies RelayChatBody),
            signal: req.signal,
        });
    } catch {
        return new Response(errorStream("릴레이 서버에 연결할 수 없어요"), {
            headers: SSE_HEADERS,
        });
    }

    if (!relayRes.ok || !relayRes.body) {
        return new Response(errorStream("릴레이 서버 오류가 발생했어요"), {
            headers: SSE_HEADERS,
        });
    }

    // modelId는 클라이언트가 보낸 alias 그대로 — 미지정 시 relay 기본 모델이므로 빈 값
    return new Response(injectDoneFields(relayRes.body, parsed.sessionId, parsed.model ?? ""), {
        headers: SSE_HEADERS,
    });
}
