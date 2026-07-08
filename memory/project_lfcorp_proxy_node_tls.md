---
name: lfcorp-proxy-node-tls
description: 이 머신은 lfcorp 회사 프록시가 TLS를 가로채서 Node fetch/pnpm이 SELF_SIGNED_CERT_IN_CHAIN으로 실패 — NODE_EXTRA_CA_CERTS로 해결
metadata: 
  node_type: memory
  type: project
  originSessionId: 9618dcc2-6112-4a93-84fb-45611a81e567
---

이 개발 머신(회사망)은 lfcorp 프록시(`CN=www.lfcorp.com`)가 모든 외부 TLS를 가로챈다.
lfcorp 루트 CA가 macOS 키체인에는 있어서 curl은 성공하지만, Node(fetch/undici, pnpm 다운로드)는
자체 CA 번들만 신뢰해 `SELF_SIGNED_CERT_IN_CHAIN`으로 실패하거나 무한 대기한다. (확인일: 2026-07-08)

**Why:** dev 서버의 relay(fetch) 호출, pnpm install 다운로드가 이 문제로 조용히 실패/행업했음. 증상만 보면 relay 장애나 네트워크 문제로 오인하기 쉽다.

**How to apply:**
1. 키체인에서 CA 추출: `security find-certificate -a -c "lfcorp" -p /Library/Keychains/System.keychain > ~/lfcorp-ca.pem` (login 키체인도 `security find-certificate -a -c "lfcorp" -p >> ...`로 병합)
2. Node 프로세스에 주입: `NODE_EXTRA_CA_CERTS=~/lfcorp-ca.pem pnpm dev`
3. pnpm 다운로드가 행업하면 캐시 활용: `pnpm install --prefer-offline`
4. `NODE_TLS_REJECT_UNAUTHORIZED=0`은 사용 금지 (검증 전체 비활성화)
5. 대안: gugbab-claude-relay를 로컬(HTTP)로 띄우고 `RELAY_URL=http://localhost:3000` 지정 — TLS 자체를 우회. 단 relay가 3000 선점 시 앱 dev 서버는 3001에 뜨므로 포트 주의

gugbab-workspace의 모든 relay 연동 앱(dream, health 등) 로컬 dev·curl 테스트에 공통 적용된다.
health 프로젝트도 2026-07-06 같은 이슈를 겪고 동일하게 해결했다 (health repo `memory/env-corp-tls-interception.md`에 기록).
Vercel 배포 환경에는 이 문제가 없다 — 로컬 개발 전용.
