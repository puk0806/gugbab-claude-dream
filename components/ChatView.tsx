"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import styles from "./ChatView.module.css";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface ChatViewProps {
    messages: ChatMessage[];
    streamingText: string;
    isStreaming: boolean;
}

export function ChatView({ messages, streamingText, isStreaming }: ChatViewProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: 메시지 추가·스트리밍 갱신 시 하단 스크롤을 트리거하기 위한 의도적 의존성
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length, streamingText]);

    return (
        <div className={styles.view} role="log" aria-live="polite" aria-label="대화 내용">
            {messages.length === 0 && !isStreaming && <p className={styles.empty}>어젯밤 꿈을 이야기해보세요 💬</p>}
            {messages.map((m, _i) => (
                <MessageBubble key={String(m.timestamp)} message={m} />
            ))}
            {isStreaming && streamingText && (
                <MessageBubble key="streaming" message={{ role: "model", content: streamingText, timestamp: 0 }} />
            )}
            {isStreaming && !streamingText && <TypingIndicator />}
            <div ref={bottomRef} />
        </div>
    );
}
