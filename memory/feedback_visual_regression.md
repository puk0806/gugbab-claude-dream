---
name: feedback-visual-regression
description: 시각 회귀 테스트 베이스라인 관리 규칙 — macOS PNG 커밋 금지
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 90e2ebc9-97e1-4f24-a998-2076d42087e2
---

**규칙:** `e2e/visual/__screenshots__/` 의 PNG 파일을 로컬(macOS)에서 절대 커밋하지 않는다.

**Why:** CI는 Ubuntu, 로컬은 macOS — 폰트·렌더링 환경이 달라 같은 코드도 픽셀이 다르게 나온다. macOS 베이스라인을 커밋하면 CI에서 항상 diff가 발생하고, PR diff가 "Phase 2→Phase 3 변화"가 아닌 "macOS Phase 3→Ubuntu 에러"로 오염된다. 2026-06-05 세션에서 실제로 이 실수를 저질러 PR을 망쳤다.

**How to apply:**
- `playwright test --update-snapshots` 결과 PNG는 커밋 전 반드시 `git checkout -- e2e/visual/__screenshots__/` 로 제거
- `.gitignore`에 `e2e/visual/__screenshots__/` 추가되어 있으므로 `git add -A`해도 자동 무시됨 (2026-06-05 설정 완료)
- 베이스라인 갱신은 PR에서 `accept-baseline` 라벨 → CI가 Ubuntu 기준으로 자동 생성·커밋
- CI workflow(`visual-regression.yml`)는 `git add -f`로 `.gitignore` 우회해서 커밋함 — 이 흐름은 정상
