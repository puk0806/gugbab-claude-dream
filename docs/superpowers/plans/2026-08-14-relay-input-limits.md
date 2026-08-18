# relay 입력 상한 대응 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** relay가 2026-08-14부터 강제하는 입력 상한(합산 100KB 등)에 대해 사전 가드 + 400 자동 복구를 붙여, 긴 대화에서도 400 없이 계속 대화 가능하게 한다.

**Architecture:** `@gugbab/utils` 1.3.0의 공유 유틸(`fitMessagesToBudget`/`isHistoryValidationError`)을 프록시(`/api/chat`)에 적용한다 — role 변환(model→assistant)이 프록시에서 일어나므로 유틸 타입과 자연스럽게 맞는 위치다. 상한 상수는 앱 로컬 `lib/relay-limits.ts`. 입력창은 기존 앱 상한(4,000자)으로 제한한다. 바이트 계산·드롭 로직 재구현 금지.

**Tech Stack:** Next.js App Router, @gugbab/utils 1.3.0, vitest 4 (기존 route 테스트: mock fetch + importRoute 패턴)

**배경 (검증 완료):**
- relay 상한: 메시지 1건 20,000자 / 개수 100 / 합산 UTF-8 100,000바이트 / systemPrompt 20,000자 → 초과 시 400 `VALIDATION_ERROR` + `violation`("history-budget" | "message-size")
- dream 현황: 클라이언트 압축(30개·4,000자·요약 대체)은 기구현 — 그러나 합산 바이트 가드 없음 (최악 ~360KB). wantSummary(항목 3)는 기구현이라 이 계획에서 제외
- dream systemPrompt 실측 626B/1,310B — 상한 무관

**프로젝트 규칙 (CLAUDE.md 우선):**
- **커밋·푸시 금지** — 사용자가 명시 요청할 때만. 이 계획에 커밋 단계 없음
- main 직접 작업 금지 — 시작 전 feature 브랜치 생성
- `any` 금지, `console.log` 금지, git 쓰기 명령은 index.lock 경합 대비 재시도

---

### Task 0: feature 브랜치 생성 + 패키지 업그레이드

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: 브랜치 생성**

Run: `git checkout -b feature/relay-input-limits` (lock 에러 시 1초 간격 재시도 최대 5회)

- [ ] **Step 2: @gugbab/utils 1.3.0 업그레이드**

Run: `pnpm add @gugbab/utils@1.3.0`
검증: `npx tsx -e "import { fitMessagesToBudget, isHistoryValidationError, totalContentBytes, compressHistory } from '@gugbab/utils'; console.log(typeof fitMessagesToBudget, typeof isHistoryValidationError)"`
Expected: `function function`

- [ ] **Step 3: 기존 테스트 회귀 확인**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 전부 PASS (utils 1.2.0→1.3.0은 추가만 있는 마이너 업)

---

### Task 1: lib/relay-limits.ts + 프록시 사전 가드·400 대응 (TDD)

