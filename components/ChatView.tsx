'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import styles from './ChatView.module.css';

interface ChatViewProps {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
}

export function ChatView({ messages, streamingText, isStreaming }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  return (
    <div className={styles.view} role="log" aria-live="polite" aria-label="대화 내용">
      {messages.length === 0 && !isStreaming && (
        <p className={styles.empty}>어젯밤 꿈을 이야기해보세요 💬</p>
      )}
      {messages.map((m, i) => (
        <MessageBubble key={`${i}-${m.timestamp}`} message={m} />
      ))}
      {isStreaming && streamingText && (
        <MessageBubble
          key="streaming"
          message={{ role: 'model', content: streamingText, timestamp: 0 }}
        />
      )}
      {isStreaming && !streamingText && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
