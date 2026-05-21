# 꿈해몽 PWA — Phase 1 + Phase 1-B 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js 15 + App Router + PWA + `@gugbab/styled-radix` 부트스트랩과 시각 회귀(Playwright + GitHub Actions) 인프라 두 단계를 한 번에 끝내, UI 컴포넌트 작업(2단계)에 진입할 수 있는 견고한 기반을 만든다.

**Architecture:**
- 프론트: Next.js 15 (App Router) + React 19 + TypeScript + `@gugbab/styled-radix` (Radix Themes 외관)
- PWA: `@serwist/next` (manifest + 오프라인 셸 + service worker)
- 자산 통합: `scripts/compile-prompts.ts`가 `.claude/skills/humanities/*` + `.claude/agents/{domain,validation}/dream-*`를 `lib/prompts/_compiled/*.ts`로 빌드 타임 변환 → 시스템 프롬프트로 임베드
- 시각 회귀: Playwright + `toHaveScreenshot`, CI Linux 단일 베이스라인, `accept-baseline` 라벨 워크플로우 (sibling `02_gugbab-claude-voca` 패턴 미러링)

**Tech Stack:**
- Next.js 15 / React 19 / TypeScript 5.6
- pnpm 9 / Node 22.13+
- `@serwist/next`, `@anthropic-ai/sdk`, `idb`, `zod`, `ulid`
- `@gugbab/styled-radix`, `@gugbab/tokens`, `@gugbab/hooks`, `@gugbab/utils`
- `@playwright/test`, GitHub Actions
- ESLint (Next.js default) + Prettier
- `tsx` (compile-prompts 실행기), `sharp` (아이콘 placeholder)

---

## ⚠️ Plan 실행 전 확정해야 할 결정 사항

(이 plan을 실행하기 전에 사용자가 결정해야 하는 단 한 가지)

**어플리케이션 코드 commit 카테고리 룰 추가** — 현재 `.claude/rules/git.md`의 카테고리는 `[agent]/[skill]/[config]/[docs]` 4개로 `.claude/` 구조 중심이라, 어플리케이션 코드(`app/`, `lib/`, `components/`, `scripts/`)와 테스트(`e2e/`)에 쓸 카테고리가 없다.

**이 plan에서는 임시로 다음 카테고리를 사용한다** (사용자 확정 필요):

| 카테고리 | 대상 |
|----------|------|
| `[app]` | 어플리케이션 코드: `app/`, `lib/`, `components/`, `scripts/` |
| `[test]` | 테스트 코드: `e2e/`, `__tests__/` |
| `[config]` (기존) | `package.json`, `tsconfig`, `next.config`, `.env*`, `.gitignore`, `.github/workflows`, `.eslintrc`, `.prettierrc` |
| `[docs]` (기존) | `README.md`, `docs/` |

> Plan 실행 도중 또는 직후에 `.claude/rules/git.md`를 정식으로 갱신할 것 (별도 PR로 분리).

> **PWA 라이브러리 결정**: `@serwist/next` 채택 (2026-05-21 시점 일반적 권장사항 기준 — Next.js 15 + App Router 활발 유지). Task 7 실행 시 공식 문서로 최신 권장사항 한 번 확인 후 진행.

---

## File Structure

### 신규 생성 (Phase 1)

| 파일 | 책임 |
|------|------|
| `.gitignore` | Node·Next·Playwright·환경변수 무시 |
| `package.json` | pnpm + scripts + deps |
| `tsconfig.json` | TS 5.6 strict + path alias `@/*` |
| `next.config.ts` | `@serwist/next` 래핑 |
| `next-env.d.ts` | Next.js auto |
| `eslint.config.mjs` | Next.js default + 커스텀 룰 |
| `.prettierrc` | Prettier 설정 (typescript.md 준수) |
| `.env.local` | `ANTHROPIC_API_KEY` (gitignored) |
| `.env.example` | 환경변수 템플릿 |
| `README.md` | 프로젝트 README skeleton |
| `app/layout.tsx` | gugbab CSS import + Radix Theme 셋업 + manifest 링크 |
| `app/page.tsx` | 임시 홈 (Phase 1-B 시각 회귀용 빈 셸) |
| `app/globals.css` | 최소 reset (gugbab tokens 위에) |
| `app/sw.ts` | Serwist service worker |
| `public/manifest.json` | PWA manifest |
| `public/icon-192.png` | PWA 아이콘 192px (placeholder, 디자인 무드 확정 후 교체) |
| `public/icon-512.png` | PWA 아이콘 512px (placeholder) |
| `public/apple-touch-icon.png` | iOS 홈 화면 아이콘 180px (placeholder) |
| `scripts/compile-prompts.ts` | `.claude/{skills/humanities,agents/{domain,validation}/dream-*}` → `lib/prompts/_compiled/*.ts` 변환 |
| `lib/prompts/_compiled/.gitkeep` | 컴파일 산출 디렉토리 표식 (산출물은 `.gitignore`) |

### 신규 생성 (Phase 1-B)

| 파일 | 책임 |
|------|------|
| `playwright.config.ts` | chromium 1280×800 단일 viewport, snapshotPathTemplate으로 OS suffix 제거 |
| `e2e/visual/README.md` | 시각 회귀 영역 설명 (02_voca 미러링) |
| `e2e/visual/tsconfig.json` | e2e 영역 TS 설정 |
| `e2e/visual/routes.spec.ts` | 라우트별 시각 회귀 spec (홈 1건으로 시작) |
| `e2e/visual/__diff_archive__/README.md` | 머지된 PR 시각 변화 보존 영역 표식 |
| `.github/workflows/visual-regression.yml` | compare/accept 2모드 + 인라인 diff 코멘트 |
| `.github/workflows/archive-vr-diffs.yml` | 머지 후 `__diff_archive__/pr-N/` 영구 보존 |

### 수정 대상 (Phase 마지막 동기화)

| 파일 | 변경 |
|------|------|
| `docs/superpowers/specs/2026-05-16-dream-app-todo.md` | 1단계 13개 + 1-B 9개 항목 체크 + 변경 로그 |
| `docs/superpowers/specs/dream-app.html` | 진행률 % / 체크리스트 done 클래스 / 최종 갱신일 |

---

## 사전 조건 검증

- [ ] **0.1** 브랜치 확인: `git branch --show-current` → `feature/writing-plan-phase-1`
- [ ] **0.2** working dir 확인: `pwd` → `/Users/lf/Desktop/gugbab-workspace/03_gugbab-claude-dream`
- [ ] **0.3** Node 버전: `node --version` → v22.13+ (없으면 nvm install)
- [ ] **0.4** pnpm 설치: `pnpm --version` → 9.x (없으면 `npm i -g pnpm@9`)
- [ ] **0.5** working tree clean: `git status --short` → 빈 출력
- [ ] **0.6** GitHub remote 확인: `git remote -v` → `puk0806/gugbab-claude-dream`

