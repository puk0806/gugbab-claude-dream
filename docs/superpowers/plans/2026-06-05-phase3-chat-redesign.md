# Phase 3 채팅·음성 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 꿈해몽 앱을 1회성 텍스트 입력/결과 구조에서 멀티턴 채팅 + 음성 I/O 구조로 전면 재설계한다.

**Architecture:** 기존 `/api/interpret` (단일 메시지)를 `/api/chat` (messages 배열 + SSE)로 교체. Safety classifier(lib/safety.ts) 완전 제거. 모든 스킬 자산을 단일 chat 프롬프트에 통합. IndexedDB를 v2로 마이그레이션해 DreamSession을 저장. Web Speech API로 마이크 입력·TTS 출력 추가.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript 5, Google Gemini 2.5 Flash (`@google/genai`), IndexedDB (`idb`), Web Speech API (브라우저 내장), Playwright (시각 회귀), pnpm, Biome

---

## 파일 구조 맵

### 삭제
- `app/api/interpret/route.ts` + 디렉토리
- `app/result/[id]/page.tsx` + 디렉토리
- `lib/safety.ts`
- `lib/crisis-resources.ts`
- `lib/prompts/casual.ts`
- `lib/prompts/reflective.ts`
- `lib/prompts/traditional.ts`
- `lib/prompts/safety.ts`
- `components/DreamInput.tsx` + `.module.css`
- `components/ToneChips.tsx` + `.module.css`
- `components/InterpretationView.tsx` + `.module.css`
- `components/SafetyResourceCard.tsx` + `.module.css`

### 수정
- `lib/types.ts` — ChatMessage, DreamSession 추가, 구 타입 제거
- `lib/llm.ts` — `getChatStream(messages)` 멀티턴 함수로 교체
- `lib/prompts/index.ts` — chat 프롬프트 단일 export로 재작성
- `lib/db.ts` — v2 마이그레이션, sessions 스토어 추가
- `components/HistoryList.tsx` + `.module.css` — DreamSession 기반으로 교체
- `app/page.tsx` + `.module.css` — 채팅 홈으로 전면 재작성
- `app/history/page.tsx` — DreamSession 기반으로 교체
- `e2e/visual/_fixtures/sse-mock.ts` — /api/chat 포맷으로 교체
- `e2e/visual/_fixtures/init-script.ts` — sessions 스토어 seed로 교체
- `e2e/visual/routes.spec.ts` — /result/[id] → /session/[id] 교체
- `e2e/visual/components.spec.ts` — ToneChips·SafetyCard spec 제거, ChatInput spec 추가

### 신규 생성
- `lib/prompts/chat.ts` — 통합 시스템 프롬프트
- `app/api/chat/route.ts` — 멀티턴 SSE 엔드포인트
- `lib/speech.ts` — Web Speech API 래퍼
- `components/MessageBubble.tsx` + `.module.css`
- `components/TypingIndicator.tsx` + `.module.css`
- `components/ChatView.tsx` + `.module.css`
- `components/ChatInput.tsx` + `.module.css`
- `app/session/[id]/page.tsx` + `.module.css` — 읽기 전용 세션 뷰

---

## Task 1: 3-A — lib/types.ts 재작성

**Files:**
- Modify: `lib/types.ts`

기존 타입(Tone, SafetyCategory, SafetyVerdict, DreamEntry, InterpretRequest, CrisisResource, InterpretSseEvent)을 제거하고 신규 타입을 추가한다. `DreamEntry`는 v1 데이터 읽기용으로 최소화해서 유지한다.

- [ ] **Step 1: lib/types.ts 전체 재작성**

```ts
// lib/types.ts
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface DreamSession {
  id: string;            // ULID
  createdAt: number;     // Unix ms
  messages: ChatMessage[];
  summary: string;       // 첫 사용자 메시지 앞 50자
  modelId: string;
  schemaVersion: 2;
}

/** v1 하위 호환 — 신규 저장 안 함, 읽기 전용 */
export interface DreamEntry {
  id: string;
  createdAt: number;
  dreamText: string;
  interpretation: string;
  modelId: string;
  schemaVersion: 1;
}

export type ChatSseEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; sessionId: string }
  | { type: 'error'; message: string };
```

- [ ] **Step 2: 타입체크 (에러 예상 — 구 타입 참조하는 파일들이 아직 존재)**

```bash
cd /Users/lf/Desktop/gugbab-workspace/03_gugbab-claude-dream
pnpm typecheck 2>&1 | head -40
```

이 시점에서 타입 에러가 다수 발생하는 것은 정상이다. 다음 Task들에서 모두 해소된다.

---

## Task 2: 3-A — 삭제 대상 lib 파일 제거

**Files:**
- Delete: `lib/safety.ts`, `lib/crisis-resources.ts`
- Delete: `lib/prompts/casual.ts`, `lib/prompts/reflective.ts`, `lib/prompts/traditional.ts`, `lib/prompts/safety.ts`
- Modify: `lib/prompts/index.ts` (임시 빈 파일로 — Task 8에서 재작성)

- [ ] **Step 1: lib 파일 삭제**

```bash
rm lib/safety.ts
rm lib/crisis-resources.ts
rm lib/prompts/casual.ts
rm lib/prompts/reflective.ts
rm lib/prompts/traditional.ts
rm lib/prompts/safety.ts
```

- [ ] **Step 2: lib/prompts/index.ts 임시 placeholder로 교체**

```ts
// lib/prompts/index.ts
// Task 8에서 chat.ts 기반으로 재작성됨
export function getChatSystemPrompt(): string {
  return '';
}
```

---

## Task 3: 3-A — 삭제 대상 컴포넌트 제거

**Files:**
- Delete: `components/DreamInput.tsx`, `components/DreamInput.module.css`
- Delete: `components/ToneChips.tsx`, `components/ToneChips.module.css`
- Delete: `components/InterpretationView.tsx`, `components/InterpretationView.module.css`
- Delete: `components/SafetyResourceCard.tsx`, `components/SafetyResourceCard.module.css`

