import { describe, expect, it } from "vitest";
import { viewport } from "./layout";

describe("viewport", () => {
    it("blocks pinch/double-tap zoom to keep PWA UI stable", () => {
        expect(viewport.maximumScale).toBe(1);
        expect(viewport.userScalable).toBe(false);
    });

    it("keeps device-width base scale with cover fit", () => {
        expect(viewport.width).toBe("device-width");
        expect(viewport.initialScale).toBe(1);
        expect(viewport.viewportFit).toBe("cover");
    });
});
