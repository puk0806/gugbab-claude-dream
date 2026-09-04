"use client";

import { isSpeechSynthesisSupported, type MicError, useSpeechRecognition } from "@gugbab/hooks";
import { appendTranscript } from "@gugbab/utils";
import { useEffect, useState } from "react";
import { MESSAGE_LIMITS } from "@/lib/chat-history";
import styles from "./ChatInput.module.css";

const MIC_ERROR_MESSAGES: Record<MicError, string> = {
    "not-allowed": "마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요.",
    "no-speech": "음성이 감지되지 않았습니다. 다시 시도해주세요.",
    network: "네트워크 오류로 음성 인식에 실패했습니다.",
    unknown: "음성 인식을 시작할 수 없습니다.",
};

interface ChatInputProps {
    /** false를 돌려주면 전송이 롤백된 것 — 입력을 복원해 바로 다시 보낼 수 있게 한다 */
    onSend: (text: string) => boolean | undefined | Promise<boolean | undefined>;
    disabled?: boolean;
    ttsEnabled: boolean;
    onTtsToggle: () => void;
}

export function ChatInput({ onSend, disabled, ttsEnabled, onTtsToggle }: ChatInputProps) {
    const [text, setText] = useState("");
    const [ttsAvailable, setTtsAvailable] = useState(false);

    // 마이크 상태 배선(listening/interim/error·stale 세션 가드·언마운트 abort)은 훅이 담당
    const {
        supported: recognitionAvailable,
        listening,
        interimText,
        error: micErrorType,
        start,
        stop,
        abort,
    } = useSpeechRecognition({
        lang: "ko-KR",
        onFinal: (transcript) => {
            // 최종 결과만 실제 입력에 반영 (interim 덮어쓰기 방지)
            setText((prev) => appendTranscript(prev, transcript, MESSAGE_LIMITS.maxContentLength));
        },
    });
    const micError = micErrorType ? MIC_ERROR_MESSAGES[micErrorType] : "";

    useEffect(() => {
        setTtsAvailable(isSpeechSynthesisSupported());
    }, []);

    const handleMic = () => {
        if (listening) {
            stop();
            return;
        }
        // 마이크 사용 시 TTS 자동 활성화 — 음성 입력이면 음성 출력도 켜는 게 자연스러운 흐름
        if (!ttsEnabled && ttsAvailable) {
            onTtsToggle();
        }
        start();
    };

    const handleSubmit = async () => {
        const trimmed = text.trim();
        if (!trimmed || disabled) return;
        abort(); // 전송 직후 늦게 도착하는 최종 결과가 빈 입력을 다시 채우지 않도록 파기
        setText("");
        const ok = await onSend(trimmed);
        // 롤백된 전송은 입력을 복원한다 — 그 사이 새로 친 내용이 있으면 덮어쓰지 않는다
        if (ok === false) setText((prev) => (prev ? prev : trimmed));
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
                            void handleSubmit();
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
                    onClick={() => void handleSubmit()}
                    disabled={disabled || !text.trim()}
                    aria-label="전송"
                >
                    전송
                </button>
            </div>
        </div>
    );
}