- [ ] **Step 1: 컴포넌트 삭제**

```bash
rm components/DreamInput.tsx components/DreamInput.module.css
rm components/ToneChips.tsx components/ToneChips.module.css
rm components/InterpretationView.tsx components/InterpretationView.module.css
rm components/SafetyResourceCard.tsx components/SafetyResourceCard.module.css
```

---

## Task 4: 3-A — 삭제 대상 페이지·라우트 제거

**Files:**
- Delete: `app/result/[id]/page.tsx` (디렉토리 포함)
- Delete: `app/api/interpret/route.ts` (디렉토리 포함)

- [ ] **Step 1: 페이지·라우트 삭제**

```bash
rm -r app/result
rm -r app/api/interpret
```

---

## Task 5: 3-A — app/page.tsx + app/history/page.tsx 임시 스텁으로 교체

구 타입(DreamEntry, Tone 등)을 참조하는 페이지 파일들을 임시 스텁으로 교체해 타입 에러를 해소한다. Task 16(홈)과 Task 23(히스토리)에서 정식으로 재작성한다.

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/history/page.tsx`

- [ ] **Step 1: app/page.tsx 스텁**

```tsx
// app/page.tsx
export default function HomePage() {
  return <main><p>구현 중</p></main>;
}
```

- [ ] **Step 2: app/history/page.tsx 스텁**

```tsx
// app/history/page.tsx
export default function HistoryPage() {
  return <main><p>구현 중</p></main>;
}
```

- [ ] **Step 3: 타입체크 — 여기서 에러 0이어야 함**

```bash
pnpm typecheck
```

Expected: 에러 0 (또는 llm.ts에서 미사용 import 경고만). 에러 있으면 해당 파일에서 구 타입 참조를 찾아 제거.

- [ ] **Step 4: 3-A 커밋**

```bash
git add -A
git commit -m "[app] Remove: 안전 분류기·ToneChips·DreamInput·result 페이지 제거 (Phase 3-A)"
```

---

## Task 6: 3-B — lib/prompts/chat.ts (통합 시스템 프롬프트)

기존 casual.ts는 스킬 1개만 임베드해 품질이 낮았다. 새 chat.ts에는 꿈 해석 관련 모든 스킬 자산 7개를 임베드한다.

**Files:**
- Create: `lib/prompts/chat.ts`

- [ ] **Step 1: lib/prompts/chat.ts 생성**

```ts
// lib/prompts/chat.ts
import {
  AGENT_RESEARCH_DREAM_MULTI_PERSPECTIVE_SYNTHESIZER,
  SKILL_HUMANITIES_ATTACHMENT_THEORY_BASICS,
  SKILL_HUMANITIES_DREAM_CONTENT_PRIVACY_ETHICS,
  SKILL_HUMANITIES_DREAM_CONTENT_RESEARCH,
  SKILL_HUMANITIES_DREAM_PSYCHOLOGY_JUNG_FREUD,
  SKILL_HUMANITIES_KOREAN_DREAM_INTERPRETATION_TRADITION,
  SKILL_HUMANITIES_RELATIONAL_PATTERN_ANALYSIS,
} from './_compiled';

export const CHAT_SYSTEM_PROMPT = `당신은 꿈 해석 전문가이자 친근한 대화 파트너입니다.

## 대화 지침
- 첫 메시지에서는 꿈의 핵심 상징을 간략히 해석하고, 더 깊은 해석을 위한 후속 질문을 한 가지만 자연스럽게 던져주세요.
- 사용자가 추가 정보(색깔, 감정, 등장 인물 등)를 주면 그 정보를 반영해 더 정확하고 깊은 해석을 이어가세요.
- 후속 질문은 한 번에 하나만. 여러 개 나열하지 않습니다.

## 톤 규약
- 존댓말, 친근하고 따뜻하게
- 이모지 0~1개 (꼭 필요할 때만)
- 단정하지 않게: "~일 수 있어요", "~로 보여요"
- 길이: 첫 응답 150~300자, 후속 응답 100~250자

## 지식 기반 — 한국 전통 해몽
${SKILL_HUMANITIES_KOREAN_DREAM_INTERPRETATION_TRADITION}

## 지식 기반 — 융 분석심리학 / 프로이트 정신분석
${SKILL_HUMANITIES_DREAM_PSYCHOLOGY_JUNG_FREUD}

## 지식 기반 — 현대 꿈 과학 연구
${SKILL_HUMANITIES_DREAM_CONTENT_RESEARCH}

## 지식 기반 — 애착 이론
${SKILL_HUMANITIES_ATTACHMENT_THEORY_BASICS}

## 지식 기반 — 관계 패턴 분석
${SKILL_HUMANITIES_RELATIONAL_PATTERN_ANALYSIS}

## 다관점 통합 방법론
${AGENT_RESEARCH_DREAM_MULTI_PERSPECTIVE_SYNTHESIZER}

## 공통 회피 규칙
${SKILL_HUMANITIES_DREAM_CONTENT_PRIVACY_ETHICS}
- 단정형 예언("반드시 일어납니다") 금지
- 의학·심리 진단("우울증입니다") 금지
- 사주·점술과 혼동되는 표현 금지
`;

export function getChatSystemPrompt(): string {
  return CHAT_SYSTEM_PROMPT;
}
```

---

## Task 7: 3-B — lib/llm.ts 업데이트 (멀티턴)

`getInterpretStream(tone, dreamText)` → `getChatStream(messages)` 로 교체. tone 파라미터는 제거된다.

**Files:**
- Modify: `lib/llm.ts`

- [ ] **Step 1: lib/llm.ts 전체 재작성**

```ts
// lib/llm.ts
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { getChatSystemPrompt } from './prompts';

const MODEL_ID = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const MAX_TOKENS = 2048;
const TEMPERATURE = 0.7;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

