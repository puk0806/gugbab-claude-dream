# 꿈해몽 PWA — Phase 3 채팅·음성 재설계 스펙

- **작성일**: 2026-06-05
- **작성자**: puk0806
- **상태**: 🟡 작성 완료 — 구현 계획 대기
- **이전 스펙**: [2026-05-16-dream-app-design.md](./2026-05-16-dream-app-design.md)
- **배경**: Phase 2 동작 검증 완료 후 UX 전면 재설계. 채팅 + 음성 I/O + 품질 개선.

> **⚠️ 후속 변경 (2026-07-08)**: 이 문서의 LLM 레이어(Gemini 2.5 Flash 직접 호출, `GEMINI_API_KEY`)는
> **gugbab-claude-relay 프록시 경유 Claude**(deep: opus-4-8 / fast: haiku-4-5, `RELAY_URL`·`RELAY_SECRET`)로 대체됨.
> `/api/chat` 엔드포인트·SSE 이벤트 계약(`chunk`/`done`/`error`)은 그대로 유지.
> 최신 상태는 [2026-05-16-dream-app-todo.md](./2026-05-16-dream-app-todo.md) 3.5단계와 `dream-app.html` 참조.

---

## 1. 재설계 배경

### 1.1 기존 스펙의 문제

| 문제 | 내용 |
|---|---|
| 1회성 구조 | 꿈 입력 → 결과 1회로 종료. 후속 질문·맥락 확장 불가 |
| 안전 분류기 과민 | 사소한 꿈에도 위기 상담센터 카드 표시 → 개인 용도에 맞지 않음 |
| 캐주얼 톤 품질 저하 | `casual.ts`가 스킬 자산을 거의 임베드 안 함 (`privacy-ethics` 1개만) → 스킬·에이전트 지식 미반영 |
| 텍스트 입력만 | 음성 입력·출력 없음 |

### 1.2 재설계 목표

- **대화형**: 꿈 1개 = 채팅 세션. 후속 질문으로 해석 깊어짐
- **음성 I/O**: 마이크 입력 + TTS 출력 (브라우저 내장, 비용 0)
- **안전 분류기 제거**: 개인 용도, 과민 차단 불필요
- **품질 향상**: 스킬·에이전트 자산을 제대로 활용한 캐주얼 + 깊이 있는 해석

---

## 2. 핵심 변경 사항 (기존 스펙 대비)

| 항목 | Phase 2 (기존) | Phase 3 (신규) |
|---|---|---|
| 입력 방식 | textarea 텍스트 | 텍스트 + 마이크 음성 |
| 출력 방식 | 화면 텍스트 렌더 | 텍스트 + TTS 음성 읽기 |
| 대화 구조 | 1회 입력 → 1회 결과 | 꿈 1개 = 채팅 세션 (멀티턴) |
| 안전 분류기 | Haiku 분류 → 위기 카드 | **완전 제거** |
| 톤 선택 | 캐주얼/자기성찰/한국전통 3종 | **캐주얼 고정** (ToneChips 제거) |
| 시스템 프롬프트 | 캐주얼: 스킬 1개만 / 리플렉티브: 6개 | **단일 프롬프트에 모든 스킬 통합** |
| 화면 구조 | `/` 홈 · `/result/[id]` · `/history` | `/` 채팅 · `/history` · `/session/[id]` |
| API 엔드포인트 | `POST /api/interpret` (단일 메시지) | `POST /api/chat` (messages 배열) |

---

## 3. 아키텍처

```
[브라우저 / PWA]
  ├ Web Speech API — SpeechRecognition  (음성→텍스트, 비용 0)
  ├ Web Speech API — SpeechSynthesis    (텍스트→음성, 비용 0)
  ├ Chat UI (메시지 리스트 + 입력 바)
  └ IndexedDB — DreamSession (대화 히스토리 로컬 저장)
        │
        ▼  POST /api/chat  (SSE, messages 배열)
[Next.js API Route]
  ├ Zod 입력 검증 (messages: Message[])
  ├ 통합 시스템 프롬프트 조립 (모든 스킬 자산 임베드)
  └ Gemini 2.5 Flash SSE 스트리밍 (멀티턴 contents 배열)
        │
        ▼
[Google Gemini API]
```

**원칙**:
- 안전 분류기(`lib/safety.ts`) 완전 제거
- `ANTHROPIC_API_KEY` 관련 코드 모두 제거 (Gemini 유지)
- `GEMINI_API_KEY` 서버 환경변수 — 클라이언트 노출 절대 금지
- 스트리밍 SSE 유지 (체감 속도 ↑)

---

## 4. 화면 구조

