# 히스토리 대화 이어하기 (Session Resume) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 히스토리에서 연 과거 대화를 홈과 완전히 동일한 대화 화면에서 이어서 계속할 수 있게 한다.

**Architecture:** 홈 화면 전체(헤더 포함)를 `components/ChatScreen.tsx`로 추출하고, `useChatSession`에 `initialSession` 옵션을 추가한다. `/session/[id]`는 IDB 로드 후 `<ChatScreen initialSession={...}>`을 렌더한다. 이어한 대화는 같은 세션 id로 저장된다.

**Tech Stack:** Next.js App Router, React 19, TypeScript, vitest 4 (SSR renderToString 스타일), CSS Modules

**프로젝트 규칙 (CLAUDE.md 우선):**
- **커밋·푸시 금지** — 사용자가 명시 요청할 때만. 이 계획에는 커밋 단계가 없다. 작업 완료 후 분리 계획만 보고
- main 직접 작업 금지 — 시작 전 feature 브랜치 생성
- `use client` 최소화, `any` 금지, `console.log` 금지
- git 쓰기 명령은 Cursor index.lock 경합 대비 재시도 (실패 시 1초 간격 최대 5회)

---

### Task 0: feature 브랜치 생성

**Files:** 없음 (git만)

- [ ] **Step 1: 브랜치 생성**

Run: `git checkout -b feature/session-resume`
Expected: `Switched to a new branch 'feature/session-resume'` (index.lock 에러 시 1초 후 재시도, 최대 5회)

---

### Task 1: useChatSession에 initialSession 옵션 추가

**Files:**
- Modify: `lib/useChatSession.ts`
- Test: `lib/useChatSession.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/useChatSession.test.ts`의 `probe` 헬퍼를 옵션 전달형으로 확장하고 테스트 추가:

```ts
// 기존 probe 함수를 아래로 교체 (options 인자 추가, 기본값 {})
function probe(render: (r: UseChatSessionReturn) => string, options: UseChatSessionOptions = {}) {
    function Probe() {
        const r = useChatSession(options);
        return createElement("output", null, render(r));
    }
    const html = renderToString(createElement(Probe));
    return html.replace(/<\/?output>/g, "");
}
```

import에 `UseChatSessionOptions` 타입 추가:

```ts
import type { UseChatSessionOptions, UseChatSessionReturn } from "./useChatSession";
```

describe 블록 안에 테스트 추가:

```ts
it("hydrates from initialSession when provided", () => {
    const initial = {
        id: "01TEST",
        createdAt: 1700000000000,
        messages: [
            { role: "user" as const, content: "이 빠지는 꿈", timestamp: 1700000000000 },
            { role: "model" as const, content: "치아 꿈은…", timestamp: 1700000001000 },
        ],
        summary: "이 빠지는 꿈",
        modelId: "haiku",
        schemaVersion: 2,
    };
    expect(probe((r) => r.session?.id ?? "none", { initialSession: initial })).toBe("01TEST");
    expect(probe((r) => String(r.session?.messages.length), { initialSession: initial })).toBe("2");
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/useChatSession.test.ts`
Expected: FAIL — `initialSession`이 `UseChatSessionOptions`에 없음 (tsc/타입 에러 또는 session이 null)

- [ ] **Step 3: 최소 구현**

`lib/useChatSession.ts`:

```ts
export interface UseChatSessionOptions {
    /** 목록으로 검증된 경우에만 전달 — 미전달 시 relay 기본 모델에 위임 (폐기된 alias 전송 방지) */
    readonly model?: string;
    /** 어시스턴트 응답 완료 시 호출 (TTS 낭독 등) */
    readonly onAssistantComplete?: (text: string) => void;
    /** 과거 세션 이어하기 — 초기 세션 상태로 주입 (히스토리 → 세션 페이지) */
    readonly initialSession?: DreamSession | null;
}
```

훅 시그니처와 useState 초기값 변경:

```ts
export function useChatSession({
    model,
    onAssistantComplete,
    initialSession,
}: UseChatSessionOptions): UseChatSessionReturn {
    const [session, setSession] = useState<DreamSession | null>(initialSession ?? null);
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run lib/useChatSession.test.ts`
Expected: PASS (기존 테스트 포함 전부)

---

### Task 2: ChatScreen 컴포넌트 추출 (홈 화면 전체 이동)

**Files:**
- Create: `components/ChatScreen.tsx`
- Create: `components/ChatScreen.module.css` (기존 `app/page.module.css` 내용 이동)
- Create: `components/ChatScreen.test.tsx`
- Modify: `app/page.tsx` (ChatScreen 렌더만 남김)
- Modify: `app/page.test.tsx` (그대로 유지 — 통과 확인용)

- [ ] **Step 1: 실패하는 테스트 작성**