export function getChatStream(
  messages: Array<{ role: 'user' | 'model'; content: string }>,
) {
  return ai.models.generateContentStream({
    model: MODEL_ID,
    config: {
      systemInstruction: getChatSystemPrompt(),
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
      safetySettings: SAFETY_SETTINGS,
    },
    contents: messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
  });
}

export function getModelId(): string {
  return MODEL_ID;
}
```

---

## Task 8: 3-B — lib/prompts/index.ts 재작성

Task 2에서 임시 스텁으로 남겨둔 파일을 chat.ts를 사용하도록 재작성한다.

**Files:**
- Modify: `lib/prompts/index.ts`

- [ ] **Step 1: lib/prompts/index.ts 재작성**

```ts
// lib/prompts/index.ts
export { getChatSystemPrompt } from './chat';
```

---

## Task 9: 3-B — app/api/chat/route.ts (멀티턴 SSE 엔드포인트)

**Files:**
- Create: `app/api/chat/route.ts`

- [ ] **Step 1: 디렉토리 생성 후 route.ts 작성**

```bash
mkdir -p app/api/chat
```

```ts
// app/api/chat/route.ts
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getChatStream } from '@/lib/llm';
import type { ChatSseEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string().min(1).max(4000),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  sessionId: z.string().min(1),
});