---

# Phase 1 — 프로젝트 초기화

## Task 1: .gitignore 작성 (Next.js 부트스트랩 전 필수)

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: .gitignore 작성**

```gitignore
# Node
node_modules/
.pnpm-store/

# Next.js
.next/
out/
build/
next-env.d.ts

# Vercel
.vercel

# Env (커밋 금지)
.env*.local
.env.production
.env.development

# Tests
coverage/
test-results/
playwright-report/

# Compiled prompts (빌드 산출 — main에 박지 않음)
lib/prompts/_compiled/*
!lib/prompts/_compiled/.gitkeep

# IDE / OS
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
.idea/
.DS_Store
*.log

# TypeScript
*.tsbuildinfo
```

- [ ] **Step 2: 검증 — 파일 존재 확인**

Run: `cat .gitignore | head -3`
Expected: `# Node\nnode_modules/\n.pnpm-store/`

- [ ] **Step 3: commit**

```bash
git add .gitignore
git commit -m "[config] Add: .gitignore 초기 설정 (Next.js·Playwright·env·컴파일 산출)"
```

---

## Task 2: Next.js 15 부트스트랩

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `eslint.config.mjs`, `pnpm-lock.yaml`, `public/*`(템플릿)

- [ ] **Step 1: Next.js 15 CLI 실행**

Run:
```bash
pnpm create next-app@latest . \
  --typescript \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --use-pnpm \
  --no-tailwind \
  --turbopack
```

Expected: 인터랙티브 프롬프트 없이 부트스트랩 완료. `package.json` 생성, `node_modules` 설치 완료.

> ⚠️ 이미 `.gitignore`가 존재하므로 CLI가 "overwrite?"를 물으면 **No** (`n`). CLI가 생성한 .gitignore를 우리 것에 머지하지 말고 우리 .gitignore 유지.

- [ ] **Step 2: 부트스트랩 결과 확인**

Run: `ls -la`
Expected: `package.json`, `tsconfig.json`, `next.config.ts`, `app/`, `node_modules/`, `eslint.config.mjs`, `next-env.d.ts` 존재.

Run: `cat package.json | head -20`
Expected: `"next": "^15.x.x"`, `"react": "^19.x.x"`, `"react-dom": "^19.x.x"` 확인.

- [ ] **Step 3: tsx 설치 (compile-prompts.ts 실행기)**

Run: `pnpm add -D tsx`
Expected: `package.json` devDependencies에 `tsx` 추가.

- [ ] **Step 4: package.json scripts 갱신**

`package.json`의 `scripts`를 다음으로 교체:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "compile-prompts": "tsx scripts/compile-prompts.ts"
  }
}
```

> 참고: `prebuild`는 Task 11에서 추가. 그 전까지는 `pnpm build` 호출하지 않음.

- [ ] **Step 5: dev 서버 1회 검증**

Run: `pnpm dev`
Expected: `http://localhost:3000` 에 Next.js 환영 페이지 응답. 브라우저 또는 `curl -s http://localhost:3000 | head -5`로 확인 후 Ctrl+C 종료.

- [ ] **Step 6: typecheck 검증**

Run: `pnpm typecheck`
Expected: 에러 0개 (exit 0).

- [ ] **Step 7: lint 검증**

Run: `pnpm lint`
Expected: 에러 0개. (CLI가 만든 기본 코드는 lint 통과)

- [ ] **Step 8: commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts next-env.d.ts app/ public/ eslint.config.mjs
git commit -m "[config] Add: Next.js 15 + App Router + TypeScript 부트스트랩"
```

---

## Task 3: Prettier 설정 (typescript.md 룰 준수)

**Files:**
- Create: `.prettierrc`, `.prettierignore`

- [ ] **Step 1: .prettierrc 작성**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 2: .prettierignore 작성**

```
node_modules
.next
out
build
public
pnpm-lock.yaml
lib/prompts/_compiled
e2e/visual/__screenshots__
e2e/visual/__diff_archive__
.claude
docs
```

- [ ] **Step 3: prettier 설치**

Run: `pnpm add -D prettier`

- [ ] **Step 4: package.json scripts에 format 추가**

scripts 객체에 두 줄 추가:

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 5: 한 번 포맷 적용 + 검증**

Run: `pnpm format`
Expected: 변경된 파일 목록 출력. (없으면 "All matched files use Prettier code style!")

Run: `pnpm format:check`
Expected: 통과 (exit 0).

- [ ] **Step 6: commit**

```bash
git add .prettierrc .prettierignore package.json pnpm-lock.yaml
git commit -m "[config] Add: Prettier 설정 (typescript.md 룰 준수: singleQuote·trailingComma·100col)"
```

---

## Task 4: 어플리케이션 의존성 설치 (@anthropic-ai/sdk, idb, zod, ulid)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: 런타임 의존성 설치**

Run:
```bash
pnpm add @anthropic-ai/sdk idb zod ulid
```

Expected: package.json dependencies에 4개 추가.

- [ ] **Step 2: 설치 검증**

Run: `pnpm list @anthropic-ai/sdk idb zod ulid --depth 0`
Expected: 4개 모두 버전과 함께 출력.

- [ ] **Step 3: commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "[config] Add: 어플리케이션 런타임 의존성 (@anthropic-ai/sdk · idb · zod · ulid)"
```

---

## Task 5: @gugbab/* UI 패키지 설치

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: 4개 패키지 설치**

Run:
```bash
pnpm add @gugbab/styled-radix @gugbab/tokens @gugbab/hooks @gugbab/utils
```

Expected: package.json dependencies에 4개 추가.

> 설치 실패 시: npm 레지스트리에서 `gugbab` scope 공개 여부 확인. private면 사용자가 `pnpm login --scope=@gugbab` 또는 `.npmrc`에 토큰 설정 필요. 사용자에게 안내 후 대기.

- [ ] **Step 2: peer dependency 확인**

Run: `pnpm install`
Expected: 경고 없음. peer dep 경고(예: React 18 요구)가 나면 사용자에게 보고.

- [ ] **Step 3: commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "[config] Add: @gugbab UI 패키지 4종 (styled-radix · tokens · hooks · utils)"
```

---

## Task 6: app/layout.tsx — gugbab CSS import + Radix Theme

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`

- [ ] **Step 1: app/layout.tsx 갱신**

