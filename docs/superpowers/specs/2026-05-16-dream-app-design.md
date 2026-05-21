# 꿈해몽 PWA — 설계 문서 (Design Spec)

- **작성일**: 2026-05-16
- **작성자**: puk0806
- **상태**: 🟢 1차 완성 — 사용자 최종 리뷰 대기
- **다음 단계**: 사용자 승인 → `writing-plans` 스킬로 구현 계획 작성

---

## 1. 한 줄 정의

> **사용자가 어젯밤 꿈을 적고 톤(캐주얼 / 자기 성찰 / 한국 전통)을 골라 누르면, Claude가 그 톤에 맞게 해몽해주는 PWA. 회원가입·서버 DB 없음. 브라우저 로컬에 히스토리만 저장.**

---

## 2. 핵심 가정 (Confirmed)

| 항목 | 결정 | 근거 |
|---|---|---|
| 형태 | 단발 해몽 도구 (입력→결과 1회) | 빠른 MVP, 회원·DB 부담 회피 |
| 톤 | 3종 — 캐주얼 엔터테인먼트 / 자기 성찰 다관점 / 한국 전통 — **사용자가 선택** | 사용자 요청: "3가지 모두 가능하게 하고싶어 선택해서" |
| 응답 구조 | **A안 — 단일 톤 모드** (선택한 톤으로만 응답, 결과 화면에서 "다른 톤으로 보기" 버튼 제공) | 사용자 의도와 일치, MVP에 가장 단순 |
| 플랫폼 | PWA (Next.js + manifest + service worker) | 설치 가능, 모바일 우선, 배포 단순(Vercel) |
| LLM | Anthropic Claude **Sonnet 4.6** (`claude-sonnet-4-6`) + 프롬프트 캐싱 via `@anthropic-ai/sdk` (Messages API). **Agent SDK 미사용** | Agent SDK는 장기 실행 컨테이너 필요 → Vercel 서버리스 비호환. 자산은 빌드 타임 임베드 방식으로 활용 |
| 자산 통합 | `.claude/agents/*.md`, `.claude/skills/humanities/*/SKILL.md`를 **빌드 타임에 시스템 프롬프트로 임베드**. 별도 §6.6 참조 | Claude.ai 대비 차별화 핵심. 한국 전통 해몽 · 융/프로이트 · 한국형 위기 자원 통째 흡수 |
| 저장 | **로컬(IndexedDB)만** — 회원·백엔드 DB 없음 | 프라이버시 우선, 백엔드 복잡도 0 |
| 비용 모델 | 무료 무제한 (사이드 프로젝트) | 사용자 결정. ⚠️ 외부 공개 시 한도·인증 추가 권고 |
| 안전 정책 | `dream-safety-classifier` **기본 켬**. 자해/위기 신호 감지 시 해몽 대신 한국 위기 자원(109, 1577-0199) 안내 카드 표시 | 윤리적 디폴트, 기존 도메인 에이전트 재활용 |
| UI 시스템 | **`@gugbab/styled-radix`** (Radix Themes 외관, 컴포넌트 35종) + `@gugbab/tokens` + `@gugbab/hooks` + `@gugbab/utils`. npm 게시됨(`gugbab` scope). | 사용자 보유 공용 패키지 재활용. 접근성·키보드 네비 기본 탑재. 별도 모노레포 합병 없이 npm 의존성으로 사용 |

---

## 3. 비기능 요구

| 항목 | 목표 |
|---|---|
| 응답 체감 시간 | 스트리밍 시작 < 2초, 전체 완료 < 15초 |
| 모바일 우선 | 360px 폭부터 깨짐 없이 동작 |
| 오프라인 | 앱 셸은 SW 캐시. 해몽 자체는 네트워크 필요 (오프라인 시 안내) |
| 접근성 | 키보드 네비게이션, 텍스트 대비 WCAG AA 이상 |
| 프라이버시 | 꿈 텍스트는 브라우저와 Anthropic API 외에는 어디에도 저장 안 됨. 서버 로그에도 본문 미기록 |

---

## 4. 아키텍처 개요