### 4.1 `/` — 채팅 홈

```
┌─────────────────────────────────┐
│  꿈 해몽 💬           [히스토리] │
├─────────────────────────────────┤
│                                 │
│   (세션 시작 전: 환영 메시지)    │
│   "어젯밤 꿈을 말해보세요"       │
│                                 │
│  ┌──────────── 메시지 리스트 ────────────┐
│  │ [사용자] 뱀 꿈 꿨어             │
│  │ [AI] 오 뱀 꿈이군요! 뱀이 어떻게...│
│  │ [사용자] 빨간색 뱀이었어          │
│  │ [AI] 빨간 뱀 — 꽤 강렬한...     │
│  └───────────────────────────────┘
│
│  ┌──────────────────── 입력 바 ──────────────────────┐
│  │ [🎤] [텍스트 입력창.................] [🔊] [전송] │
│  └───────────────────────────────────────────────────┘
│
│  [새 꿈 이야기하기] (진행 중 세션 있을 때만 표시)
└─────────────────────────────────┘
```

- 페이지 진입 시: 빈 채팅 또는 가장 최근 세션 복원 (선택)
- "새 꿈 이야기하기": 현재 세션 저장 → 새 빈 세션 시작

### 4.2 `/history` — 히스토리

- DreamSession 리스트 (최신순)
- 각 항목: 첫 메시지 앞 50자 요약 + 날짜 + 대화 수
- 클릭 → `/session/[id]` (읽기 전용)
- 전체 삭제 버튼

### 4.3 `/session/[id]` — 과거 세션 (읽기 전용)

- 저장된 대화 복원해서 표시
- 입력 바 없음 (과거 세션은 읽기만)
- "이 꿈 다시 이야기하기" 버튼 → 홈에서 새 세션으로 맥락 연결

---

## 5. 대화 흐름 설계

### 5.1 세션 라이프사이클

```
사용자 접속
    │
    ├─ 기존 세션 없음 → 빈 채팅 표시 (환영 메시지)
    └─ 기존 세션 있음 → 마지막 세션 자동 복원

사용자 첫 메시지 (꿈 설명)
    │
    ▼
새 DreamSession 생성 (IDB 저장)
    │
    ▼
AI 첫 응답: 해석 + 후속 질문 유도
    │
    ▼
사용자 후속 메시지 (맥락 추가)
    │
    ▼
AI 응답: 추가 정보 반영한 더 깊은 해석
    │
    ▼ (반복)
    │
"새 꿈 이야기하기" 클릭
    │
    ▼
현재 세션 저장 완료 → 새 세션 시작
```

### 5.2 대화 예시

```
[사용자] 어젯밤에 뱀이 나왔어
[AI]     오 뱀 꿈이군요! 뱀이 어떻게 나왔어요?
         쫓아오는 건지, 가만히 있는 건지에 따라 느낌이 달라요 🐍
[사용자] 그냥 가만히 있었는데 빨간색이었어
[AI]     빨간 뱀이라면 꽤 강렬한 상징이에요.
         한국 전통 해몽에서 뱀은 재물·직관을 상징하는데,
         빨간색이 더해지면 강한 에너지·열정과 연결될 수 있어요.
         혹시 꿈에서 무서웠나요, 아니면 신기한 느낌이었나요?
[사용자] 신기한 느낌이었어
[AI]     그럼 더 좋은 방향이에요! 무섭지 않고 신기하게 봤다는 건
         무의식에서 그 에너지를 긍정적으로 받아들이는 신호일 수 있거든요...
```

---

## 6. 음성 I/O

### 6.1 음성 입력 (Web Speech API — SpeechRecognition)

- **기술**: 브라우저 내장 `webkitSpeechRecognition` / `SpeechRecognition`
- **비용**: 0 (서버 API 없음)
- **지원**: Chrome, Edge, Safari (iOS 포함). Firefox 미지원 → 마이크 버튼 숨김
- **동작**:
  1. 🎤 버튼 탭 → 녹음 시작 (빨간 점 애니메이션)
  2. 음성 인식 중 → 텍스트 입력창에 실시간 transcript 채움
  3. 발화 종료 감지 또는 🎤 재탭 → 녹음 중지
  4. 텍스트 입력창에 남은 채로 → 사용자가 수정 후 전송, 또는 바로 전송
- **언어**: `ko-KR` 고정

### 6.2 음성 출력 (Web Speech API — SpeechSynthesis)

- **기술**: 브라우저 내장 `SpeechSynthesis`
- **비용**: 0 (서버 API 없음)
- **동작**:
  - 🔊 토글 ON 상태에서 AI 응답 완료 시 자동 읽기
  - 스트리밍 중 청크 단위 읽기 X → **완료 후 전체 읽기** (끊김 방지)
  - 새 응답 시작 시 이전 읽기 즉시 중단
