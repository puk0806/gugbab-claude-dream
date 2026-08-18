# Memory Index

- [HTML 대시보드 동기 갱신 룰](feedback_html_dashboard.md) — 작업 단위마다 docs/superpowers/specs/dream-app.html 함께 갱신
- [해몽 답변 대화체 톤](feedback_dream_tone_conversational.md) — 관점 나열식 금지, 꿈해몽가와 대화하듯 자연스럽게 (DEEP_PROMPT 방향 고정)
- [Feature 브랜치 + PR 워크플로우](feedback_feature_branch_workflow.md) — main 직접 작업 금지, 모든 작업은 feature 브랜치 → PR. PR 생성은 사용자가 직접 (gh pr create 금지)
- [Commit/push 사용자 승인 필수](feedback_commit_push_user_approval.md) — 자동 commit·push 금지. 작업 완료 후 요약 + 분리 계획 보고 → 사용자 명시 요청("커밋해" 등) 시에만 실행
- [API 키 노출 시 폐기 안내](feedback_api_key_handling.md) — 사용자가 채팅에 secret 붙여넣으면 즉시 폐기+재발급 안내, 노출된 키는 어떤 도구로도 사용·저장·echo 금지
- [시각 회귀 베이스라인 macOS PNG 커밋 금지](feedback_visual_regression.md) — __screenshots__/ 는 .gitignore, CI만 git add -f로 커밋. accept-baseline 라벨로 Ubuntu 기준 재생성
- [lfcorp 프록시 Node TLS 이슈](project_lfcorp_proxy_node_tls.md) — 회사망에서 Node fetch/pnpm SELF_SIGNED_CERT_IN_CHAIN 실패, NODE_EXTRA_CA_CERTS로 해결
- [이력 압축 v2 — relay 요약 기반](project_dream_history_summary.md) — wantSummary 적용 완료(2026-08-04), 후속 후보: DreamSession.summary AI 요약 교체(사용자 요청 대기)
- [이력 압축 v3 — 크로스 리뷰 수렴 종결](project_history_v3_cross_review.md) — health↔dream 상호 이식 완료(2026-08-18), 추가 크로스 스윕 금지·포팅은 handoff 문서로만
- [Cursor git lock 경합](project_cursor_git_lock_race.md) — Cursor gitWorker가 index.lock을 순간 점유, git 쓰기 명령은 재시도 루프로 감싼다
