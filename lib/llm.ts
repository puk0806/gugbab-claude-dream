/**
 * Google Gen AI (Gemini Flash) 클라이언트 + 톤별 system instruction + 스트리밍.
 *
 * 우리 자산 (.claude/skills/humanities + .claude/agents/{research,validation}/dream-*)
 * 을 lib/prompts/_compiled/* 로 컴파일한 결과를 system instruction 에 그대로 박는다.
 *
 * 응답: AsyncIterable of chunks — API Route 에서 SSE 인코딩.
 */
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { getSystemPrompt } from './prompts';
import type { Tone } from './types';

const MODEL_ID = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const MAX_TOKENS = 2048;
const TEMPERATURE = 0.7;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Gemini 자체 safety filter 완화 — 우리 앱은 별도 dream-safety-classifier
 * (lib/safety.ts) 로 자해/위기 신호를 사전 차단하므로, Gemini 의 보수적 filter
 * 가 정상 꿈 텍스트(자해 단어 포함된 system instruction 등)까지 막는 것을 방지.
 * BLOCK_ONLY_HIGH 로 진짜 위험만 막는다.
 */
const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

export function getInterpretStream(tone: Tone, dreamText: string) {
  return ai.models.generateContentStream({
    model: MODEL_ID,
    config: {
      systemInstruction: getSystemPrompt(tone),
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
      safetySettings: SAFETY_SETTINGS,
    },
    contents: [{ role: 'user', parts: [{ text: dreamText }] }],
  });
}

export function getModelId(): string {
  return MODEL_ID;
}