**Files:**
- Create: `lib/relay-limits.ts`
- Modify: `app/api/chat/route.ts`
- Test: `app/api/chat/__tests__/route.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`app/api/chat/__tests__/route.test.ts`의 기존 describe 안에 추가 (기존 `mockFetch`/`importRoute`/`makeRequest`/`mockRelaySse` 헬퍼 재사용):

```ts
describe("relay 입력 상한 대응", () => {
    // 4,000자 한글 = 12,000 UTF-8 bytes
    const bigContent = "가".repeat(4000);
    const bigHistory = (count: number) =>
        Array.from({ length: count }, (_, i) => ({
            role: i % 2 === 0 ? ("user" as const) : ("model" as const),
            content: bigContent,
        }));

    it("pre-guard: drops oldest turns so total content stays within budget", async () => {
        mockRelaySse('data: {"type":"done"}\n\n');
        const { POST } = await importRoute();
        // 9개 × 12KB = 108KB > 예산 90KB → 오래된 왕복 드롭
        const res = await POST(makeRequest({ messages: bigHistory(9), sessionId: "s1" }) as never);
        expect(res.status).toBe(200);

        const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        const sent = JSON.parse(options.body as string) as { messages: Array<{ role: string; content: string }> };
        const totalBytes = sent.messages.reduce((n, m) => n + new TextEncoder().encode(m.content).byteLength, 0);
        expect(totalBytes).toBeLessThanOrEqual(90_000);
        expect(sent.messages.length).toBeLessThan(9);
        expect(sent.messages[0]?.role).toBe("user");
        expect(sent.messages[sent.messages.length - 1]?.role).toBe("user");
    });

    it("retries once with tighter trim on 400 history-budget, then streams", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ errorCode: "VALIDATION_ERROR", violation: "history-budget", message: "..." }), {
                status: 400,
                headers: { "content-type": "application/json" },
            }),
        );
        mockRelaySse('data: {"type":"chunk","text":"이어서"}\n\ndata: {"type":"done"}\n\n');

        const { POST } = await importRoute();
        const res = await POST(makeRequest({ messages: bigHistory(5), sessionId: "s1" }) as never);
        expect(res.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        const [, retryOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
        const retried = JSON.parse(retryOptions.body as string) as { messages: unknown[] };
        expect(retried.messages.length).toBeLessThanOrEqual(5);
        const text = await res.text();
        expect(text).toContain("이어서");
    });

    it("does NOT retry on 400 message-size — returns guidance error event", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ errorCode: "VALIDATION_ERROR", violation: "message-size", message: "..." }), {
                status: 400,
                headers: { "content-type": "application/json" },
            }),
        );
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({ messages: [{ role: "user", content: "뱀 꿈" }], sessionId: "s1" }) as never,
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const text = await res.text();
        expect(text).toContain('"type":"error"');
        expect(text).toContain("줄여");
    });

    it("still returns generic error for non-limit 400 (retry disabled)", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ errorCode: "VALIDATION_ERROR", message: "bad model" }), {
                status: 400,
                headers: { "content-type": "application/json" },
            }),
        );
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({ messages: [{ role: "user", content: "뱀 꿈" }], sessionId: "s1" }) as never,
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const text = await res.text();
        expect(text).toContain("릴레이 서버 오류가 발생했어요");
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run app/api/chat/__tests__/route.test.ts`
Expected: 신규 4건 FAIL (pre-guard 미적용·400이 SSE 아닌 기존 경로)

- [ ] **Step 3: 구현**

`lib/relay-limits.ts` 생성:

```ts
/**
 * relay 입력 상한 로컬 상수 — 참조 소스: relay openapi `x-relay-limits`
 * (GET {RELAY_URL}/api/openapi.json, 2026-08-14 배포 스펙).
 * 값이 어긋나도 400 재시도 경로가 런타임에 흡수하므로 동기화 파이프라인은 두지 않는다.
 */
export const RELAY_LIMITS = {
    maxMessageContentChars: 20_000,
    maxMessagesCount: 100,
    maxTotalContentBytes: 100_000,
    maxCustomPromptChars: 20_000,
} as const;

/** 사전 가드 예산 — relay 합산 상한에서 안전 마진(10%)을 둔 값 */
export const OUTGOING_BUDGET_BYTES = 90_000;