기존 내용을 다음으로 교체:

```tsx
import type { Metadata, Viewport } from 'next';
import { Theme } from '@radix-ui/themes';
import '@gugbab/tokens/dist/radix.css';
import '@gugbab/styled-radix/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: '꿈해몽',
  description: '어젯밤 꿈을 적고 톤을 골라 누르면 Claude가 해석해주는 PWA',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '꿈해몽',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f0a1e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Theme appearance="dark" accentColor="violet" radius="large">
          {children}
        </Theme>
      </body>
    </html>
  );
}
```

> 주의: `@radix-ui/themes` 임포트가 `@gugbab/styled-radix`의 peer dep으로 자동 설치되어 있어야 한다. 안 되어 있으면 `pnpm add @radix-ui/themes`.

- [ ] **Step 2: app/globals.css 최소 reset**

기존 내용을 다음으로 교체:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'SF Pro KR',
    'Noto Sans KR',
    'Apple SD Gothic Neo',
    sans-serif;
}

body {
  background: var(--gray-1);
  color: var(--gray-12);
}
```

- [ ] **Step 3: dev 서버로 렌더 확인**

Run: `pnpm dev`
Expected: 콘솔에 import 에러 없음. 브라우저 `http://localhost:3000` 다크 테마로 환영 페이지 렌더. Ctrl+C 종료.

- [ ] **Step 4: typecheck**

Run: `pnpm typecheck`
Expected: 에러 0개.

- [ ] **Step 5: commit**

```bash
git add app/layout.tsx app/globals.css package.json pnpm-lock.yaml
git commit -m "[app] Add: layout.tsx에 @gugbab CSS 임포트 + Radix Theme 다크/violet 셋업"
```

---

## Task 7: PWA — @serwist/next 설치 및 설정

**Files:**
- Create: `app/sw.ts`
- Modify: `next.config.ts`, `package.json`

- [ ] **Step 1: serwist 설치**

Run:
```bash
pnpm add @serwist/next
pnpm add -D serwist
```