```
[브라우저 / PWA]
  ├ Next.js App Router (UI)
  ├ IndexedDB (idb 라이브러리)  ← 로컬 히스토리
  └ Service Worker (오프라인 셸 + manifest)
        │
        ▼  fetch /api/interpret  (SSE)
[Next.js API Route (서버리스)]
  ├ Zod 입력 검증
  ├ dream-safety-classifier 단계  ← 위기 신호면 해몽 차단 + 위기 자원 응답
  ├ Anthropic SDK + SSE 스트리밍
  └ 톤별 시스템 프롬프트 (프롬프트 캐싱)
        │
        ▼
[Anthropic API]
```

**원칙:**
- 백엔드 DB·인증·세션 없음. API Route는 Claude 프록시 + 안전 분류만.
- `ANTHROPIC_API_KEY`는 서버 환경변수. 클라이언트 노출 절대 금지.
- 스트리밍 SSE로 결과를 점진 렌더 — 체감 속도 ↑.

---

## 5. 사용자 화면 흐름 (3화면)

### 5.1 `/` 홈 — 입력 화면
- 큰 textarea: "어젯밤 꿈을 적어보세요"
- 톤 선택 칩 3개: `캐주얼` / `자기 성찰`(기본) / `한국 전통`
- **해석하기** 버튼
- 하단: 최근 해몽 3개(있으면) — 카드 클릭 시 결과 화면 복원

### 5.2 `/result/[id]` 결과 화면
- 상단: 입력한 꿈 요약 + 선택한 톤 배지
- 본문: 스트리밍되어 채워지는 해석 결과
- 하단 액션: `다른 톤으로 다시 보기` / `텍스트 복사` / `이 해몽 삭제`
- **안전 신호 감지 시**: 해몽 대신 위기 자원 안내 카드 표시 (109, 1577-0199 등)

### 5.3 `/history` 히스토리 화면
- IndexedDB에서 최근 N건 리스트 (날짜 · 톤 · 첫 문장)
- 항목 클릭 → `/result/[id]`
- 전체 삭제 버튼

---

## 6. 모듈/디렉토리 구조

```
app/
  ├ layout.tsx                  ← PWA manifest, SW 등록
  ├ page.tsx                    ← / 홈
  ├ result/[id]/page.tsx        ← 결과 화면 (스트리밍)
  ├ history/page.tsx            ← 히스토리
  └ api/interpret/route.ts      ← POST: 안전 분류 → Claude 스트리밍

components/
  ├ DreamInput.tsx              ← 입력 textarea + 톤 선택
  ├ ToneChips.tsx               ← 톤 3종 선택 칩
  ├ InterpretationView.tsx      ← 스트리밍 결과 렌더
  ├ SafetyResourceCard.tsx      ← 위기 자원 안내 카드
  └ HistoryList.tsx

lib/
  ├ claude.ts                   ← Anthropic SDK 래퍼 + 프롬프트 캐싱
  ├ safety.ts                   ← dream-safety-classifier 호출 로직
  ├ prompts/
  │   ├ casual.ts               ← 캐주얼 톤 시스템 프롬프트
  │   ├ reflective.ts           ← 자기 성찰(다관점) 시스템 프롬프트
  │   └ traditional.ts          ← 한국 전통 해몽 시스템 프롬프트
  ├ db.ts                       ← idb 래퍼 (DreamEntry CRUD)
  └ types.ts                    ← DreamEntry, Tone, SafetyVerdict

public/
  ├ manifest.json
  └ icons/...
```

### 6.5 사용자 자산 통합 전략 (Claude.ai 대비 차별화의 핵심)

**왜 이 섹션이 중요한가**: 단순히 `@anthropic-ai/sdk`로 Claude를 호출하기만 하면 "Claude.ai에 직접 묻기"와 차이가 거의 없다. 이 앱의 차별점은 **사용자가 만든 `.claude/agents/`와 `.claude/skills/`를 시스템 프롬프트로 흡수**하는 것이다.

#### 6.5.1 자산 매핑

