import type { NextRequest } from "next/server";
import { z } from "zod";
import { getChatStream, getModelId } from "@/lib/llm";
import type { ChatSseEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MessageSchema = z.object({
    role: z.enum(["user", "model"]),
    content: z.string().min(1).max(4000),
});

const ChatRequestSchema = z.object({
    messages: z.array(MessageSchema).min(1).max(50),
    sessionId: z.string().min(1),
});

function parseGeminiError(e: unknown): string {
    const raw = e instanceof Error ? e.message : String(e);
    if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota")) {
        return "API 사용 한도를 초과했어요. 무료 플랜은 하루 20회 제한이 있어요. 내일 다시 시도해주세요.";
    }
    if (raw.includes("401") || raw.includes("UNAUTHENTICATED") || raw.includes("API_KEY")) {
        return "API 키가 유효하지 않아요. 서버 설정을 확인해주세요.";
    }
    if (raw.includes("SAFETY") || raw.includes("blocked")) {
        return "안전 정책으로 처리가 차단됐어요. 다른 내용으로 다시 시도해주세요.";
    }
    if (raw.includes("503") || raw.includes("unavailable") || raw.includes("overloaded")) {
        return "AI 서버가 일시적으로 혼잡해요. 잠시 후 다시 시도해주세요.";
    }
    return "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
}

function sseLine(event: ChatSseEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest): Promise<Response> {
    let parsed: z.infer<typeof ChatRequestSchema>;
    try {
        const body = await req.json();
        parsed = ChatRequestSchema.parse(body);
    } catch {
        return new Response(JSON.stringify({ error: "입력을 확인해주세요" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const encoder = new TextEncoder();
            const send = (event: ChatSseEvent) => controller.enqueue(encoder.encode(sseLine(event)));

            try {
                const llmStream = await getChatStream(parsed.messages);
                for await (const chunk of llmStream) {
                    const text = chunk.text ?? "";
                    if (text) send({ type: "chunk", text });
                }
                send({ type: "done", sessionId: parsed.sessionId, modelId: getModelId() });
            } catch (e) {
                send({ type: "error", message: parseGeminiError(e) });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
            connection: "keep-alive",
            // Vercel/nginx 프록시 버퍼링 비활성화 — SSE 청크가 즉시 클라이언트에 전달됨
            "x-accel-buffering": "no",
        },
    });
}