/** 400(history-budget) 재시도 시 유지할 최대 메시지 수 — 2왕복 + 현재 user 턴 */
export const RETRY_MAX_MESSAGES = 5;
```

`app/api/chat/route.ts` 수정:

1. import 추가·변경:
```ts
import { fitMessagesToBudget, isHistoryValidationError, toSSELine } from "@gugbab/utils";
import { OUTGOING_BUDGET_BYTES, RELAY_LIMITS, RETRY_MAX_MESSAGES } from "@/lib/relay-limits";
```
2. role 변환 직후 사전 가드 적용:
```ts
    // relay 합산 바이트·개수 상한 사전 가드 — 오래된 왕복부터 드롭해 400 왕복 자체를 줄인다
    const fitted = fitMessagesToBudget(messages, OUTGOING_BUDGET_BYTES, RELAY_LIMITS.maxMessagesCount);
    if (fitted.length === 0) {
        return new Response(JSON.stringify({ error: "입력을 확인해주세요" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }
```
3. relay 호출을 헬퍼로 추출하고 400 분기 추가 — 기존 fetch 블록을 아래 구조로 교체:
```ts
    const callRelay = (msgs: typeof fitted) =>
        fetch(`${relayUrl}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Relay-Secret": relaySecret,
            },
            body: JSON.stringify({
                app: "dream",
                systemPrompt,
                messages: msgs,
                // done 이벤트에 답변 요약(한국어 1~3문장, best-effort) 요청 — 이력 압축에 사용
                wantSummary: true,
                ...(parsed.model ? { model: parsed.model } : {}),
            } satisfies RelayChatBody),
            signal: req.signal,
        });

    let relayRes: Response;
    try {
        relayRes = await callRelay(fitted);

        if (relayRes.status === 400) {
            let body: { errorCode?: string; violation?: string } = {};
            try {
                body = (await relayRes.json()) as { errorCode?: string; violation?: string };
            } catch {
                // 본문 파싱 실패 — 아래 일반 오류 경로로
            }
            if (isHistoryValidationError(body)) {
                // 이력 총량 초과 — 최근 왕복만 남기고 1회 재시도 (꿈 해몽은 직전 맥락으로 충분)
                relayRes = await callRelay(fitMessagesToBudget(fitted, OUTGOING_BUDGET_BYTES, RETRY_MAX_MESSAGES));
            } else if (body.violation === "message-size") {
                // 개별 메시지 길이 초과 — 드롭으로 복구 불가, 재시도 금지
                return new Response(errorStream("메시지가 너무 길어요. 조금 줄여서 다시 보내주세요."), {
                    headers: SSE_HEADERS,
                });
            }
        }
    } catch {
        return new Response(errorStream("릴레이 서버에 연결할 수 없어요"), {
            headers: SSE_HEADERS,
        });
    }
```
4. 이후 기존 `if (!relayRes.ok || !relayRes.body)` 일반 오류 경로와 `injectDoneFields` 반환은 그대로 유지.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run app/api/chat/__tests__/route.test.ts && npx vitest run && npx tsc --noEmit`
Expected: 신규 4건 포함 전부 PASS (adversarial 테스트 포함)

---

### Task 2: ChatInput 입력 길이 제한 (TDD)

**Files:**
- Modify: `components/ChatInput.tsx`
- Test: `components/ChatInput.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성** (기존 테스트 파일 스타일 확인 후 동일 스타일로)

```tsx
it("limits input length to the app message cap", () => {
    const html = renderToString(
        <ChatInput onSend={() => {}} ttsEnabled={false} onTtsToggle={() => {}} />,
    );
    expect(html).toContain('maxLength="4000"');
});
```

(기존 테스트가 다른 render 헬퍼를 쓰면 그 헬퍼 재사용. props 시그니처는 실제 파일 확인 후 맞출 것)

- [ ] **Step 2: 실패 확인** — `npx vitest run components/ChatInput.test.tsx` Expected: FAIL

- [ ] **Step 3: 구현**

`components/ChatInput.tsx`:
1. `import { MESSAGE_LIMITS } from "@/lib/chat-history";`
2. textarea에 `maxLength={MESSAGE_LIMITS.maxContentLength}` 추가
3. 음성 인식 최종 결과 append는 maxLength 속성을 우회하므로 클램프:
```ts
setText((prev) => (prev ? `${prev} ${transcript}` : transcript).slice(0, MESSAGE_LIMITS.maxContentLength));
```

- [ ] **Step 4: 통과 확인** — `npx vitest run components/ChatInput.test.tsx && npx tsc --noEmit` Expected: PASS

---

### Task 3: 전체 검증 + 실측 + 대시보드

**Files:**
- Modify: `docs/superpowers/specs/dream-app.html`

- [ ] **Step 1: 전체 게이트**

Run: `npx vitest run && npx tsc --noEmit && npx biome check .`
Expected: 전부 클린

- [ ] **Step 2: 실측 (프로덕션 relay 대상)**

`pnpm dev` 후: 짧은 대화 1회 정상 확인. (합산 초과 실측은 mock 테스트로 갈음 — 실제 100KB 초과 대화를 만드는 것은 비용·시간상 비현실적, pre-guard가 mock으로 검증됨)

- [ ] **Step 3: 대시보드 갱신**

`docs/superpowers/specs/dream-app.html`에 "relay 입력 상한 대응" 단계 카드 추가 (기존 카드 형식).

- [ ] **Step 4: codex 적대적 리뷰**

`.claude/rules/codex-review.md` 조건 3종 확인 → 리뷰 실행 → `touch .claude/.codex-review-done`

- [ ] **Step 5: 완료 보고** — 커밋 분리 계획 보고 후 **사용자 요청 대기**
