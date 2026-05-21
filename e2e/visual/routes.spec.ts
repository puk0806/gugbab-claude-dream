/**
 * 라우트 페이지 시각 회귀 spec.
 *
 * 한 라우트당 한 스크린샷. 새 라우트가 등장하면 본 파일에 추가하고
 * PR에 `accept-baseline` 라벨을 붙여 베이스라인을 등록한다.
 *
 * 베이스라인 PNG 는 `e2e/visual/__screenshots__/routes.spec.ts/` 아래에
 * 자동 저장된다. Linux(CI)에서만 캡처/갱신하며 로컬 변경분은 commit 금지.
 *
 * Phase 1-B 시점: 홈 1건만 캡처. Phase 2 에서 /result/[id], /history 추가.
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
