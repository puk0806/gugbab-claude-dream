// 클라이언트 전용 — SSR에서 호출하지 않는다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly [index: number]: { readonly transcript: string };
}

interface SpeechRecognitionResultList {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function isRecognitionSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export function isSpeechSynthesisSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        typeof window.speechSynthesis.speak === "function"
    );
}

export interface SpeechRecognizer {
    start(): void;
    stop(): void;
    abort(): void;
}

export type MicError = "not-allowed" | "no-speech" | "network" | "unknown";

export function createRecognizer(
    onResult: (text: string, isFinal: boolean) => void,
    onEnd: () => void,
    onError?: (type: MicError) => void,
): SpeechRecognizer {
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;

    if (!Ctor) throw new Error("SpeechRecognition 미지원");

    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        onResult(result[0].transcript, result.isFinal);
    };
    rec.onend = onEnd;
    rec.onerror = (event) => {
        const errType = event.error;
        let type: MicError = "unknown";
        if (errType === "not-allowed" || errType === "permission-denied") type = "not-allowed";
        else if (errType === "no-speech") type = "no-speech";
        else if (errType === "network") type = "network";
        onError?.(type);
    };

    return {
        start: () => rec.start(),
        stop: () => rec.stop(),
        abort: () => rec.abort(),
    };
}

// ── TTS hook (voca useSpeak 패턴 — voiceschanged를 React state로 추적) ──

function listVoices(): SpeechSynthesisVoice[] {
    if (!isSpeechSynthesisSupported()) return [];
    return window.speechSynthesis.getVoices();
}

function pickKoreanVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (voices.length === 0) return null;
    return voices.find((v) => v.lang.startsWith("ko")) ?? null;
}

export interface UseSpeakReturn {
    readonly speak: (text: string) => void;
    readonly stop: () => void;
    readonly speaking: boolean;
    readonly supported: boolean;
}

export function useSpeak(): UseSpeakReturn {
    const supported = isSpeechSynthesisSupported();
    const [voices, setVoices] = useState<readonly SpeechSynthesisVoice[]>(() => listVoices());
    const [speaking, setSpeaking] = useState(false);
    const speakingRef = useRef(false);

    useEffect(() => {
        if (!supported) return;
        const handle = () => setVoices(listVoices());
        handle();
        window.speechSynthesis.addEventListener("voiceschanged", handle);
        return () => {
            window.speechSynthesis.removeEventListener("voiceschanged", handle);
        };
    }, [supported]);

    const voice = useMemo(() => pickKoreanVoice(voices), [voices]);

    const stop = useCallback(() => {
        if (!supported) return;
        window.speechSynthesis.cancel();
        speakingRef.current = false;
        setSpeaking(false);
    }, [supported]);

    const speak = useCallback(
        (text: string) => {
            if (!supported || !text) return;
            window.speechSynthesis.cancel();

            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = "ko-KR";
            if (voice) utter.voice = voice;

            utter.addEventListener("end", () => {
                speakingRef.current = false;
                setSpeaking(false);
            });
            utter.addEventListener("error", () => {
                speakingRef.current = false;
                setSpeaking(false);
            });

            speakingRef.current = true;
            setSpeaking(true);
            window.speechSynthesis.speak(utter);
        },
        [supported, voice],
    );

    useEffect(() => {
        return () => {
            if (supported && speakingRef.current) {
                window.speechSynthesis.cancel();
            }
        };
    }, [supported]);

    return { speak, stop, speaking, supported };
}

export function stopSpeaking(): void {
    if (!isSpeechSynthesisSupported()) return;
    window.speechSynthesis.cancel();
}
