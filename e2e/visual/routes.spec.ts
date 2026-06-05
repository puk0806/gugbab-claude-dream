/**
 * 라우트 시각 회귀 spec — Phase 3 채팅 UI.
 *
 * 라우트: /, /session/[id], /history
 */
import { expect, type Page, test } from '@playwright/test';
import { FIXTURE_SCRIPT, makeSeedSessionScript } from './_fixtures/init-script';

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

test.describe('routes — visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FIXTURE_SCRIPT);
  });

  test('home', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expect(page).toHaveScreenshot('home.png', { fullPage: true });
  });

  test('home-with-recent', async ({ page }) => {
    const seedId = 'fixt01ULIDXXXXXXXXXXXXXXXX';
    await page.addInitScript(
      makeSeedSessionScript({
        id: seedId,
        summary: '뱀이 나오는 꿈을 꿨어요',
        messages: [
          { role: 'user', content: '뱀이 나오는 꿈을 꿨어요', timestamp: Date.UTC(2026, 4, 21, 0, 0, 1) },
          { role: 'model', content: '오 뱀 꿈이군요! 뱀이 어떤 상태였나요?', timestamp: Date.UTC(2026, 4, 21, 0, 0, 2) },
        ],
      }),
    );
    await page.goto('/');
    await settle(page);
    await expect(page).toHaveScreenshot('home-with-recent.png', { fullPage: true });
  });

  test('session-readonly', async ({ page }) => {
    const seedId = 'fixt01ULIDXXXXXXXXXXXXXXXX';
    await page.addInitScript(
      makeSeedSessionScript({
        id: seedId,
        summary: '뱀이 나오는 꿈을 꿨어요',
        messages: [
          { role: 'user', content: '뱀이 나오는 꿈을 꿨어요', timestamp: Date.UTC(2026, 4, 21, 0, 0, 1) },
          { role: 'model', content: '오 뱀 꿈이군요! 뱀이 어떤 상태였나요?', timestamp: Date.UTC(2026, 4, 21, 0, 0, 2) },
        ],
      }),
    );
    await page.goto(`/session/${seedId}`);
    await settle(page);
    await expect(page).toHaveScreenshot('session-readonly.png', { fullPage: true });
  });

  test('history-empty', async ({ page }) => {
    await page.goto('/history');
    await settle(page);
    await expect(page).toHaveScreenshot('history-empty.png', { fullPage: true });
  });
});

