# 꿈해몽 PWA — Phase 2 + Phase 2-B 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 부트스트랩 셸 위에 핵심 해몽 기능(톤 프롬프트 3종 · Anthropic SSE 스트리밍 · 안전 분류기 · IndexedDB 100건 LRU · UI 컴포넌트 5종 · 라우트 3종)을 얹고, 동시에 Phase 2-B로 시각 회귀 spec을 확장(라우트 3건 + 컴포넌트 spec + LLM SSE mock fixture)해 MVP 안정화 단계(3단계) 진입 가능한 상태를 만든다.

**Architecture:**
- Anthropic SDK Messages API + 프롬프트 캐싱 + SSE 스트리밍 (서버 → 클라이언트)
- 안전 분류기는 Claude Haiku 4.5 (저비용·빠른 JSON)로 사전 게이트, 위기 신호 시 해몽 차단 + 위기 자원 카드 페이로드만 반환
- 톤별 system prompt는 `lib/prompts/_compiled/*` (Phase 1 compile-prompts 산출)를 import해 조립
- 클라이언트는 `idb`로 IndexedDB CRUD (DreamEntry 100건 LRU)
- UI는 `@gugbab/styled-radix` 컴포넌트 + CSS module (typescript.md "인라인 스타일 금지" 준수)
- 시각 회귀는 `page.route('/api/interpret', ...)`로 결정론 mocked SSE 주입 → 라우트·컴포넌트 baseline 등록

**Tech Stack:**
- 신규: `@radix-ui/themes` (필요시) — 현재 styled-radix만으로 layout primitive 부족할 경우 결정
- 기존: Next.js 16 / React 19 / TypeScript 5 / @serwist/next / @anthropic-ai/sdk / idb / zod / ulid / @gugbab/*
- 테스트: 신규 — `vitest` + `@testing-library/react` (단위·컴포넌트 테스트는 Phase 3로 미루되 plan에는 hook 자리 명시)
- 시각 회귀: 기존 Playwright 인프라 + spec 확장

---

## 사전 조건 검증

- [ ] **0.1** 브랜치: `git branch --show-current` → `feature/writing-plan-phase-2`
- [ ] **0.2** main 최신 sync: `git log origin/main -1 --oneline` 에 `Merge pull request #1` 이상
- [ ] **0.3** `pnpm install` 한 번 (lockfile sync)
- [ ] **0.4** `.env.local` 에 실제 `ANTHROPIC_API_KEY` 입력됨 (없으면 사용자에게 발급 요청 후 대기)
- [ ] **0.5** `pnpm compile-prompts` 1회 실행 → `lib/prompts/_compiled/` 에 24개 .ts 파일 + index.ts

---

## File Structure

### 신규 생성 (Phase 2 — `lib/`)

| 파일 | 책임 |
|------|------|
| `lib/types.ts` | `Tone`, `SafetyCategory`, `SafetyVerdict`, `DreamEntry`, API 요청·응답 타입 |
| `lib/db.ts` | idb 래퍼: openDB(`gugbab-dream` v1, store `entries` + index `createdAt_idx`), CRUD, LRU 100건 자동 제거 |
| `lib/safety.ts` | Claude Haiku 분류기 호출, 5 카테고리 + confidence 반환, 보수적 분기 (timeout/5xx → 안전 카드) |
| `lib/claude.ts` | Anthropic SDK 클라이언트 + 톤별 system prompt 조립 + `cache_control: ephemeral` + Messages.stream SSE |
| `lib/prompts/casual.ts` | 캐주얼 톤 system prompt — `_compiled/skill_humanities_dream_content_privacy_ethics` 임베드 |
| `lib/prompts/reflective.ts` | 자기 성찰 톤 — `_compiled/skill_humanities_dream_psychology_jung_freud` + `dream_content_research` + `attachment_theory_basics` + `korean_dream_interpretation_tradition` + `agent_research_dream_multi_perspective_synthesizer` + `dream_content_privacy_ethics` 통합 |
| `lib/prompts/traditional.ts` | 한국 전통 톤 — `_compiled/skill_humanities_korean_dream_interpretation_tradition` + `dream_content_privacy_ethics` |
| `lib/prompts/safety.ts` | 안전 분류기 system prompt — `_compiled/agent_validation_dream_safety_classifier` + `meta/dream-safety-classifier-prompts` SKILL 임베드 |
| `lib/prompts/index.ts` | 톤별 prompt를 함수로 export: `getSystemPrompt(tone: Tone)`, `getSafetyClassifierPrompt()` |
| `lib/crisis-resources.ts` | 한국 위기 자원 데이터 — `_compiled/skill_humanities_crisis_intervention_resources_korea` 파싱 결과 또는 정적 배열 |

### 신규 생성 (Phase 2 — `app/api/` + 페이지)

| 파일 | 책임 |
|------|------|
| `app/api/interpret/route.ts` | POST 엔드포인트: Zod 검증 → `lib/safety.ts` 분류 → 안전 시 위기 카드 페이로드 SSE 1회 후 종료 / 정상 시 `lib/claude.ts` SSE 스트리밍 그대로 pass-through |
| `app/page.tsx` | 홈 — DreamInput + ToneChips + 해석 버튼 + 최근 해몽 3건 |
| `app/result/[id]/page.tsx` | 결과 — 입력 요약 + InterpretationView 스트리밍 + "다른 톤으로 보기" |
| `app/history/page.tsx` | 히스토리 — HistoryList (최근 100건) + 단건/전체 삭제 |

### 신규 생성 (Phase 2 — `components/`)

| 파일 | 책임 |
|------|------|
| `components/DreamInput.tsx` + `.module.css` | textarea + 글자수 카운터 + 해석 버튼 (gugbab `Form` 활용) |
| `components/ToneChips.tsx` + `.module.css` | 톤 3종 단일 선택 (gugbab `ToggleGroup type="single"`) |
| `components/InterpretationView.tsx` + `.module.css` | SSE 스트리밍 부분 텍스트 누적 렌더 + 로딩 인디케이터 (gugbab `Progress`) |
| `components/SafetyResourceCard.tsx` + `.module.css` | 위기 자원 안내 카드 (gugbab `Dialog` + `tel:` 링크) |
| `components/HistoryList.tsx` + `.module.css` | DreamEntry 100건 리스트 (gugbab `Separator`) |

### 신규 생성 (Phase 2-B — 시각 회귀 spec)

| 파일 | 책임 |
|------|------|
| `e2e/visual/routes.spec.ts` (수정) | `/`, `/result/[id]`, `/history` 3건 캡처 — page.route로 mocked SSE 주입 |
| `e2e/visual/components.spec.ts` | ToneChips(3톤 각 선택) + SafetyResourceCard(자해 분기) + InterpretationView(스트리밍·완료) |
| `e2e/visual/_fixtures/sse-mock.ts` | mocked SSE 응답 helper (Phase 2 톤별 샘플 응답 텍스트 1종) |
| `e2e/visual/_fixtures/init-script.ts` | addInitScript용: IndexedDB 초기화 + `crypto.randomUUID` 시드 고정 + `Date.now` freeze |

### 수정 (Phase 마지막)

| 파일 | 변경 |
|------|------|
| `docs/superpowers/specs/2026-05-16-dream-app-todo.md` | 2단계 13항목 + 2-B 4항목 체크 + 변경 로그 |
| `docs/superpowers/specs/dream-app.html` | 진행률·체크리스트·기술 스택 표(테스트 행)·갱신일 |

---

# Phase 2 — 핵심 기능 구현

## Task 1: `lib/types.ts` — 공통 타입

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: lib/types.ts 작성**

```ts
/**
 * 꿈해몽 PWA 공통 타입.
 * lib/* 와 app/api 양쪽이 import 한다.
 */

export type Tone = 'casual' | 'reflective' | 'traditional';

