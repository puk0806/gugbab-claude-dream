/**
 * 라우트 시각 회귀 spec — Phase 2-B 확장.
 *
 * 라우트: /, /result/[id], /history
 * 비결정 차단: addInitScript (IndexedDB·random·Date) + page.route SSE mock
 */
import { expect, type Page, test } from '@playwright/test';
import { FIXTURE_SCRIPT, makeSeedIdbScript } from './_fixtures/init-script';
import { mockInterpretRoute } from './_fixtures/sse-mock';

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

  test('result-reflective', async ({ page }) => {
    await page.route('**/api/interpret', (route) => mockInterpretRoute(route, 'reflective'));
    const seedId = 'fixt01ULIDXXXXXXXXXXXXXXXX';
    await page.addInitScript(
      makeSeedIdbScript({
        id: seedId,
        tone: 'reflective',
        dreamText: '맑은 강에서 큰 물고기를 잡았어요.',
      }),
    );
    await page.goto(`/result/${seedId}`);
    await settle(page);
    await page.waitForSelector('text=나에게 묻는 질문', { timeout: 5000 });
    await expect(page).toHaveScreenshot('result-reflective.png', { fullPage: true });
  });

  test('history-empty', async ({ page }) => {
    await page.goto('/history');
    await settle(page);
    await expect(page).toHaveScreenshot('history-empty.png', { fullPage: true });
  });
});
