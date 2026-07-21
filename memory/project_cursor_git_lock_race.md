---
name: cursor-git-lock-race
description: 이 머신은 Cursor 에디터의 gitWorker가 주기적으로 .git/index.lock을 잡아 git add/commit이 간헐 실패 — 재시도 루프로 해결
metadata: 
  node_type: memory
  type: project
  originSessionId: 467d03e7-42d4-4b56-92da-51464970b26e
---

이 개발 머신에서는 Cursor 에디터(`Cursor Helper (Plugin) … gitWorker.js`)가 git 상태를 폴링하며
순간적으로 `.git/index.lock`을 생성한다. Claude가 `git add`/`git commit`을 실행하면
"Unable to create index.lock: File exists"로 간헐 실패한다. (확인일: 2026-07-16, gugbab-workspace 공통)

**Why:** lock 파일은 1초 내에 사라지므로 "다른 git 프로세스 종료" 안내나 lock 수동 삭제는 불필요·위험하다. 단순 재시도로 충분한데, 원인을 모르면 크래시된 git 프로세스로 오인하기 쉽다.

**How to apply:** git 쓰기 명령은 재시도 루프로 감싼다:
```bash
gitretry() { for i in 1 2 3 4 5; do "$@" && return 0; sleep 1; done; return 1; }
gitretry git add <files> && gitretry git commit -m "..."
```
`.git/index.lock`을 직접 삭제하지 말 것 — Cursor가 실제 사용 중일 수 있다.
