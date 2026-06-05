import { test, expect } from '@playwright/test';

// 실제 Gemini API 호출하는 실 브라우저 시뮬레이션 테스트
// - IndexedDB 초기화
// - 타이핑 → 전송 → AI 응답 수신 → 화면 표시 확인
// - 연속 메시지 (멀티턴) 확인
// - 히스토리 저장 확인

/** textarea가 다시 활성화될 때까지 대기 — streaming 완료 증명 */
async function waitForStreamingDone(page: import('@playwright/test').Page, timeout = 30000) {
  const textarea = page.locator('[aria-label="꿈 입력"]');
  await expect(textarea).toBeEnabled({ timeout });
}

test.describe('실제 E2E 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // IDB 초기화 (깨끗한 상태)
    await page.addInitScript(`
      try { indexedDB.deleteDatabase('gugbab-dream'); } catch {}
    `);
  });

  test('1) 홈 로드 - 채팅 입력창 보임, 전송 버튼 초기 disabled', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('[aria-label="꿈 입력"]');
    const sendBtn = page.locator('[aria-label="전송"]');

    await expect(textarea).toBeVisible();
    await expect(sendBtn).toBeVisible();
    expect(await sendBtn.isDisabled()).toBe(true);

    console.log('JS errors:', errors);
    expect(errors, `JS 에러 있음: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('2) 텍스트 입력 → 전송 버튼 활성화 → 클릭 → textarea 비워짐', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('[aria-label="꿈 입력"]');
    const sendBtn = page.locator('[aria-label="전송"]');

    await textarea.click();
    await page.keyboard.type('뱀이 나오는 꿈을 꿨어요');
    await page.waitForTimeout(200);

    expect(await sendBtn.isDisabled()).toBe(false);

    await sendBtn.click();

    // textarea 즉시 비워져야 함
    await expect(textarea).toHaveValue('');
    console.log('JS errors after click:', errors);
    expect(errors, `JS 에러 있음: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('3) 전송 후 유저 메시지 버블 표시 + AI 스트리밍 응답 수신 (SSE mock)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    // /api/chat 을 SSE mock으로 인터셉트 (실제 Gemini 호출 안 함)
    await page.route('/api/chat', async (route) => {
      const body = [
        'data: {"type":"chunk","text":"꿈 해석:"}\n\n',
        'data: {"type":"chunk","text":"뱀은 전통적으로 재물운을 상징해요."}\n\n',
        'data: {"type":"done","sessionId":"mock-id"}\n\n',
      ].join('');
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
        body,
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const chatLog = page.locator('[role="log"]');
    const textarea = page.locator('[aria-label="꿈 입력"]');
    const sendBtn = page.locator('[aria-label="전송"]');

    await textarea.click();
    await page.keyboard.type('뱀이 나오는 꿈을 꿨어요');
    await sendBtn.click();

    // 1. 유저 메시지 버블이 즉시 표시됨
    await expect(chatLog).toContainText('뱀이 나오는 꿈을 꿨어요', { timeout: 3000 });

    // 2. AI 응답 텍스트가 채팅 로그에 나타날 때까지 대기 (mock이므로 빠름)
    await expect(chatLog).toContainText('뱀은 전통적으로 재물운을 상징해요', { timeout: 5000 });
    console.log('AI 응답 확인');

    // 3. streaming 완료 대기 (textarea 재활성화)
    await waitForStreamingDone(page);

    const logText = await chatLog.textContent();
    console.log('채팅 로그 일부:', logText?.slice(0, 200));

    console.log('JS errors:', errors);
    expect(errors, `JS 에러 있음: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('4) 멀티턴 - 두 번째 메시지도 전송됨', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const chatLog = page.locator('[role="log"]');
    const textarea = page.locator('[aria-label="꿈 입력"]');
    const sendBtn = page.locator('[aria-label="전송"]');

    // 첫 번째 메시지
    await textarea.click();
    await page.keyboard.type('뱀이 나오는 꿈을 꿨어요');
    await sendBtn.click();
    await expect(chatLog).toContainText('뱀이 나오는 꿈을 꿨어요', { timeout: 3000 });

    // AI 첫 응답 대기 (streaming 완료 = textarea 재활성화)
    await waitForStreamingDone(page);

    // 두 번째 메시지
    await textarea.click();
    await page.keyboard.type('뱀이 빨간색이었어요');
    await page.waitForTimeout(200);

    const sendBtnEnabled = await sendBtn.isEnabled();
    console.log('두 번째 전송 버튼 활성화:', sendBtnEnabled);
    expect(sendBtnEnabled).toBe(true);

    await sendBtn.click();
    await expect(chatLog).toContainText('뱀이 빨간색이었어요', { timeout: 3000 });

    // 두 번째 AI 응답 대기
    await waitForStreamingDone(page);

    const logText = await chatLog.textContent();
    expect(logText).toContain('뱀이 나오는 꿈을 꿨어요');
    expect(logText).toContain('뱀이 빨간색이었어요');

    console.log('JS errors:', errors);
    expect(errors, `JS 에러 있음: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('5) Enter 키로 전송', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('[aria-label="꿈 입력"]');
    const chatLog = page.locator('[role="log"]');

    await textarea.click();
    await page.keyboard.type('뱀 꿈');
    await page.keyboard.press('Enter');

    await expect(textarea).toHaveValue('');
    await expect(chatLog).toContainText('뱀 꿈', { timeout: 3000 });
  });

  test('6) Shift+Enter는 줄바꿈 (전송 안 됨)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('[aria-label="꿈 입력"]');

    await textarea.click();
    await page.keyboard.type('뱀 꿈');
    await page.keyboard.press('Shift+Enter');

    // textarea 안 비워짐
    const val = await textarea.inputValue();
    console.log('Shift+Enter 후 textarea 값:', JSON.stringify(val));
    expect(val).toContain('뱀 꿈');
  });

  test('7) 히스토리 저장 - 전송 후 /history에 세션 나타남 (SSE mock)', async ({ page }) => {
    // /api/chat 을 SSE mock으로 인터셉트
    await page.route('/api/chat', async (route) => {
      const sessionId = JSON.parse((await route.request().postData()) ?? '{}').sessionId ?? 'mock';
      const body = [
        'data: {"type":"chunk","text":"뱀 꿈 해석입니다."}\n\n',
        `data: {"type":"done","sessionId":"${sessionId}"}\n\n`,
      ].join('');
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
        body,
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('[aria-label="꿈 입력"]');
    const sendBtn = page.locator('[aria-label="전송"]');

    await textarea.click();
    await page.keyboard.type('뱀이 나오는 꿈');
    await sendBtn.click();

    // 유저 메시지 표시 확인
    const chatLog = page.locator('[role="log"]');
    await expect(chatLog).toContainText('뱀이 나오는 꿈', { timeout: 3000 });

    // AI 응답 텍스트가 나타날 때까지 대기 (mock이므로 빠름)
    await expect(chatLog).toContainText('뱀 꿈 해석입니다', { timeout: 5000 });

    // streaming 완료 대기
    await waitForStreamingDone(page);
    await page.waitForTimeout(500); // saveSession flush

    // SPA 링크로 이동 — page.goto는 addInitScript 재실행으로 IDB 초기화됨
    await page.locator('[href="/history"]').click();
    await page.waitForURL('/history');
    await page.waitForLoadState('networkidle');

    // 세션이 저장됨
    const historyMain = page.locator('main');
    const text = await historyMain.textContent();
    console.log('히스토리 텍스트:', text?.slice(0, 200));
    expect(text).toContain('뱀');
  });
});
