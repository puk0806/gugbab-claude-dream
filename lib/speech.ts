// 클라이언트 전용 — SSR에서 호출하지 않는다.

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function isRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface SpeechRecognizer {
  start(): void;
  stop(): void;
  abort(): void;
}

export function createRecognizer(
  onResult: (text: string, isFinal: boolean) => void,
  onEnd: () => void,
): SpeechRecognizer {
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;

  if (!Ctor) throw new Error('SpeechRecognition 미지원');

  const rec = new Ctor();
  rec.lang = 'ko-KR';
  rec.continuous = false;
  rec.interimResults = true;

  rec.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    onResult(result[0].transcript, result.isFinal);
  };
  rec.onend = onEnd;

  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
    abort: () => rec.abort(),
  };
}

export function speak(text: string): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  const voices = window.speechSynthesis.getVoices();
  const koVoice = voices.find((v) => v.lang.startsWith('ko'));
  if (koVoice) utter.voice = koVoice;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}
