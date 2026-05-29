/**
 * 결정론 mocked SSE 응답 — Playwright page.route 에서 사용.
 *
 * 톤별 고정 샘플 1종씩 + 안전 차단 1종.
 * 실제 Anthropic 호출을 차단하고 동일한 텍스트를 매번 반환 → baseline 안정.
 */
import type { Route } from '@playwright/test';

const SAMPLE_BY_TONE: Record<string, string> = {
  casual: `## 작은 손짓\n\n어젯밤 꿈은 짧지만 또렷한 신호 같아요. 마음 한 켠에서 가볍게 두드리는 메시지.\n\n살짝 미소가 나는 마무리예요. 좋은 하루 보내세요.`,
  reflective: `## 자기 안의 작은 신호\n\n### 한국 전통 관점\n전통적으로는 ...로 풀이됩니다.\n\n### 융 분석심리학 관점\n자기(self) 의 통합 신호로 보입니다.\n\n### 프로이트 정신분석 관점\n억압된 ...의 재출현으로 해석 가능합니다.\n\n**나에게 묻는 질문 3개**\n1. 최근 어떤 결정을 미루고 있나요?\n2. 누구의 인정을 가장 원하고 있나요?\n3. 이 꿈이 사라진다면 가장 그리울 것은 무엇일까요?`,
  traditional: `## 길몽\n\n### 등장 상징\n- 물고기: 재물·기회\n- 맑은 물: 마음의 정화\n\n종합하면 전통적으로 길몽으로 풀이됩니다.`,
};

export function makeChunkedSse(text: string, chunkSize = 30): string {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  const events = chunks.map((delta) => `data: ${JSON.stringify({ type: 'chunk', delta })}\n\n`);
  events.push(
    `data: ${JSON.stringify({
      type: 'done',
      modelId: 'claude-sonnet-4-6',
      verdict: { category: 'null', confidence: 1.0 },
    })}\n\n`,
  );
  return events.join('');
}

export function makeSafetyBlockSse(): string {
  return `data: ${JSON.stringify({
    type: 'safety_block',
    verdict: { category: 'self_harm', confidence: 0.95 },
    resources: [
      {
        name: '자살예방상담전화',
        phone: '109',
        description: '24시간 연중무휴 · 전화 / 문자 모두 가능',
      },
      {
        name: '정신건강위기상담전화',
        phone: '1577-0199',
        description: '24시간 · 정신건강 위기 일반',
      },
      { name: '청소년상담전화', phone: '1388', description: '청소년 위기 · 익명 가능' },
    ],
  })}\n\n`;
}

export async function mockInterpretRoute(
  route: Route,
  variant: 'casual' | 'reflective' | 'traditional' | 'safety',
): Promise<void> {
  const body =
    variant === 'safety'
      ? makeSafetyBlockSse()
      : makeChunkedSse(SAMPLE_BY_TONE[variant] ?? SAMPLE_BY_TONE.reflective);
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
    body,
  });
}
