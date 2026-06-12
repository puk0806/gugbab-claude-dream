---
name: api-key-handling-protocol
description: API 키·토큰·시크릿이 채팅에 노출되면 즉시 폐기+재발급 안내. 키는 채팅·코드·git에 절대 박지 않고 .env.local 또는 환경변수로만 처리
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fa831d31-b74b-479b-a982-68a672161923
---

API 키·토큰·시크릿은 **사용자와의 대화 어디에도 평문으로 등장하면 안 된다**. 만약 사용자가 실수로 채팅에 키를 붙여넣으면 다음 절차로 즉시 대응한다.

**Why:** 채팅 대화는 LLM 서버에 평문 저장되고 메모리·로그·세션 분석 등 여러 경로로 외부 노출 가능성이 있다. 한 번 노출된 키는 *어떤 식으로도 안전하지 않다고 봐야 한다* — 비용 청구·악용·서비스 abuse를 막기 위해 폐기가 정석. 2026-05-25 사용자가 Anthropic API 키를 채팅에 직접 붙여넣어 즉시 폐기·재발급 안내 패턴 확립.

**How to apply:**
- 사용자가 채팅에 `sk-ant-...`, `sk-...`, `ghp_...`, AWS access key, Vercel 토큰 등 secret을 붙여넣으면:
  1. **즉시 빨간 경고** — 키 노출됨, 폐기 필요
  2. **폐기 URL 안내** (예: https://console.anthropic.com/settings/keys → Revoke)
  3. **새 키 재발급 + 채팅에 다시 붙여넣지 않는 방법 안내** (`.env.local` 직접 편집, `nano`/`code`/`open -a` 등)
  4. **dev 서버 재시작 안내**
- 사용자가 노출한 키를 Claude가 *어떤 도구로도 사용·저장·기록 금지*:
  - `.env.local`에 Edit으로 박지 않음 (Edit 로그에도 남음)
  - 메모리·verification.md·plan 어디에도 평문 박지 않음
  - 키 문자열을 답변에 다시 echo하지 않음 (참조 자체가 위험)
- 처음부터 키를 받지 않는 방법으로 유도:
  - "터미널에서 직접 `.env.local`에 붙여넣어 주세요"
  - `open -a "Cursor" .env.local` / `code .env.local` / `nano .env.local` 명령 안내
- 짝 룰: [[commit-push-user-approval-required]] (`.env*`는 이미 `.gitignore`로 보호되지만 노출 자체가 별개 위험)
