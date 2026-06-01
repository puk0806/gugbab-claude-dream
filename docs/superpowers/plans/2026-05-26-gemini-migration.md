# Gemini Flash 전환 구현 계획

> Anthropic Claude → Google Gemini Flash 교체. 무료 한도 내에서 동일 기능 유지.

**Goal:** 사용자가 만든 도메인 자산(`.claude/skills/humanities/*`, `.claude/agents/{research,validation}/dream-*`)은 그대로 유지하고, LLM 호출 레이어만 Gemini Flash로 교체해 결제 부담 없이 dream 앱을 베타 운영 가능하게 한다.

**Architecture:**
- 자산 컴파일러(`scripts/compile-prompts.ts`) + 컴파일 결과(`lib/prompts/_compiled/*.ts`) + 톤별 system prompt 조립(`lib/prompts/{casual,reflective,traditional,safety,index}.ts`) **모두 그대로**
- LLM 호출 레이어만 `@anthropic-ai/sdk` → `@google/genai`로 교체
- SSE 스트리밍 인터페이스(`InterpretSseEvent`) 동일 — 클라이언트 측 result 페이지·SafetyResourceCard 무변경
- 안전 분류기: Gemini Flash + `responseMimeType: application/json` + `responseSchema`로 JSON 강제

**Tech Stack:**
- 신규: `@google/genai` (Google Gen AI SDK, 공식)
- 제거: `@anthropic-ai/sdk`
- 모델: `gemini-2.5-flash` (해몽) + `gemini-2.5-flash` (안전 분류 — 같은 모델, system 다름)
- 무료 한도: 분당 15 RPM · 일 1,500 req · 토큰 1M/일

---

## 사전 조건

- [ ] **0.1** Google AI API 키 발급: https://aistudio.google.com/apikey → `AIza...` 키 생성
- [ ] **0.2** `.env.local`에 `GEMINI_API_KEY=AIza...` 입력 (사용자 본인 터미널에서)
- [ ] **0.3** 현재 브랜치: `feature/writing-plan-phase-2` (Phase 2 코드 누적 상태 — 같은 브랜치에 이어서)

---

## Task 1: 패키지 교체

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Anthropic SDK 제거 + Gemini SDK 설치**

```bash
pnpm remove @anthropic-ai/sdk
pnpm add @google/genai
```

- [ ] **Step 2: 설치 확인**

```bash
pnpm list @google/genai --depth 0
```

---

## Task 2: `lib/llm.ts` 작성 (Anthropic 래퍼 → Gemini 래퍼)

**Files:**
- Delete: `lib/claude.ts`
- Create: `lib/llm.ts`

- [ ] **Step 1: lib/claude.ts 제거**

```bash
rm lib/claude.ts
```

- [ ] **Step 2: lib/llm.ts 작성**

```ts
/**
 * Google Gen AI (Gemini Flash) 클라이언트 + 톤별 system instruction + 스트리밍.
 *
 * 우리 자산(.claude/skills/humanities + .claude/agents/{research,validation}/dream-*)을
 * lib/prompts/_compiled/* 로 컴파일한 결과를 system instruction 에 그대로 박는다.
 *
 * 응답: AsyncIterable of chunks — API Route 에서 SSE 인코딩.
 */
import { GoogleGenAI } from '@google/genai';
import { getSystemPrompt } from './prompts';
import type { Tone } from './types';

const MODEL_ID = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const MAX_TOKENS = 1024;
const TEMPERATURE = 0.7;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function getInterpretStream(tone: Tone, dreamText: string) {
  return ai.models.generateContentStream({
    model: MODEL_ID,
    config: {
      systemInstruction: getSystemPrompt(tone),
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
    },
    contents: [{ role: 'user', parts: [{ text: dreamText }] }],
  });
}

export function getModelId(): string {
  return MODEL_ID;
}
```

---

## Task 3: `lib/safety.ts` 갱신 (Haiku → Gemini Flash + JSON schema)

**Files:**
- Modify: `lib/safety.ts`

- [ ] **Step 1: lib/safety.ts 전체 교체**