| 자산 | 활용 위치 |
|---|---|
| `.claude/skills/humanities/korean-dream-interpretation-tradition/SKILL.md` | `lib/prompts/traditional.ts` system 프롬프트 |
| `.claude/skills/humanities/dream-psychology-jung-freud/SKILL.md` | `lib/prompts/reflective.ts` system 프롬프트 |
| `.claude/skills/humanities/dream-content-research/SKILL.md` | `lib/prompts/reflective.ts` system 프롬프트 |
| `.claude/skills/humanities/attachment-theory-basics/SKILL.md` | `lib/prompts/reflective.ts` system 프롬프트 |
| `.claude/skills/humanities/crisis-intervention-resources-korea/SKILL.md` | `lib/safety.ts` 분류기 system + `SafetyResourceCard` 데이터 |
| `.claude/skills/humanities/dream-content-privacy-ethics/SKILL.md` | 모든 톤의 공통 회피 규칙 |
| `.claude/agents/domain/dream-multi-perspective-synthesizer.md` | `reflective.ts`의 출력 포맷·금지·회피 규칙 |
| `.claude/agents/validation/dream-safety-classifier.md` | `safety.ts` 분류기 system 베이스 |
| `.claude/agents/validation/dream-interpretation-prompt-tester.md` | 출시 전 톤별 품질 검증 (런타임 X) |

#### 6.5.2 빌드 타임 임베드 메커니즘

```
.claude/skills/humanities/*/SKILL.md
.claude/agents/{domain,validation}/dream-*.md
        │
        ▼   scripts/compile-prompts.ts  (pnpm prebuild 단계)
        │
        ▼
lib/prompts/_compiled/{casual,reflective,traditional,safety-classifier}.ts
        │
        ▼   import 시 사용
lib/prompts/{casual,reflective,traditional}.ts  (런타임 시스템 프롬프트 조립)
```

- `scripts/compile-prompts.ts`는 `.claude/` 파일을 읽어 마크다운 본문을 추출해 TypeScript 문자열 상수로 변환한다
- v1.0: **원문 임베드** (단순). 토큰 부담은 프롬프트 캐싱으로 흡수
- v1.1 옵션: 핵심 발췌만 추출 / 매번 사용자 입력 키워드에 따라 동적 선택

#### 6.5.3 토큰·비용 영향

- 자산 임베드 후 시스템 프롬프트 추정 토큰:
  - `casual`: 200~400
  - `reflective`: 2,000~3,500 (가장 큼 — 다관점 흡수)
  - `traditional`: 800~1,500
- **프롬프트 캐싱** (`cache_control: ephemeral`) 적용 시 두 번째 호출부터 input 토큰 단가 10%로 떨어짐 → 동일 톤 재방문 비용 절감 큼
- TTL 기본 5분, 필요 시 `ENABLE_PROMPT_CACHING_1H` 환경변수로 1시간

#### 6.5.4 자산 변경 시 동기화

- `.claude/skills/` 또는 `.claude/agents/dream-*` 가 갱신되면 → `pnpm compile-prompts` 다시 실행 → `lib/prompts/_compiled/*` 갱신 → commit
- 빌드 파이프라인에 `prebuild: pnpm compile-prompts` 등록해 자동화

---

### 6.6 UI 패키지 통합 (`@gugbab/*`)

- **사용 패키지** (npm `gugbab` scope, 게시 완료):
  - `@gugbab/styled-radix` — Radix Themes 외관 컴포넌트 35종 (`grx-*` 클래스)
  - `@gugbab/tokens` — 디자인 토큰 → CSS variables
  - `@gugbab/hooks` — 11개 공용 React 훅
  - `@gugbab/utils` — 22개 프레임워크 독립 유틸
  - (자동 따라옴) `@gugbab/headless`

- **peer deps**: `react ≥ 18`, `react-dom ≥ 18` — 본 프로젝트는 **React 19** 사용

- **CSS 임포트** (한 번, `app/layout.tsx`):
  ```ts
  import '@gugbab/tokens/dist/radix.css';        // CSS 변수
  import '@gugbab/styled-radix/styles.css';      // 컴포넌트 스타일
  ```

- **컴포넌트 매핑**:

  | 우리 컴포넌트 | gugbab 사용 |
  |---|---|
  | `ToneChips` (톤 3종 단일 선택) | `ToggleGroup` (type="single") |
  | `DreamInput` 검증 | `Form` + textarea(커스텀) |
  | "다른 톤으로 보기" | `DropdownMenu` 또는 `Tabs` (UX 결정은 구현 시) |
  | `SafetyResourceCard` | `Dialog`(포커스 트랩) + `tel:` 링크 |
  | 로딩 인디케이터 | `Progress` (indeterminate) |
  | 알림 토스트(저장 불가 등) | `Toast` |
  | 히스토리 구분선 | `Separator` |
  | 길이 제한 안내 | `Tooltip` |

