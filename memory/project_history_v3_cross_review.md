---
name: history-v3-cross-review
description: 이력 압축 v3 — health 세션이 크로스 리뷰로 클라이언트 압축을 @gugbab/utils 위임으로 교체 (2026-08-14, 미커밋)
metadata:
  node_type: memory
  type: project
---

2026-08-14, **health 앱 세션(04_gugbab-health)이 두 앱의 이력 압축 구현을 크로스
리뷰**한 뒤, 사용자 승인 하에 이 레포를 직접 수정했다 (dream 터미널 세션은
피어 목록 미등록으로 세션 간 메시지 불가 → 사용자가 "방법 A: health 세션이
직접 수정"을 선택).

## 배경 — 크로스 리뷰 결과

두 앱 모두 relay 입력 상한(2026-08-14) 대응을 구현했는데 서로 장단점이 달랐다:

- **dream이 더 좋았던 것** → health에 이식 완료: 예산 안전 마진(90KB),
  프록시 사전 가드, adversarial 테스트(relay body 키 집합 고정)
- **health가 더 좋았던 것** → 이 레포에 이번에 반영: 클라이언트 압축의
  공통 유틸 위임(작업 요청 문서의 "로직 재구현 금지" 준수), 클라이언트
  바이트 예산, 재시도 시 바이트 예산 축소

## 이 레포에 반영된 변경 (브랜치 feature/relay-input-limits, 미커밋)

1. **lib/chat-history.ts** — `toOutgoingMessages`를 자체 구현에서
   `@gugbab/utils`의 `compressHistory` + `fitMessagesToBudget` 조합으로 교체.
   role이 `user|model`이라 유틸 계약(`user|assistant`)과 매핑 후 되돌리는
   구조. 정책 값만 앱이 결정: `KEEP_RECENT_TURNS = 2`(기존 "최근 4개 메시지"
   → "최근 2왕복" turn 단위로 의미 변경), 개수 30, 바이트 예산 90KB.
   동작 변화 2가지: ① 클라이언트에도 바이트 예산 적용(기존엔 글자수만이라
   최악 360KB 전송 가능했음) ② 요약이 원문보다 크면 원문 유지(교체 이득
   판정), 꼬리 model 메시지 제거(relay 규약: 마지막 메시지 user)
2. **lib/relay-limits.ts** — `RETRY_BUDGET_BYTES = 45_000` 신설
3. **app/api/chat/route.ts** — history-budget 400 재시도 시 개수(→5)만
   조이던 것을 바이트 예산도 절반(45KB)으로 함께 축소 (상수 drift 흡수)
4. 테스트 갱신: chat-history.test.ts를 turn 단위 보존·바이트 예산 드롭·
   첫/마지막 user 계약·과대 요약 원문 유지에 맞게 재작성, relay-limits.test.ts에
   RETRY_BUDGET_BYTES 검증 추가

검증: vitest 115개 전부 통과, tsc 클린, biome 클린 (2026-08-14).

## 남은 것

- 커밋·PR은 사용자 명시 요청 대기 ([[commit-push-user-approval]] 참조).
  health 세션이 만진 변경은 dream 세션의 기존 미커밋 변경(route.ts,
  ChatInput 등) 위에 쌓여 있으므로 같은 브랜치에서 함께 커밋하면 된다
- health에는 있고 dream에는 없는 것: 크로스 세션 요약 주입(health의
  recentMealSummaries 상당 — 다른 세션 요약을 systemPrompt에 넣는 기능).
  [[dream-history-summary]]의 보류 후속(DreamSession.summary AI 요약 교체)과
  묶어서 진행하면 자연스러움 — 사용자 요청 대기

관련: [[dream-history-summary]], [[feature-branch-workflow]]
