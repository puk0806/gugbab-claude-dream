/**
 * 컴포넌트 상태별 시각 회귀 — Phase 3 채팅 UI.
 */
import { expect, test } from '@playwright/test';
import { FIXTURE_SCRIPT, makeSeedSessionScript } from './_fixtures/init-script';

test.describe('components — visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FIXTURE_SCRIPT);
  });

  test('chat-input-idle', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const inputBar = page.locator('[aria-label="꿈 입력"]');
    await expect(inputBar).toBeVisible();
    await expect(inputBar.locator('..').locator('..')).toHaveScreenshot('chat-input-idle.png');
  });

  test('history-list-with-sessions', async ({ page }) => {
    await page.addInitScript(
      makeSeedSessionScript({
        id: 'fixt01ULIDXXXXXXXXXXXXXXXX',
        summary: '뱀이 나오는 꿈을 꿨어요',
        messages: [
          { role: 'user', content: '뱀이 나오는 꿈을 꿨어요', timestamp: Date.UTC(2026, 4, 21, 0, 0, 1) },
          { role: 'model', content: '오 뱀 꿈이군요!', timestamp: Date.UTC(2026, 4, 21, 0, 0, 2) },
        ],
      }),
    );
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('history-with-sessions.png', { fullPage: true });
  });
});
