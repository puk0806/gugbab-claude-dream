import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// iOS Safari 환경을 가정해도 첫 렌더는 SSR과 동일해야 한다 (hydration mismatch 방지)
vi.mock("./detectInstallEnv", () => ({
    detectStandalone: () => false,
    detectIOSSafari: () => true,
}));

const { useInstallPrompt } = await import("./useInstallPrompt");

function probe(render: (r: ReturnType<typeof useInstallPrompt>) => string) {
    function Probe() {
        const r = useInstallPrompt();
        return createElement("output", null, render(r));
    }
    const html = renderToString(createElement(Probe));
    return html.replace(/<\/?output>/g, "");
}

describe("useInstallPrompt", () => {
    it("first render never shows install UI even on iOS Safari (SSR parity — hydration 방지)", () => {
        // 감지값(true)은 mount effect 이후에만 반영되어야 한다.
        // 첫 렌더에서 canInstall=true면 SSR(null)과 어긋나 hydration 오류 발생.
        expect(probe((r) => String(r.canInstall))).toBe("false");
    });

    it("first render mode is unsupported before mount", () => {
        expect(probe((r) => r.mode)).toBe("unsupported");
    });
});
