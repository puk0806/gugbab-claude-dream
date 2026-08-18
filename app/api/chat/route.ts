import type { ChatRequest, SSEError } from "@gugbab/relay-types";
import { fitMessagesToBudget, isHistoryValidationError, toSSELine } from "@gugbab/utils";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { MESSAGE_LIMITS } from "@/lib/chat-history";
import { getChatSystemPrompt } from "@/lib/prompts/chat";
import { OUTGOING_BUDGET_BYTES, RETRY_BUDGET_BYTES, RETRY_MAX_MESSAGES } from "@/lib/relay-limits";
import type { ChatSseEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MessageSchema = z.object({
    role: z.enum(["user", "model"]),
    content: z.string().min(1).max(MESSAGE_LIMITS.maxContentLength),
});

const ChatRequestSchema = z.object({
    messages: z
        .array(MessageSchema)
        .min(1)
        .max(MESSAGE_LIMITS.maxCount)
        // relay 계약 미러링(첫·마지막 role=user): model로 끝나는 기형 이력을 사전 가드가
        // 조용히 재작성(직전 질문 중복 답변)하지 않도록 여기서 명시적으로 거부한다
        .refine((msgs) => msgs[0]?.role === "user" && msgs.at(-1)?.role === "user"),
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

// relay의 done 이벤트에 sessionId·modelId를 주입해 클라이언트 SSE 계약(ChatSseEvent)을 유지한다.
// relay가 실어준 summary(best-effort)는 유실 없이 함께 전달한다.
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
                                const summary = typeof event.summary === "string" ? event.summary : undefined;
                                const doneEvent: ChatSseEvent = {
                                    type: "done",
                                    sessionId,
                                    modelId,
                                    ...(summary !== undefined ? { summary } : {}),
                                };
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

    // relay 합산 바이트·개수 상한 사전 가드 — 오래된 왕복부터 드롭해 400 왕복 자체를 줄인다
    const fitted = fitMessagesToBudget(messages, OUTGOING_BUDGET_BYTES, MESSAGE_LIMITS.maxCount);
    if (fitted.length === 0) {
        return new Response(JSON.stringify({ error: "입력을 확인해주세요" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }

    const callRelay = (msgs: typeof fitted) =>
        fetch(`${relayUrl}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Relay-Secret": relaySecret,
            },
            body: JSON.stringify({
                app: "dream",
                systemPrompt,
                messages: msgs,
                // done 이벤트에 답변 요약(한국어 1~3문장, best-effort) 요청 — 이력 압축에 사용
                wantSummary: true,
                ...(parsed.model ? { model: parsed.model } : {}),
            } satisfies RelayChatBody),
            signal: req.signal,
        });

    let relayRes: Response;
    try {
        relayRes = await callRelay(fitted);

        if (relayRes.status === 400) {
            let body: { errorCode?: string; violation?: string } = {};
            try {
                body = (await relayRes.json()) as { errorCode?: string; violation?: string };
            } catch {
                // 본문 파싱 실패 — 아래 일반 오류 경로로
            }
            if (isHistoryValidationError(body)) {
                // 이력 총량 초과 — 바이트 예산도 절반으로 조이고 최근 왕복만 남겨 1회 재시도
                // (꿈 해몽은 직전 맥락으로 충분, 예산 축소는 상수 drift 흡수용)
                relayRes = await callRelay(fitMessagesToBudget(fitted, RETRY_BUDGET_BYTES, RETRY_MAX_MESSAGES));
            } else if (body.violation === "message-size") {
                // 개별 메시지 길이 초과 — 드롭으로 복구 불가, 재시도 금지
                return new Response(errorStream("메시지가 너무 길어요. 내용을 줄여서 다시 보내주세요."), {
                    headers: SSE_HEADERS,
                });
            }
        }
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