export type SafetyCategory =
  | 'null' // 안전 — 정상 해몽 진행
  | 'self_harm' // 자해/자살 신호
  | 'trauma' // 트라우마 재경험
  | 'violence_toward_others' // 타해 위협
  | 'severe_distress'; // 심각한 정서적 고통

export interface SafetyVerdict {
  category: SafetyCategory;
  confidence: number; // 0..1
  rationale?: string; // 디버깅 — UI 노출 X
}

export interface DreamEntry {
  id: string; // ULID
  createdAt: number; // Unix ms
  dreamText: string; // 사용자 입력 원문 (로컬 only)
  tone: Tone;
  interpretation: string; // 스트리밍 완료 후 누적 저장
  safetyVerdict: SafetyVerdict;
  modelId: string; // 예: 'claude-sonnet-4-6'
  schemaVersion: 1;
}

/** POST /api/interpret 요청 body */
export interface InterpretRequest {
  dreamText: string;
  tone: Tone;
}

/** SSE event 종류 — 클라이언트 디스패처에서 분기 */
export type InterpretSseEvent =
  | { type: 'safety_block'; verdict: SafetyVerdict; resources: CrisisResource[] }
  | { type: 'chunk'; delta: string }
  | { type: 'done'; modelId: string; verdict: SafetyVerdict }
  | { type: 'error'; message: string };