- **음성**: `ko-KR` 우선, 없으면 기기 기본 한국어 음성
- **기본값**: 🔊 OFF (처음엔 텍스트만, 사용자가 켜는 방식)

### 6.3 lib/speech.ts

```ts
// SpeechRecognition 래퍼
export function createRecognizer(onResult: (text: string) => void): SpeechRecognizer

// SpeechSynthesis 래퍼
export function speak(text: string): void
export function stopSpeaking(): void
export function isSpeechSupported(): boolean
export function isRecognitionSupported(): boolean
```

---

## 7. 품질 향상 전략

### 7.1 스킬 미작동 이슈 (근본 원인)

기존 `casual.ts`는 `SKILL_HUMANITIES_DREAM_CONTENT_PRIVACY_ETHICS` 1개만 import.
`reflective.ts`는 6개 스킬·에이전트를 임베드해 품질이 높았음.

**결론**: 캐주얼 톤이 스킬 지식 없이 동작 → 일반 LLM과 차이 없었음.

### 7.2 새 통합 시스템 프롬프트 (`lib/prompts/chat.ts`)

단일 프롬프트에 **모든 관련 스킬 자산 통합**:

```ts
import {
  SKILL_HUMANITIES_KOREAN_DREAM_INTERPRETATION_TRADITION,  // 한국 전통 해몽 사전
  SKILL_HUMANITIES_DREAM_PSYCHOLOGY_JUNG_FREUD,             // 융·프로이트 심리학
  SKILL_HUMANITIES_DREAM_CONTENT_RESEARCH,                  // 현대 꿈 연구
  SKILL_HUMANITIES_ATTACHMENT_THEORY_BASICS,                // 애착 이론
  SKILL_HUMANITIES_RELATIONAL_PATTERN_ANALYSIS,             // 관계 패턴 분석
  AGENT_RESEARCH_DREAM_MULTI_PERSPECTIVE_SYNTHESIZER,       // 다관점 통합 에이전트
  SKILL_HUMANITIES_DREAM_CONTENT_PRIVACY_ETHICS,            // 윤리 규칙
} from './_compiled';
```

**프롬프트 구조**:
1. **정체성**: 깊은 지식을 가진 친근한 꿈 해석 친구
2. **대화 지침**: 첫 메시지는 해석 + 후속 질문 유도. 정보가 쌓일수록 해석 깊어짐
3. **지식 기반**: 위 스킬 자산 전체 임베드 (한국 전통 + 융/프로이트 + 현대 연구)
4. **톤 규약**: 캐주얼하고 친근하되, 답변은 지식 기반으로 정확하게
5. **회피 규칙**: 단정형 예언, 의학 진단, 사주 혼동 금지

### 7.3 대화형 구조의 품질 향상

멀티턴으로 인한 자연스러운 품질 향상:
- 첫 메시지: 꿈 전체 윤곽 파악 + 핵심 상징 해석
- 2~3번째: 세부 정보(색, 감정, 인물) 반영한 정확한 해석
- 이후: 사용자 반응에 맞춰 더 깊거나 가볍게 조절

---

## 8. API 설계 변경

### 8.1 제거

```
DELETE  /api/interpret
DELETE  lib/safety.ts
DELETE  lib/crisis-resources.ts
DELETE  lib/types.ts (일부 — SafetyVerdict, SafetyCategory, Tone 제거)
```

### 8.2 신규: `POST /api/chat`

**요청**:
```ts
{
  messages: Array<{
    role: 'user' | 'model';
    content: string;
  }>;
  sessionId: string;
}
```

**응답**: SSE 스트림
```
data: {"type":"chunk","text":"빨간 뱀이라면..."}
data: {"type":"chunk","text":"강렬한 상징이에요"}
data: {"type":"done","sessionId":"01J..."}
data: {"type":"error","message":"..."}
```

**처리 흐름**:
```
Zod 검증
  │
  ▼
getSystemPrompt() → chat.ts (통합 프롬프트)
  │
  ▼
Gemini generateContentStream({
  systemInstruction: chatPrompt,
  contents: messages (role 변환: 'assistant' → 'model')
})
  │
  ▼
SSE chunk 스트리밍
```

### 8.3 Zod 스키마

```ts
const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string().min(1).max(4000),
  })).min(1).max(50),
  sessionId: z.string().ulid(),
});
```

---

## 9. 데이터 모델

### 9.1 타입 (`lib/types.ts` 변경)

