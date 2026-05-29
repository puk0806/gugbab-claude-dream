/**
 * 안전 분류기 — Gemini Flash + JSON schema 강제.
 *
 * 보수 분기:
 *   - timeout (3s 초과) → 안전 카드 강제
 *   - 5xx / 파싱 실패 → 안전 카드 강제
 *   - confidence < 0.6 → 안전 카드 강제
 */
import { GoogleGenAI, HarmBlockThreshold, HarmCategory, Type } from '@google/genai';
import { getSafetyClassifierPrompt } from './prompts';
import type { SafetyVerdict } from './types';

const TIMEOUT_MS = 10000;
const SAFE_CONFIDENCE_THRESHOLD = 0.6;
const SAFETY_MODEL = process.env.GEMINI_SAFETY_MODEL ?? 'gemini-2.5-flash';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Gemini 자체 safety filter 완화 — 분류 대상이 자해/위기 신호 텍스트라
 * Gemini 가 응답을 막아버리면 분류 자체가 실패. BLOCK_ONLY_HIGH 로 분류 작업을
 * 허용한다 (우리 classifier 가 그 결과를 받아 safety_block 분기 처리).
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

function conservativeVerdict(reason: string): SafetyVerdict {
  return {
    category: 'severe_distress',
    confidence: 0.0,
    rationale: `보수적 분기: ${reason}`,
  };
}

export async function classifySafety(dreamText: string): Promise<SafetyVerdict> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: SAFETY_MODEL,
      config: {
        systemInstruction: getSafetyClassifierPrompt(),
        temperature: 0,
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              enum: ['null', 'self_harm', 'trauma', 'violence_toward_others', 'severe_distress'],
            },
            confidence: { type: Type.NUMBER },
            rationale: { type: Type.STRING },
          },
          required: ['category', 'confidence'],
        },
        safetySettings: SAFETY_SETTINGS,
        abortSignal: controller.signal,
      },
      contents: [{ role: 'user', parts: [{ text: dreamText }] }],
    });

    const text = response.text ?? '';
    if (!text) {
      return conservativeVerdict('빈 응답');
    }

    // Gemini 가 가끔 "Here is the JSON:" 같은 자연어 prefix 를 붙이거나
    // 응답이 잘려서 { ... } 블록을 추출해야 할 수 있다. 보수적 fallback.
    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr) as SafetyVerdict;
    if (!parsed.category || typeof parsed.confidence !== 'number') {
      return conservativeVerdict('스키마 불일치');
    }
    return parsed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return conservativeVerdict(msg);
  } finally {
    clearTimeout(timer);
  }
}

export function isSafe(verdict: SafetyVerdict): boolean {
  return verdict.category === 'null' && verdict.confidence >= SAFE_CONFIDENCE_THRESHOLD;
}
