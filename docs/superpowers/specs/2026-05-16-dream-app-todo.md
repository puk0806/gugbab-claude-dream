# 꿈해몽 PWA — Todo / 진행 상태

- **연결 문서**: [2026-05-16-dream-app-design.md](./2026-05-16-dream-app-design.md)
- **최종 갱신**: 2026-05-21

> 이 파일은 *현재 무엇이 끝났고 다음에 무엇을 해야 하는지* 한눈에 보이게 만드는 진행판입니다.
> 매 작업 끝날 때마다 항목 옆 체크박스를 갱신합니다.

---

## 0단계 — 브레인스토밍 (완료)

- [x] 프로젝트 컨텍스트 탐색
- [x] 핵심 의도·범위 합의 (단발 해몽 / 3톤 / PWA / Claude / 로컬저장 / 무료무제한)
- [x] 응답 구조 결정 (A안 — 단일 톤 모드)
- [x] **설계 1/3** — 아키텍처·화면 흐름·모듈 구조
- [x] **설계 2/3** — 데이터 모델 + LLM 프롬프트 + 안전 정책
- [x] **설계 3/3** — 에러 처리 + 테스트 전략 + 로드맵
- [x] 스펙 셀프 리뷰 (placeholder/모순/모호함 점검)
- [x] 사용자 스펙 최종 리뷰 (시각 회귀 §11.4 반영 · feature/PR 워크플로우 확정)
- [x] **`writing-plans` 스킬로 구현 계획 작성 단계 진입** → `docs/superpowers/plans/2026-05-21-phase-1-bootstrap.md` 산출 (Phase 1 + 1-B 통합 24 task)

---

## 1단계 — 프로젝트 초기화 (완료)

- [x] Next.js 15 + App Router + TypeScript 프로젝트 부트스트랩 *(실제: Next.js 16.2.6 latest 채택)*
- [x] PWA 설정 *(`@serwist/next` 채택 / `next build --webpack` 필요 — Next 16 turbopack 호환 이슈)*
- [x] `manifest.json`, 아이콘 세트 (192/512 + apple-touch-icon 180) *(placeholder, 디자인 무드 확정 후 교체)*
- [x] Anthropic SDK 설치 (`@anthropic-ai/sdk` 0.97.1)
- [x] `idb` 설치 (IndexedDB 래퍼) (8.0.3)
- [x] Zod 설치 (입력 검증) (4.4.3)
- [x] **`@gugbab/*` UI 패키지 설치** — `@gugbab/styled-radix` 1.0.1, `@gugbab/tokens` 1.0.0, `@gugbab/hooks` 1.0.1, `@gugbab/utils` 1.0.1
- [x] `app/layout.tsx`에 `@gugbab/tokens/radix.css` + `@gugbab/styled-radix/styles.css` import *(경로: `/dist/` 제외 — exports field 기준)*
- [x] **Biome + `@gugbab/biome-config`** 설정 (Prettier·ESLint 대체)
- [x] `.env.example` 작성 + `.env.local` placeholder (사용자가 키 입력 필요)
- [ ] Vercel 배포 파이프라인 1회 점검 *(사용자 액션 — PR 머지 후)*
- [x] **`scripts/compile-prompts.ts` 작성** — `.claude/skills/humanities/*/SKILL.md` + `.claude/agents/{research,validation}/dream-*.md` → `lib/prompts/_compiled/*.ts` 변환기 *(domain → research로 정정. 24개 컴파일 검증)*
- [x] **`prebuild: pnpm compile-prompts`** package.json에 등록

### 1-B. 시각 회귀 인프라 (UI 첫 라우트 셸 직후 — 02_voca 패턴 미러링)

- [x] `@playwright/test` 설치 (1.60.0)
- [x] `playwright.config.ts` — chromium 단일 viewport(1280×800), `snapshotPathTemplate`로 OS suffix 제거, `webServer.command: pnpm dev`(3000 포트)
- [x] `e2e/visual/` 디렉토리 + `README.md`(02_voca README 미러링) + tsconfig.json + `__diff_archive__/README.md`
- [x] `e2e/visual/routes.spec.ts` — 빈 셸 상태 `/` 1건만 우선 캡처
- [x] `package.json` 스크립트: `test:visual`, `test:visual:update`, `test:visual:report`
- [x] `.github/workflows/visual-regression.yml` — compare/accept 2모드 + PR 코멘트 인라인 diff + vrt-snapshots 브랜치 push
- [x] `.github/workflows/archive-vr-diffs.yml` — 머지 후 `__diff_archive__/pr-N/` 영구 보존
- [ ] GitHub Repository 라벨 `accept-baseline` 생성 *(사용자 액션)*
- [ ] 첫 베이스라인 등록 PR (라벨 부여 → CI 자동 commit 흐름 1회 검증) *(사용자 액션 — 본 PR이 그 첫 베이스라인 PR 역할)*

---

## 2단계 — 핵심 기능 구현 (예정)