`components/ChatScreen.test.tsx` 생성:

```tsx
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DreamSession } from "@/lib/types";
import { ChatScreen } from "./ChatScreen";

const pastSession: DreamSession = {
    id: "01PAST",
    createdAt: 1700000000000,
    messages: [
        { role: "user", content: "바다에서 헤엄치는 꿈", timestamp: 1700000000000 },
        { role: "model", content: "바다는 무의식을 상징하기도 해요", timestamp: 1700000001000 },
    ],
    summary: "바다에서 헤엄치는 꿈",
    modelId: "haiku",
    schemaVersion: 2,
};

describe("ChatScreen", () => {
    it("renders home header (title, model chip placeholder, history link)", () => {
        const html = renderToString(<ChatScreen />);
        expect(html).toContain("꿈해몽");
        expect(html).toContain("모델");
        expect(html).toContain("히스토리");
    });

    it("renders chat input", () => {
        const html = renderToString(<ChatScreen />);
        expect(html).toContain("꿈을 이야기해보세요");
    });

    it("renders past messages when initialSession is provided", () => {
        const html = renderToString(<ChatScreen initialSession={pastSession} />);
        expect(html).toContain("바다에서 헤엄치는 꿈");
        expect(html).toContain("바다는 무의식을 상징하기도 해요");
    });

    it("resume mode renders new-session control as a link to home", () => {
        const html = renderToString(<ChatScreen initialSession={pastSession} />);
        expect(html).toContain("새 꿈 이야기하기");
        expect(html).toMatch(/href="\/"/);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run components/ChatScreen.test.tsx`
Expected: FAIL — `./ChatScreen` 모듈 없음

- [ ] **Step 3: 구현 — 파일 이동·추출**

1. `app/page.module.css` → `components/ChatScreen.module.css` 로 내용 전체 이동 (클래스명 변경 없음).
   `app/page.module.css`는 삭제.
2. `components/ChatScreen.tsx` 생성 — 현재 `app/page.tsx` 본문을 그대로 가져오되:
   - 컴포넌트명 `ChatScreen`, named export, props `{ initialSession?: DreamSession }`
   - `useChatSession({...})` 호출에 `initialSession` 전달
   - "새 꿈 이야기하기": resume 모드(= `initialSession` 존재)면 `<Link href="/">`, 아니면 기존 button
   - styles import는 `./ChatScreen.module.css`

```tsx
"use client";

import { capitalize } from "@gugbab/utils";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { ChatView } from "@/components/ChatView";
import { InstallButton } from "@/components/install/InstallButton";
import ModelSheet from "@/components/ModelSheet";
import { useSpeak } from "@/lib/speech";
import type { DreamSession } from "@/lib/types";
import { useChatSession } from "@/lib/useChatSession";
import { useModelSelection } from "@/lib/useModelSelection";
import styles from "./ChatScreen.module.css";

interface ChatScreenProps {
    /** 과거 세션 이어하기 — 전달 시 해당 대화가 채워진 상태로 시작 */
    initialSession?: DreamSession;
}

export function ChatScreen({ initialSession }: ChatScreenProps) {
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const { speak, supported: ttsSupported } = useSpeak();
    const { models, model, selectModel } = useModelSelection();

    // SSR hydration mismatch 방지 — 마운트 후 localStorage에서 읽음
    useEffect(() => {
        setTtsEnabled(localStorage.getItem("tts-enabled") === "true");
    }, []);

    const handleAssistantComplete = useCallback(
        (text: string) => {
            if (ttsEnabled && ttsSupported) speak(text);
        },
        [ttsEnabled, ttsSupported, speak],
    );

    const { session, streamingText, isStreaming, errorMsg, sendMessage, startNewSession } = useChatSession({
        // 목록으로 검증된 경우에만 model 전달 — 미로드 시 relay 기본값에 위임 (폐기된 alias 전송 방지)
        model: models ? model : undefined,
        onAssistantComplete: handleAssistantComplete,
        initialSession,
    });

    const handleSelectModel = (alias: string) => {
        selectModel(alias);
        setSheetOpen(false);
    };

    const showNewSession = session && session.messages.length > 0 && !isStreaming;

    return (
        <main className={styles.home}>
            <header className={styles.header}>
                <h1 className={styles.title}>꿈해몽 💬</h1>
                <nav className={styles.headerActions}>
                    <button
                        type="button"
                        className={styles.modelChip}
                        onClick={() => setSheetOpen(true)}
                        disabled={isStreaming || !models}
                        aria-haspopup="dialog"
                    >
                        {models ? capitalize(model) : "모델"} <span aria-hidden>▾</span>
                    </button>
                    <InstallButton />
                    <Link href="/history" className={styles.historyLink}>
                        히스토리
                    </Link>
                </nav>
            </header>

            <ChatView messages={session?.messages ?? []} streamingText={streamingText} isStreaming={isStreaming} />

            {errorMsg && (
                <div className={styles.errorBanner} role="alert">
                    <span aria-hidden>⚠️</span>
                    <span>{errorMsg}</span>
                </div>
            )}

            {showNewSession &&
                // resume 모드에서 새 대화를 시작하면 URL(/session/[id])과 state가 어긋나므로 홈으로 이동
                (initialSession ? (
                    <Link href="/" className={styles.newSessionBtn}>
                        새 꿈 이야기하기
                    </Link>
                ) : (
                    <button type="button" onClick={startNewSession} className={styles.newSessionBtn}>
                        새 꿈 이야기하기
                    </button>
                ))}

            <ChatInput
                onSend={sendMessage}
                disabled={isStreaming}
                ttsEnabled={ttsEnabled}
                onTtsToggle={() =>
                    setTtsEnabled((v) => {
                        const next = !v;
                        localStorage.setItem("tts-enabled", String(next));
                        return next;
                    })
                }
            />

            {sheetOpen && models && (
                <ModelSheet
                    models={models}
                    selected={model}
                    onSelect={handleSelectModel}
                    onClose={() => setSheetOpen(false)}
                />
            )}
        </main>
    );
}
```