export interface CrisisResource {
  name: string;
  phone: string;
  description?: string;
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 0 error.

- [ ] **Step 3: commit (배치 commit 시점은 plan 마지막. 이 step은 working tree에 둠)**

---

## Task 2: `lib/db.ts` — IndexedDB CRUD + LRU

**Files:**
- Create: `lib/db.ts`

- [ ] **Step 1: lib/db.ts 작성**

```ts
/**
 * IndexedDB (gugbab-dream v1) 래퍼.
 * - store: entries (keyPath: id, index: createdAt_idx)
 * - LRU 100건 유지: 추가 시 초과분 자동 삭제
 *
 * 모든 쓰기 작업은 schemaVersion 검증 + LRU 트리거.
 */
import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { DreamEntry } from './types';

const DB_NAME = 'gugbab-dream';
const DB_VERSION = 1;
const STORE = 'entries';
const LRU_LIMIT = 100;

interface DreamDB extends DBSchema {
  [STORE]: {
    key: string;
    value: DreamEntry;
    indexes: { createdAt_idx: number };
  };
}

let dbPromise: Promise<IDBPDatabase<DreamDB>> | null = null;

function getDB(): Promise<IDBPDatabase<DreamDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DreamDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt_idx', 'createdAt');
      },
    });
  }
  return dbPromise;
}

export async function saveEntry(entry: DreamEntry): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  await tx.store.put(entry);
  await tx.done;
  await enforceLruLimit();
}

export async function getEntry(id: string): Promise<DreamEntry | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

export async function listEntriesDesc(limit = LRU_LIMIT): Promise<DreamEntry[]> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readonly');
  const index = tx.store.index('createdAt_idx');
  const result: DreamEntry[] = [];
  let cursor = await index.openCursor(null, 'prev');
  while (cursor && result.length < limit) {
    result.push(cursor.value);
    cursor = await cursor.continue();
  }
  return result;
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

async function enforceLruLimit(): Promise<void> {
  const db = await getDB();
  const count = await db.count(STORE);
  if (count <= LRU_LIMIT) return;
  const overflow = count - LRU_LIMIT;
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.store.index('createdAt_idx');
  let cursor = await index.openCursor(null, 'next'); // 오래된 순
  let removed = 0;
  while (cursor && removed < overflow) {
    await cursor.delete();
    removed += 1;
    cursor = await cursor.continue();
  }
  await tx.done;
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck` → 0 error.

---

## Task 3: `lib/crisis-resources.ts` — 위기 자원 정적 데이터

**Files:**
- Create: `lib/crisis-resources.ts`

- [ ] **Step 1: lib/crisis-resources.ts 작성**

```ts
/**
 * 한국 위기 자원 정적 데이터.
 *
 * 출처: .claude/skills/humanities/crisis-intervention-resources-korea/SKILL.md
 * (compile-prompts 산출본에서 발췌해 정적 배열로 박는다 — 런타임 파싱 비용 회피)
 *
 * SafetyResourceCard 와 InterpretSseEvent.safety_block.resources 양쪽에서 import.
 */
import type { CrisisResource } from './types';

export const KOREA_CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: '자살예방상담전화',
    phone: '109',
    description: '24시간 연중무휴 · 전화 / 문자 모두 가능',
  },
  {
    name: '정신건강위기상담전화',
    phone: '1577-0199',
    description: '24시간 · 정신건강 위기 일반',
  },
  {
    name: '청소년상담전화',
    phone: '1388',
    description: '청소년 위기 · 익명 가능',
  },
];
```

> 출처 검증: 본 task 실행 전 `.claude/skills/humanities/crisis-intervention-resources-korea/SKILL.md` 의 위 3개 번호와 일치하는지 1회 대조. 다르면 SKILL.md 를 우선 진실로 보고 데이터를 맞춤.

---

## Task 4: `lib/prompts/casual.ts` — 캐주얼 톤 시스템 프롬프트

**Files:**
- Create: `lib/prompts/casual.ts`

- [ ] **Step 1: lib/prompts/casual.ts 작성**

```ts
/**
 * 캐주얼 톤 system prompt.
 *
 * 구조: [정체성] + [출력 형식 규약] + [공통 회피 규칙 — privacy-ethics 임베드]
 *
 * 토큰 추정: 200~400 (가장 작음)
 */
import { SKILL_HUMANITIES_DREAM_CONTENT_PRIVACY_ETHICS } from './_compiled';

export const CASUAL_SYSTEM_PROMPT = `당신은 가볍고 친근한 꿈 해석가입니다.

## 출력 형식
1. **한 줄 요약** (제목으로 "## " 사용)
2. 가벼운 해석 본문 2~3문단
3. 살짝 위트 있는 마무리 한 줄

## 톤 규약
- 존댓말 유지
- 친근하지만 단정하지 않게
- 이모지 0~1개 허용 (꼭 필요할 때만)
- 길이 250~400자

## 공통 회피 규칙
${SKILL_HUMANITIES_DREAM_CONTENT_PRIVACY_ETHICS}

## 추가 회피
- 단정형 예언 ("반드시 일어납니다" 등) 금지
- 의학·심리 진단 ("우울증입니다" 등) 금지
- 사주·점술과 혼동되는 표현 금지
`;
```

- [ ] **Step 2: typecheck — `_compiled` import가 실제 존재하는지 확인**

Run: `pnpm typecheck`
Expected: 0 error. 만약 `_compiled` 에 해당 export 없으면 `pnpm compile-prompts` 재실행.

---

## Task 5: `lib/prompts/reflective.ts` — 자기 성찰(다관점) 톤

**Files:**
- Create: `lib/prompts/reflective.ts`

- [ ] **Step 1: lib/prompts/reflective.ts 작성**

```ts
/**
 * 자기 성찰 톤 system prompt (3관점 통합) — 기본값 톤.
 *
 * 임베드 자산:
 *   - humanities/dream-psychology-jung-freud (융 + 프로이트)
 *   - humanities/dream-content-research (현대 꿈 연구)
 *   - humanities/attachment-theory-basics
 *   - humanities/korean-dream-interpretation-tradition (전통 관점도 한 섹션)
 *   - agent_research/dream-multi-perspective-synthesizer (출력 포맷·금지)
 *   - humanities/dream-content-privacy-ethics (공통 회피)
 *
 * 토큰 추정: 2,000~3,500 (가장 큼) — 프롬프트 캐싱 필수
 */
import {
  AGENT_RESEARCH_DREAM_MULTI_PERSPECTIVE_SYNTHESIZER,
  SKILL_HUMANITIES_ATTACHMENT_THEORY_BASICS,
  SKILL_HUMANITIES_DREAM_CONTENT_PRIVACY_ETHICS,
  SKILL_HUMANITIES_DREAM_CONTENT_RESEARCH,
  SKILL_HUMANITIES_DREAM_PSYCHOLOGY_JUNG_FREUD,
  SKILL_HUMANITIES_KOREAN_DREAM_INTERPRETATION_TRADITION,
} from './_compiled';

export const REFLECTIVE_SYSTEM_PROMPT = `당신은 한국 전통 해몽 · 융 분석심리학 · 프로이트 정신분석 · 현대 꿈 연구를 통합한 자기 성찰 해석가입니다.

## 출력 형식
1. **한 줄 요약** (제목으로 "## ")
2. **세 관점 섹션** — 각각 소제목 "### "
   - 한국 전통 관점
   - 융 분석심리학 관점 (자기·그림자·아니마/아니무스)
   - 프로이트 정신분석 관점 (소망 충족·억압)
3. **나에게 묻는 질문 3개** — 번호 매김, 자기 성찰 유도형
4. 마무리 한 단락

## 톤 규약
- 따뜻하고 진중한 존댓말
- 평어/존댓말 혼용 금지
- 진단어·예언어 금지
- 길이 600~900자

---

## 출력 포맷 · 금지 (synthesizer agent 가이드)
${AGENT_RESEARCH_DREAM_MULTI_PERSPECTIVE_SYNTHESIZER}

---

## 한국 전통 해몽 지식
${SKILL_HUMANITIES_KOREAN_DREAM_INTERPRETATION_TRADITION}

---

## 융·프로이트 심리학 지식
${SKILL_HUMANITIES_DREAM_PSYCHOLOGY_JUNG_FREUD}

---

## 현대 꿈 연구 (Domhoff continuity hypothesis 등)
${SKILL_HUMANITIES_DREAM_CONTENT_RESEARCH}

---

## 애착 이론 기본
${SKILL_HUMANITIES_ATTACHMENT_THEORY_BASICS}

---

## 공통 회피 규칙
${SKILL_HUMANITIES_DREAM_CONTENT_PRIVACY_ETHICS}
`;
```

- [ ] **Step 2: typecheck — 6개 import가 모두 _compiled/index.ts 에 export 되어 있는지 확인**

Run: `pnpm typecheck`

만약 누락 export 발견 시: `cat lib/prompts/_compiled/index.ts | grep -i "dream_psychology\|attachment\|korean_dream\|content_research\|content_privacy\|synthesizer"` 로 확인 후 missing 항목은 `pnpm compile-prompts` 재실행.

---

## Task 6: `lib/prompts/traditional.ts` — 한국 전통 톤

**Files:**
- Create: `lib/prompts/traditional.ts`

- [ ] **Step 1: lib/prompts/traditional.ts 작성**

```ts
/**
 * 한국 전통 해몽 톤 system prompt.
 *
 * 임베드 자산:
 *   - humanities/korean-dream-interpretation-tradition (메인)
 *   - humanities/dream-content-privacy-ethics (공통 회피)
 *
 * 토큰 추정: 800~1,500
 */
import {
  SKILL_HUMANITIES_DREAM_CONTENT_PRIVACY_ETHICS,
  SKILL_HUMANITIES_KOREAN_DREAM_INTERPRETATION_TRADITION,
} from './_compiled';

export const TRADITIONAL_SYSTEM_PROMPT = `당신은 한국 전통 해몽 사전에 기반한 해석가입니다.

## 출력 형식
1. **한 줄 요약** (제목 "## ") — 길몽/흉몽/중립 라벨 포함
2. **등장 상징별 전통 의미** — 각 상징 소제목 "### "
   (예: 이, 물고기, 물, 불, 뱀, 돌아가신 분 등)
3. **종합 한 단락**

## 톤 규약
- 차분하고 약간 옛스러운 문어체 허용
- **강한 길흉 단정 금지** ("반드시 흉합니다" 등 X)
- 약화된 표현으로: "전통적으로 ~로 풀이됩니다", "예부터 ~로 여겨졌습니다"
- 길이 400~600자

---

## 한국 전통 해몽 지식 (메인)
${SKILL_HUMANITIES_KOREAN_DREAM_INTERPRETATION_TRADITION}

---

## 공통 회피 규칙
${SKILL_HUMANITIES_DREAM_CONTENT_PRIVACY_ETHICS}
`;
```

- [ ] **Step 2: typecheck**

---

## Task 7: `lib/prompts/safety.ts` + `lib/prompts/index.ts`

**Files:**
- Create: `lib/prompts/safety.ts`, `lib/prompts/index.ts`

- [ ] **Step 1: lib/prompts/safety.ts 작성**

```ts
/**
 * 안전 분류기 system prompt.
 * 모델: claude-haiku-4-5
 * 출력: JSON 1건 { category, confidence, rationale }
 *
 * 임베드 자산:
 *   - agent_validation/dream-safety-classifier (분류 규약 메인)
 *   - meta/dream-safety-classifier-prompts (실제로는 별도 스킬이지만 compile-prompts 대상 외 — task 11에 추가 검토)
 */
import { AGENT_VALIDATION_DREAM_SAFETY_CLASSIFIER } from './_compiled';

export const SAFETY_CLASSIFIER_SYSTEM_PROMPT = `당신은 꿈 텍스트의 안전 신호 분류기입니다.

## 출력
반드시 JSON 객체 1건만 반환하세요. 다른 텍스트 금지.

\`\`\`json
{
  "category": "null" | "self_harm" | "trauma" | "violence_toward_others" | "severe_distress",
  "confidence": 0.0 ~ 1.0,
  "rationale": "한 줄 한국어 설명 (디버깅용, 사용자에게 노출 X)"
}
\`\`\`

## 카테고리 정의
- **null**: 일반 꿈. 해몽 진행 가능.
- **self_harm**: 자해/자살 신호. 본인을 해치려는 직접 표현 또는 강한 절망감.
- **trauma**: 과거 트라우마 재경험. 실제 사건과 연결된 반복 악몽.
- **violence_toward_others**: 타인을 해치려는 의도가 명확한 표현.
- **severe_distress**: 심각한 정서적 고통. 위 카테고리에 안 들지만 보호적 안내 필요.

## 분류 기준
- 사용자가 꿈을 "묘사"한 것이지 "현실 의도"가 아닌 경우에도 강한 자살 어휘가 있으면 보수적으로 self_harm 분류
- 확실하지 않으면 confidence 를 낮춰 0.3~0.5 로 표시 — 서버가 보수적 분기

---

## 분류 규약 (메인)
${AGENT_VALIDATION_DREAM_SAFETY_CLASSIFIER}
`;
```

- [ ] **Step 2: lib/prompts/index.ts 작성**

```ts
import type { Tone } from '../types';
import { CASUAL_SYSTEM_PROMPT } from './casual';
import { REFLECTIVE_SYSTEM_PROMPT } from './reflective';
import { SAFETY_CLASSIFIER_SYSTEM_PROMPT } from './safety';
import { TRADITIONAL_SYSTEM_PROMPT } from './traditional';

export function getSystemPrompt(tone: Tone): string {
  switch (tone) {
    case 'casual':
      return CASUAL_SYSTEM_PROMPT;
    case 'reflective':
      return REFLECTIVE_SYSTEM_PROMPT;
    case 'traditional':
      return TRADITIONAL_SYSTEM_PROMPT;
  }
}

export function getSafetyClassifierPrompt(): string {
  return SAFETY_CLASSIFIER_SYSTEM_PROMPT;
}
```

- [ ] **Step 3: typecheck**

---

## Task 8: `lib/safety.ts` — 분류기 호출 + 보수적 분기

**Files:**
- Create: `lib/safety.ts`

- [ ] **Step 1: lib/safety.ts 작성**

```ts
/**
 * 안전 분류기 — Claude Haiku 4.5 호출 + 보수적 분기.
 *
 * 보수 분기:
 *   - timeout (3s 초과) → 안전 카드 강제
 *   - 5xx / 파싱 실패 → 안전 카드 강제
 *   - confidence < 0.6 → 안전 카드 강제
 */
import Anthropic from '@anthropic-ai/sdk';
import { getSafetyClassifierPrompt } from './prompts';
import type { SafetyVerdict } from './types';

const TIMEOUT_MS = 3000;
const SAFE_CONFIDENCE_THRESHOLD = 0.6;
const SAFETY_MODEL = process.env.ANTHROPIC_SAFETY_MODEL ?? 'claude-haiku-4-5';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** 위기로 보수적 fallback verdict */
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
    const response = await client.messages.create(
      {
        model: SAFETY_MODEL,
        max_tokens: 200,
        system: [
          {
            type: 'text',
            text: getSafetyClassifierPrompt(),
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: dreamText }],
      },
      { signal: controller.signal },
    );

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      return conservativeVerdict('text block 없음');
    }

    // JSON 추출 (``` 펜스 처리)
    const raw = block.text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(raw) as SafetyVerdict;

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