function sseLine(event: ChatSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest): Promise<Response> {
  let parsed: z.infer<typeof ChatRequestSchema>;
  try {
    const body = await req.json();
    parsed = ChatRequestSchema.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: '입력을 확인해주세요' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: ChatSseEvent) =>
        controller.enqueue(encoder.encode(sseLine(event)));

      try {
        const llmStream = await getChatStream(parsed.messages);
        for await (const chunk of llmStream) {
          const text = chunk.text ?? '';
          if (text) send({ type: 'chunk', text });
        }
        send({ type: 'done', sessionId: parsed.sessionId });
      } catch (e) {
        const message = e instanceof Error ? e.message : '알 수 없는 오류';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}
```

- [ ] **Step 2: 타입체크**

```bash
pnpm typecheck
```

Expected: 에러 0.

- [ ] **Step 3: 3-B 커밋**

```bash
git add -A
git commit -m "[app] Add: 통합 채팅 프롬프트(chat.ts 7개 스킬) + /api/chat 멀티턴 SSE 엔드포인트 (Phase 3-B)"
```

---

## Task 10: 3-C — MessageBubble + TypingIndicator 컴포넌트

**Files:**
- Create: `components/MessageBubble.tsx`, `components/MessageBubble.module.css`
- Create: `components/TypingIndicator.tsx`, `components/TypingIndicator.module.css`

- [ ] **Step 1: MessageBubble.module.css 생성**

```css
/* components/MessageBubble.module.css */
.bubble {
  display: flex;
  gap: var(--gugbab-space-2, 8px);
  max-width: 80%;
  align-items: flex-end;
}

.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.ai {
  align-self: flex-start;
}

.avatar {
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1;
}

.content {
  padding: var(--gugbab-space-3, 12px) var(--gugbab-space-4, 16px);
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.user .content {
  background: var(--gugbab-color-accent-base, #0090ff);
  color: white;
  border-bottom-right-radius: 4px;
}

.ai .content {
  background: var(--gugbab-color-bg-inset, #f0f0f3);
  color: var(--gugbab-color-fg-primary, #1c2024);
  border-bottom-left-radius: 4px;
}
```

- [ ] **Step 2: MessageBubble.tsx 생성**

```tsx
// components/MessageBubble.tsx
import type { ChatMessage } from '@/lib/types';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={`${styles.bubble} ${isUser ? styles.user : styles.ai}`}>
      {!isUser && <div className={styles.avatar}>💭</div>}
      <div className={styles.content}>{message.content}</div>
    </div>
  );
}
```

- [ ] **Step 3: TypingIndicator.module.css 생성**

```css
/* components/TypingIndicator.module.css */
.container {
  display: flex;
  align-items: flex-end;
  gap: var(--gugbab-space-2, 8px);
  align-self: flex-start;
}

.avatar {
  font-size: 20px;
  flex-shrink: 0;
}

.dots {
  display: flex;
  gap: 4px;
  padding: var(--gugbab-space-3, 12px) var(--gugbab-space-4, 16px);
  background: var(--gugbab-color-bg-inset, #f0f0f3);
  border-radius: 18px;
  border-bottom-left-radius: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gugbab-color-fg-muted, #80838d);
  animation: bounce 1.2s infinite;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}
```

- [ ] **Step 4: TypingIndicator.tsx 생성**

```tsx
// components/TypingIndicator.tsx
import styles from './TypingIndicator.module.css';

export function TypingIndicator() {
  return (
    <div className={styles.container}>
      <div className={styles.avatar}>💭</div>
      <div className={styles.dots}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  );
}
```

---

## Task 11: 3-C — ChatView 컴포넌트

**Files:**
- Create: `components/ChatView.tsx`, `components/ChatView.module.css`

- [ ] **Step 1: ChatView.module.css 생성**

```css
/* components/ChatView.module.css */
.view {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--gugbab-space-3, 12px);
  overflow-y: auto;
  padding: var(--gugbab-space-4, 16px) var(--gugbab-space-3, 12px);
  width: 100%;
}

.empty {
  text-align: center;
  color: var(--gugbab-color-fg-muted, #80838d);
  font-size: 15px;
  margin: auto;
  padding: var(--gugbab-space-8, 32px) 0;
}
```

- [ ] **Step 2: ChatView.tsx 생성**

```tsx
// components/ChatView.tsx
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
      {messages.map((m) => (
        <MessageBubble key={m.timestamp} message={m} />
      ))}
      {isStreaming && streamingText && (
        <MessageBubble
          message={{ role: 'model', content: streamingText, timestamp: Date.now() }}
        />
      )}
      {isStreaming && !streamingText && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
```

---

## Task 12: 3-C — ChatInput 컴포넌트 (텍스트 전용, 음성은 Task 20에서 추가)

**Files:**
- Create: `components/ChatInput.tsx`, `components/ChatInput.module.css`

- [ ] **Step 1: ChatInput.module.css 생성**

```css
/* components/ChatInput.module.css */
.bar {
  display: flex;
  align-items: flex-end;
  gap: var(--gugbab-space-2, 8px);
  padding: var(--gugbab-space-3, 12px);
  border-top: 1px solid var(--gugbab-color-border-base, #cdced6);
  background: var(--gugbab-color-bg-surface, #f9f9fb);
  width: 100%;
}

.input {
  flex: 1;
  padding: var(--gugbab-space-2, 8px) var(--gugbab-space-3, 12px);
  border: 1px solid var(--gugbab-color-border-base, #cdced6);
  border-radius: 20px;
  font: inherit;
  font-size: 15px;
  resize: none;
  max-height: 120px;
  background: var(--gugbab-color-bg-elevated, #fcfcfd);
  color: var(--gugbab-color-fg-primary, #1c2024);
  line-height: 1.5;
}

.input:focus-visible {
  outline: 2px solid var(--gugbab-color-border-focus, #5eb1ef);
  outline-offset: 1px;
}

.input:disabled {
  opacity: 0.5;
}

.iconBtn {
  background: none;
  border: 1px solid var(--gugbab-color-border-base, #cdced6);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  flex-shrink: 0;
}

.iconBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.recording {
  border-color: #ef4444;
  background: #fef2f2;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.ttsOn {
  border-color: var(--gugbab-color-accent-base, #0090ff);
  background: var(--gugbab-color-accent-subtle, #e6f4fe);
}

.sendBtn {
  padding: 0 var(--gugbab-space-4, 16px);
  height: 36px;
  background: var(--gugbab-color-accent-base, #0090ff);
  color: white;
  border: none;
  border-radius: 18px;
  font-weight: 600;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}

.sendBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 2: ChatInput.tsx 생성 (텍스트 전용 — mic·TTS 버튼은 Task 20에서 추가)**

```tsx
// components/ChatInput.tsx
'use client';

import { useState } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  ttsEnabled: boolean;
  onTtsToggle: () => void;
}

export function ChatInput({ onSend, disabled, ttsEnabled, onTtsToggle }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className={styles.bar}>
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
      <button
        type="button"
        className={`${styles.iconBtn} ${ttsEnabled ? styles.ttsOn : ''}`}
        onClick={onTtsToggle}
        aria-label={ttsEnabled ? 'TTS 끄기' : 'TTS 켜기'}
      >
        🔊
      </button>
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
```

- [ ] **Step 3: 타입체크**

```bash
pnpm typecheck
```

Expected: 에러 0.

- [ ] **Step 4: 3-C 커밋**

```bash
git add -A
git commit -m "[app] Add: ChatView·MessageBubble·TypingIndicator·ChatInput 컴포넌트 4종 (Phase 3-C)"
```

---

## Task 13: 3-D — lib/db.ts v2 (DreamSession CRUD)

IndexedDB를 v1→v2로 마이그레이션한다. `entries` 스토어는 읽기 전용으로 유지, `sessions` 스토어를 신규 추가한다.

**Files:**
- Modify: `lib/db.ts`

- [ ] **Step 1: lib/db.ts 전체 재작성**

```ts
// lib/db.ts
import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { DreamEntry, DreamSession } from './types';

const DB_NAME = 'gugbab-dream';
const DB_VERSION = 2;
const SESSION_STORE = 'sessions';
const ENTRY_STORE = 'entries';
const LRU_LIMIT = 100;

interface DreamDB extends DBSchema {
  sessions: {
    key: string;
    value: DreamSession;
    indexes: { createdAt_idx: number };
  };
  entries: {
    key: string;
    value: DreamEntry;
    indexes: { createdAt_idx: number };
  };
}

let dbPromise: Promise<IDBPDatabase<DreamDB>> | null = null;

function getDB(): Promise<IDBPDatabase<DreamDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DreamDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const entryStore = db.createObjectStore(ENTRY_STORE, { keyPath: 'id' });
          entryStore.createIndex('createdAt_idx', 'createdAt');
        }
        if (oldVersion < 2) {
          const sessionStore = db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
          sessionStore.createIndex('createdAt_idx', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

// ── Sessions (v2) ──────────────────────────────────────────

export async function saveSession(session: DreamSession): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(SESSION_STORE, 'readwrite');
  await tx.store.put(session);
  await tx.done;
  await enforceLruLimitSessions();
}

export async function getSession(id: string): Promise<DreamSession | undefined> {
  const db = await getDB();
  return db.get(SESSION_STORE, id);
}

export async function listSessionsDesc(limit = LRU_LIMIT): Promise<DreamSession[]> {
  const db = await getDB();
  const tx = db.transaction(SESSION_STORE, 'readonly');
  const index = tx.store.index('createdAt_idx');
  const result: DreamSession[] = [];
  let cursor = await index.openCursor(null, 'prev');
  while (cursor && result.length < limit) {
    result.push(cursor.value);
    cursor = await cursor.continue();
  }
  return result;
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(SESSION_STORE, id);
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.clear(SESSION_STORE);
}

async function enforceLruLimitSessions(): Promise<void> {
  const db = await getDB();
  const count = await db.count(SESSION_STORE);
  if (count <= LRU_LIMIT) return;
  const overflow = count - LRU_LIMIT;
  const tx = db.transaction(SESSION_STORE, 'readwrite');
  const index = tx.store.index('createdAt_idx');
  let cursor = await index.openCursor(null, 'next');
  let removed = 0;
  while (cursor && removed < overflow) {
    await cursor.delete();
    removed += 1;
    cursor = await cursor.continue();
  }
  await tx.done;
}

// ── Entries (v1, 읽기 전용) ────────────────────────────────

export async function getEntry(id: string): Promise<DreamEntry | undefined> {
  const db = await getDB();
  return db.get(ENTRY_STORE, id);
}

export async function listEntriesDesc(limit = LRU_LIMIT): Promise<DreamEntry[]> {
  const db = await getDB();
  const tx = db.transaction(ENTRY_STORE, 'readonly');
  const index = tx.store.index('createdAt_idx');
  const result: DreamEntry[] = [];
  let cursor = await index.openCursor(null, 'prev');
  while (cursor && result.length < limit) {
    result.push(cursor.value);
    cursor = await cursor.continue();
  }
  return result;
}
```

---

## Task 14: 3-D — app/page.tsx 채팅 홈 재작성

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: app/page.module.css 재작성**

```css
/* app/page.module.css */
.home {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  max-width: 720px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gugbab-space-4, 16px) var(--gugbab-space-4, 16px)
    var(--gugbab-space-3, 12px);
  border-bottom: 1px solid var(--gugbab-color-border-base, #cdced6);
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--gugbab-color-fg-primary, #1c2024);
  margin: 0;
}

.historyLink {
  font-size: 14px;
  color: var(--gugbab-color-accent-base, #0090ff);
  text-decoration: none;
}

.newSessionBtn {
  margin: var(--gugbab-space-2, 8px) auto;
  padding: var(--gugbab-space-2, 8px) var(--gugbab-space-4, 16px);
  font-size: 13px;
  color: var(--gugbab-color-fg-secondary, #60646c);
  background: none;
  border: 1px solid var(--gugbab-color-border-base, #cdced6);
  border-radius: 999px;
  cursor: pointer;
}

.errorBanner {
  margin: var(--gugbab-space-2, 8px) var(--gugbab-space-3, 12px);
  padding: var(--gugbab-space-2, 8px) var(--gugbab-space-3, 12px);
  background: #fef2f2;
  color: #c33;
  border-radius: var(--gugbab-radius-md, 4px);
  font-size: 13px;
}

.recent {
  padding: var(--gugbab-space-3, 12px) var(--gugbab-space-3, 12px) 0;
}

.recentTitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--gugbab-color-fg-muted, #80838d);
  margin: 0 0 var(--gugbab-space-2, 8px) 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

- [ ] **Step 2: app/page.tsx 채팅 홈으로 재작성**

```tsx
// app/page.tsx
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ulid } from 'ulid';
import { ChatInput } from '@/components/ChatInput';
import { ChatView } from '@/components/ChatView';
import { HistoryList } from '@/components/HistoryList';
import { listSessionsDesc, saveSession } from '@/lib/db';
import { speak } from '@/lib/speech';
import type { ChatMessage, ChatSseEvent, DreamSession } from '@/lib/types';
import styles from './page.module.css';

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
      await saveSession(withUser);

      setIsStreaming(true);
      setStreamingText('');
      let accumulated = '';

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: withUser.id,
            messages: withUser.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            if (!part.startsWith('data: ')) continue;
            const event = JSON.parse(part.slice(6)) as ChatSseEvent;
            if (event.type === 'chunk') {
              accumulated += event.text;
              setStreamingText(accumulated);
            } else if (event.type === 'done') {
              const aiMsg: ChatMessage = {
                role: 'model',
                content: accumulated,
                timestamp: Date.now(),
              };
              const finalSession: DreamSession = {
                ...withUser,
                messages: [...withUser.messages, aiMsg],
                modelId: 'gemini-2.5-flash',
              };
              setSession(finalSession);
              await saveSession(finalSession);
              if (ttsEnabled && accumulated) speak(accumulated);
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
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
        <Link href="/history" className={styles.historyLink}>
          히스토리
        </Link>
      </header>

      <ChatView
        messages={session?.messages ?? []}
        streamingText={streamingText}
        isStreaming={isStreaming}
      />

      {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

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
```

- [ ] **Step 3: 타입체크**

```bash
pnpm typecheck
```

HistoryList가 아직 DreamEntry 기반이라 에러가 발생한다. Task 15에서 해소된다.

---

## Task 15: 3-D — HistoryList.tsx DreamSession 기반으로 교체

**Files:**
- Modify: `components/HistoryList.tsx`
- Modify: `components/HistoryList.module.css`

- [ ] **Step 1: HistoryList.module.css 수정** (tone 배지 제거, msgCount 스타일 추가)

```css
/* components/HistoryList.module.css */
.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.item {
  display: flex;
  gap: var(--gugbab-space-3, 12px);
  padding: var(--gugbab-space-3, 12px) 0;
  position: relative;
}

.link {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--gugbab-space-1, 4px);
  text-decoration: none;
  color: inherit;
}

.meta {
  display: flex;
  gap: var(--gugbab-space-2, 8px);
  align-items: center;
}

.date {
  font-size: 12px;
  color: var(--gugbab-color-fg-muted, #80838d);
}

.msgCount {
  font-size: 12px;
  color: var(--gugbab-color-fg-muted, #80838d);
}

.preview {
  font-size: 14px;
  color: var(--gugbab-color-fg-secondary, #60646c);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deleteBtn {
  padding: var(--gugbab-space-1, 4px) var(--gugbab-space-2, 8px);
  font-size: 12px;
  background: none;
  border: 1px solid var(--gugbab-color-border-base, #cdced6);
  border-radius: var(--gugbab-radius-md, 4px);
  cursor: pointer;
  color: var(--gugbab-color-fg-secondary, #60646c);
  align-self: center;
  flex-shrink: 0;
}

.deleteBtn:hover {
  border-color: #ef4444;
  color: #c33;
}

.separator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}

.empty {
  text-align: center;
  color: var(--gugbab-color-fg-muted, #80838d);
  font-size: 14px;
  padding: var(--gugbab-space-6, 24px) 0;
}
```

- [ ] **Step 2: HistoryList.tsx DreamSession 기반으로 재작성**

```tsx
// components/HistoryList.tsx
'use client';

import { Separator } from '@gugbab/styled-radix';
import Link from 'next/link';
import type { DreamSession } from '@/lib/types';
import styles from './HistoryList.module.css';

interface HistoryListProps {
  sessions: DreamSession[];
  onDelete?: (id: string) => void;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function HistoryList({ sessions, onDelete }: HistoryListProps) {
  if (sessions.length === 0) {
    return <p className={styles.empty}>아직 저장된 대화가 없어요.</p>;
  }

  return (
    <ul className={styles.list}>
      {sessions.map((s, idx) => (
        <li key={s.id} className={styles.item}>
          <Link href={`/session/${s.id}`} className={styles.link}>
            <div className={styles.meta}>
              <span className={styles.date}>{formatDate(s.createdAt)}</span>
              <span className={styles.msgCount}>{s.messages.length}개 메시지</span>
            </div>
            <p className={styles.preview}>{s.summary}</p>
          </Link>
          {onDelete && (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => onDelete(s.id)}
              aria-label={`${formatDate(s.createdAt)} 대화 삭제`}
            >
              삭제
            </button>
          )}
          {idx < sessions.length - 1 && <Separator className={styles.separator} />}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: 타입체크**

```bash
pnpm typecheck
```

Expected: 에러 0.

- [ ] **Step 4: 3-D 커밋**

```bash
git add -A
git commit -m "[app] Add: 채팅 홈 페이지 + IDB v2 DreamSession CRUD + HistoryList DreamSession 전환 (Phase 3-D)"
```

---

## Task 16: 3-E — lib/speech.ts (Web Speech API 래퍼)

**Files:**
- Create: `lib/speech.ts`

- [ ] **Step 1: lib/speech.ts 생성**

```ts
// lib/speech.ts
// 클라이언트 전용 — SSR에서 호출하지 않는다.

export function isRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface SpeechRecognizer {
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

export function createRecognizer(
  onResult: (text: string, isFinal: boolean) => void,
  onEnd: () => void,
): SpeechRecognizer {
  const Ctor: SpeechRecognitionCtor | undefined =
    (window as unknown as Record<string, unknown>).SpeechRecognition as SpeechRecognitionCtor ??
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition as SpeechRecognitionCtor;

  if (!Ctor) throw new Error('SpeechRecognition 미지원');

  const rec = new Ctor();
  rec.lang = 'ko-KR';
  rec.continuous = false;
  rec.interimResults = true;

  rec.onresult = (event: SpeechRecognitionEvent) => {
    const result = event.results[event.results.length - 1];
    onResult(result[0].transcript, result.isFinal);
  };
  rec.onend = onEnd;

  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
    abort: () => rec.abort(),
  };
}

export function speak(text: string): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  const voices = window.speechSynthesis.getVoices();
  const koVoice = voices.find((v) => v.lang.startsWith('ko'));
  if (koVoice) utter.voice = koVoice;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}
```

---

## Task 17: 3-E — ChatInput에 마이크 + TTS 버튼 통합

Task 12에서 만든 ChatInput에 음성 기능을 추가한다. CSS는 이미 `.recording`, `.ttsOn` 클래스를 포함하고 있어 추가 수정 불필요.

**Files:**
- Modify: `components/ChatInput.tsx`

- [ ] **Step 1: ChatInput.tsx 음성 지원 추가**

```tsx
// components/ChatInput.tsx
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
```

- [ ] **Step 2: 타입체크**

```bash
pnpm typecheck
```

Expected: 에러 0.

- [ ] **Step 3: 3-E 커밋**

```bash
git add -A
git commit -m "[app] Add: lib/speech.ts Web Speech API 래퍼 + ChatInput 마이크·TTS 버튼 통합 (Phase 3-E)"
```

---

## Task 18: 3-F — app/history/page.tsx DreamSession 기반으로 재작성

**Files:**
- Modify: `app/history/page.tsx`

- [ ] **Step 1: app/history/page.tsx 재작성**

```tsx
// app/history/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HistoryList } from '@/components/HistoryList';
import { clearAll, deleteSession, listSessionsDesc } from '@/lib/db';
import type { DreamSession } from '@/lib/types';
import styles from './page.module.css';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<DreamSession[]>([]);

  useEffect(() => {
    listSessionsDesc(100)
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClearAll = async () => {
    if (!window.confirm('모든 대화를 삭제할까요?')) return;
    await clearAll();
    setSessions([]);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← 홈으로
        </Link>
        <h1 className={styles.title}>히스토리</h1>
        {sessions.length >= 3 && (
          <button type="button" onClick={handleClearAll} className={styles.clearBtn}>
            전체 삭제
          </button>
        )}
      </header>
      <HistoryList sessions={sessions} onDelete={handleDelete} />
    </main>
  );
}
```

이 페이지는 이미 `page.module.css`가 있다. 타입만 변경되므로 CSS 수정 불필요.

---

## Task 19: 3-F — app/session/[id]/page.tsx (읽기 전용 세션 뷰) 신규

**Files:**
- Create: `app/session/[id]/page.tsx`
- Create: `app/session/[id]/page.module.css`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p "app/session/[id]"
```

- [ ] **Step 2: app/session/[id]/page.module.css 생성**

```css
/* app/session/[id]/page.module.css */
.page {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  max-width: 720px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gugbab-space-4, 16px);
  border-bottom: 1px solid var(--gugbab-color-border-base, #cdced6);
}

.back {
  font-size: 14px;
  color: var(--gugbab-color-accent-base, #0090ff);
  text-decoration: none;
}

.meta {
  font-size: 12px;
  color: var(--gugbab-color-fg-muted, #80838d);
  text-align: right;
}

.readonlyNote {
  text-align: center;
  font-size: 12px;
  color: var(--gugbab-color-fg-muted, #80838d);
  padding: var(--gugbab-space-2, 8px);
  border-top: 1px solid var(--gugbab-color-border-base, #cdced6);
}

.notFound {
  text-align: center;
  padding: var(--gugbab-space-8, 32px);
  color: var(--gugbab-color-fg-secondary, #60646c);
}
```

- [ ] **Step 3: app/session/[id]/page.tsx 생성**

```tsx
// app/session/[id]/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChatView } from '@/components/ChatView';
import { getSession } from '@/lib/db';
import type { DreamSession } from '@/lib/types';
import styles from './page.module.css';

function formatDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export default function SessionPage({
  params,
}: {
  params: { id: string };
}) {
  const [session, setSession] = useState<DreamSession | null | 'loading'>('loading');

  useEffect(() => {
    getSession(params.id)
      .then((s) => setSession(s ?? null))
      .catch(() => setSession(null));
  }, [params.id]);

  if (session === 'loading') return null;

  if (!session) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <Link href="/history" className={styles.back}>
            ← 히스토리
          </Link>
        </header>
        <p className={styles.notFound}>대화를 찾을 수 없어요.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/history" className={styles.back}>
          ← 히스토리
        </Link>
        <div className={styles.meta}>
          <div>{formatDate(session.createdAt)}</div>
          <div>{session.messages.length}개 메시지</div>
        </div>
      </header>

      <ChatView
        messages={session.messages}
        streamingText=""
        isStreaming={false}
      />

      <p className={styles.readonlyNote}>
        읽기 전용 — 이어서 대화하려면{' '}
        <Link href="/" style={{ color: 'var(--gugbab-color-accent-base, #0090ff)' }}>
          홈으로
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 4: 타입체크**

```bash
pnpm typecheck
```

Expected: 에러 0.

- [ ] **Step 5: 3-F 커밋**

```bash
git add -A
git commit -m "[app] Add: /session/[id] 읽기 전용 페이지 + /history DreamSession 전환 (Phase 3-F)"
```

---

## Task 20: 3-G — E2E fixtures 업데이트

**Files:**
- Modify: `e2e/visual/_fixtures/sse-mock.ts`
- Modify: `e2e/visual/_fixtures/init-script.ts`

- [ ] **Step 1: sse-mock.ts /api/chat 포맷으로 재작성**

```ts
// e2e/visual/_fixtures/sse-mock.ts
import type { Route } from '@playwright/test';

const SAMPLE_AI_RESPONSE = `오 뱀 꿈이군요! 한국 전통 해몽에서 뱀은 재물이나 직관을 상징하는 경우가 많아요.
꿈에서 뱀이 어떤 상태였나요? 가만히 있었는지, 움직이고 있었는지에 따라 의미가 달라질 수 있어요 🐍`;

export function makeChunkedChatSse(text: string, sessionId: string, chunkSize = 30): string {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  const events = chunks.map(
    (t) => `data: ${JSON.stringify({ type: 'chunk', text: t })}\n\n`,
  );
  events.push(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
  return events.join('');
}

export async function mockChatRoute(route: Route, sessionId = 'test-session-id'): Promise<void> {
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
    body: makeChunkedChatSse(SAMPLE_AI_RESPONSE, sessionId),
  });
}
```

- [ ] **Step 2: init-script.ts sessions 스토어 seed로 재작성**

```ts
// e2e/visual/_fixtures/init-script.ts
export const FIXTURE_SCRIPT = `
  (() => {
    try {
      indexedDB.deleteDatabase('gugbab-dream');
    } catch {}

    let state = 42;
    Math.random = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };

    const FIXED_UUID = '00000000-0000-4000-8000-000000000000';
    if (crypto && 'randomUUID' in crypto) {
      crypto.randomUUID = () => FIXED_UUID;
    }

    const FROZEN = Date.UTC(2026, 4, 22, 0, 0, 0);
    Date.now = () => FROZEN;
  })();
`;

export function makeSeedSessionScript(opts: {
  id: string;
  summary: string;
  messages: Array<{ role: 'user' | 'model'; content: string; timestamp: number }>;
}): string {
  return `
    indexedDB.deleteDatabase('gugbab-dream');
    const req = indexedDB.open('gugbab-dream', 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) {
        const es = db.createObjectStore('entries', { keyPath: 'id' });
        es.createIndex('createdAt_idx', 'createdAt');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const ss = db.createObjectStore('sessions', { keyPath: 'id' });
        ss.createIndex('createdAt_idx', 'createdAt');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put(${JSON.stringify({
        id: opts.id,
        createdAt: Date.UTC(2026, 4, 21, 0, 0, 0),
        messages: opts.messages,
        summary: opts.summary,
        modelId: 'gemini-2.5-flash',
        schemaVersion: 2,
      })});
    };
  `;
}
```

---

## Task 21: 3-G — E2E spec 파일 업데이트

**Files:**
- Modify: `e2e/visual/routes.spec.ts`
- Modify: `e2e/visual/components.spec.ts`

- [ ] **Step 1: routes.spec.ts 업데이트**

`/result/[id]` 테스트를 `/session/[id]` 로 교체한다.

```ts
// e2e/visual/routes.spec.ts
import { expect, type Page, test } from '@playwright/test';
import { FIXTURE_SCRIPT, makeSeedSessionScript } from './_fixtures/init-script';
import { mockChatRoute } from './_fixtures/sse-mock';

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

test.describe('routes — visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FIXTURE_SCRIPT);
  });

  test('home', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expect(page).toHaveScreenshot('home.png', { fullPage: true });
  });

  test('home-with-messages', async ({ page }) => {
    const seedId = 'fixt01ULIDXXXXXXXXXXXXXXXX';
    await page.addInitScript(
      makeSeedSessionScript({
        id: seedId,
        summary: '뱀이 나오는 꿈을 꿨어요',
        messages: [
          { role: 'user', content: '뱀이 나오는 꿈을 꿨어요', timestamp: Date.UTC(2026, 4, 21, 0, 0, 1) },
          { role: 'model', content: '오 뱀 꿈이군요! 뱀이 어떤 상태였나요?', timestamp: Date.UTC(2026, 4, 21, 0, 0, 2) },
        ],
      }),
    );
    // 세션이 IDB에 있어도 홈은 새 빈 세션으로 시작 (최근 세션 목록만 표시)
    await page.goto('/');
    await settle(page);
    await expect(page).toHaveScreenshot('home-with-recent.png', { fullPage: true });
  });

  test('session-readonly', async ({ page }) => {
    const seedId = 'fixt01ULIDXXXXXXXXXXXXXXXX';
    await page.addInitScript(
      makeSeedSessionScript({
        id: seedId,
        summary: '뱀이 나오는 꿈을 꿨어요',
        messages: [
          { role: 'user', content: '뱀이 나오는 꿈을 꿨어요', timestamp: Date.UTC(2026, 4, 21, 0, 0, 1) },
          { role: 'model', content: '오 뱀 꿈이군요! 뱀이 어떤 상태였나요?', timestamp: Date.UTC(2026, 4, 21, 0, 0, 2) },
        ],
      }),
    );
    await page.goto(`/session/${seedId}`);
    await settle(page);
    await expect(page).toHaveScreenshot('session-readonly.png', { fullPage: true });
  });

  test('history-empty', async ({ page }) => {
    await page.goto('/history');
    await settle(page);
    await expect(page).toHaveScreenshot('history-empty.png', { fullPage: true });
  });
});
```

- [ ] **Step 2: components.spec.ts ToneChips·SafetyCard 제거, ChatInput spec 추가**

```ts
// e2e/visual/components.spec.ts
import { expect, test } from '@playwright/test';
import { FIXTURE_SCRIPT } from './_fixtures/init-script';

test.describe('components — visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FIXTURE_SCRIPT);
  });

  test('chat-input-idle', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // 입력 바 영역만 캡처
    const inputBar = page.locator('[aria-label="꿈 입력"]');
    await expect(inputBar).toBeVisible();
    // 부모 컨테이너 (입력 바 전체) 캡처
    await expect(page.locator('[aria-label="꿈 입력"]').locator('..').locator('..')).toHaveScreenshot('chat-input-idle.png');
  });

  test('history-list-with-sessions', async ({ page }) => {
    const { makeSeedSessionScript } = await import('./_fixtures/init-script');
    await page.addInitScript(
      makeSeedSessionScript({
        id: 'fixt01ULIDXXXXXXXXXXXXXXXX',
        summary: '뱀이 나오는 꿈을 꿨어요',
        messages: [
          { role: 'user', content: '뱀이 나오는 꿈을 꿨어요', timestamp: Date.UTC(2026, 4, 21, 0, 0, 1) },
          { role: 'model', content: '오 뱀 꿈이군요!', timestamp: Date.UTC(2026, 4, 21, 0, 0, 2) },
        ],
      }),
    );
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('history-with-sessions.png', { fullPage: true });
  });
});
```

- [ ] **Step 3: 타입체크**

```bash
pnpm typecheck
```

Expected: 에러 0.

- [ ] **Step 4: 기존 baseline 스냅샷 삭제 (새 UI와 맞지 않으므로)**

```bash
rm -rf e2e/visual/__screenshots__
```

- [ ] **Step 5: 개발 서버 실행 + 브라우저에서 수동 검증 (UI 확인)**

```bash
pnpm dev
```

브라우저에서 다음 경로 직접 확인:
- `http://localhost:3000/` — 채팅 홈, 메시지 전송 흐름
- `http://localhost:3000/history` — 세션 목록 (비어 있음)
- 메시지 전송 후 `/history` — 저장된 세션 확인
- 세션 클릭 → `/session/[id]` 읽기 전용 확인

- [ ] **Step 6: 새 baseline 생성**

```bash
pnpm test:visual:update
```

Expected: 스냅샷 신규 생성 (실패 없이). Linux CI 환경에서 최종 확정.

- [ ] **Step 7: 3-G 커밋**

```bash
git add -A
git commit -m "[test] Add: Phase 3-G 시각 회귀 spec 재작성 + 새 baseline 생성 (chat/session/history)"
```

---

## Self-Review Checklist

### 1. Spec coverage

| 스펙 항목 | 커버하는 Task |
|---|---|
| 안전 분류기 완전 제거 | Task 2, 3, 4 |
| /api/interpret 제거 | Task 4 |
| /api/chat 신규 | Task 9 |
| 통합 시스템 프롬프트 (7개 스킬) | Task 6 |
| lib/llm.ts 멀티턴 | Task 7 |
| ChatMessage / DreamSession 타입 | Task 1 |
| IDB v2 sessions 스토어 | Task 13 |
| ChatView + MessageBubble | Task 10, 11 |
| TypingIndicator | Task 10 |
| ChatInput (텍스트) | Task 12 |
| lib/speech.ts | Task 16 |
| ChatInput (마이크 + TTS) | Task 17 |
| 홈 페이지 채팅 UI | Task 14 |
| HistoryList DreamSession 전환 | Task 15 |
| /history 페이지 업데이트 | Task 18 |
| /session/[id] 신규 | Task 19 |
| E2E spec 업데이트 | Task 20, 21 |

### 2. Type consistency check

- `ChatMessage.role`: `'user' | 'model'` — Task 1 정의, Task 9(/api/chat), Task 13(db.ts), Task 14(page.tsx) 모두 일치
- `DreamSession.schemaVersion`: `2 as const` — Task 1, Task 13, Task 14 일치
- `saveSession` / `getSession` / `listSessionsDesc` / `deleteSession` — Task 13에서 정의, Task 14·18·19에서 사용, 모두 일치
- `ChatSseEvent` — Task 1 정의, Task 9에서 send() 파라미터 타입으로 사용, Task 14에서 파싱 시 캐스팅
- `getChatStream` — Task 7 정의, Task 9에서 호출. 파라미터 타입 `Array<{role: 'user'|'model'; content: string}>` 일치
- `getChatSystemPrompt` — Task 6에서 export, Task 8(index.ts)에서 re-export, Task 7(llm.ts)에서 import

### 3. No placeholder scan

모든 Task에 실제 코드가 포함되어 있음을 확인. TBD/TODO 없음.