3. `app/page.tsx` 를 아래로 교체 (`"use client"` 제거 — 서버 컴포넌트化):

```tsx
import { ChatScreen } from "@/components/ChatScreen";

export default function HomePage() {
    return <ChatScreen />;
}
```

`.newSessionBtn`이 `<Link>`(anchor)로도 쓰이므로 `ChatScreen.module.css`의 해당 클래스에
`text-decoration: none; text-align: center;` 가 없으면 추가한다 (button 전용 스타일 확인).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run components/ChatScreen.test.tsx app/page.test.tsx`
Expected: PASS — ChatScreen 4개 + 기존 HomePage 테스트 그대로 GREEN

---

### Task 3: 세션 페이지를 ChatScreen 기반으로 교체

**Files:**
- Modify: `app/session/[id]/page.tsx`
- Modify: `app/session/[id]/page.module.css` (not-found·back 스타일만 남김)

- [ ] **Step 1: 구현**

`app/session/[id]/page.tsx` 를 아래로 교체 (읽기 전용 뷰·메타 헤더·안내 문구 제거):

```tsx
"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ChatScreen } from "@/components/ChatScreen";
import { getSession } from "@/lib/db";
import type { DreamSession } from "@/lib/types";
import styles from "./page.module.css";

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [session, setSession] = useState<DreamSession | null | "loading">("loading");

    useEffect(() => {
        getSession(id)
            .then((s) => setSession(s ?? null))
            .catch(() => setSession(null));
    }, [id]);

    if (session === "loading") return null;

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

    return <ChatScreen initialSession={session} />;
}
```

`page.module.css`에서 삭제된 요소(meta, readonlyNote 등)의 미사용 클래스를 제거하고
`.page`·`.header`·`.back`·`.notFound`만 남긴다.

- [ ] **Step 2: 전체 검증**

Run: `npx vitest run && npx tsc --noEmit && npx biome check .`
Expected: 전체 테스트 PASS, 타입 에러 0, lint 경고 0

---

### Task 4: 수동 E2E + 대시보드 갱신

**Files:**
- Modify: `docs/superpowers/specs/dream-app.html`

- [ ] **Step 1: dev 서버 수동 확인**

Run: `pnpm dev` 후 브라우저에서:
1. 홈에서 새 대화 1회 (기존 동작 회귀 없음)
2. 히스토리 → 과거 대화 진입 → 과거 메시지 표시 + 하단 입력창 존재
3. 이어서 메시지 전송 → 스트리밍 정상 → 히스토리 목록에서 메시지 수 증가 확인
4. 세션 페이지 "새 꿈 이야기하기" → 홈 이동

- [ ] **Step 2: 대시보드 갱신**

`docs/superpowers/specs/dream-app.html`에 "히스토리 대화 이어하기" 단계 추가
(기존 단계 카드 형식 그대로 따름 — 이력 압축 v2 항목 참고).

- [ ] **Step 3: codex 적대적 리뷰**

`.claude/rules/codex-review.md`의 실행 조건 3가지 확인 후 충족 시 리뷰 실행
(최대 3라운드, ACCEPT/REJECT 판정 보고). 완료 후 `touch .claude/.codex-review-done`.

- [ ] **Step 4: 완료 보고**

테스트·typecheck·lint 결과와 함께 커밋 분리 계획([app] 기능 / [docs] 대시보드)을
보고하고 **커밋은 사용자 요청을 기다린다**.
