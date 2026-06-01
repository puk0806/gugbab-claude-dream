/**
 * 한국 위기 자원 정적 데이터.
 *
 * 출처: .claude/skills/humanities/crisis-intervention-resources-korea/SKILL.md
 * (compile-prompts 산출본에서 발췌해 정적 배열로 박는다 — 런타임 파싱 비용 회피)
 *
 * SafetyResourceCard 와 InterpretSseEvent.safety_block.resources 양쪽에서 import.
 */
import type { CrisisResource } from './types';

export const KOREA_CRISIS_RESOURCES: CrisisResource[] = [
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
  {
    name: '청소년상담전화',
    phone: '1388',
    description: '청소년 위기 · 익명 가능',
  },
];
