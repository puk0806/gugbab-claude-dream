---
name: commit-push-user-approval-required
description: commit·push는 사용자가 명시적으로 요청할 때만 진행. 작업 후 요약 + 분리 계획 보고 → 사용자 OK 대기
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fa831d31-b74b-479b-a982-68a672161923
---

이 프로젝트(`03_gugbab-claude-dream`, 꿈해몽 PWA)에서는 commit·push를 **사용자가 명시적으로 요청할 때만** 진행한다.

**Why:** 사용자가 commit 시점·범위·메시지 자체를 통제하고 싶어함 — PR 분할, 변경 내용 직접 검토, 흐름 결정 등을 위해. 2026-05-21~22 동안 다섯 차례 commit 시도 중 세 차례 거부됨 → "커밋·푸시 전에 작업 요약 + 분리 계획 보여줘" 패턴 반복. 2026-05-23 명시 확정: "커밋 푸쉬는 내가 요청할때 진행해 다음 작업 다 진행해".

**How to apply:**
- 작업이 끝나도 자동으로 `git add` / `git commit` / `git push` 호출 금지
- 대신 작업 완료 시 다음을 보고:
  - (a) 변경 사항 요약 (파일별)
  - (b) 분리 commit 계획 ([[feedback-feature-branch-workflow]] 룰의 카테고리별 분리 — `[config]/[app]/[test]/[docs]` 등)
  - (c) push 대상 브랜치
- 사용자가 다음과 같은 명시 신호를 보낼 때만 실행:
  - "커밋해" / "푸시해" / "진행해" / "그대로 진행" 등
- 단순 검증·테스트 명령은 사용자 요청 없이 실행 OK (파괴적 아님): `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:visual` 등
- working tree에 변경 사항을 쌓는 것 자체는 OK (사용자가 commit 시점 결정할 수 있도록)
- 짝 룰: [[feedback-feature-branch-workflow]] (feature 브랜치 + PR 흐름 · PR 생성도 사용자가 직접), [[feedback-html-dashboard]] (작업 단위마다 dream-app.html 동기 갱신)
