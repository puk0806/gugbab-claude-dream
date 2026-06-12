---
name: feature-branch-pr-workflow
description: 모든 작업은 feature 브랜치에서 진행하고 PR로 main에 머지. PR 생성은 사용자가 GitHub에서 직접 함 — Claude는 gh pr create 호출 금지
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fa831d31-b74b-479b-a982-68a672161923
---

이 프로젝트(`03_gugbab-claude-dream`, 꿈해몽 PWA)에서는 main에 직접 commit·push를 하지 않는다. 모든 작업은 새 feature 브랜치를 따서 진행하고, PR을 통해 main에 머지한다. **PR 생성은 사용자(puk0806)가 GitHub 웹에서 직접 한다 — Claude는 `gh pr create` 같은 명령을 실행하지 않는다.**

**Why:** 사용자가 명시적으로 요청 — "앞으로 진행은 작업에 관련된 피처를 따고 pr통해서 머지 할거야 pr 생성은 내가 직접 할거고" (2026-05-21). 시각 회귀 워크플로우(`.github/workflows/visual-regression.yml` + `__diff_archive__/pr-N/`)도 PR 기반 흐름을 전제로 설계됐고, PR 단위의 시각 변화 history 추적이 의도된 모델. 사용자가 직접 PR을 만들면서 변경 범위를 한 번 더 확인하는 게이트 역할.

**How to apply:**
- **작업 시작 전 반드시 `git branch --show-current` + `git log origin/main --oneline -3` 으로 현재 브랜치와 main 상태 먼저 확인**
- **현재 브랜치가 이미 main에 머지된 브랜치면 절대 그 브랜치에 커밋하지 않는다** — PR #4, PR #5에서 두 번 반복한 실수
- **새 작업 = 반드시 `git checkout main && git pull` → `git checkout -b feature/<작업내용>` 순서** — 예외 없음
- 이전 feature 브랜치에 이어서 커밋하면 이미 머지된 커밋이 중복 포함되어 conflict 발생
- 작업 진행 + 커밋은 [[feedback-html-dashboard]] 룰과 함께 적용 + CLAUDE.md `git.md` 분리 룰([skill]/[agent]/[config]/[docs]) 준수
- `git push -u origin <branch-name>` 으로 원격 브랜치까지 푸시는 Claude가 해도 됨 (사용자가 GitHub에서 바로 PR 만들 수 있게)
- 푸시 후 **사용자에게 "GitHub 페이지에서 PR 만들어주세요" 라고 안내** — `gh pr create` / `gh pr ...` 명령 호출 금지
- **브랜치 네이밍: `feature/<작업내용>` 형식** (2026-05-21 확정). kebab-case 권장
- 단순 메모리 저장·룰 추가처럼 *코드 변경이 아닌 메타 작업*도 원칙적으로 feature 브랜치 권장. 다만 commit 없는 작업(메모리·로컬 설정만)은 브랜치 불필요