- **외부 의존성 0 원칙**: 모든 UI는 `@gugbab/*` 컴포넌트 + 토큰 CSS 변수로만 구성. MUI·Radix Themes 본가 패키지는 별도 설치하지 않음 (이미 styled-radix가 lookalike로 흡수).

---

## 7. 데이터 모델

### 7.1 타입 (`lib/types.ts`)

```ts
export type Tone = 'casual' | 'reflective' | 'traditional';

export type SafetyCategory =
  | 'null'                    // 안전 — 정상 해몽 진행
  | 'self_harm'               // 자해/자살 신호
  | 'trauma'                  // 트라우마 재경험
  | 'violence_toward_others'  // 타해 위협
  | 'severe_distress';        // 심각한 정서적 고통

export interface SafetyVerdict {
  category: SafetyCategory;
  confidence: number;         // 0..1
  rationale?: string;         // 디버깅용 (UI 노출 X)
}

export interface DreamEntry {
  id: string;                 // ULID (정렬 가능한 짧은 ID)
  createdAt: number;          // Unix ms
  dreamText: string;          // 사용자 입력 원문 (브라우저 로컬에만)
  tone: Tone;
  interpretation: string;     // 스트리밍 완료 후 누적 저장
  safetyVerdict: SafetyVerdict;
  modelId: string;            // 'claude-sonnet-4-6'
  schemaVersion: 1;
}
```

### 7.2 IndexedDB 스키마

- **DB 이름**: `gugbab-dream`
- **버전**: 1
- **ObjectStore**: `entries`
  - keyPath: `id`
  - index: `createdAt_idx` on `createdAt` (역순 정렬용)

### 7.3 보관 정책

- 최근 **100건** 유지 (LRU)
- 100건 초과 시 가장 오래된 항목 자동 삭제
- 사용자가 `/history`에서 단건 삭제 / 전체 삭제 가능
- **꿈 본문은 서버에 저장하지 않음** — 서버 로그에도 본문 미기록 (요약 hash만 디버깅용 옵션)

---

## 8. LLM 프롬프트·톤별 설계

### 8.1 공통 규약

- 시스템 프롬프트는 톤별로 분리 (`lib/prompts/{casual,reflective,traditional}.ts`)
- **프롬프트 캐싱**: 시스템 프롬프트 블록에 `cache_control: { type: 'ephemeral' }` 적용 — 같은 톤 재호출 시 비용·지연 절감
- User 메시지는 사용자 꿈 텍스트 1건
- 출력 형식: 마크다운 (`## 한 줄 요약`, 본문 섹션, 마무리)
- 파라미터: `temperature: 0.7`, `max_tokens: 1024`
- **공통 회피**: 단정형 예언, 의학·심리 진단, 미래 단정, 사주·점술 혼동

### 8.2 캐주얼 톤 (`casual.ts`)

- **정체성**: 가볍고 친근한 꿈 해석가
- **출력**:
  1. 한 줄 요약
  2. 2~3문단의 가벼운 해석
  3. 살짝 위트 있는 마무리 한 줄
- **톤**: 존댓말, 친근, 이모지 0~1개 허용
- **길이**: 250~400자

### 8.3 자기 성찰 톤 (`reflective.ts`) — 기본값

- **정체성**: 한국 전통 해몽 · 융 · 프로이트 다관점 통합 해석가
- **출력**:
  1. 한 줄 요약
  2. **세 관점 섹션** — 한국 전통 / 융(자기·그림자·아니마/아니무스) / 프로이트(소망 충족·억압)
  3. **나에게 묻는 질문 3개** — 자기 성찰 유도
- **톤**: 따뜻하고 진중, 평어/존댓말 혼용 금지(존댓말 유지)
- **길이**: 600~900자
- **도메인 자산 활용**: `humanities/dream-psychology-jung-freud`, `humanities/korean-dream-interpretation-tradition`

### 8.4 한국 전통 톤 (`traditional.ts`)

- **정체성**: 한국 전통 해몽 사전 기반 해석가
- **출력**:
  1. 한 줄 요약(길몽/흉몽/중립 라벨)
  2. 등장 상징별 전통 의미 (예: 이, 물고기, 물, 불, 뱀 등)
  3. 종합 한 단락
- **톤**: 차분, 약간 옛스러운 문어체 허용, 단 강한 길흉 단정 금지
- **길이**: 400~600자
- **도메인 자산 활용**: `humanities/korean-dream-interpretation-tradition`