> ⚠️ 실행 직전 `@serwist/next` 공식 문서(https://serwist.pages.dev/) 1회 확인 — 2026-05-21 이후 API 변동 가능. 본 plan은 일반적 사용 패턴 기준.

- [ ] **Step 2: next.config.ts 갱신**

기존 내용을 다음으로 교체:

```ts
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

export default withSerwist({
  reactStrictMode: true,
});
```

- [ ] **Step 3: app/sw.ts 작성**

```ts
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

- [ ] **Step 4: tsconfig.json에 sw.ts용 lib 추가**

`tsconfig.json`의 `compilerOptions.lib` 배열에 `"WebWorker"` 추가 (DOM, DOM.Iterable, ESNext 옆에).

- [ ] **Step 5: typecheck**

Run: `pnpm typecheck`
Expected: 에러 0개.

- [ ] **Step 6: prod 빌드 검증 (sw.js 생성 확인)**

Run: `pnpm build`
Expected: 빌드 성공. `public/sw.js` 생성됨.

Run: `ls -la public/sw.js`
Expected: 파일 존재.

- [ ] **Step 7: commit**

```bash
git add next.config.ts app/sw.ts tsconfig.json package.json pnpm-lock.yaml public/sw.js
git commit -m "[config] Add: @serwist/next PWA 설정 (sw.ts + next.config 래핑)"
```

---

## Task 8: PWA manifest + 아이콘 placeholder

**Files:**
- Create: `public/manifest.json`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`

- [ ] **Step 1: public/manifest.json 작성**

```json
{
  "name": "꿈해몽",
  "short_name": "꿈해몽",
  "description": "어젯밤 꿈을 적고 톤을 골라 누르면 Claude가 해석해주는 PWA",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0a1e",
  "theme_color": "#0f0a1e",
  "orientation": "portrait",
  "lang": "ko",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: sharp 설치 (아이콘 생성용)**

Run: `pnpm add -D sharp`

- [ ] **Step 3: placeholder 아이콘 3종 생성**

Run:
```bash
node -e "require('sharp')({create:{width:192,height:192,channels:4,background:{r:139,g:92,b:246,alpha:1}}}).png().toFile('public/icon-192.png').then(()=>console.log('192 OK'))"
node -e "require('sharp')({create:{width:512,height:512,channels:4,background:{r:139,g:92,b:246,alpha:1}}}).png().toFile('public/icon-512.png').then(()=>console.log('512 OK'))"
node -e "require('sharp')({create:{width:180,height:180,channels:4,background:{r:139,g:92,b:246,alpha:1}}}).png().toFile('public/apple-touch-icon.png').then(()=>console.log('apple OK'))"
```

Expected: 3개 모두 "OK" 출력.

- [ ] **Step 4: 아이콘 파일 검증**

Run: `ls -la public/icon-*.png public/apple-touch-icon.png`
Expected: 3개 파일, 각각 200B 이상.

- [ ] **Step 5: prod 빌드로 manifest serving 확인**

> 참고: `app/layout.tsx`의 `metadata.icons`는 이미 Task 6에서 박혀 있다 (apple-touch-icon 포함). 이 task에서는 PNG 파일들이 실제로 제공되는지만 검증.

Run: `pnpm build && pnpm start &`
이어서: `sleep 3 && curl -s http://localhost:3000/manifest.json | head -5`
Expected: JSON 응답에 `"name": "꿈해몽"` 포함.

종료: `pkill -f "next start"` (또는 jobs로 확인 후 kill %1)

Run: `pnpm build && pnpm start &`
이어서: `sleep 3 && curl -s http://localhost:3000/manifest.json | head -5`
Expected: JSON 응답에 `"name": "꿈해몽"` 포함.

종료: `pkill -f "next start"` (또는 jobs로 확인 후 kill %1)

- [ ] **Step 6: commit (PNG는 placeholder임을 명시)**

```bash
git add public/manifest.json public/icon-192.png public/icon-512.png public/apple-touch-icon.png package.json pnpm-lock.yaml
git commit -m "[config] Add: PWA manifest + 아이콘 placeholder 3종 (디자인 무드 확정 후 교체 예정)"
```

---

## Task 9: app/page.tsx — 임시 홈 (시각 회귀 베이스라인용 빈 셸)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: app/page.tsx 갱신**

기존 내용을 다음으로 교체:

```tsx
import { Container, Flex, Heading, Text } from '@radix-ui/themes';

export default function HomePage() {
  return (
    <Container size="2" px="4" py="6">
      <Flex direction="column" gap="4" align="center" justify="center" minHeight="80vh">
        <Heading size="8" weight="bold" align="center">
          꿈해몽
        </Heading>
        <Text size="3" color="gray" align="center">
          어젯밤 꿈을 적고 톤을 골라 누르면 Claude가 해석해드려요.
        </Text>
        <Text size="2" color="gray" align="center">
          (Phase 1 부트스트랩 셸 — Phase 2에서 입력 폼 추가)
        </Text>
      </Flex>
    </Container>
  );
}
```

- [ ] **Step 2: dev 서버 렌더 확인**

Run: `pnpm dev`
Expected: `http://localhost:3000` 다크 배경 + 보라 액센트, "꿈해몽" 제목 중앙 정렬 렌더. Ctrl+C.

- [ ] **Step 3: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 둘 다 통과.

- [ ] **Step 4: commit**

```bash
git add app/page.tsx
git commit -m "[app] Add: 임시 홈 셸 (Phase 1-B 시각 회귀 베이스라인용)"
```

---

## Task 10: scripts/compile-prompts.ts (TDD)

**Files:**
- Create: `scripts/compile-prompts.ts`, `lib/prompts/_compiled/.gitkeep`, `scripts/compile-prompts.test.ts` (선택)

이 스크립트는 빌드 타임에 `.claude/skills/humanities/*/SKILL.md`와 `.claude/agents/{domain,validation}/dream-*.md`를 읽어 TS 문자열 상수로 변환한다. 변환 결과는 `lib/prompts/_compiled/`에 저장되고, `.gitignore` 대상.

- [ ] **Step 1: 출력 디렉토리 .gitkeep**

```bash
mkdir -p lib/prompts/_compiled
echo "# Auto-generated by scripts/compile-prompts.ts — content gitignored" > lib/prompts/_compiled/.gitkeep
```

- [ ] **Step 2: scripts/compile-prompts.ts 작성**

`scripts/compile-prompts.ts` 작성:

```ts
/**
 * .claude/skills/humanities/<slug>/SKILL.md와
 * .claude/agents/{domain,validation}/dream-*.md를
 * lib/prompts/_compiled/<category>_<slug>.ts로 변환한다.
 *
 * v1.0: 원문 임베드 (frontmatter 포함). 백틱·${} 만 escape.
 * 토큰 부담은 Claude 프롬프트 캐싱으로 흡수.
 *
 * 사용: pnpm compile-prompts
 * 자동: pnpm build 직전(prebuild 훅)
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'lib', 'prompts', '_compiled');

type SourceKind = 'skill_dir' | 'agent_flat';

interface Source {
  category: string;
  dir: string;
  kind: SourceKind;
  /** agent_flat에서 어떤 파일을 포함할지 결정 */
  filter?: (name: string) => boolean;
}

const SOURCES: Source[] = [
  {
    category: 'skill_humanities',
    dir: '.claude/skills/humanities',
    kind: 'skill_dir',
  },
  {
    category: 'agent_domain',
    dir: '.claude/agents/domain',
    kind: 'agent_flat',
    filter: (n) => n.startsWith('dream-') && n.endsWith('.md'),
  },
  {
    category: 'agent_validation',
    dir: '.claude/agents/validation',
    kind: 'agent_flat',
    filter: (n) => n.startsWith('dream-') && n.endsWith('.md'),
  },
];

export function toConstName(category: string, slug: string): string {
  return `${category}_${slug}`
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

export function escapeForTemplate(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function toFileName(category: string, slug: string): string {
  return `${category}_${slug.replace(/-/g, '_')}.ts`;
}

interface CompileResult {
  files: number;
  exports: string[];
}

export function compile(): CompileResult {
  if (!existsSync(OUT)) {
    mkdirSync(OUT, { recursive: true });
  }

  const exports: string[] = [];
  let count = 0;

  for (const src of SOURCES) {
    const absDir = join(ROOT, src.dir);
    if (!existsSync(absDir)) {
      console.warn(`⚠️  source dir 미존재: ${src.dir}`);
      continue;
    }

    if (src.kind === 'skill_dir') {
      const subdirs = readdirSync(absDir).filter((n) =>
        statSync(join(absDir, n)).isDirectory(),
      );
      for (const slug of subdirs) {
        const skillPath = join(absDir, slug, 'SKILL.md');
        if (!existsSync(skillPath)) continue;
        const content = readFileSync(skillPath, 'utf-8');
        const constName = toConstName(src.category, slug);
        const fileName = toFileName(src.category, slug);
        const ts = `// Auto-generated by scripts/compile-prompts.ts — DO NOT EDIT
// Source: ${src.dir}/${slug}/SKILL.md

export const ${constName} = \`${escapeForTemplate(content)}\`;
`;
        writeFileSync(join(OUT, fileName), ts);
        exports.push(`export { ${constName} } from './${fileName.replace(/\.ts$/, '')}';`);
        count += 1;
        console.log(`✓ ${fileName}`);
      }
    } else {
      const files = readdirSync(absDir).filter((n) => src.filter!(n));
      for (const f of files) {
        const filePath = join(absDir, f);
        const content = readFileSync(filePath, 'utf-8');
        const slug = basename(f, '.md');
        const constName = toConstName(src.category, slug);
        const fileName = toFileName(src.category, slug);
        const ts = `// Auto-generated by scripts/compile-prompts.ts — DO NOT EDIT
// Source: ${src.dir}/${f}

export const ${constName} = \`${escapeForTemplate(content)}\`;
`;
        writeFileSync(join(OUT, fileName), ts);
        exports.push(`export { ${constName} } from './${fileName.replace(/\.ts$/, '')}';`);
        count += 1;
        console.log(`✓ ${fileName}`);
      }
    }
  }

  writeFileSync(
    join(OUT, 'index.ts'),
    `// Auto-generated — DO NOT EDIT\n${exports.sort().join('\n')}\n`,
  );

  console.log(`\n✓ ${count}개 prompt 컴파일 완료 (lib/prompts/_compiled/)`);
  return { files: count, exports };
}

// CLI 실행
if (process.argv[1] && process.argv[1].includes('compile-prompts')) {
  compile();
}
```

- [ ] **Step 3: 실행 검증**

Run: `pnpm compile-prompts`
Expected: 콘솔에 `✓ skill_humanities_*.ts` 19개 + `✓ agent_domain_dream_*.ts` 1개 + `✓ agent_validation_dream_*.ts` 2~3개 출력. 마지막에 "✓ N개 prompt 컴파일 완료".

> 정확한 개수는 `.claude/agents/{domain,validation}/dream-*.md` 와 `.claude/skills/humanities/` 디렉토리 수에 따라 다름. 2026-05-21 기준 약 20~25개.

- [ ] **Step 4: 산출물 검증**

Run: `ls lib/prompts/_compiled/`
Expected: 다수의 `.ts` 파일 + `index.ts` + `.gitkeep`.

Run: `head -5 lib/prompts/_compiled/index.ts`
Expected: `// Auto-generated`로 시작, `export { ... } from './...'` 라인들.

