# Memory Index

- [HTML 대시보드 동기 갱신 룰](feedback_html_dashboard.md) — 작업 단위마다 docs/superpowers/specs/dream-app.html 함께 갱신
- [해몽 답변 대화체 톤](feedback_dream_tone_conversational.md) — 관점 나열식 금지, 꿈해몽가와 대화하듯 자연스럽게 (DEEP_PROMPT 방향 고정)
- [Feature 브랜치 + PR 워크플로우](feedback_feature_branch_workflow.md) — main 직접 작업 금지, 모든 작업은 feature 브랜치 → PR. PR 생성은 사용자가 직접 (gh pr create 금지)
- [Commit/push 사용자 승인 필수](feedback_commit_push_user_approval.md) — 자동 commit·push 금지. 작업 완료 후 요약 + 분리 계획 보고 → 사용자 명시 요청("커밋해" 등) 시에만 실행
- [API 키 노출 시 폐기 안내](feedback_api_key_handling.md) — 사용자가 채팅에 secret 붙여넣으면 즉시 폐기+재발급 안내, 노출된 키는 어떤 도구로도 사용·저장·echo 금지
- [시각 회귀 베이스라인 macOS PNG 커밋 금지](feedback_visual_regression.md) — __screenshots__/ 는 .gitignore, CI만 git add -f로 커밋. accept-baseline 라벨로 Ubuntu 기준 재생성
- [lfcorp 프록시 Node TLS 이슈](project_lfcorp_proxy_node_tls.md) — 회사망에서 Node fetch/pnpm SELF_SIGNED_CERT_IN_CHAIN 실패, NODE_EXTRA_CA_CERTS로 해결