---

## 9. 안전 정책 흐름

### 9.1 시퀀스

```
[POST /api/interpret]  ← Zod로 dreamText, tone 검증
        │
        ▼
[safety classifier]
   Claude Haiku 4.5에 분류 전용 짧은 프롬프트
   → JSON: { category, confidence, rationale }
        │
        ▼
   category === 'null' AND confidence ≥ 0.6 ?
        │           │
       YES         NO
        │           │
        ▼           ▼
[톤별 해몽    [해몽 차단 + 위기 자원 안내]
 LLM 호출]      - SSE 1회로 안전 카드 페이로드 전송 후 종료
   SSE          - 클라이언트는 SafetyResourceCard 렌더
 스트리밍       - 응답에 사용자 꿈 본문 재노출 ❌ (재트라우마 방지)
   │              - 위기 자원:
   ▼                 · 자살예방상담전화 109
[클라이언트          · 정신건강위기상담 1577-0199
 누적 렌더]          · 청소년 1388
                     · (확장 시) 우먼·이주민 등 추가
```

### 9.2 보수적 분기 규칙

- `confidence < 0.6` → 보수적으로 안전 카드 표시
- 분류기 자체 실패(timeout / 5xx) → 보수적으로 안전 카드 표시
- 톤이 `casual`이어도 안전 가드는 동일 적용 — **톤은 안전 정책을 우회하지 않음**

### 9.3 분류기 프롬프트 골자

- 모델: `claude-haiku-4-5` (저비용·빠름)
- 시스템 프롬프트: 5개 카테고리 정의 + 한국어 예시 각 1~2개 + JSON 반환 강제
- 토큰: 입력 ≤ 1.5KB, 출력 ≤ 100 토큰
- 캐시: 시스템 프롬프트 `ephemeral` 캐시 적용

---

## 10. 에러 처리·로딩 상태

### 10.1 서버(API Route) 에러 분류

| 상황 | HTTP | 사용자에게 보이는 메시지 |
|---|---|---|
| Zod 검증 실패 | 400 | "입력을 확인해주세요" |
| Anthropic 429 (rate limit) | 429 | "요청이 몰리고 있어요. 잠시 후 다시 시도해주세요" (exponential backoff 1회 자동 재시도) |
| Anthropic 5xx | 502 | "지금 해석이 어려워요. 잠시 후 다시 시도해주세요" |
| 분류기 타임아웃 (3s) | — | 보수적으로 SafetyResourceCard 노출 (정책 9.2) |
| 알 수 없는 오류 | 500 | "예상치 못한 오류가 발생했어요" |

- 서버 로그에는 traceId·timestamp·status·duration만 기록. **꿈 본문은 로그에 남기지 않음.**
- 에러 응답에 스택트레이스·내부 경로·모델명 노출 금지.

### 10.2 클라이언트

- App Router `app/error.tsx` 라우트별 ErrorBoundary 배치
- 네트워크 오프라인: `navigator.onLine` 감지 → "오프라인 상태입니다. 연결 후 다시 시도해주세요"
- IndexedDB 실패(사파리 프라이빗 모드 등): 메모리 fallback — 단발 해몽은 가능, "히스토리 저장 불가" 토스트

### 10.3 로딩 상태

- "해석하기" 클릭 → 톤 칩·버튼 비활성화 + "꿈을 풀어보는 중..." 인디케이터
- 첫 SSE 이벤트 수신 시 인디케이터 사라지고 글자 스트리밍 시작 — 글자가 채워지는 것 자체가 진행 표시
- 스트리밍 도중 중단(사용자 이탈/취소) 시 부분 텍스트는 저장하지 않음

---

## 11. 테스트 전략

### 11.1 단위 테스트 (`vitest`)

- `lib/safety.ts` — 카테고리 분기 5케이스 (null / self_harm / trauma / violence / severe_distress)
- `lib/safety.ts` — `confidence < 0.6` 보수 분기, 분류기 실패 시 보수 분기
- `lib/db.ts` — DreamEntry CRUD + LRU 100건 초과 시 가장 오래된 항목 삭제
- `lib/claude.ts` — 톤별 시스템 프롬프트가 캐시 키 일관성 유지
- `lib/prompts/*` — 금지어(예언 단정어 등) 미포함 정적 점검

### 11.2 컴포넌트 테스트 (`@testing-library/react`)

