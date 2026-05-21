# 꿈해몽 PWA

> 어젯밤 꿈을 적고 톤(캐주얼 · 자기 성찰 · 한국 전통)을 골라 누르면 Claude가 해석해주는 PWA. 회원가입·서버 DB 없음. 브라우저 로컬에 최근 100건만 저장.

## 기술 스택

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **PWA**: `@serwist/next`
- **UI**: `@gugbab/styled-radix` (Radix Themes lookalike 35종) + `@gugbab/tokens` (CSS 변수)
- **LLM**: Claude Sonnet 4.6 via `@anthropic-ai/sdk` + 프롬프트 캐싱 + SSE
- **로컬 저장**: IndexedDB via `idb`
- **검증**: `zod` (입력) / `ulid` (ID)
- **린트·포맷**: Biome (`@gugbab/biome-config` 확장)
- **시각 회귀**: Playwright + `toHaveScreenshot` + GitHub Actions

## 개발

```bash
pnpm install
cp .env.example .env.local  # 그 후 ANTHROPIC_API_KEY 입력
pnpm dev                    # http://localhost:3000
```

## 스크립트

| 명령 | 설명 |
|------|------|
| `pnpm dev` | dev 서버 (turbopack) |
| `pnpm build` | prod 빌드 (`--webpack` — @serwist/next 호환) + prebuild 로 compile-prompts 자동 실행 |
| `pnpm start` | prod 서버 |
| `pnpm typecheck` | TypeScript 타입 검증 |
| `pnpm lint` / `pnpm lint:fix` | Biome lint |
| `pnpm format` / `pnpm format:check` | Biome format |
| `pnpm check` / `pnpm check:fix` | Biome lint + format 한꺼번에 |
| `pnpm compile-prompts` | `.claude/skills/humanities` + `.claude/agents/{research,validation}/dream-*` → `lib/prompts/_compiled/*.ts` 변환 |
| `pnpm test:visual` | Playwright 시각 회귀 비교 (Phase 1-B) |
| `pnpm test:visual:update` | 시각 회귀 베이스라인 갱신 (로컬 X, CI 전용) |

## 문서

- 설계 스펙: [docs/superpowers/specs/2026-05-16-dream-app-design.md](docs/superpowers/specs/2026-05-16-dream-app-design.md)
- 진행판: [docs/superpowers/specs/2026-05-16-dream-app-todo.md](docs/superpowers/specs/2026-05-16-dream-app-todo.md)
- 대시보드: [docs/superpowers/specs/dream-app.html](docs/superpowers/specs/dream-app.html) (브라우저로 열기)
- 구현 계획: [docs/superpowers/plans/2026-05-21-phase-1-bootstrap.md](docs/superpowers/plans/2026-05-21-phase-1-bootstrap.md)
- 시각 회귀: [e2e/visual/README.md](e2e/visual/README.md)

## 라이선스

Private — 사이드 프로젝트
