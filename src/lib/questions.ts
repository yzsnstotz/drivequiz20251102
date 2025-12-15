import type { CorrectAnswer } from '@/lib/types/question';

export function getBooleanCorrectAnswer(answer: CorrectAnswer | null): boolean | null {
  if (!answer) return null;

  // 检查是否是对象类型且有 type 属性
  if (typeof answer === "object" && answer !== null && "type" in answer) {
    if (answer.type === 'boolean') return answer.value;
  }

  // 兼容旧格式：直接的布尔值
  if (typeof answer === "boolean") return answer;

  return null;
}
