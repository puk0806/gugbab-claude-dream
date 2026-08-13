# 히스토리 대화 이어하기 (Session Resume) — 설계

- 날짜: 2026-08-13
- 상태: 설계 확정 (사용자 승인)

## 목적

히스토리에서 과거 대화를 열면 지금은 읽기 전용 화면(`/session/[id]`)만 보인다.
과거 대화를 열었을 때 **홈 꿈해몽 대화창과 완전히 동일한 화면**에서 그 대화를 이어서
계속할 수 있게 한다.

## 요구사항

1. 히스토리 → 과거 대화 진입 시, 홈과 똑같은 대화 화면에 과거 메시지가 채워진 상태로 열린다
   (별도의 "히스토리 뒤로가기" 헤더 없음 — 홈 헤더 그대로: 타이틀·모델 칩·설치 버튼·히스토리 링크)
2. 하단 입력창으로 바로 이어서 대화할 수 있다 (스트리밍·에러 배너·TTS·모델 선택 모두 홈과 동일)
3. 이어서 한 대화는 **같은 세션(id)에 이어붙어 IndexedDB에 저장**된다 (히스토리 목록에 반영)
4. 존재하지 않는 세션 id로 진입하면 기존과 동일하게 "대화를 찾을 수 없어요" 안내
5. 기존 "읽기 전용 — 홈으로" 안내 문구는 제거

## 설계

### 컴포넌트 구조 — 화면 전체 공유

`app/page.tsx`의 화면 전체(헤더 포함)를 `components/ChatScreen.tsx`(client)로 추출한다.

```
ChatScreen ({ initialSession?: DreamSession })
├── header: 꿈해몽 💬 · 모델 칩 · InstallButton · 히스토리 링크
├── ChatView (messages + streamingText)
├── 에러 배너
├── "새 꿈 이야기하기" 버튼
├── ChatInput (TTS 토글 포함)
└── ModelSheet
```

- `app/page.tsx` → `<ChatScreen />` (기존과 동일: 빈 세션 시작)
- `app/session/[id]/page.tsx` → IDB `getSession(id)` 로드 완료 후
  `<ChatScreen initialSession={session} />`. 로딩 중 null, 미존재 시 기존 not-found UI 유지

### 훅 변경

`useChatSession`에 `initialSession?: DreamSession | null` 옵션 추가 —
`useState`의 초기값으로만 사용한다. `sendMessage`는 세션 state 기반으로 이미
이력 압축(`toOutgoingMessages`) 포함 동작하므로 추가 변경 없음.

### 동작 규칙

| 항목 | 규칙 |
|------|------|
| 모델 | 현재 선택 모델(localStorage) 사용 — 과거 대화의 modelId를 강제하지 않음 (홈과 동일 규칙) |
| 저장 | 같은 세션 id로 `saveSession` 덮어쓰기 — createdAt·summary 유지, modelId는 최신 응답 기준 갱신 |
| "새 꿈 이야기하기" | 세션 페이지에서는 URL(`/session/[id]`)과 state가 어긋나지 않도록 **홈(`/`)으로 이동** |
| 세션 페이지 재방문 | IDB에서 최신 상태 로드 (이어한 대화 포함) |

### 에러 처리

- IDB 로드 실패 → not-found UI (기존 동작 유지)
- 전송 실패 → ChatScreen 내 에러 배너 (홈과 동일 — 기존 useChatSession errorMsg 경로)

## 테스트

- `useChatSession`: `initialSession` 주입 시 session 초기값 반영, 이어서 send 시 기존 메시지 뒤에 이어붙음
- `ChatScreen`: 홈 기존 테스트를 ChatScreen 기준으로 이전해 GREEN 유지
- 세션 페이지: 로드 후 입력창 렌더 + 전송 시 같은 id로 저장 / 미존재 id는 not-found
- "새 꿈 이야기하기" 클릭 시 홈 이동 (세션 페이지 한정)

## 산출물

- `components/ChatScreen.tsx` (+ CSS Module — 기존 `page.module.css` 이동/공유)
- `app/page.tsx`·`app/session/[id]/page.tsx` 축소
- `lib/useChatSession.ts` 옵션 추가
- 테스트 갱신, 대시보드(`docs/superpowers/specs/dream-app.html`) 단계 추가
