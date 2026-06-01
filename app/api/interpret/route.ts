/**
 * POST /api/interpret
 *
 * 흐름:
 *   1. Zod 검증
 *   2. safety classifier → 안전 시 step 3 / 아니면 위기 카드 SSE 1회 후 종료
 *   3. tone 별 LLM 스트리밍 → SSE pass-through
 *
 * SSE event 타입:
 *   - safety_block (위기 분기)
 *   - chunk (delta 텍스트)
 *   - done (modelId, verdict 최종)
 *   - error
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { KOREA_CRISIS_RESOURCES } from '@/lib/crisis-resources';
import { getInterpretStream, getModelId } from '@/lib/llm';
import { classifySafety, isSafe } from '@/lib/safety';
import type { InterpretSseEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RequestSchema = z.object({
  dreamText: z.string().min(1).max(2000),
  tone: z.enum(['casual', 'reflective', 'traditional']),
});

function sseLine(event: InterpretSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest): Promise<Response> {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body = await req.json();
    parsed = RequestSchema.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: '입력을 확인해주세요' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const verdict = await classifySafety(parsed.dreamText);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: InterpretSseEvent) => controller.enqueue(encoder.encode(sseLine(event)));

      try {
        if (!isSafe(verdict)) {
          send({ type: 'safety_block', verdict, resources: KOREA_CRISIS_RESOURCES });
          controller.close();
          return;
        }

        const llmStream = await getInterpretStream(parsed.tone, parsed.dreamText);
        for await (const chunk of llmStream) {
          const delta = chunk.text;
          if (delta) {
            send({ type: 'chunk', delta });
          }
        }
        send({ type: 'done', modelId: getModelId(), verdict });
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        send({ type: 'error', message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
