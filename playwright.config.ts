/**
 * Playwright 시각 회귀 설정.
 *
 * - testDir: e2e/visual
 * - webServer: Next.js dev 서버 자동 기동 (3000)
 * - viewport: 1280×800 Chromium (베이스라인 단일 환경)
 * - 베이스라인은 Linux(CI)에서만 캡처/비교 — 로컬 macOS PNG 는 commit 금지
 *   (snapshotPathTemplate 으로 OS suffix 제거)
 *
 * sibling 프로젝트 02_gugbab-claude-voca 의 visual-regression 패턴을 Next.js 컨텍스트로
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
