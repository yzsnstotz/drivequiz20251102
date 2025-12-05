import type { CorrectAnswer } from '@/lib/types/question';

export function getBooleanCorrectAnswer(answer: CorrectAnswer | null): boolean | null {
  if (!answer) return null;
  if (answer.type === 'boolean') return answer.value;
  return null;
}