- [ ] **Step 5: 컴파일 산출물 TypeScript 타입 검증**

Run: `pnpm typecheck`
Expected: 에러 0개. (`_compiled/*.ts`도 함께 검증됨)

- [ ] **Step 6: commit (산출물 자체는 gitignore, 스크립트와 .gitkeep만 commit)**

```bash
git add scripts/compile-prompts.ts lib/prompts/_compiled/.gitkeep
git commit -m "[app] Add: scripts/compile-prompts.ts — .claude 자산 → lib/prompts/_compiled/*.ts 변환"
```

---

## Task 11: prebuild 등록 + 빌드 검증

**Files:**
- Modify: `package.json`

- [ ] **Step 1: package.json에 prebuild 추가**

scripts 객체에 추가:

```json
"prebuild": "pnpm compile-prompts"
```

- [ ] **Step 2: 빌드 전체 흐름 검증**

Run: `rm -rf lib/prompts/_compiled/*.ts lib/prompts/_compiled/index.ts && pnpm build`

Expected:
1. `compile-prompts` 자동 실행 → 산출물 다시 생성
2. Next.js 빌드 성공
3. `.next/` 디렉토리에 빌드 결과

- [ ] **Step 3: commit**

```bash
git add package.json
git commit -m "[config] Add: prebuild 훅으로 compile-prompts 자동 실행"
```

---

## Task 12: 환경변수 (.env.local + .env.example)

**Files:**
- Create: `.env.example`
- Create: `.env.local` (gitignored)

- [ ] **Step 1: .env.example 작성**

```bash
# Anthropic API Key — 서버 전용. 클라이언트 노출 금지.
# https://console.anthropic.com/settings/keys 에서 발급
ANTHROPIC_API_KEY=sk-ant-api03-...

# 선택: 모델 ID 오버라이드 (기본: claude-sonnet-4-6)
# ANTHROPIC_MODEL=claude-sonnet-4-6

# 선택: 안전 분류 모델 ID (기본: claude-haiku-4-5)
# ANTHROPIC_SAFETY_MODEL=claude-haiku-4-5
```

- [ ] **Step 2: .env.local 작성 (실제 키는 사용자가 직접)**

```bash
# 이 파일은 .gitignore됨 — commit 절대 금지
ANTHROPIC_API_KEY=
```

> 사용자에게 안내: `.env.local`을 열어 `ANTHROPIC_API_KEY=` 옆에 실제 키 입력 필요. Anthropic 콘솔에서 발급.

- [ ] **Step 3: .gitignore 검증 — .env.local이 무시되는지**

Run: `git check-ignore .env.local`
Expected: `.env.local` 출력 (= 무시됨).

- [ ] **Step 4: commit (.env.example만)**

```bash
git add .env.example
git commit -m "[config] Add: .env.example (ANTHROPIC_API_KEY 템플릿)"
```

---

## Task 13: README.md skeleton

**Files:**
- Create: `README.md`

- [ ] **Step 1: README.md 작성**