```ts
/**
 * 안전 분류기 — Gemini Flash + JSON schema 강제.
 *
 * 보수 분기:
 *   - timeout (3s 초과) → 안전 카드 강제
 *   - 5xx / 파싱 실패 → 안전 카드 강제
 *   - confidence < 0.6 → 안전 카드 강제
 */
import { GoogleGenAI, Type } from '@google/genai';
import { getSafetyClassifierPrompt } from './prompts';
import type { SafetyVerdict } from './types';

const TIMEOUT_MS = 3000;
const SAFE_CONFIDENCE_THRESHOLD = 0.6;
const SAFETY_MODEL = process.env.GEMINI_SAFETY_MODEL ?? 'gemini-2.5-flash';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function conservativeVerdict(reason: string): SafetyVerdict {
  return {
    category: 'severe_distress',
    confidence: 0.0,
    rationale: `보수적 분기: ${reason}`,
  };
}

export async function classifySafety(dreamText: string): Promise<SafetyVerdict> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: SAFETY_MODEL,
      config: {
        systemInstruction: getSafetyClassifierPrompt(),
        temperature: 0,
        maxOutputTokens: 200,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              enum: [
                'null',
                'self_harm',
                'trauma',
                'violence_toward_others',
                'severe_distress',
              ],
            },
            confidence: { type: Type.NUMBER },
            rationale: { type: Type.STRING },
          },
          required: ['category', 'confidence'],
        },
        abortSignal: controller.signal,
      },
      contents: [{ role: 'user', parts: [{ text: dreamText }] }],
    });

    const text = response.text ?? '';
    if (!text) {
      return conservativeVerdict('빈 응답');
    }

    const parsed = JSON.parse(text) as SafetyVerdict;
    if (!parsed.category || typeof parsed.confidence !== 'number') {
      return conservativeVerdict('스키마 불일치');
    }
    return parsed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return conservativeVerdict(msg);
  } finally {
    clearTimeout(timer);
  }
}

export function isSafe(verdict: SafetyVerdict): boolean {
  return verdict.category === 'null' && verdict.confidence >= SAFE_CONFIDENCE_THRESHOLD;
}
```

---

## Task 4: `app/api/interpret/route.ts` SSE 매핑 갱신

**Files:**
- Modify: `app/api/interpret/route.ts`

- [ ] **Step 1: getInterpretStream import 경로 변경**

`@/lib/claude` → `@/lib/llm`

- [ ] **Step 2: Gemini chunk 이벤트 매핑**

```ts
// 기존: Anthropic content_block_delta
// for await (const event of llmStream) {
//   if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
//     send({ type: 'chunk', delta: event.delta.text });
//   }
// }

// 신: Gemini chunks — chunk.text 가 누적 텍스트가 아닌 delta
for await (const chunk of llmStream) {
  const delta = chunk.text;
  if (delta) {
    send({ type: 'chunk', delta });
  }
}
```

`@/lib/llm` 의 `getInterpretStream` 과 `getModelId` 모두 동일 인터페이스 유지 → 다른 코드 변경 불필요.

---

## Task 5: `.env.example` 갱신

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: ANTHROPIC_API_KEY 제거 + GEMINI_API_KEY 추가**

```bash
# Google AI API Key — 서버 전용. 클라이언트 노출 금지.
# https://aistudio.google.com/apikey 에서 발급 (무료)
GEMINI_API_KEY=AIza...

# 선택: 모델 ID 오버라이드 (기본: gemini-2.5-flash)
# GEMINI_MODEL=gemini-2.5-flash

# 선택: 안전 분류 모델 ID (기본: gemini-2.5-flash)
# GEMINI_SAFETY_MODEL=gemini-2.5-flash
```

---

## Task 6: 검증

- [ ] **Step 1**: `pnpm typecheck` → 0 error
- [ ] **Step 2**: `pnpm check` (Biome) → 0 error
- [ ] **Step 3**: `pnpm build --webpack` → 5 routes detect
- [ ] **Step 4**: dev 서버 띄우고 `curl -X POST /api/interpret` 호출 → 정상 응답 확인 (사용자가 키 입력 후)

---

## Task 7: spec 동기 갱신

- [ ] `docs/superpowers/specs/2026-05-16-dream-app-todo.md` — 변경 로그 추가 (Gemini 전환 1건)
- [ ] `docs/superpowers/specs/dream-app.html` — 기술 스택 표 + 헤더 배지 갱신
- [ ] `README.md` — 기술 스택·환경변수·키 발급 URL 갱신
