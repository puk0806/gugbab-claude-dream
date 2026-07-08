import type { ModelsResponse } from "@gugbab/relay-types";

export const runtime = "nodejs";

const ERROR_HEADERS = { "content-type": "application/json" };

export async function GET(): Promise<Response> {
    const relayUrl = process.env.RELAY_URL;

    if (!relayUrl) {
        return new Response(JSON.stringify({ error: "릴레이 서버가 설정되지 않았어요" }), {
            status: 503,
            headers: ERROR_HEADERS,
        });
    }

    try {
        const relayRes = await fetch(`${relayUrl}/api/models`, { next: { revalidate: 300 } });
        if (!relayRes.ok) {
            return new Response(JSON.stringify({ error: "모델 목록을 불러오지 못했어요" }), {
                status: 503,
                headers: ERROR_HEADERS,
            });
        }
        // 외부 API 경계 — relay 응답 계약은 @gugbab/relay-types가 단일 소스
        const data = (await relayRes.json()) as ModelsResponse;
        return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
        });
    } catch {
        return new Response(JSON.stringify({ error: "모델 목록을 불러오지 못했어요" }), {
            status: 503,
            headers: ERROR_HEADERS,
        });
    }
}
