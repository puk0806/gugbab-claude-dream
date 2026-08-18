"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MESSAGE_LIMITS } from "@/lib/chat-history";
import { createRecognizer, isRecognitionSupported, isSpeechSynthesisSupported, type MicError } from "@/lib/speech";
import styles from "./ChatInput.module.css";

/**
 * 음성 인식 최종 결과를 기존 입력에 이어붙인다.
 * textarea의 maxLength 속성은 프로그램적 setState를 막지 못하므로 여기서 상한을 강제하고,
 * 절단 지점이 서로게이트 쌍(이모지 등) 중간이면 한 코드유닛 더 제거해 깨진 문자를 남기지 않는다.
 */
export function appendTranscript(prev: string, transcript: string, max: number): string {
    const composed = prev ? `${prev} ${transcript}` : transcript;
    if (composed.length <= max) return composed;
    const cut = composed.slice(0, max);
    const last = cut.charCodeAt(cut.length - 1);
    return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

interface ChatInputProps {
    onSend: (text: string) => void;
    disabled?: boolean;
    ttsEnabled: boolean;
    onTtsToggle: () => void;
}

export function ChatInput({ onSend, disabled, ttsEnabled, onTtsToggle }: ChatInputProps) {
    const [text, setText] = useState("");
    const [interimText, setInterimText] = useState("");
    const [listening, setListening] = useState(false);
    const [micError, setMicError] = useState<string>("");
    const [recognitionAvailable, setRecognitionAvailable] = useState(false);
    const [ttsAvailable, setTtsAvailable] = useState(false);
    const recognizerRef = useRef<ReturnType<typeof createRecognizer> | null>(null);

    useEffect(() => {
        setRecognitionAvailable(isRecognitionSupported());
        setTtsAvailable(isSpeechSynthesisSupported());
    }, []);

    useEffect(() => {
        return () => {
            recognizerRef.current?.abort();
        };
    }, []);

    const handleMic = useCallback(() => {
        setMicError("");
        if (listening) {
            recognizerRef.current?.stop();
            setListening(false);
            setInterimText("");
            return;
        }
        recognizerRef.current?.abort();

        // 마이크 사용 시 TTS 자동 활성화 — 음성 입력이면 음성 출력도 켜는 게 자연스러운 흐름
        if (!ttsEnabled && ttsAvailable) {
            onTtsToggle();
        }

        try {
            const rec = createRecognizer(
                (transcript, isFinal) => {
                    if (isFinal) {
                        // 최종 결과만 실제 입력에 반영 (interim 덮어쓰기 방지)
                        setText((prev) => appendTranscript(prev, transcript, MESSAGE_LIMITS.maxContentLength));
                        setInterimText("");
                    } else {
                        // 중간 결과는 힌트로만 표시
                        setInterimText(transcript);
                    }
                },
                () => {
                    setListening(false);
                    setInterimText("");
                },
                (type: MicError) => {
                    setListening(false);
                    setInterimText("");
                    if (type === "not-allowed") {
                        setMicError("마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요.");
                    } else if (type === "network") {
                        setMicError("네트워크 오류로 음성 인식에 실패했습니다.");
                    } else if (type === "no-speech") {
                        setMicError("음성이 감지되지 않았습니다. 다시 시도해주세요.");
                    }
                },
            );
            recognizerRef.current = rec;
            rec.start();
            setListening(true);
        } catch {
            setListening(false);
            setMicError("음성 인식을 시작할 수 없습니다.");
        }
    }, [listening, ttsEnabled, ttsAvailable, onTtsToggle]);

    const handleSubmit = () => {
        const trimmed = text.trim();
        if (!trimmed || disabled) return;
        recognizerRef.current?.abort();
        setListening(false);
        setInterimText("");
        onSend(trimmed);
        setText("");
    };

    return (
        <div className={styles.wrapper}>
            {micError && (
                <p className={styles.micError} role="alert">
                    {micError}
                </p>
            )}
            {interimText && (
                <p className={styles.interimHint} aria-live="polite">
                    {interimText}
                </p>
            )}
            <div className={styles.bar}>
                {recognitionAvailable && (
                    <button
                        type="button"
                        className={`${styles.iconBtn} ${listening ? styles.recording : ""}`}
                        onClick={handleMic}
                        disabled={disabled}
                        aria-label={listening ? "녹음 중지" : "음성 입력"}
                        aria-pressed={listening}
                    >
                        🎤
                    </button>
                )}
                <textarea
                    className={styles.input}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    placeholder={listening ? "듣는 중..." : "꿈을 이야기해보세요"}
                    rows={1}
                    disabled={disabled}
                    maxLength={MESSAGE_LIMITS.maxContentLength}
                    aria-label="꿈 입력"
                />
                {ttsAvailable && (
                    <button
                        type="button"
                        className={`${styles.iconBtn} ${ttsEnabled ? styles.ttsOn : ""}`}
                        onClick={onTtsToggle}
                        aria-label={ttsEnabled ? "TTS 끄기" : "TTS 켜기"}
                        aria-pressed={ttsEnabled}
                    >
                        🔊
                    </button>
                )}
                <button
                    type="button"
                    className={styles.sendBtn}
                    onClick={handleSubmit}
                    disabled={disabled || !text.trim()}
                    aria-label="전송"
                >
                    전송
                </button>
            </div>
        </div>
    );
}