- [ ] 톤별 시스템 프롬프트 작성 (`lib/prompts/{casual,reflective,traditional}.ts`) — `_compiled/*`에서 흡수한 사용자 자산을 조립
- [ ] `lib/claude.ts` — Anthropic SDK 래퍼 + 프롬프트 캐싱 + SSE 스트리밍
- [ ] `lib/safety.ts` — 자해/위기 신호 분류
- [ ] `app/api/interpret/route.ts` — 엔드포인트 (Zod 검증 → 안전 분류 → Claude 스트리밍)
- [ ] `lib/db.ts` — IndexedDB CRUD (DreamEntry 저장/조회/삭제)
- [ ] `components/DreamInput.tsx` — 입력 + 톤 선택 UI (gugbab `Form` 활용)
- [ ] `components/ToneChips.tsx` — 톤 3종 칩 컴포넌트 (gugbab `ToggleGroup type="single"`)
- [ ] `components/InterpretationView.tsx` — 스트리밍 결과 렌더 (로딩은 gugbab `Progress`)
- [ ] `components/SafetyResourceCard.tsx` — 위기 자원 카드 (gugbab `Dialog` + `tel:` 링크)
- [ ] `components/HistoryList.tsx` — 히스토리 리스트 (gugbab `Separator`)
- [ ] `app/page.tsx` — 홈 페이지
- [ ] `app/result/[id]/page.tsx` — 결과 페이지
- [ ] `app/history/page.tsx` — 히스토리 페이지

### 2-B. 시각 회귀 spec 확장 (컴포넌트 추가와 동시에)

- [ ] `routes.spec.ts` — `/`, `/result/[id]`, `/history` 3개 라우트 캡처 (LLM 응답은 `page.route`로 mocked SSE 주입)
- [ ] `components.spec.ts` — `ToneChips`(3톤 각 선택 상태), `SafetyResourceCard`(자해 시뮬레이션 분기), `InterpretationView`(스트리밍 중/완료)
- [ ] 비결정 차단 fixture — `addInitScript`로 IndexedDB 초기화 + `crypto.randomUUID` 시드 고정
- [ ] 새 컴포넌트가 머지될 때마다 `accept-baseline` 라벨로 베이스라인 등록

---

## 3단계 — 안정화 (예정)

- [ ] 에러 경계(ErrorBoundary) + API 실패 UI
- [ ] 오프라인 안내 UI
- [ ] 안전 분류기 시뮬레이션 테스트 (자해/트라우마/null 케이스)
- [ ] 톤별 응답 품질 점검 (`dream-interpretation-prompt-tester` 활용)
- [ ] 모바일 360px / 데스크탑 1280px 렌더 점검 (수동)
- [ ] Lighthouse PWA 점수 90+ 확인
- [ ] 시각 회귀 베이스라인 전체 한 번 갱신 (디자인 무드 확정 후)

---

## 4단계 — 배포 (예정)

- [ ] Vercel 프로덕션 배포
- [ ] OG 이미지, SEO 메타
- [ ] 첫 사용자 테스트 (지인 5명)
- [ ] 피드백 수렴 → v1.1 계획

---

## 변경 로그

| 일자 | 변경 |
|---|---|
| 2026-05-16 | 초안 작성. 0단계 4/9 완료 |
| 2026-05-16 | 설계 2/3 작성 완료. 0단계 5/9 진행 |
| 2026-05-16 | 설계 3/3 작성 완료. 셀프 리뷰 완료. 사용자 최종 리뷰 단계 진입 |
| 2026-05-16 | UI 시스템 결정: `@gugbab/styled-radix`. 1단계에 `@gugbab/*` 설치 항목 추가, 2단계 컴포넌트에 gugbab 매핑 명시 |
| 2026-05-16 | C안 확정: Vercel 서버리스 유지 + `@anthropic-ai/sdk` + 자산 빌드 타임 임베드. 1단계에 `scripts/compile-prompts.ts` + `prebuild` 항목 추가 |
| 2026-05-21 | 시각 회귀 테스트 MVP 포함 결정 (sibling `02_gugbab-claude-voca` 패턴 미러링). 1단계 1-B(인프라 9개), 2단계 2-B(spec 확장 4개), 3단계에 베이스라인 갱신 1개 추가. UI 첫 라우트 셸 직후부터 ON |
| 2026-05-21 | 0단계 완료. `feature/writing-plan-phase-1` 브랜치에서 `writing-plans` 스킬로 Phase 1 + 1-B 통합 구현 계획서 (`docs/superpowers/plans/2026-05-21-phase-1-bootstrap.md`, 24 task) 산출 |
| 2026-05-21 | **Phase 1 + 1-B 실제 부트스트랩 실행**: Next.js 16.2.6 + React 19 + TS5 + Biome(Prettier 대체) + @gugbab/* 4종 + @serwist/next + compile-prompts(24개) + Playwright + GH Actions 2종. 사용자 액션 잔여 2건(Vercel 배포 점검, GitHub `accept-baseline` 라벨 + 첫 베이스라인 PR). 본 PR 자체가 첫 베이스라인 PR 역할 |
