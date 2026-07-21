"use client";

import { useCallback, useEffect, useState } from "react";
import { detectIOSSafari, detectStandalone } from "./detectInstallEnv";

export type InstallMode = "native" | "ios-guide" | "installed" | "unsupported";

export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface UseInstallPromptResult {
    readonly mode: InstallMode;
    readonly canInstall: boolean;
    readonly promptInstall: () => Promise<{ outcome: "accepted" | "dismissed" } | null>;
}

export function useInstallPrompt(): UseInstallPromptResult {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    // 초기값은 항상 false — 첫 클라이언트 렌더가 SSR(null)과 일치해야 hydration 오류가 없다.
    // 실제 감지값은 아래 mount effect에서 반영된다.
    const [installed, setInstalled] = useState(false);
    const [iosFallback, setIosFallback] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferred(e as BeforeInstallPromptEvent);
        };

        const handleAppInstalled = () => {
            setInstalled(true);
            setDeferred(null);
        };

        const standaloneMql =
            typeof window.matchMedia === "function" ? window.matchMedia("(display-mode: standalone)") : null;
        const handleStandaloneChange = (e: MediaQueryListEvent) => {
            if (e.matches) setInstalled(true);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleAppInstalled);
        standaloneMql?.addEventListener("change", handleStandaloneChange);

        setInstalled(detectStandalone());
        setIosFallback(detectIOSSafari());

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleAppInstalled);
            standaloneMql?.removeEventListener("change", handleStandaloneChange);
        };
    }, []);

    const mode: InstallMode = installed ? "installed" : deferred ? "native" : iosFallback ? "ios-guide" : "unsupported";

    const promptInstall = useCallback(async () => {
        if (mode === "native" && deferred) {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            setDeferred(null);
            return { outcome: choice.outcome };
        }
        return null;
    }, [mode, deferred]);

    return {
        mode,
        canInstall: mode === "native" || mode === "ios-guide",
        promptInstall,
    };
}
