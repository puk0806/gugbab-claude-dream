# Git 커밋 컨벤션

## 구조

```
[category] Type: Subject

body (선택, 72자 이내)
footer (선택)
```

**category:** `agent` | `skill` | `app` | `test` | `docs` | `config`

## Type

| Type | 설명 |
|------|------|
| `Add` | 새 파일·기능 추가 |
| `Remove` | 삭제 |
| `Fix` | 버그 수정 |
| `Modify` | 기존 기능 변경 |
| `Improve` | 품질·성능 향상 |
| `Refactor` | 구조 개선 |
| `Rename` / `Move` | 이름·위치 변경 |

## Subject

- 마침표 없음
- 영문이면 동사 첫 글자 대문자

## Body (선택)

- 한 줄 72자 이내
- "어떻게"보다 "무엇을, 왜" 위주로 작성

## Footer (선택)

| 키워드 | 사용 시점 |
|--------|-----------|
| `Fixes` | 이슈 수정 중 |
| `Resolves` | 이슈 해결 완료 |
| `Ref` | 참고 이슈 |
| `Related to` | 관련 이슈 |

## 커밋 분리 원칙

하나의 작업이 여러 관심사에 걸치면 관심사별로 커밋을 나눈다.

| 관심사 | 카테고리 | 예시 |
|--------|---------|------|
| 스킬 파일 | `[skill]` | `.claude/skills/**/SKILL.md` |
| 에이전트 파일 | `[agent]` | `.claude/agents/**/*.md` |
| 어플리케이션 코드 | `[app]` | `app/`, `lib/`, `components/`, `scripts/`, `public/` |
| 테스트 코드 | `[test]` | `e2e/`, `__tests__/`, `*.test.ts` |
| 설정·빌드·CI | `[config]` | `package.json`, `tsconfig.json`, `next.config.ts`, `biome.json`, `playwright.config.ts`, `.env.example`, `.gitignore`, `.github/workflows/`, `CLAUDE.md`, `.claude/rules/`, `.claude/settings.json`, `.claude/hooks/` |
| 문서 | `[docs]` | `README.md`, `docs/`, `verification.md`, `AGENTS.md` |

**분리 기준:**
- `[skill]`과 `[agent]`는 항상 별도 커밋
- `[app]`과 `[test]`는 항상 별도 커밋 (테스트 변경 추적성 확보)
- `[config]` 변경과 `[docs]` 변경은 별도 커밋
- 같은 category 내에서도 변경 목적이 다르면 분리 가능 (예: `[docs] Add` vs `[docs] Modify`)

**하나로 묶어도 되는 경우:**
- 동일 스킬의 SKILL.md + verification.md (한 작업의 산출물)
- 에이전트 추가 + 해당 에이전트 문서
- 동일 컴포넌트의 .tsx + .module.css (한 컴포넌트의 산출물 — `[app]` 단일 커밋)

## 예시

```
[agent] Add: agent-creator subagent for generating agent MD files

새로운 서브에이전트를 대화형으로 설계하고 .claude/agents/에 저장.
모델/도구/절차/출력형식을 자동으로 구성함.
```

```
# 여러 관심사가 섞인 경우 — 아래처럼 분리

[skill] Add: Rust 백엔드 스킬 15종 추가
[agent] Add: rust-backend-developer, rust-backend-architect
[config] Improve: skill-creator 검증 프로세스 강화
[docs] Add: 백엔드 스킬 verification.md 15종 및 README 업데이트
```

```
# 어플리케이션 코드 + 테스트 분리 예시 (Phase 2 같은 핵심 기능 구현 시)

[config] Add: @anthropic-ai/sdk · idb · zod 의존성
[app] Add: lib/claude.ts · lib/safety.ts · lib/db.ts (Phase 2 핵심 로직)
[app] Add: 컴포넌트 5종 (DreamInput · ToneChips · InterpretationView · SafetyResourceCard · HistoryList)
[app] Add: 라우트 3종 (/ · /result/[id] · /history) + API Route /api/interpret
[test] Add: e2e/visual spec 확장 (routes 3건 + components 4건 + SSE mock fixture)
[docs] Modify: Phase 2 완료 반영 (todo.md · dream-app.html)
```
