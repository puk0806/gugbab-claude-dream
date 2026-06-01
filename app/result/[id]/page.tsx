'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { InterpretationView } from '@/components/InterpretationView';
import { SafetyResourceCard } from '@/components/SafetyResourceCard';
import { getEntry, saveEntry } from '@/lib/db';
import type { CrisisResource, DreamEntry, InterpretSseEvent } from '@/lib/types';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface State {
  entry: DreamEntry | null;
  text: string;
  done: boolean;
  loading: boolean;
  safetyBlock: { resources: CrisisResource[] } | null;
  error: string | null;
}

const TONE_LABEL: Record<string, string> = {
  casual: '캐주얼',
  reflective: '자기 성찰',
  traditional: '한국 전통',
};

export default function ResultPage({ params }: PageProps) {
  const { id } = use(params);
  const [state, setState] = useState<State>({
    entry: null,
    text: '',
    done: false,
    loading: true,
    safetyBlock: null,
    error: null,
  });
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      const entry = await getEntry(id);
      if (controller.signal.aborted) return;

      if (!entry) {
        setState((s) => ({ ...s, error: '해몽을 찾을 수 없어요', loading: false }));
        return;
      }
      setState((s) => ({ ...s, entry }));

      if (entry.interpretation) {
        setState((s) => ({ ...s, text: entry.interpretation, done: true, loading: false }));
        return;
      }

      await streamInterpret(entry, controller.signal, (next) => {
        if (controller.signal.aborted) return;
        setState((prev) => next(prev));
      });
    })();

    return () => {
      controller.abort();
    };
  }, [id]);

  if (state.error) {
    return (
      <main className={styles.page}>
        <p className={styles.error}>{state.error}</p>
        <Link href="/" className={styles.back}>
          ← 홈으로
        </Link>
      </main>
    );
  }

  if (!state.entry) {
    return (
      <main className={styles.page}>
        <InterpretationView text="" loading done={false} />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← 홈으로
        </Link>
        <span className={styles.toneBadge}>{TONE_LABEL[state.entry.tone]}</span>
      </header>

      <section className={styles.dreamSummary} aria-label="입력한 꿈">
        <h2 className={styles.summaryTitle}>입력한 꿈</h2>
        <p className={styles.summaryBody}>{state.entry.dreamText}</p>
      </section>

      {state.safetyBlock ? (
        <SafetyResourceCard resources={state.safetyBlock.resources} />
      ) : (
        <InterpretationView text={state.text} loading={state.loading} done={state.done} />
      )}
    </main>
  );
}

async function streamInterpret(
  entry: DreamEntry,
  signal: AbortSignal,
  setState: (next: (prev: State) => State) => void,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dreamText: entry.dreamText, tone: entry.tone }),
      signal,
    });
  } catch (e) {
    if (signal.aborted) return;
    const msg = e instanceof Error ? e.message : 'unknown error';
    setState((s) => ({ ...s, error: `네트워크 오류: ${msg}`, loading: false }));
    return;
  }

  if (!res.ok || !res.body) {
    setState((s) => ({ ...s, error: '서버 응답이 비정상이에요', loading: false }));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (e) {
      if (signal.aborted) return;
      const msg = e instanceof Error ? e.message : 'unknown error';
      setState((s) => ({ ...s, error: `스트림 오류: ${msg}`, loading: false }));
      return;
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const raw of events) {
      const line = raw.replace(/^data:\s*/, '').trim();
      if (!line) continue;
      const event = JSON.parse(line) as InterpretSseEvent;
      if (event.type === 'chunk') {
        accumulated += event.delta;
        setState((s) => ({ ...s, text: accumulated, loading: false }));
      } else if (event.type === 'safety_block') {
        setState((s) => ({
          ...s,
          loading: false,
          safetyBlock: { resources: event.resources },
        }));
      } else if (event.type === 'done') {
        const finalEntry: DreamEntry = {
          ...entry,
          interpretation: accumulated,
          modelId: event.modelId,
          safetyVerdict: event.verdict,
        };
        await saveEntry(finalEntry);
        setState((s) => ({ ...s, done: true, loading: false }));
      } else if (event.type === 'error') {
        setState((s) => ({ ...s, error: event.message, loading: false }));
      }
    }
  }
}
