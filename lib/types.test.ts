import { describe, expectTypeOf, it } from "vitest";
import type { ChatSseEvent, DreamSession, ModelAlias, ModelInfo, ModelsResponse } from "./types";

describe("types", () => {
    it("ModelsResponse holds ModelInfo list and default alias", () => {
        const sample: ModelsResponse = {
            models: [
                {
                    id: "claude-sonnet-4-6",
                    alias: "sonnet",
                    name: "Claude Sonnet 4.6",
                    description: "속도·품질 균형",
                },
            ],
            default: "sonnet",
        };
        expectTypeOf(sample.models).items.toEqualTypeOf<ModelInfo>();
        expectTypeOf(sample.default).toEqualTypeOf<ModelAlias>();
    });

    it("ChatSseEvent done carries sessionId and modelId", () => {
        const done: Extract<ChatSseEvent, { type: "done" }> = {
            type: "done",
            sessionId: "s1",
            modelId: "sonnet",
        };
        expectTypeOf(done.sessionId).toEqualTypeOf<string>();
        expectTypeOf(done.modelId).toEqualTypeOf<string>();
    });

    it("DreamSession stores modelId as string", () => {
        expectTypeOf<DreamSession["modelId"]>().toEqualTypeOf<string>();
    });
});
