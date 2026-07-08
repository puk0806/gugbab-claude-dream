import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
    vi.clearAllMocks();
    process.env.RELAY_URL = "https://relay.example.com";
});

async function importRoute() {
    vi.resetModules();
    const mod = await import("../route");
    return mod;
}

describe("GET /api/models (relay proxy)", () => {
    it("returns 503 when RELAY_URL is not set", async () => {
        delete process.env.RELAY_URL;
        const { GET } = await importRoute();
        const res = await GET();
        expect(res.status).toBe(503);
    });

    it("proxies model list from relay", async () => {
        const payload = {
            models: [{ id: "claude-sonnet-4-6", alias: "sonnet", name: "Claude Sonnet 4.6", description: "기본값" }],
            default: "sonnet",
        };
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(payload), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        );

        const { GET } = await importRoute();
        const res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(payload);

        const [url] = mockFetch.mock.calls[0] as [string];
        expect(url).toBe("https://relay.example.com/api/models");
    });

    it("returns 503 when relay responds non-ok", async () => {
        mockFetch.mockResolvedValueOnce(new Response("oops", { status: 500 }));
        const { GET } = await importRoute();
        const res = await GET();
        expect(res.status).toBe(503);
    });

    it("returns 503 when relay fetch throws", async () => {
        mockFetch.mockRejectedValueOnce(new Error("network down"));
        const { GET } = await importRoute();
        const res = await GET();
        expect(res.status).toBe(503);
    });
});
