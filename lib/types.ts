export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface DreamSession {
  id: string;            // ULID
  createdAt: number;     // Unix ms
  messages: ChatMessage[];
  summary: string;       // 첫 사용자 메시지 앞 50자
  modelId: string;
  schemaVersion: 2;
}

/** v1 하위 호환 — 신규 저장 안 함, 읽기 전용 */
export interface DreamEntry {
  id: string;
  createdAt: number;
  dreamText: string;
  interpretation: string;
  modelId: string;
  schemaVersion: 1;
}

export type ChatSseEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; sessionId: string; modelId: string }
  | { type: 'error'; message: string };
