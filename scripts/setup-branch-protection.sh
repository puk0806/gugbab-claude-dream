#!/usr/bin/env bash
#
# main 브랜치 보호 설정을 적용한다. sibling 프로젝트 02_gugbab-claude-voca 의
# branch protection 을 그대로 미러링하며, 시각 회귀 워크플로우(visual-regression
# status check) 가 PASS 해야만 PR 머지가 가능하도록 강제한다.
#
# 적용되는 룰:
#   - required_status_checks.strict = true       (PR 브랜치가 main 과 최신 상태여야 함)
#   - required_status_checks.contexts = ["visual-regression"]
#   - allow_force_pushes = false
#   - allow_deletions = false
#   - enforce_admins = false                     (admin 우회 허용)
#
# 사용:
#   ./scripts/setup-branch-protection.sh                 # 현재 디렉토리의 origin 레포 자동 인식
#   ./scripts/setup-branch-protection.sh owner/repo      # 특정 레포 지정
#   ./scripts/setup-branch-protection.sh owner/repo dev  # main 외 브랜치 지정
#
# 사전 조건:
#   - gh CLI 설치 + 인증 완료 (gh auth status)
#   - 대상 레포에 main 브랜치 존재
#   - 본인이 해당 레포 admin 권한 보유

set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo '')}"
BRANCH="${2:-main}"

if [[ -z "$REPO" ]]; then
  echo "❌ 레포를 자동 인식할 수 없습니다. 인자로 owner/repo 를 전달하세요."
  echo "   예: ./scripts/setup-branch-protection.sh puk0806/gugbab-claude-dream"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ gh CLI 인증 필요: gh auth login"
  exit 1
fi

echo "→ Setting branch protection on ${REPO}:${BRANCH}"

gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" --input - <<'JSON' >/dev/null
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["visual-regression"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false,
  "required_linear_history": false
}
JSON

echo "✓ Branch protection 적용 완료"
echo ""
echo "현재 설정 확인:"
gh api "repos/${REPO}/branches/${BRANCH}/protection" --jq '{
  strict: .required_status_checks.strict,
  contexts: .required_status_checks.contexts,
  allow_force_pushes: .allow_force_pushes.enabled,
  allow_deletions: .allow_deletions.enabled
}'
