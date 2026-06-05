'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRecognizer,
  isRecognitionSupported,
  isSpeechSynthesisSupported,
} from '@/lib/speech';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  ttsEnabled: boolean;
  onTtsToggle: () => void;
}

export function ChatInput({ onSend, disabled, ttsEnabled, onTtsToggle }: ChatInputProps) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
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
    if (listening) {
      recognizerRef.current?.stop();
      setListening(false);
      return;
    }
    try {
      const rec = createRecognizer(
        (transcript) => setText(transcript),
        () => setListening(false),
      );
      recognizerRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    recognizerRef.current?.abort();
    setListening(false);
    onSend(trimmed);
    setText('');
  };

  return (
    <div className={styles.bar}>
      {recognitionAvailable && (
        <button
          type="button"
          className={`${styles.iconBtn} ${listening ? styles.recording : ''}`}
          onClick={handleMic}
          disabled={disabled}
          aria-label={listening ? '녹음 중지' : '음성 입력'}
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
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="꿈을 이야기해보세요"
        rows={1}
        disabled={disabled}
        aria-label="꿈 입력"
      />
      {ttsAvailable && (
        <button
          type="button"
          className={`${styles.iconBtn} ${ttsEnabled ? styles.ttsOn : ''}`}
          onClick={onTtsToggle}
          aria-label={ttsEnabled ? 'TTS 끄기' : 'TTS 켜기'}
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
  );
}
