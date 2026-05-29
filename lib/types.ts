/**
 * 꿈해몽 PWA 공통 타입.
 * lib/* 와 app/api 양쪽이 import 한다.
 */

export type Tone = 'casual' | 'reflective' | 'traditional';

export type SafetyCategory =
  | 'null' // 안전 — 정상 해몽 진행
  | 'self_harm' // 자해/자살 신호
  | 'trauma' // 트라우마 재경험
  | 'violence_toward_others' // 타해 위협
  | 'severe_distress'; // 심각한 정서적 고통

export interface SafetyVerdict {
  category: SafetyCategory;
  confidence: number; // 0..1
  rationale?: string; // 디버깅 — UI 노출 X
}

export interface DreamEntry {
  id: string; // ULID
  createdAt: number; // Unix ms
  dreamText: string; // 사용자 입력 원문 (로컬 only)
  tone: Tone;
  interpretation: string; // 스트리밍 완료 후 누적 저장
  safetyVerdict: SafetyVerdict;
  modelId: string; // 예: 'claude-sonnet-4-6'
  schemaVersion: 1;
}

/** POST /api/interpret 요청 body */
export interface InterpretRequest {
  dreamText: string;
  tone: Tone;
}

export interface CrisisResource {
  name: string;
  phone: string;
  description?: string;
}

/** SSE event 종류 — 클라이언트 디스패처에서 분기 */
export type InterpretSseEvent =
  | { type: 'safety_block'; verdict: SafetyVerdict; resources: CrisisResource[] }
  | { type: 'chunk'; delta: string }
  | { type: 'done'; modelId: string; verdict: SafetyVerdict }
  | { type: 'error'; message: string };