- [ ] **Step 2: typecheck**

---

## Task 9: `lib/claude.ts` — Anthropic SDK 래퍼 + SSE

**Files:**
- Create: `lib/claude.ts`

- [ ] **Step 1: lib/claude.ts 작성**

```ts
/**
 * Anthropic SDK 클라이언트 + 톤별 system prompt 조립 + SSE 스트리밍.
 *
 * - 프롬프트 캐싱: system 블록에 cache_control: ephemeral
 * - 응답: AsyncIterable<MessageStreamEvent> 그대로 반환 — API Route 에서 SSE 인코딩
 */
import Anthropic from '@anthropic-ai/sdk';
import { getSystemPrompt } from './prompts';
import type { Tone } from './types';

const MODEL_ID = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;
const TEMPERATURE = 0.7;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function getInterpretStream(tone: Tone, dreamText: string) {
  return client.messages.stream({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: [
      {
        type: 'text',
        text: getSystemPrompt(tone),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: dreamText }],
  });
}

export function getModelId(): string {
  return MODEL_ID;
}
```

- [ ] **Step 2: typecheck**

---

## Task 10: `app/api/interpret/route.ts` — API 엔드포인트

**Files:**
- Create: `app/api/interpret/route.ts`

- [ ] **Step 1: app/api/interpret/route.ts 작성**

```ts
/**
 * POST /api/interpret
 *
 * 흐름:
 *   1. Zod 검증
 *   2. safety classifier → 안전 시 step 3 / 아니면 위기 카드 SSE 1회 후 종료
 *   3. tone 별 LLM 스트리밍 → SSE pass-through
 *
 * SSE event 타입:
 *   - safety_block (위기 분기)
 *   - chunk (delta 텍스트)
 *   - done (modelId, verdict 최종)
 *   - error
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getInterpretStream, getModelId } from '@/lib/claude';
import { KOREA_CRISIS_RESOURCES } from '@/lib/crisis-resources';
import { classifySafety, isSafe } from '@/lib/safety';
import type { InterpretSseEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RequestSchema = z.object({
  dreamText: z.string().min(1).max(2000),
  tone: z.enum(['casual', 'reflective', 'traditional']),
});

function sseLine(event: InterpretSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest): Promise<Response> {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body = await req.json();
    parsed = RequestSchema.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: '입력을 확인해주세요' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const verdict = await classifySafety(parsed.dreamText);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: InterpretSseEvent) =>
        controller.enqueue(encoder.encode(sseLine(event)));

      try {
        if (!isSafe(verdict)) {
          send({ type: 'safety_block', verdict, resources: KOREA_CRISIS_RESOURCES });
          controller.close();
          return;
        }

        const llmStream = getInterpretStream(parsed.tone, parsed.dreamText);
        for await (const event of llmStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send({ type: 'chunk', delta: event.delta.text });
          }
        }
        send({ type: 'done', modelId: getModelId(), verdict });
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        send({ type: 'error', message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
```

- [ ] **Step 2: typecheck + build (prebuild 로 compile-prompts 자동 실행되는지 확인)**

Run: `pnpm typecheck && pnpm build`
Expected: 빌드 성공 + `Route (app) /api/interpret` 자동 detect.

---

## Task 11: `components/ToneChips.tsx` — 톤 3종 단일 선택

**Files:**
- Create: `components/ToneChips.tsx`, `components/ToneChips.module.css`

- [ ] **Step 1: ToneChips.tsx 작성**

```tsx
'use client';

import { ToggleGroup } from '@gugbab/styled-radix';
import type { Tone } from '@/lib/types';
import styles from './ToneChips.module.css';

interface ToneChipsProps {
  value: Tone;
  onChange: (next: Tone) => void;
  disabled?: boolean;
}

const TONE_LABELS: Record<Tone, string> = {
  casual: '캐주얼',
  reflective: '자기 성찰',
  traditional: '한국 전통',
};

export function ToneChips({ value, onChange, disabled }: ToneChipsProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as Tone);
      }}
      disabled={disabled}
      className={styles.root}
      aria-label="해몽 톤 선택"
    >
      {(Object.keys(TONE_LABELS) as Tone[]).map((tone) => (
        <ToggleGroup.Item key={tone} value={tone} className={styles.item}>
          {TONE_LABELS[tone]}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
```

- [ ] **Step 2: ToneChips.module.css 작성**

```css
.root {
  display: flex;
  gap: var(--gugbab-space-2, 8px);
  flex-wrap: wrap;
  justify-content: center;
}

.item {
  padding: var(--gugbab-space-2, 8px) var(--gugbab-space-4, 16px);
}
```

- [ ] **Step 3: typecheck**

---

## Task 12: `components/DreamInput.tsx`

**Files:**
- Create: `components/DreamInput.tsx`, `components/DreamInput.module.css`

- [ ] **Step 1: DreamInput.tsx 작성**

```tsx
'use client';

import { useState } from 'react';
import type { Tone } from '@/lib/types';
import { ToneChips } from './ToneChips';
import styles from './DreamInput.module.css';

interface DreamInputProps {
  onSubmit: (dreamText: string, tone: Tone) => void;
  loading?: boolean;
}

const MAX_LEN = 2000;

export function DreamInput({ onSubmit, loading }: DreamInputProps) {
  const [text, setText] = useState('');
  const [tone, setTone] = useState<Tone>('reflective');

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_LEN && !loading;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(trimmed, tone);
      }}
    >
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
        placeholder="어젯밤 꿈을 적어보세요"
        rows={6}
        disabled={loading}
        aria-label="꿈 텍스트 입력"
      />
      <div className={styles.meta}>
        <span className={styles.counter}>
          {text.length}/{MAX_LEN}
        </span>
      </div>
      <ToneChips value={tone} onChange={setTone} disabled={loading} />
      <button type="submit" className={styles.submit} disabled={!canSubmit}>
        {loading ? '해석 중...' : '해석하기'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: DreamInput.module.css 작성**

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--gugbab-space-3, 12px);
  width: 100%;
}

.textarea {
  width: 100%;
  padding: var(--gugbab-space-3, 12px);
  border: 1px solid var(--gugbab-color-border-base, #cdced6);
  border-radius: var(--gugbab-radius-md, 4px);
  font: inherit;
  resize: vertical;
  background: var(--gugbab-color-bg-surface, #f9f9fb);
  color: var(--gugbab-color-fg-primary, #1c2024);
}

.textarea:focus-visible {
  outline: 2px solid var(--gugbab-color-border-focus, #5eb1ef);
  outline-offset: 1px;
}

.meta {
  display: flex;
  justify-content: flex-end;
}

.counter {
  font-size: 12px;
  color: var(--gugbab-color-fg-muted, #80838d);
}

.submit {
  padding: var(--gugbab-space-3, 12px) var(--gugbab-space-5, 20px);
  font-weight: 600;
  background: var(--gugbab-color-accent-base, #0090ff);
  color: var(--gugbab-color-accent-fg, white);
  border: none;
  border-radius: var(--gugbab-radius-md, 4px);
  cursor: pointer;
}

.submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 3: typecheck**

---

## Task 13: `components/InterpretationView.tsx` — SSE 스트리밍 렌더

**Files:**
- Create: `components/InterpretationView.tsx`, `components/InterpretationView.module.css`

- [ ] **Step 1: InterpretationView.tsx 작성**

```tsx
'use client';

