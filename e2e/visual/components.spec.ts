/**
 * 컴포넌트 상태별 시각 회귀.
 *
 * 페이지 경유로 캡처 (Storybook 미사용):
 *   - tone-chips: 홈에서 톤 클릭 후 form 영역만
 *   - safety-card: result 페이지에서 mocked safety_block 응답 후 카드 영역만
 */
import { expect, test } from '@playwright/test';
import { FIXTURE_SCRIPT, makeSeedIdbScript } from './_fixtures/init-script';
import { mockInterpretRoute } from './_fixtures/sse-mock';

const TONE_BUTTON_LABEL: Record<'casual' | 'reflective' | 'traditional', string> = {
  casual: '캐주얼',
  reflective: '자기 성찰',
  traditional: '한국 전통',
};

test.describe('components — visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FIXTURE_SCRIPT);
  });

  for (const tone of ['casual', 'reflective', 'traditional'] as const) {
    test(`tone-chips-${tone}`, async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      // styled-radix ToggleGroup.Item 은 role=radio (type=single 이라). 텍스트로 찾는다.
      await page.getByText(TONE_BUTTON_LABEL[tone], { exact: true }).click();
      await expect(page.locator('form')).toHaveScreenshot(`tone-chips-${tone}.png`);
    });
  }

  test('safety-card', async ({ page }) => {
    await page.route('**/api/interpret', (route) => mockInterpretRoute(route, 'safety'));
    const seedId = 'safety01ULIDXXXXXXXXXXXXXX';
    await page.addInitScript(
      makeSeedIdbScript({
        id: seedId,
        tone: 'reflective',
        dreamText: '(자해 시뮬레이션 입력)',
      }),
    );
    await page.goto(`/result/${seedId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=자살예방상담전화', { timeout: 5000 });
    await expect(page.locator('section[aria-labelledby="safety-title"]')).toHaveScreenshot(
      'safety-card.png',
    );
  });
});