```markdown
# 꿈해몽 PWA

> 어젯밤 꿈을 적고 톤(캐주얼 · 자기 성찰 · 한국 전통)을 골라 누르면 Claude가 해석해주는 PWA. 회원가입·서버 DB 없음. 브라우저 로컬에 최근 100건만 저장.

## 기술 스택

- **Next.js 15** (App Router) + **React 19** + **TypeScript 5.6**
- **PWA**: `@serwist/next`
- **UI**: `@gugbab/styled-radix` (Radix Themes 외관 35종)
- **LLM**: Claude Sonnet 4.6 via `@anthropic-ai/sdk` + 프롬프트 캐싱 + SSE
- **로컬 저장**: IndexedDB via `idb`
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
| `pnpm build` | prod 빌드 (prebuild로 compile-prompts 자동 실행) |
| `pnpm start` | prod 서버 |
| `pnpm typecheck` | TypeScript 타입 검증 |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier 적용 |
| `pnpm compile-prompts` | `.claude/` 자산 → `lib/prompts/_compiled/*.ts` |
| `pnpm test:visual` | Playwright 시각 회귀 비교 |
| `pnpm test:visual:update` | 시각 회귀 베이스라인 갱신 (로컬 X, CI 전용) |

## 문서

- 설계 스펙: [docs/superpowers/specs/2026-05-16-dream-app-design.md](docs/superpowers/specs/2026-05-16-dream-app-design.md)
- 진행판: [docs/superpowers/specs/2026-05-16-dream-app-todo.md](docs/superpowers/specs/2026-05-16-dream-app-todo.md)
- 대시보드: [docs/superpowers/specs/dream-app.html](docs/superpowers/specs/dream-app.html) (브라우저로 열기)
- 시각 회귀: [e2e/visual/README.md](e2e/visual/README.md)

## 라이선스

Private — 사이드 프로젝트
```

- [ ] **Step 2: commit**

```bash
git add README.md
git commit -m "[docs] Add: README.md skeleton (기술 스택·스크립트·문서 링크)"
```

---

## Task 14: Vercel 1회 배포 점검 (사용자 액션)

**Files:** 없음 (수동 검증)

이 task는 Claude가 직접 실행할 수 없고 사용자가 진행. Plan 실행 자동화 시 이 task는 "사용자 액션 안내"로만 처리.

- [ ] **Step 1: Vercel CLI 설치 안내 (옵션)**

`pnpm add -g vercel` 또는 Vercel 대시보드(https://vercel.com/new)에서 GitHub 연동.

- [ ] **Step 2: 사용자가 직접 수행할 것**

1. https://vercel.com/new 접속
2. GitHub `puk0806/gugbab-claude-dream` 레포 선택 (또는 push된 feature 브랜치)
3. Framework: Next.js (자동 감지)
4. Environment Variables: `ANTHROPIC_API_KEY` 입력
5. Build Command: 기본 (`pnpm build`)
6. Deploy 클릭
7. 배포 URL 접속 확인

- [ ] **Step 3: 결과 사용자에게 보고**

이 plan을 실행하는 에이전트는 사용자에게 다음과 같이 안내:

> "Vercel 배포는 사용자님이 직접 진행해주세요. https://vercel.com/new 에서 레포 연결 + `ANTHROPIC_API_KEY` 환경변수 설정 + Deploy. 배포 URL 받으면 알려주세요."

> 배포는 PR 머지 후 main 브랜치에서 진행해도 됨. 이 plan에서는 *점검*만 하면 되므로 PR 머지 후 작업이 자연스러움.

---

# Phase 1-B — 시각 회귀 인프라

## Task 15: @playwright/test 설치 + browser

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: @playwright/test 설치**

Run: `pnpm add -D @playwright/test`

- [ ] **Step 2: chromium 브라우저 설치**

Run: `pnpm exec playwright install --with-deps chromium`
Expected: chromium 다운로드 + 시스템 deps 설치. (macOS에서는 deps 단계 skip 가능)

- [ ] **Step 3: 설치 확인**

Run: `pnpm exec playwright --version`
Expected: 버전 출력 (예: `Version 1.49.x`).

- [ ] **Step 4: commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "[config] Add: @playwright/test + chromium browser"
```

---

## Task 16: playwright.config.ts

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: playwright.config.ts 작성**

```ts
/**
 * Playwright 시각 회귀 설정.
 *
 * - testDir: e2e/visual (vitest 영역과 분리)
 * - webServer: Next.js dev 서버 자동 기동 (3000)
 * - viewport: 1280×800 Chromium (베이스라인 단일 환경)
 * - 베이스라인은 Linux(CI)에서만 캡처/비교 — 로컬 macOS에서 캡처한 PNG는 commit 금지
 *   (snapshotPathTemplate으로 OS suffix 제거 + CI에서 update)
 *
 * sibling 프로젝트 02_gugbab-claude-voca의 visual-regression 패턴을 Next.js 컨텍스트로
 * 미러링한 버전. Storybook 없이 라우트 페이지를 직접 캡처한다.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e/visual',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: 'disabled',
    },
  },

  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 에러 0개.

- [ ] **Step 3: commit**

```bash
git add playwright.config.ts
git commit -m "[config] Add: playwright.config.ts (chromium 1280×800 단일 viewport, snapshotPathTemplate으로 OS suffix 제거)"
```

---

## Task 17: e2e/visual/ 디렉토리 + README + tsconfig + __diff_archive__/README

**Files:**
- Create: `e2e/visual/README.md`, `e2e/visual/tsconfig.json`, `e2e/visual/__diff_archive__/README.md`

- [ ] **Step 1: e2e/visual/README.md 작성**

```markdown
# Visual Regression — `e2e/visual/`

Playwright 기반 라우트 페이지 시각 회귀 영역.

## 구조

```
e2e/visual/
├── routes.spec.ts                 라우트별 스크린샷 정의
├── __screenshots__/               베이스라인 PNG (CI Linux에서 캡처, 자동 관리)
│   └── routes.spec.ts/
│       └── home.png
├── __diff_archive__/              머지된 PR의 시각 변화 영구 보존 (자동 관리)
│   └── pr-N/
│       ├── home/
│       │   ├── expected.png
│       │   ├── actual.png
│       │   └── diff.png
│       └── ...
└── README.md
```

## 작동 방식

1. PR 생성 또는 push 이벤트가 GH Actions `visual-regression` 워크플로우 트리거
2. **compare 모드** (기본):
   - 베이스라인 있고 diff 없음 → ✅ PASS
   - 베이스라인 있고 diff 있음 → ❌ FAIL — PR 코멘트에 expected/actual/diff PNG 인라인 표시
   - 베이스라인 없음 (신규 라우트) → ❌ FAIL — PR 코멘트에 신규 라우트의 actual PNG 표시
3. PR에 `accept-baseline` 라벨 부여 시 → **accept 모드** → `--update-snapshots` 실행 → PNG 자동 commit + push to PR branch → status 직접 등록 → 다음 compare 통과 → 머지 가능
4. **머지 후** → `archive-vr-diffs` 워크플로우가 `vrt-snapshots/pr-N` 브랜치의 PNG 를 main 의 `__diff_archive__/pr-N/` 으로 영구 보존

## 로컬에서

```bash
# 베이스라인은 CI에서 관리한다. 로컬은 비교 용도만.
pnpm test:visual            # 비교 (실패해도 commit 안 함)
pnpm test:visual:report     # 마지막 결과 리포트 보기
```

> 주의: 로컬 macOS와 CI Linux의 폰트 렌더링 차이로 로컬 비교는 실패할 수 있다.
> 베이스라인 PNG는 *반드시 CI에서 갱신*하고 로컬에서 직접 commit하지 않는다.

## 라우트 추가

새 라우트를 만들면:

1. `routes.spec.ts`에 test 추가
2. PR 생성 → 베이스라인 없으므로 CI fail
3. 시각 디자인 확인 후 PR에 `accept-baseline` 라벨 부여
4. CI가 베이스라인 PNG 생성 + commit + push
5. 머지 가능
```

- [ ] **Step 2: e2e/visual/tsconfig.json 작성**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["@playwright/test"],
    "noEmit": true
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 3: e2e/visual/__diff_archive__/README.md 작성**

```bash
mkdir -p e2e/visual/__diff_archive__
```

`e2e/visual/__diff_archive__/README.md`:

```markdown
# Visual Diff Archive

머지된 PR의 시각 변화 PNG가 `pr-N/` 디렉토리로 영구 보존되는 영역.

`.github/workflows/archive-vr-diffs.yml`이 PR 머지 시점에 `vrt-snapshots/pr-N` 브랜치의 PNG를 이 디렉토리로 자동 복사한다.

수동 편집 금지.
```

- [ ] **Step 4: commit**

```bash
git add e2e/visual/README.md e2e/visual/tsconfig.json e2e/visual/__diff_archive__/README.md
git commit -m "[test] Add: e2e/visual/ 디렉토리 + README + tsconfig + __diff_archive__/README"
```

---

## Task 18: e2e/visual/routes.spec.ts (홈 1건)

**Files:**
- Create: `e2e/visual/routes.spec.ts`

- [ ] **Step 1: routes.spec.ts 작성**

```ts
/**
 * 라우트 페이지 시각 회귀 spec.
 *
 * 한 라우트당 한 스크린샷. 새 라우트가 등장하면 본 파일에 추가하고
 * PR에 `accept-baseline` 라벨을 붙여 베이스라인을 등록한다.
 *
 * 베이스라인 PNG는 `e2e/visual/__screenshots__/routes.spec.ts/` 아래에
 * 자동 저장된다. Linux(CI)에서만 캡처/갱신하며 로컬 변경분은 commit 금지.
 *
 * Phase 1-B 시점: 홈 1건만 캡처. Phase 2에서 /result/[id], /history 추가.
 */
import { expect, type Page, test } from '@playwright/test';

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

