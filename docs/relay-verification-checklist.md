# relay 연동 최종 검증 체크리스트 — dream

> relay(`05_gugbab-claude-relay`) 2026-08-18 기준 최신 계약에 대한 앱 측 확인 항목.
> 이 파일은 relay 세션에서 생성함. 새 dream 세션에 "이 파일 읽고 검증 진행해줘"로 전달.

## relay 최신 상태 (전부 프로덕션 배포·검증 완료)

| 날짜 | 변경 | 앱 영향 |
|------|------|---------|
| 08-13 | 한글 멀티바이트 청크 오염 수정 (PR #17) | `stream inconsistency` 오탐 소멸 |
| 08-14 | 입력 상한 도입 (PR #19): 메시지 20,000자·100개·합산 UTF-8 100,000바이트·systemPrompt 20,000자 | 초과 시 400 |
| 08-14 | 400에 `violation` 필드 (PR #21): `"history-budget"`(트림 재시도 가능) / `"message-size"`(입력 축소 안내) | `isHistoryValidationError`가 이 필드로 판정 |
| 08-18 | **요약 마커 쌍·런 노출 수정 (PR #22)**: haiku가 `<<<SUMMARY>>>`를 반복 출력해도 마커 미노출·summary 정상 탑재 | 채팅 말풍선 마커 오염 소멸 |

relay 측 실측: haiku·wantSummary 3회 — 마커 노출 0·error 0·summary 탑재 확인 (08-18).

## 앱 측 확인 항목

> **검증 완료: 2026-08-19 (프로덕션 실측 + 코드 확인). 전 항목 PASS.**

### A. 마커 노출 버그 해소 (PR #22) — 실 UI 확인
- [x] 프로덕션 dream 앱에서 haiku로 채팅 5회 이상 — 말풍선에 `<<<SUMMARY>>>` 또는 요약 원문이 보이지 않는지
  → haiku 3회 프로덕션 실측: chunk에 마커 노출 0, done.summary 3회 모두 정상 탑재
- [x] 각 응답 후 IndexedDB에 summary가 저장되는지 (유실 시 원문 유지 폴백 동작 포함)
  → done.summary 정상 수신 확인 + `useChatSession`이 aiMsg.summary로 저장(코드 검증). 유실 시 원문 유지 폴백은 `chat-history.ts` getSummary 분기로 보장

### B. 400 대응·사전 가드 (구현 완료분 회귀 확인)
- [x] `fitMessagesToBudget(messages, MAX_TOTAL_CONTENT_BYTES, MAX_MESSAGES)` 사전 가드가 전송 경로에 있는지 (바이트·개수 **둘 다** 전달)
  → `route.ts:132` 프록시 사전 가드 + `chat-history.ts:64` 클라 압축, 둘 다 바이트·개수 전달
- [x] `isHistoryValidationError` true → 트림 후 1회 자동 재시도 / `violation === "message-size"` → "메시지를 줄여주세요" 안내(재시도 금지) 분기
  → `route.ts:169-175` 분기 존재 (재시도는 45KB·5개로 이중 축소)
- [x] 입력창 글자 수 제한 (개별 메시지 상한 20,000자 기준)
  → dream은 앱 상한 4,000자로 더 엄격하게 적용 (`ChatInput.tsx:148` maxLength + 음성 append 클램프)
- [x] 상수가 하드코딩이 아니라 로컬 const 파일(`lib/relay-limits.ts` 류)에 모여 있는지 — 참조 소스는 relay `/api/openapi.json`의 `x-relay-limits`
  → `lib/relay-limits.ts` (RELAY_LIMITS·OUTGOING_BUDGET_BYTES·RETRY_*)

### C. 실측 시나리오
- [x] 한 꿈에 대해 문답을 길게 이어가기(10턴+) — 400 없이 계속 대화되는지 (자동 트림 동작)
  → 21턴(57KB) 200 / **41턴·359KB(예산 초과) 200** — 사전 가드 트림 없었으면 relay 400이었을 것, 트림 경로 실증
- [x] 초장문 입력(20,000자 초과) 시도 — 입력창에서 차단되거나 명확한 안내가 나오는지
  → 개별 4,001자 API 400 확인 (dream zod 4,000자 상한). 입력창은 maxLength로 타이핑 단계 차단

## 문제 발견 시

relay 쪽 원인으로 보이면 (마커 노출 재발, summary 유실, 오탐 400 등):
원인 분석을 `05_gugbab-claude-relay/docs/handoff/`에 md로 작성해 relay 세션에 전달
(선례: `summary-marker-pair-leak-prompt.md` — 증상 SSE 원문·원인 분석·작업 요청 구조).