```ts
// 제거: Tone, SafetyCategory, SafetyVerdict
// 유지: DreamEntry (하위 호환 — v1 데이터 읽기용, 신규 저장 안 함)

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface DreamSession {
  id: string;               // ULID (정렬 가능)
  createdAt: number;        // Unix ms
  messages: ChatMessage[];  // 전체 대화 기록
  summary: string;          // 첫 사용자 메시지 앞 50자
  modelId: string;          // 'gemini-2.5-flash'
  schemaVersion: 2;
}
```

### 9.2 IndexedDB 변경

| 항목 | 기존 | 신규 |
|---|---|---|
| DB 이름 | `gugbab-dream` | `gugbab-dream` (유지) |
| DB 버전 | 1 | 2 |
| ObjectStore | `entries` | `sessions` (신규 추가) |
| 키 | `id` | `id` |
| 인덱스 | `createdAt_idx` | `createdAt_idx` |
| LRU 정책 | 100건 | 100건 (유지) |

v1 마이그레이션: `entries` ObjectStore는 유지(읽기 전용). v2에서 신규 저장은 `sessions`에만.

---

## 10. 컴포넌트 변경

### 10.1 제거

- `components/DreamInput.tsx` (textarea + 버튼)
- `components/ToneChips.tsx` (톤 선택)
- `components/InterpretationView.tsx` (SSE 단방향 렌더)
- `components/SafetyResourceCard.tsx` (위기 자원 카드)

### 10.2 신규

| 컴포넌트 | 역할 |
|---|---|
| `components/ChatView.tsx` | 메시지 리스트 + 스크롤 자동 하단 |
| `components/MessageBubble.tsx` | 사용자/AI 메시지 버블 |
| `components/ChatInput.tsx` | 텍스트 입력 + 🎤 마이크 버튼 + 🔊 TTS 토글 + 전송 |
| `components/TypingIndicator.tsx` | AI 응답 대기 중 점 애니메이션 |

### 10.3 유지 (변경 없음)

- `components/HistoryList.tsx` — DreamSession 기반으로 타입만 교체

---

## 11. 페이지 변경

| 경로 | 기존 | 신규 |
|---|---|---|
| `/` | 홈 (DreamInput + 최근 3건) | 채팅 홈 (ChatView + ChatInput) |
| `/result/[id]` | 결과 화면 (단방향) | **제거** |
| `/history` | 히스토리 리스트 | 유지 (DreamSession 기반으로 타입 교체) |
| `/session/[id]` | 없음 | **신규** (읽기 전용 세션 복원) |

---

## 12. 테스트 전략 변경

### 12.1 제거

- `e2e/visual/components.spec.ts` — `SafetyResourceCard`, `ToneChips` spec 삭제

### 12.2 업데이트

- `e2e/visual/routes.spec.ts` — `/result/[id]` → `/session/[id]` 교체
- `e2e/visual/_fixtures/sse-mock.ts` — `/api/chat` SSE 포맷으로 업데이트

### 12.3 신규 수동 검증 (출시 전)

- 마이크 입력 → 텍스트 변환 → 전송 흐름 (Chrome, Safari)
- TTS 자동 읽기 ON/OFF 토글
- 5턴 이상 대화에서 맥락 유지 확인
- Firefox에서 마이크 버튼 숨김 확인

---

## 13. 환경변수 변경

```bash
# 제거
# (없음 — GEMINI_API_KEY는 Phase 2부터 이미 있음)

# 신규 (선택)
NEXT_PUBLIC_DEFAULT_TTS=false  # TTS 기본값 (OFF 권장)
```

---

## 14. 로드맵

| Phase | 목표 |
|---|---|
| **3-A** | 불필요 코드 제거 (safety, ToneChips, InterpretationView, /result) |
| **3-B** | 통합 시스템 프롬프트 작성 (`lib/prompts/chat.ts`) + `/api/chat` 엔드포인트 |
| **3-C** | ChatView + ChatInput + MessageBubble + TypingIndicator 컴포넌트 |
| **3-D** | 홈 페이지 채팅 UI 전환 + IDB DreamSession CRUD |
| **3-E** | `lib/speech.ts` (Web Speech API) + 마이크/TTS 버튼 ChatInput 통합 |
| **3-F** | `/session/[id]` 읽기 전용 페이지 + `/history` 타입 교체 |
| **3-G** | 시각 회귀 spec 업데이트 + 동작 검증 |

---

## 변경 로그

| 일자 | 변경 |
|---|---|
| 2026-06-05 | Phase 3 채팅·음성 재설계 스펙 초안 작성. 안전 분류기 제거·채팅 UI·음성 I/O·품질 향상 설계 확정 |