test.describe('routes — visual regression', () => {
  test('home', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expect(page).toHaveScreenshot('home.png', { fullPage: true });
  });
});
```

- [ ] **Step 2: 로컬 1회 실행 — spec 자체 동작 확인 (PNG 결과물은 commit 금지)**

Run: `pnpm exec playwright test --reporter=list`

Expected:
- Playwright는 로컬 첫 실행 시 베이스라인이 없으면 **자동 생성 + test PASS** (조용히). CI(`process.env.CI`)에서만 "snapshot not found" 에러로 FAIL.
- 콘솔에 `1 passed` 메시지 출력.
- `e2e/visual/__screenshots__/routes.spec.ts/home.png` 파일이 생성됨 (macOS 폰트 기반 — Linux와 다르므로 commit 금지).

만약 spec 자체에 에러(타입·import 등)가 나면 보고하고 수정.

- [ ] **Step 3: 로컬 생성 PNG 모두 제거 (CI Linux에서만 baseline 갱신)**

Run: `rm -rf e2e/visual/__screenshots__/`

Run: `git status --short e2e/visual/`
Expected: `routes.spec.ts` `tsconfig.json` `README.md` `__diff_archive__/README.md` 만 untracked/staged. PNG 0건.

- [ ] **Step 4: commit**

```bash
git add e2e/visual/routes.spec.ts
git commit -m "[test] Add: routes.spec.ts (홈 1건 시각 회귀 spec)"
```

---

## Task 19: package.json — test:visual 스크립트

**Files:**
- Modify: `package.json`

- [ ] **Step 1: scripts에 3개 추가**

```json
"test:visual": "playwright test",
"test:visual:update": "playwright test --update-snapshots",
"test:visual:report": "playwright show-report"
```

- [ ] **Step 2: 명령 확인**

Run: `pnpm test:visual --list`
Expected: `routes — visual regression > home` 1건 출력.

- [ ] **Step 3: commit**

```bash
git add package.json
git commit -m "[config] Add: package.json에 test:visual / :update / :report 스크립트"
```

---

## Task 20: .github/workflows/visual-regression.yml

**Files:**
- Create: `.github/workflows/visual-regression.yml`

이 워크플로우는 sibling `02_gugbab-claude-voca`에서 그대로 복사하되, 우리 프로젝트에 맞게 미세 조정한다 (Node 22.13.1, pnpm 9.15.0 등은 동일).

- [ ] **Step 1: 02_voca 워크플로우 복사**

Run:
```bash
mkdir -p .github/workflows
cp /Users/lf/Desktop/gugbab-workspace/02_gugbab-claude-voca/.github/workflows/visual-regression.yml .github/workflows/
```

- [ ] **Step 2: 복사된 파일 내용 검증**

Run: `head -30 .github/workflows/visual-regression.yml`
Expected: `name: visual-regression`, on/pull_request/branches/types 트리거 정의 등 표시.

- [ ] **Step 3: 우리 프로젝트에 맞게 미세 조정 (필요한 경우)**

내용 그대로 사용 가능 (sibling과 동일한 Node 22.13.1 + pnpm 9.15.0 + chromium + Playwright 패턴). 만약 우리 package.json의 pnpm 버전이 다르면 워크플로우 파일의 `version: 9.15.0`을 맞춰 수정.

Run: `grep -n "pnpm/action-setup\|setup-node\|version:" .github/workflows/visual-regression.yml`
이 출력에서 pnpm version과 node version이 package.json `engines`·`packageManager`와 일치하는지 확인. 불일치 시 워크플로우 파일 편집.

- [ ] **Step 4: commit**

```bash
git add .github/workflows/visual-regression.yml
git commit -m "[config] Add: GitHub Actions visual-regression 워크플로우 (02_voca 미러링, compare/accept 2모드 + 인라인 diff)"
```

---

## Task 21: .github/workflows/archive-vr-diffs.yml

**Files:**
- Create: `.github/workflows/archive-vr-diffs.yml`

- [ ] **Step 1: 02_voca 워크플로우 복사**

Run:
```bash
cp /Users/lf/Desktop/gugbab-workspace/02_gugbab-claude-voca/.github/workflows/archive-vr-diffs.yml .github/workflows/
```

- [ ] **Step 2: 내용 검증**

Run: `head -20 .github/workflows/archive-vr-diffs.yml`
Expected: `name: archive-vr-diffs`, `on: pull_request: types: [closed]` 트리거 등 표시.

- [ ] **Step 3: commit**

```bash
git add .github/workflows/archive-vr-diffs.yml
git commit -m "[config] Add: GitHub Actions archive-vr-diffs 워크플로우 (머지 후 __diff_archive__/pr-N/ 영구 보존)"
```

---

## Task 22: GitHub 라벨 + 첫 베이스라인 PR 안내 (사용자 액션)

**Files:** 없음 (사용자 GitHub 액션)

- [ ] **Step 1: 사용자에게 안내**

이 plan을 실행하는 에이전트는 사용자에게 다음을 알린다:

> **사용자님 직접 해주실 일:**
>
> 1. GitHub 레포 https://github.com/puk0806/gugbab-claude-dream 접속
> 2. **Labels 탭** (Issues > Labels) → **New label** → 이름: `accept-baseline`, 색: 자유 (예: 보라 `#a78bfa`), 설명: "PR baseline accept 트리거"
> 3. 라벨 생성 완료 알려주기
>
> 이후 PR이 생성되면:
> - 시각 회귀 워크플로우가 자동 실행됨
> - 첫 PR이므로 베이스라인이 없어 CI fail + PR 코멘트에 신규 actual PNG 표시
> - 시각 검토 후 `accept-baseline` 라벨 부여 → CI가 자동으로 PNG commit + push → PR 머지 가능

---

# 마무리

## Task 23: spec 동기화 (todo.md + dream-app.html)

**Files:**
- Modify: `docs/superpowers/specs/2026-05-16-dream-app-todo.md`
- Modify: `docs/superpowers/specs/dream-app.html`

**Memory rule:** `feedback-html-dashboard` — 작업 단위마다 dream-app.html 동기 갱신.

- [ ] **Step 1: todo.md — 1단계 13개 항목 체크**

`docs/superpowers/specs/2026-05-16-dream-app-todo.md`의 "1단계 — 프로젝트 초기화" 섹션 항목 모두 `- [ ]` → `- [x]`로 변경.

- [ ] **Step 2: todo.md — 1-B단계 9개 항목 체크**

"1-B. 시각 회귀 인프라" 섹션 항목 모두 `- [ ]` → `- [x]`로 변경.

> Task 14(Vercel)와 Task 22(GitHub 라벨)는 사용자 액션 대기 상태일 수 있음 — 사용자 확인 후 체크.