- `DreamInput` — 빈 입력 시 버튼 비활성
- `ToneChips` — 단일 선택 동작, 키보드 네비게이션
- `SafetyResourceCard` — 위기 자원 번호 노출, 전화 링크 `tel:` 스킴
- `InterpretationView` — 부분 텍스트 누적 렌더

### 11.3 통합·품질 점검 (수동, 출시 전 1회)

- 톤별 샘플 꿈 5종으로 응답 품질 점검 → `validation/dream-interpretation-prompt-tester` 에이전트 활용
- 안전 분류 시뮬레이션 5케이스 → `validation/dream-safety-classifier` 에이전트 활용
- Lighthouse PWA 점수 90+ / 모바일 360px 렌더 확인

### 11.4 시각 회귀 (Visual Regression) — UI 화면이 나오는 시점부터 ON

> 참고: sibling 프로젝트 `02_gugbab-claude-voca`의 `e2e/visual/` + `visual-regression.yml` 패턴을
> 단일 Next.js 앱 컨텍스트로 미러링한다. Storybook 없이 라우트 페이지를 직접 캡처한다.

**적용 시점**: 1단계 후반(첫 라우트 셸 생성 직후)부터. 2단계 컴포넌트 추가 시마다 spec 갱신.
**MVP 포함 사유**: UI 컴포넌트(`@gugbab/styled-radix`) 업그레이드·디자인 토큰 변경·CSS 회귀를
사용자 눈이 잡기 전에 자동 차단. 1인 사이드 프로젝트도 회귀 비용이 빠르게 누적된다.

#### 11.4.1 구조

```
e2e/visual/
├── routes.spec.ts                    라우트별 1 스크린샷 (/, /result/[id], /history)
├── components.spec.ts                컴포넌트 상태별 (ToneChips 선택/미선택, SafetyResourceCard 등)
├── __screenshots__/                  베이스라인 PNG (CI Linux 캡처 — 자동 관리)
├── __diff_archive__/pr-N/            머지된 PR의 시각 변화 영구 보존
└── README.md
```

#### 11.4.2 도구·설정

- **Playwright** `@playwright/test` + `toHaveScreenshot`
- **단일 viewport**: 1280×800 chromium (베이스라인 단일 환경)
- **모바일 viewport** (360×640): v1.1로 보류 — MVP에서는 데스크탑 1종만
- `snapshotPathTemplate`로 OS suffix 제거 → CI(Linux) 단일 베이스라인
- `maxDiffPixelRatio: 0.01`, `threshold: 0.2`, `animations: 'disabled'`
- `webServer.command: pnpm dev` (Next.js dev 서버 자동 기동, 3000 포트)

#### 11.4.3 비결정 요인 차단

| 요인 | 대응 |
|---|---|
| LLM 스트리밍 응답 | `page.route('/api/interpret', ...)` 로 mocked SSE 응답 주입 (결정론 fixture) |
| IndexedDB 누적 히스토리 | `addInitScript`로 `indexedDB.deleteDatabase('gugbab-dream')` 호출 |
| `crypto.randomUUID` / ULID | `addInitScript`로 시드 고정 |
| `Date.now()` | 필요한 spec에서 시간 freeze (`page.clock` 또는 fixture) |
| 폰트 로드 타이밍 | `page.waitForLoadState('networkidle')` + 컴포넌트 visible 대기 |

#### 11.4.4 CI 워크플로우 (`.github/workflows/visual-regression.yml`)

**compare 모드** (기본):
- 베이스라인 있고 diff 없음 → ✅ PASS
- 베이스라인 있고 diff 있음 → ❌ FAIL · PR 코멘트에 expected/actual/diff PNG 인라인 표시
- 베이스라인 없음 (신규 라우트) → ❌ FAIL · 신규 라우트의 actual PNG 표시

**accept 모드**:
- PR에 `accept-baseline` 라벨 부여 → `pnpm test:visual:update` → PNG 자동 commit + push to PR 브랜치
- status 직접 등록 → 다음 compare 통과 → 머지 가능

**머지 후**:
- `archive-vr-diffs.yml`이 `vrt-snapshots/pr-N` 브랜치의 PNG를 main의 `__diff_archive__/pr-N/`으로 영구 보존
- 두 layer 보존: ① `vrt-snapshots/**` 브랜치 (PR 코멘트 raw URL 소스), ② main의 `__diff_archive__/` (백업)

