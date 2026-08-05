---
name: dream-history-summary
description: 이력 압축 v2(relay 요약 기반) 적용 완료 — 후속 후보는 DreamSession.summary AI 요약 교체
metadata: 
  node_type: memory
  type: project
  originSessionId: d0eb96ca-1497-4fc1-a135-feba0032c772
  modified: 2026-08-05T07:39:32.446Z
---

2026-08-04 이력 압축 v2 적용: relay `wantSummary: true`로 받은 답변 요약을
`ChatMessage.summary`(IDB 선택 필드)에 저장하고, `toOutgoingMessages`가 최근
4개보다 오래된 model 턴을 "[이전 답변 요약] "으로 대체 전송한다 (요약은
best-effort — 없으면 절삭 폴백). health 앱과 같은 구조.

**보류된 후속 후보**: `DreamSession.summary`(현재 첫 메시지 앞 50자)를 relay
AI 요약으로 교체해 세션 목록(/history) 표시 품질을 올리는 작업 — 이번 작업
범위 밖으로 의도적으로 제외됨. 사용자가 원할 때 별도 요청 예정.

관련: [[feature-branch-workflow]], [[commit-push-user-approval]]
