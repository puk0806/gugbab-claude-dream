'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ulid } from 'ulid';
import { ChatInput } from '@/components/ChatInput';
import { ChatView } from '@/components/ChatView';
import { HistoryList } from '@/components/HistoryList';
import { InstallButton } from '@/components/install/InstallButton';
import { listSessionsDesc, saveSession } from '@/lib/db';
import { speak } from '@/lib/speech';
import type { ChatMessage, ChatSseEvent, DreamSession } from '@/lib/types';
import styles from './page.module.css';

async function streamChat(
  sessionId: string,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, messages }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let modelId = '';

  const processBuffer = (buf: string): string => {
    const parts = buf.split('\n\n');
    const remaining = parts.pop() ?? '';
    for (const part of parts) {
      if (!part.startsWith('data: ')) continue;
      let event: ChatSseEvent;
      try {
        event = JSON.parse(part.slice(6)) as ChatSseEvent;
      } catch {
        continue;
      }
      if (event.type === 'chunk') {
        onChunk(event.text);
      } else if (event.type === 'done') {
        modelId = event.modelId;
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    }
    return remaining;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      processBuffer(buffer);
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = processBuffer(buffer);
  }

  return modelId;
}

export default function HomePage() {
  const [session, setSession] = useState<DreamSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<DreamSession[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    listSessionsDesc(3)
      .then(setRecentSessions)
      .catch(() => setRecentSessions([]));
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      setErrorMsg('');
      const userMsg: ChatMessage = {
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      const current: DreamSession = session ?? {
        id: ulid(),
        createdAt: Date.now(),
        messages: [],
        summary: text.slice(0, 50),
        modelId: '',
        schemaVersion: 2,
      };
      const withUser = { ...current, messages: [...current.messages, userMsg] };
      setSession(withUser);

      setIsStreaming(true);
      setStreamingText('');
      let accumulated = '';

      try {
        await saveSession(withUser);

        const modelId = await streamChat(
          withUser.id,
          withUser.messages.map((m) => ({ role: m.role, content: m.content })),
          (chunk) => {
            accumulated += chunk;
            setStreamingText(accumulated);
          },
        );

        if (accumulated) {
          const aiMsg: ChatMessage = {
            role: 'model',
            content: accumulated,
            timestamp: Date.now(),
          };
          const finalSession: DreamSession = {
            ...withUser,
            messages: [...withUser.messages, aiMsg],
            modelId,
          };
          setSession(finalSession);
          if (ttsEnabled) speak(accumulated);
          try {
            await saveSession(finalSession);
          } catch {
            // IDB failure is non-critical — UI already updated
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.';
        setErrorMsg(msg);
      } finally {
        setIsStreaming(false);
        setStreamingText('');
      }
    },
    [session, ttsEnabled],
  );

  const handleNewSession = () => {
    if (session) {
      setRecentSessions((prev) => [session, ...prev].slice(0, 3));
    }
    setSession(null);
    setErrorMsg('');
  };

  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <h1 className={styles.title}>꿈해몽 💬</h1>
        <nav className={styles.headerActions}>
          <InstallButton />
          <Link href="/history" className={styles.historyLink}>
            히스토리
          </Link>
        </nav>
      </header>

      <ChatView
        messages={session?.messages ?? []}
        streamingText={streamingText}
        isStreaming={isStreaming}
      />

      {errorMsg && (
        <div className={styles.errorBanner} role="alert">
          <span aria-hidden>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {session && session.messages.length > 0 && !isStreaming && (
        <button type="button" onClick={handleNewSession} className={styles.newSessionBtn}>
          새 꿈 이야기하기
        </button>
      )}

      <ChatInput
        onSend={sendMessage}
        disabled={isStreaming}
        ttsEnabled={ttsEnabled}
        onTtsToggle={() => setTtsEnabled((v) => !v)}
      />

      {recentSessions.length > 0 && !session && (
        <section className={styles.recent} aria-labelledby="recent-title">
          <h2 id="recent-title" className={styles.recentTitle}>
            최근 대화
          </h2>
          <HistoryList sessions={recentSessions} />
        </section>
      )}
    </main>
  );
}