#### 11.4.5 npm 스크립트

```json
"test:visual": "playwright test",
"test:visual:update": "playwright test --update-snapshots",
"test:visual:report": "playwright show-report"
```

#### 11.4.6 로컬 검증 정책

- 베이스라인은 **반드시 CI에서 갱신** — 로컬 macOS에서 캡처한 PNG는 commit 금지
- 로컬은 비교 용도만 (`pnpm test:visual`) — 폰트 차이로 실패할 수 있음

### 11.5 E2E (기능)

- MVP에서는 시각 회귀로 충분. **기능 E2E는 v1.1 이후** Playwright 도입 (입력→스트리밍→히스토리 저장 플로우).

---

## 12. 로드맵 / Phase별 작업 목록

> 상세 체크리스트는 [2026-05-16-dream-app-todo.md](./2026-05-16-dream-app-todo.md)에 동기화한다.

| Phase | 목표 | 예상 일수 |
|---|---|---|
| 1. 초기화 | Next.js 15 + PWA + 의존성 부트스트랩, 환경변수, Vercel 1회 배포 점검 | 1~2일 |
| 2. 핵심 구현 | API Route, 톤 프롬프트 3종, 안전 분류기, IndexedDB, 3화면 UI | 5~7일 |
| 3. 안정화 | 에러 경계, 오프라인, 톤별 품질 점검, 안전 분류 시뮬레이션, Lighthouse | 2~3일 |
| 4. 배포 | Vercel 프로덕션, OG/메타, 지인 5명 베타, 피드백 수렴 | 1일 |
| v1.1+ | "다른 톤으로 누적 보기"(C안), 디자인 무드 다듬기, Playwright E2E | — |

**완료 정의(DoD) — MVP:**
- [ ] 3톤 모두 정상 응답
- [ ] 자해 시뮬레이션 입력에서 위기 자원 카드만 노출되고 해몽 LLM은 호출되지 않음
- [ ] IndexedDB에 100건 LRU 동작
- [ ] PWA 설치 가능 (홈 화면 추가 → 오프라인 시 셸 렌더)
- [ ] Lighthouse PWA 90+ / 모바일 360px 깨짐 없음
- [ ] 서버 로그에 꿈 본문 미기록 확인

---

## 부록 A. 후속 결정 사항 (Open Questions)

- [ ] 디자인 무드 — 어두운 신비/별빛 톤 vs 밝은 미니멀 (UI 설계 단계에서 결정)
- [ ] 외부 공개 시 한도 도입 방식 (IP·세션 기반 일일 N회)
- [ ] OG 이미지·SEO 메타 (출시 직전)
- [ ] PWA 아이콘 세트 디자인

---

## 변경 로그

| 일자 | 변경 |
|---|---|
| 2026-05-16 | 초안 작성. 설계 1/3 (아키텍처·화면 흐름·모듈 구조) 합의 완료 |
| 2026-05-16 | 설계 2/3 (데이터 모델·LLM 프롬프트·안전 정책) 작성 |
| 2026-05-16 | 설계 3/3 (에러 처리·테스트 전략·로드맵) 작성. 1차 완성 — 사용자 최종 리뷰 대기 |
| 2026-05-16 | UI 시스템 결정: `@gugbab/styled-radix` (Radix Themes 외관) + tokens/hooks/utils. 섹션 6.5 추가, 핵심 가정 표에 UI 행 추가 |
| 2026-05-16 | Claude Agent SDK 검토 결과 Vercel 서버리스 비호환 확인. **C안 채택** — `@anthropic-ai/sdk` 유지 + 자산 빌드 타임 임베드. §6.5(자산 통합 전략) 신규 추가, 기존 UI 섹션은 §6.6으로 이동. 핵심 가정 표에 자산 통합 행 추가 |
| 2026-05-21 | **시각 회귀 테스트 MVP 포함 결정**. §11.4 신규(sibling `02_gugbab-claude-voca` 패턴 미러링: Playwright + `toHaveScreenshot` + CI Linux 단일 베이스라인 + `accept-baseline` 라벨 워크플로우 + `__diff_archive__` 영구 보존). 기존 §11.4 E2E는 §11.5로 이동. UI 화면이 나오는 1단계 후반부터 ON, 2단계 컴포넌트 추가 시마다 spec 갱신 |
