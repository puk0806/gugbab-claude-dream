import type { Tone } from '../types';
import { CASUAL_SYSTEM_PROMPT } from './casual';
import { REFLECTIVE_SYSTEM_PROMPT } from './reflective';
import { SAFETY_CLASSIFIER_SYSTEM_PROMPT } from './safety';
import { TRADITIONAL_SYSTEM_PROMPT } from './traditional';

export function getSystemPrompt(tone: Tone): string {
  switch (tone) {
    case 'casual':
      return CASUAL_SYSTEM_PROMPT;
    case 'reflective':
      return REFLECTIVE_SYSTEM_PROMPT;
    case 'traditional':
      return TRADITIONAL_SYSTEM_PROMPT;
  }
}

export function getSafetyClassifierPrompt(): string {
  return SAFETY_CLASSIFIER_SYSTEM_PROMPT;
}