import { Progress } from '@gugbab/styled-radix';
import styles from './InterpretationView.module.css';

interface InterpretationViewProps {
  /** 누적된 markdown 텍스트 */
  text: string;
  /** 첫 chunk 도착 전 true */
  loading: boolean;
  /** 'done' 이벤트 받음 */
  done: boolean;
}

export function InterpretationView({ text, loading, done }: InterpretationViewProps) {
  if (loading && !text) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <Progress.Root className={styles.progressRoot}>
          <Progress.Indicator className={styles.progressIndicator} />
        </Progress.Root>
        <p className={styles.loadingText}>꿈을 풀어보는 중...</p>
      </div>
    );
  }

  return (
    <article className={styles.article} aria-live="polite" aria-busy={!done}>
      {text}
      {!done && <span className={styles.caret} aria-hidden="true">▍</span>}
    </article>
  );
}
```

- [ ] **Step 2: InterpretationView.module.css 작성**

```css
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gugbab-space-3, 12px);
  padding: var(--gugbab-space-6, 24px);
}

.progressRoot {
  width: 200px;
}

.progressIndicator {
  /* gugbab Progress 의 indeterminate 동작은 자체 CSS 로 작동 */
}

.loadingText {
  color: var(--gugbab-color-fg-muted, #80838d);
  font-size: 14px;
}

.article {
  white-space: pre-wrap;
  line-height: 1.7;
  font-size: 16px;
  color: var(--gugbab-color-fg-primary, #1c2024);
}

.caret {
  display: inline-block;
  margin-left: 2px;
  animation: blink 1s steps(2) infinite;
  color: var(--gugbab-color-accent-base, #0090ff);
}

@keyframes blink {
  to {
    opacity: 0;
  }
}
```

> 참고: markdown 파싱은 v1.0 에서 생략 (텍스트 그대로 렌더). v1.1 에 `marked` / `react-markdown` 도입 검토.

- [ ] **Step 3: typecheck**

---

## Task 14: `components/SafetyResourceCard.tsx` — 위기 자원 카드

**Files:**
- Create: `components/SafetyResourceCard.tsx`, `components/SafetyResourceCard.module.css`

- [ ] **Step 1: SafetyResourceCard.tsx 작성**

```tsx
'use client';

import type { CrisisResource } from '@/lib/types';
import styles from './SafetyResourceCard.module.css';

interface SafetyResourceCardProps {
  resources: CrisisResource[];
}

export function SafetyResourceCard({ resources }: SafetyResourceCardProps) {
  return (
    <section className={styles.card} role="region" aria-labelledby="safety-title">
      <h2 id="safety-title" className={styles.title}>
        도움이 필요하시면 연락해보세요
      </h2>
      <p className={styles.lead}>
        지금 마음이 무거우시군요. 혼자가 아니에요. 아래 번호로 연결해서 이야기를 나눌 수
        있어요.
      </p>
      <ul className={styles.list}>
        {resources.map((r) => (
          <li key={r.phone} className={styles.item}>
            <a href={`tel:${r.phone}`} className={styles.phone}>
              {r.phone}
            </a>
            <div className={styles.meta}>
              <span className={styles.name}>{r.name}</span>
              {r.description && <span className={styles.desc}>{r.description}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: SafetyResourceCard.module.css 작성**

```css
.card {
  padding: var(--gugbab-space-6, 24px);
  background: var(--gugbab-color-bg-elevated, #fcfcfd);
  border: 1px solid var(--gugbab-color-border-base, #cdced6);
  border-radius: var(--gugbab-radius-md, 4px);
  display: flex;
  flex-direction: column;
  gap: var(--gugbab-space-4, 16px);
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--gugbab-color-fg-primary, #1c2024);
}

.lead {
  margin: 0;
  color: var(--gugbab-color-fg-secondary, #60646c);
  line-height: 1.6;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gugbab-space-3, 12px);
}

.item {
  display: flex;
  gap: var(--gugbab-space-3, 12px);
  align-items: center;
}

.phone {
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
  color: var(--gugbab-color-accent-base, #0090ff);
  padding: var(--gugbab-space-2, 8px) var(--gugbab-space-3, 12px);
  background: var(--gugbab-color-accent-subtle, #e6f4fe);
  border-radius: var(--gugbab-radius-sm, 3px);
  min-width: 100px;
  text-align: center;
}

.meta {
  display: flex;
  flex-direction: column;
}

.name {
  font-weight: 600;
}

.desc {
  font-size: 12px;
  color: var(--gugbab-color-fg-muted, #80838d);
}
```

- [ ] **Step 3: typecheck**

---

## Task 15: `components/HistoryList.tsx`

**Files:**
- Create: `components/HistoryList.tsx`, `components/HistoryList.module.css`

- [ ] **Step 1: HistoryList.tsx 작성**

```tsx
'use client';

import Link from 'next/link';
import { Separator } from '@gugbab/styled-radix';
import type { DreamEntry, Tone } from '@/lib/types';
import styles from './HistoryList.module.css';

interface HistoryListProps {
  entries: DreamEntry[];
  onDelete?: (id: string) => void;
}

const TONE_BADGE: Record<Tone, string> = {
  casual: '캐주얼',
  reflective: '자기 성찰',
  traditional: '한국 전통',
};

function formatDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function firstLine(s: string, n = 60): string {
  const trimmed = s.trim().replace(/\s+/g, ' ');
  return trimmed.length > n ? `${trimmed.slice(0, n)}…` : trimmed;
}

export function HistoryList({ entries, onDelete }: HistoryListProps) {
  if (entries.length === 0) {
    return <p className={styles.empty}>아직 저장된 해몽이 없어요.</p>;
  }

  return (
    <ul className={styles.list}>
      {entries.map((e, idx) => (
        <li key={e.id} className={styles.item}>
          <Link href={`/result/${e.id}`} className={styles.link}>
            <div className={styles.meta}>
              <span className={styles.date}>{formatDate(e.createdAt)}</span>
              <span className={styles.tone}>{TONE_BADGE[e.tone]}</span>
            </div>
            <p className={styles.preview}>{firstLine(e.dreamText)}</p>
          </Link>
          {onDelete && (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => onDelete(e.id)}
              aria-label={`${formatDate(e.createdAt)} 해몽 삭제`}
            >
              삭제
            </button>
          )}
          {idx < entries.length - 1 && <Separator className={styles.separator} />}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: HistoryList.module.css 작성**

```css
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

.tone {
  font-size: 12px;
  padding: 2px var(--gugbab-space-2, 8px);
  background: var(--gugbab-color-accent-subtle, #e6f4fe);
  color: var(--gugbab-color-accent-base, #0090ff);
  border-radius: 999px;
}

.preview {
  margin: 0;
  font-size: 14px;
  color: var(--gugbab-color-fg-primary, #1c2024);
  line-height: 1.5;
}

.deleteBtn {
  padding: var(--gugbab-space-1, 4px) var(--gugbab-space-2, 8px);
  font-size: 12px;
  background: transparent;
  border: 1px solid var(--gugbab-color-border-subtle, #d9d9e0);
  border-radius: var(--gugbab-radius-sm, 3px);
  color: var(--gugbab-color-fg-secondary, #60646c);
  cursor: pointer;
}

.separator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}

.empty {
  color: var(--gugbab-color-fg-muted, #80838d);
  text-align: center;
  padding: var(--gugbab-space-8, 32px);
}
```

- [ ] **Step 3: typecheck**

---

## Task 16: `app/page.tsx` — 홈

**Files:**
- Modify: `app/page.tsx`, `app/page.module.css`

- [ ] **Step 1: app/page.tsx 갱신**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ulid } from 'ulid';
import { DreamInput } from '@/components/DreamInput';
import { HistoryList } from '@/components/HistoryList';
import { listEntriesDesc, saveEntry } from '@/lib/db';
import type { DreamEntry, Tone } from '@/lib/types';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const [recent, setRecent] = useState<DreamEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listEntriesDesc(3).then(setRecent).catch(() => setRecent([]));
  }, []);

  const handleSubmit = async (dreamText: string, tone: Tone) => {
    setSubmitting(true);
    const id = ulid();
    // 빈 entry 를 미리 저장 (result 페이지에서 stream 받아 채움)
    const pending: DreamEntry = {
      id,
      createdAt: Date.now(),
      dreamText,
      tone,
      interpretation: '',
      safetyVerdict: { category: 'null', confidence: 0 },
      modelId: '',
      schemaVersion: 1,
    };
    await saveEntry(pending);
    router.push(`/result/${id}`);
  };

  return (
    <main className={styles.home}>
      <h1 className={styles.title}>꿈해몽</h1>
      <p className={styles.subtitle}>어젯밤 꿈을 적고 톤을 골라 누르면 Claude가 해석해드려요.</p>

      <DreamInput onSubmit={handleSubmit} loading={submitting} />

      {recent.length > 0 && (
        <section className={styles.recent} aria-labelledby="recent-title">
          <h2 id="recent-title" className={styles.recentTitle}>최근 해몽</h2>
          <HistoryList entries={recent} />
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: app/page.module.css 갱신**

```css
.home {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--gugbab-space-6, 24px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gugbab-space-5, 20px);
  min-height: 90vh;
  text-align: center;
}

.title {
  font-size: 36px;
  font-weight: 700;
  margin: var(--gugbab-space-8, 32px) 0 0 0;
  color: var(--gugbab-color-fg-primary, #1c2024);
}

.subtitle {
  color: var(--gugbab-color-fg-secondary, #60646c);
  font-size: 16px;
  margin: 0 0 var(--gugbab-space-4, 16px) 0;
}

.recent {
  width: 100%;
  text-align: left;
  margin-top: var(--gugbab-space-6, 24px);
}

.recentTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--gugbab-color-fg-muted, #80838d);
  margin: 0 0 var(--gugbab-space-2, 8px) 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

- [ ] **Step 3: typecheck**

---

## Task 17: `app/result/[id]/page.tsx` — 결과 + SSE 클라이언트

**Files:**
- Create: `app/result/[id]/page.tsx`, `app/result/[id]/page.module.css`

- [ ] **Step 1: app/result/[id]/page.tsx 작성**

```tsx
'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entry = await getEntry(id);
      if (!entry) {
        setState((s) => ({ ...s, error: '해몽을 찾을 수 없어요', loading: false }));
        return;
      }
      setState((s) => ({ ...s, entry }));

      // 이미 완료된 entry 면 재호출 X
      if (entry.interpretation) {
        setState((s) => ({ ...s, text: entry.interpretation, done: true, loading: false }));
        return;
      }

      if (startedRef.current) return;
      startedRef.current = true;

      await streamInterpret(entry, (next) => {
        if (cancelled) return;
        setState((prev) => next(prev));
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.error) {
    return (
      <main className={styles.page}>
        <p className={styles.error}>{state.error}</p>
        <Link href="/" className={styles.back}>← 홈으로</Link>
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
        <Link href="/" className={styles.back}>← 홈으로</Link>
        <span className={styles.toneBadge}>{state.entry.tone}</span>
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
  setState: (next: (prev: State) => State) => void,
): Promise<void> {
  const res = await fetch('/api/interpret', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dreamText: entry.dreamText, tone: entry.tone }),
  });

  if (!res.ok || !res.body) {
    setState((s) => ({ ...s, error: '서버 응답이 비정상이에요', loading: false }));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
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
```

- [ ] **Step 2: app/result/[id]/page.module.css 작성**

```css
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--gugbab-space-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--gugbab-space-5, 20px);
  min-height: 90vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.back {
  color: var(--gugbab-color-accent-base, #0090ff);
  text-decoration: none;
}

.toneBadge {
  font-size: 12px;
  padding: 2px var(--gugbab-space-2, 8px);
  background: var(--gugbab-color-accent-subtle, #e6f4fe);
  color: var(--gugbab-color-accent-base, #0090ff);
  border-radius: 999px;
}

.dreamSummary {
  padding: var(--gugbab-space-3, 12px);
  background: var(--gugbab-color-bg-inset, #f0f0f3);
  border-radius: var(--gugbab-radius-md, 4px);
}

.summaryTitle {
  font-size: 12px;
  margin: 0 0 var(--gugbab-space-1, 4px) 0;
  color: var(--gugbab-color-fg-muted, #80838d);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summaryBody {
  margin: 0;
  white-space: pre-wrap;
  color: var(--gugbab-color-fg-secondary, #60646c);
  font-size: 14px;
}

.error {
  text-align: center;
  color: var(--gugbab-color-danger-base, #e5484d);
  padding: var(--gugbab-space-8, 32px);
}
```

- [ ] **Step 3: typecheck**

---

## Task 18: `app/history/page.tsx` — 히스토리

**Files:**
- Create: `app/history/page.tsx`, `app/history/page.module.css`

- [ ] **Step 1: app/history/page.tsx 작성**

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HistoryList } from '@/components/HistoryList';
import { clearAll, deleteEntry, listEntriesDesc } from '@/lib/db';
import type { DreamEntry } from '@/lib/types';
import styles from './page.module.css';

export default function HistoryPage() {
  const [entries, setEntries] = useState<DreamEntry[]>([]);

  useEffect(() => {
    listEntriesDesc(100).then(setEntries).catch(() => setEntries([]));
  }, []);

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClearAll = async () => {
    if (!window.confirm('모든 히스토리를 삭제할까요?')) return;
    await clearAll();
    setEntries([]);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← 홈으로</Link>
        <h1 className={styles.title}>히스토리</h1>
        {entries.length > 0 && (
          <button type="button" onClick={handleClearAll} className={styles.clearBtn}>
            전체 삭제
          </button>
        )}
      </header>
      <HistoryList entries={entries} onDelete={handleDelete} />
    </main>
  );
}
```

- [ ] **Step 2: app/history/page.module.css 작성**

```css
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--gugbab-space-6, 24px);
  min-height: 90vh;
}

.header {
  display: flex;
  align-items: center;
  gap: var(--gugbab-space-3, 12px);
  margin-bottom: var(--gugbab-space-5, 20px);
}

.back {
  color: var(--gugbab-color-accent-base, #0090ff);
  text-decoration: none;
  font-size: 14px;
}

.title {
  flex: 1;
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.clearBtn {
  padding: var(--gugbab-space-2, 8px) var(--gugbab-space-3, 12px);
  background: transparent;
  border: 1px solid var(--gugbab-color-danger-base, #e5484d);
  color: var(--gugbab-color-danger-base, #e5484d);
  border-radius: var(--gugbab-radius-sm, 3px);
  cursor: pointer;
  font-size: 12px;
}
```

- [ ] **Step 3: typecheck + build (전체 빌드 1회)**

Run: `pnpm typecheck && pnpm build`
Expected: 3개 라우트 detect (`/`, `/result/[id]`, `/history`) + `/api/interpret`.

---

# Phase 2-B — 시각 회귀 spec 확장

## Task 19: `e2e/visual/_fixtures/sse-mock.ts` + `init-script.ts`

**Files:**
- Create: `e2e/visual/_fixtures/sse-mock.ts`, `e2e/visual/_fixtures/init-script.ts`

- [ ] **Step 1: sse-mock.ts 작성**

```ts
/**
 * 결정론 mocked SSE 응답 — Playwright page.route 에서 사용.
 *
 * 톤별 고정 샘플 1종씩 + 안전 차단 1종.
 * 실제 Anthropic 호출을 차단하고 동일한 텍스트를 매번 반환 → baseline 안정.
 */
import type { Route } from '@playwright/test';

const SAMPLE_BY_TONE: Record<string, string> = {
  casual: `## 작은 손짓\n\n어젯밤 꿈은 짧지만 또렷한 신호 같아요. 마음 한 켠에서 가볍게 두드리는 메시지.\n\n살짝 미소가 나는 마무리예요. 좋은 하루 보내세요.`,
  reflective: `## 자기 안의 작은 신호\n\n### 한국 전통 관점\n전통적으로는 ...로 풀이됩니다.\n\n### 융 분석심리학 관점\n자기(self) 의 통합 신호로 보입니다.\n\n### 프로이트 정신분석 관점\n억압된 ...의 재출현으로 해석 가능합니다.\n\n**나에게 묻는 질문 3개**\n1. 최근 어떤 결정을 미루고 있나요?\n2. 누구의 인정을 가장 원하고 있나요?\n3. 이 꿈이 사라진다면 가장 그리울 것은 무엇일까요?`,
  traditional: `## 길몽\n\n### 등장 상징\n- 물고기: 재물·기회\n- 맑은 물: 마음의 정화\n\n종합하면 전통적으로 길몽으로 풀이됩니다.`,
};

export function makeChunkedSse(text: string, chunkSize = 30): string {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  const events = chunks.map((delta) =>
    `data: ${JSON.stringify({ type: 'chunk', delta })}\n\n`,
  );
  events.push(
    `data: ${JSON.stringify({
      type: 'done',
      modelId: 'claude-sonnet-4-6',
      verdict: { category: 'null', confidence: 1.0 },
    })}\n\n`,
  );
  return events.join('');
}

export function makeSafetyBlockSse(): string {
  return `data: ${JSON.stringify({
    type: 'safety_block',
    verdict: { category: 'self_harm', confidence: 0.95 },
    resources: [
      { name: '자살예방상담전화', phone: '109' },
      { name: '정신건강위기상담전화', phone: '1577-0199' },
      { name: '청소년상담전화', phone: '1388' },
    ],
  })}\n\n`;
}

export async function mockInterpretRoute(
  route: Route,
  variant: 'casual' | 'reflective' | 'traditional' | 'safety',
): Promise<void> {
  const body =
    variant === 'safety'
      ? makeSafetyBlockSse()
      : makeChunkedSse(SAMPLE_BY_TONE[variant] ?? SAMPLE_BY_TONE.reflective);
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
    body,
  });
}
```

- [ ] **Step 2: init-script.ts 작성**

```ts
/**
 * page.addInitScript 로 주입할 결정론 fixture.
 *
 * - IndexedDB(gugbab-dream) 초기화 → 매 spec 깨끗한 상태
 * - crypto.randomUUID 와 ulid 의존성 시드 고정 (xorshift32)
 * - Date.now freeze (2026-05-22T00:00:00Z)
 */
export const FIXTURE_SCRIPT = `
  (() => {
    // 1. IndexedDB 초기화
    try {
      indexedDB.deleteDatabase('gugbab-dream');
    } catch {}

    // 2. Math.random 시드 (xorshift32, seed=42)
    let state = 42;
    Math.random = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };

    // 3. crypto.randomUUID 고정값
    const FIXED_UUID = '00000000-0000-4000-8000-000000000000';
    if (crypto && 'randomUUID' in crypto) {
      crypto.randomUUID = () => FIXED_UUID;
    }

    // 4. Date.now freeze (캐럿 깜빡임은 animations: 'disabled' 로 처리)
    const FROZEN = Date.UTC(2026, 4, 22, 0, 0, 0);
    Date.now = () => FROZEN;
  })();
`;
```

- [ ] **Step 3: typecheck (e2e/visual/tsconfig.json 이 _fixtures 도 포함하는지)**

---

## Task 20: `e2e/visual/routes.spec.ts` 확장 — 3개 라우트

**Files:**
- Modify: `e2e/visual/routes.spec.ts`

- [ ] **Step 1: routes.spec.ts 확장**

```ts
/**
 * 라우트 시각 회귀 spec — Phase 2-B 확장.
 *
 * 라우트: /, /result/[id], /history
 * 비결정 차단: addInitScript (IndexedDB·random·Date) + page.route SSE mock
 */
import { expect, type Page, test } from '@playwright/test';
import { FIXTURE_SCRIPT } from './_fixtures/init-script';
import { mockInterpretRoute } from './_fixtures/sse-mock';

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

  test('result-reflective', async ({ page }) => {
    await page.route('**/api/interpret', (route) => mockInterpretRoute(route, 'reflective'));
    // 빈 result 페이지로 직접 이동 (IndexedDB 비어있어 entry 없음 — 에러 메시지 캡처는 별도)
    // Phase 2-B 시점에는 홈 → 입력 → 결과 흐름 대신 미리 IDB seed 한 entry 사용
    await page.addInitScript(`
      indexedDB.deleteDatabase('gugbab-dream');
      const req = indexedDB.open('gugbab-dream', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const store = db.createObjectStore('entries', { keyPath: 'id' });
        store.createIndex('createdAt_idx', 'createdAt');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('entries', 'readwrite');
        tx.objectStore('entries').put({
          id: 'fixt01ULIDXXXXXXXXXXXXXXXX',
          createdAt: Date.UTC(2026, 4, 21, 0, 0, 0),
          dreamText: '맑은 강에서 큰 물고기를 잡았어요.',
          tone: 'reflective',
          interpretation: '',
          safetyVerdict: { category: 'null', confidence: 0 },
          modelId: '',
          schemaVersion: 1,
        });
      };
    `);
    await page.goto('/result/fixt01ULIDXXXXXXXXXXXXXXXX');
    await settle(page);
    // 스트리밍 완료까지 대기
    await page.waitForSelector('text=나에게 묻는 질문', { timeout: 5000 });
    await expect(page).toHaveScreenshot('result-reflective.png', { fullPage: true });
  });

  test('history-empty', async ({ page }) => {
    await page.goto('/history');
    await settle(page);
    await expect(page).toHaveScreenshot('history-empty.png', { fullPage: true });
  });
});
```

> 주의: 위 `result-reflective` test 의 IDB seed 스크립트는 길어 보일 수 있어 추후 `_fixtures/seed-idb.ts` 헬퍼로 빼는 게 좋음 (Phase 2-B 후속 정리 — todo.md 에 v1.1 항목).

- [ ] **Step 2: 로컬 1회 실행 (PNG는 commit 금지)**

Run: `pnpm exec playwright test --reporter=list`
Expected: 3 passed. 로컬 생성 PNG는 다음 step에서 정리.

- [ ] **Step 3: 로컬 생성 PNG 제거**

Run: `rm -rf e2e/visual/__screenshots__/`
Expected: 디렉토리 사라짐.

---

## Task 21: `e2e/visual/components.spec.ts` — 컴포넌트 spec

**Files:**
- Create: `e2e/visual/components.spec.ts`

- [ ] **Step 1: components.spec.ts 작성**

```ts
/**
 * 컴포넌트 상태별 시각 회귀.
 *
 * 페이지 경유 없이 직접 캡처할 수 없으므로 (Storybook 미사용),
 * 홈에서 톤 선택 상태별 + 자해 시뮬레이션 입력 후 결과 페이지에서 안전 카드 캡처.
 */
import { expect, type Page, test } from '@playwright/test';
import { FIXTURE_SCRIPT } from './_fixtures/init-script';
import { mockInterpretRoute } from './_fixtures/sse-mock';

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

test.describe('components — visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FIXTURE_SCRIPT);
  });

  for (const tone of ['casual', 'reflective', 'traditional'] as const) {
    test(`tone-chips-${tone}`, async ({ page }) => {
      await page.goto('/');
      await settle(page);
      // 톤 chip 클릭으로 선택 상태 변경
      await page.getByRole('button', { name: tone === 'casual' ? '캐주얼' : tone === 'reflective' ? '자기 성찰' : '한국 전통' }).click();
      await expect(page.locator('form')).toHaveScreenshot(`tone-chips-${tone}.png`);
    });
  }

  test('safety-card', async ({ page }) => {
    await page.route('**/api/interpret', (route) => mockInterpretRoute(route, 'safety'));
    await page.addInitScript(`
      indexedDB.deleteDatabase('gugbab-dream');
      const req = indexedDB.open('gugbab-dream', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const store = db.createObjectStore('entries', { keyPath: 'id' });
        store.createIndex('createdAt_idx', 'createdAt');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('entries', 'readwrite');
        tx.objectStore('entries').put({
          id: 'safety01ULIDXXXXXXXXXXXXXX',
          createdAt: Date.UTC(2026, 4, 21, 0, 0, 0),
          dreamText: '(자해 시뮬레이션 입력)',
          tone: 'reflective',
          interpretation: '',
          safetyVerdict: { category: 'null', confidence: 0 },
          modelId: '',
          schemaVersion: 1,
        });
      };
    `);
    await page.goto('/result/safety01ULIDXXXXXXXXXXXXXX');
    await settle(page);
    await page.waitForSelector('text=자살예방상담전화', { timeout: 5000 });
    await expect(page.locator('[role="region"]')).toHaveScreenshot('safety-card.png');
  });
});
```

- [ ] **Step 2: 로컬 1회 실행 + PNG 정리**

Run: `pnpm exec playwright test --reporter=list && rm -rf e2e/visual/__screenshots__/`

---

## Task 22: spec 동기화 (todo.md + dream-app.html)

**Files:**
- Modify: `docs/superpowers/specs/2026-05-16-dream-app-todo.md`, `docs/superpowers/specs/dream-app.html`

- [ ] **Step 1: todo.md — 2단계 13항목 + 2-B 4항목 체크**

`- [ ]` → `- [x]` 일괄 변경. 변경 로그 추가:

```markdown
| 2026-05-22 | **Phase 2 + 2-B 핵심 기능 구현 완료**: 톤 프롬프트 3종 + Haiku 안전 분류기 + SSE 스트리밍 API Route + IndexedDB CRUD/LRU + 컴포넌트 5종 + 라우트 3종. Phase 2-B 시각 회귀 spec 확장 (routes 3건 + components 4건 + LLM SSE mock fixture + IDB 초기화). 사용자 액션: accept-baseline 라벨로 신규 베이스라인 등록 |
```

- [ ] **Step 2: dream-app.html — 진행률·체크리스트·기술 스택 갱신**

- 헤더 배지: "🟢 Phase 2 핵심 기능 완료" + "테스트: Playwright VR 4건"
- 2단계 phase: `0/13` → `13/13` 모두 done class
- 2-B 단계 phase: `0/4` → `4/4` 모두 done class
- "다음 할 일" 섹션: Phase 3 안정화 항목으로 갱신 (ErrorBoundary, 오프라인, Lighthouse 등)
- 최종 갱신일: 2026-05-22

---

## Task 23: feature 브랜치 push + 사용자 PR 안내

**Files:** 없음

- [ ] **Step 1: 분리 commit** (이 plan 실행 시점에는 모든 변경이 working tree에 누적된 상태)

```bash
# [config] (없음 — Phase 2는 어플리케이션 코드 위주)
# [app]
git add lib/ app/api/ app/page.tsx app/page.module.css app/result/ app/history/ components/
git commit -m "[app] Add: Phase 2 핵심 기능 구현 (...)"

# [test]
git add e2e/visual/
git commit -m "[test] Add: Phase 2-B 시각 회귀 spec 확장 (...)"

# [docs]
git add docs/superpowers/specs/2026-05-16-dream-app-todo.md docs/superpowers/specs/dream-app.html
git commit -m "[docs] Modify: Phase 2 + 2-B 완료 반영"
```

- [ ] **Step 2: push**

Run: `git push -u origin feature/writing-plan-phase-2`

- [ ] **Step 3: 사용자에게 안내**

> "PR 만들어주세요: https://github.com/puk0806/gugbab-claude-dream/pull/new/feature/writing-plan-phase-2
> Phase 2 는 신규 라우트 2개 + 새 컴포넌트로 시각 변화 많음 → CI 첫 실행 fail 예상 → 신규 baseline 7장 검토 → `accept-baseline` 라벨 부여 → PASS → 머지"

---

# DoD (Definition of Done) — Phase 2 + 2-B

- [ ] `pnpm dev` 에서 / → 톤 선택 → 해석하기 → /result/[id] → SSE 스트리밍 텍스트 누적 렌더 → /history 에서 entry 확인 → 단건/전체 삭제 동작
- [ ] 자해 시뮬레이션 입력 (`"죽고 싶다"` 같은 명백 신호) → 안전 카드 노출 + LLM 호출 안 됨 (네트워크 탭 확인)
- [ ] IndexedDB 100건 LRU — 101건째 추가 시 가장 오래된 항목 자동 삭제 (DevTools > Application > IndexedDB)
- [ ] 톤별 prompt 캐싱 — 같은 톤 재호출 시 input 비용 ↓ (Anthropic 응답 헤더 또는 콘솔 사용량 확인 — 선택)
- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm check` (Biome) exit 0
- [ ] `pnpm build` 성공 (4 routes: `/`, `/result/[id]`, `/history`, `/api/interpret`)
- [ ] `pnpm test:visual` 로컬 spec 4~7건 detect (PNG 결과는 commit 금지)
- [ ] PR 생성 후 visual-regression CI fail → `accept-baseline` 라벨 → CI 자동 baseline commit → PASS → 머지 활성화
- [ ] 머지 후 Vercel 자동 배포 (Phase 1 머지 후 사용자가 Vercel 연결한 경우)

---

# 실행 시 주의사항

## 컴파일 산출 의존성
- `lib/prompts/casual.ts` 등은 `lib/prompts/_compiled/*` 에서 import. 만약 import 에러 시 `pnpm compile-prompts` 1회 실행 후 재시도.
- 새 humanities/dream-* 자산이 추가되면 `pnpm compile-prompts` 재실행 필수.

## 환경변수
- `.env.local` 의 `ANTHROPIC_API_KEY` 가 비어 있으면 API Route 가 401 응답 — 사용자에게 사전 안내.

## Anthropic SDK 버전 차이
- `@anthropic-ai/sdk` 0.x → 1.x 마이그레이션 시 `messages.stream` 이벤트 타입 변경 가능. plan 작성 시점(0.97.1) 기준이며, 실행 시 버전 확인 후 시그니처 차이 있으면 보고.

## 시각 회귀 첫 베이스라인
- Phase 2-B 신규 라우트·컴포넌트가 많아 CI 첫 실행에서 베이스라인 7장 신규 생성 예상.
- `accept-baseline` 라벨 1회 부여로 일괄 등록.
- 라벨 토글 필요 시 (CI fail 후 재시도) `gh api -X DELETE/POST issues/N/labels` 패턴 사용.

## 카테고리 룰
- 2026-05-23 `.claude/rules/git.md` 정식 갱신 완료 — `[app]`·`[test]` 카테고리 정식 등록 (분리 기준 표 + 분리 원칙 + 묶어도 되는 경우 + 예시 블록 모두 추가). 이 plan에서 사용한 카테고리는 모두 정식 룰과 일치.