- [ ] **Step 3: todo.md — 변경 로그 추가**

```markdown
| 2026-05-21 | Phase 1 (Next.js 부트스트랩) + Phase 1-B (시각 회귀 인프라) 완료. 22개 task 실행 완료. 다음: 2단계 핵심 기능 구현 (톤 프롬프트 · API Route · 컴포넌트 + 시각 회귀 spec 확장) |
```

- [ ] **Step 4: dream-app.html — 진행률 갱신**

`dream-app.html`의 `<!-- 진행률 -->` 섹션과 1단계·1-B단계 phase 영역:

- 상단 progress-summary는 "0단계 — 브레인스토밍" 8/9 → 9/9 + "1단계·1-B 완료"로 갱신 (또는 1단계 카운터로 전환)
- 1단계 phase: `phase-meta`를 "13/13 완료" + 각 li에 `class="done"`
- 1-B단계 phase: `phase-meta`를 "9/9 완료" + 각 li에 `class="done"`
- "최종 갱신" 배지: `2026-05-21` 유지 (또는 plan 실행 일자로)
- 헤더 상태 배지: "🟢 기획 1차 완성" → "🟢 Phase 1 부트스트랩 완료"

- [ ] **Step 5: dream-app.html — "다음 할 일" 갱신**

`<!-- 다음 할 일 -->` 섹션의 ol 항목을 다음으로 교체:

```html
<ol>
  <li>현재 PR(feature/writing-plan-phase-1) 머지 후 main 동기화</li>
  <li>다음 feature 브랜치 분기: feature/phase-2-tone-prompts (또는 적절한 이름)</li>
  <li>writing-plans 스킬로 2단계 (핵심 기능 구현) 계획 작성</li>
  <li>2단계 + 2-B 단계 진행 (톤 프롬프트 · API Route · 컴포넌트 + 시각 회귀 spec 확장)</li>
</ol>
```

- [ ] **Step 6: 검증 — 두 파일 일관성**

Run: `grep -c "x\]" docs/superpowers/specs/2026-05-16-dream-app-todo.md`
Expected: 22+개 (체크된 항목 수).

Run: `open docs/superpowers/specs/dream-app.html`
Expected: 브라우저에서 1단계·1-B 모두 done 클래스로 표시.

- [ ] **Step 7: commit**

```bash
git add docs/superpowers/specs/2026-05-16-dream-app-todo.md docs/superpowers/specs/dream-app.html
git commit -m "[docs] Modify: Phase 1 + 1-B 완료 반영 (todo.md 22개 체크 · dashboard 진행률 갱신)"
```

---

## Task 24: feature 브랜치 push + 사용자 PR 생성 안내

**Files:** 없음

- [ ] **Step 1: push**

Run: `git push -u origin feature/writing-plan-phase-1`
Expected: GitHub에 브랜치 push 완료.

- [ ] **Step 2: 사용자에게 PR 생성 안내**

이 plan을 실행하는 에이전트는 사용자에게 다음을 알린다:

> **사용자님 직접 해주실 일:**
>
> 1. https://github.com/puk0806/gugbab-claude-dream/pull/new/feature/writing-plan-phase-1 접속
> 2. PR 제목: `Phase 1 + 1-B 완료 — Next.js 부트스트랩 + 시각 회귀 인프라`
> 3. PR 본문에 다음 포함:
>    - 산출물 요약 (Next.js 15 + PWA + @gugbab + compile-prompts + Playwright + GH Actions)
>    - `accept-baseline` 라벨 생성 안내 (Task 22, 아직이라면)
>    - 베이스라인이 없으므로 CI fail 예상 → 라벨 부여로 자동 commit
> 4. PR Create
> 5. 시각 회귀 CI fail 확인 → 신규 home 베이스라인 PNG 검토 → `accept-baseline` 라벨 부여 → CI 자동 commit + PASS → 머지

---

# DoD (Definition of Done) — Phase 1 + 1-B

- [ ] `pnpm dev` 정상 동작 (3000 포트, 다크 violet 테마 홈 셸 렌더)
- [ ] `pnpm build` 성공 (prebuild로 compile-prompts 자동 실행 + Next.js 빌드 통과)
- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm lint` exit 0
- [ ] `pnpm format:check` exit 0
- [ ] `pnpm compile-prompts` 실행 시 `lib/prompts/_compiled/`에 20개 이상의 `.ts` 파일 + `index.ts` 생성
- [ ] PWA `/manifest.json` 응답 확인 (prod 빌드 후)
- [ ] `e2e/visual/routes.spec.ts` 1건 spec 등록
- [ ] `.github/workflows/visual-regression.yml` + `archive-vr-diffs.yml` 존재
- [ ] GitHub 라벨 `accept-baseline` 생성 (사용자 액션)
- [ ] feature 브랜치 push 완료 + 사용자가 PR 생성
- [ ] todo.md + dream-app.html 동기 갱신 완료
- [ ] Vercel 배포 1회 점검 (사용자 액션, PR 머지 후 가능)

---

# 실행 시 주의사항

## 카테고리 룰 (임시)
- `[app]` — `app/`, `lib/`, `components/`, `scripts/`
- `[test]` — `e2e/`, `__tests__/`
- `[config]` — `package.json`, `tsconfig`, `next.config`, `.env*`, `.gitignore`, `.github/workflows`, ESLint/Prettier
- `[docs]` — `README.md`, `docs/`

Plan 완료 후 별도 PR로 `.claude/rules/git.md`에 위 카테고리를 정식 추가할 것.

## 메모리 룰 적용
- `feature-branch-pr-workflow`: 이 plan은 `feature/writing-plan-phase-1` 브랜치에서 실행 중. push까지만 진행, PR 생성은 사용자.
- `feedback-html-dashboard`: Task 23에서 dream-app.html 동기 갱신 필수.

## 검증 도구 사용 우선순위
- 파일 작성: Write/Edit (Bash sed/awk 금지 — verification-guard 훅)
- 패키지 관리: pnpm (npm/yarn 금지)
- 외부 정보 조사: WebSearch + 공식 문서 우선 (info-verification.md)

## 실패 시 대응
- `pnpm install` 실패 → 사용자에게 .npmrc / 토큰 확인 요청 (특히 @gugbab scope)
- typecheck 실패 → 에러 라인 정확히 보고, 임의 `// @ts-ignore` 금지
- lint 실패 → `pnpm lint --fix` 시도, 안 되면 보고
- 시각 회귀 로컬 캡처 — commit 금지 (`__screenshots__/`의 PNG는 CI에서만 갱신)
