// ============================================================
// 文件路径: src/lib/questionUtils.ts
// 功能: 题目多语言工具函数
// ============================================================

import { Language } from './i18n';

export interface QuestionContent {
  zh: string;
  en?: string;
  ja?: string;
  [key: string]: string | undefined;
}

/**
 * 获取题目的多语言内容
 * @param content 题目内容（可能是字符串或多语言对象）
 * @param locale 目标语言
 * @returns 对应语言的题目内容
 */
export function getQuestionContent(
  content: string | QuestionContent,
  locale: Language = 'zh'
): string | null {
  if (typeof content === 'string') {
    // 兼容旧格式：单语言字符串
    return content;
  }
  
  // 新格式：多语言对象
  // 只返回目标语言（必须是有效的非空字符串，且不是占位符），如果没有则返回null
  const targetLangValue = content[locale];
  // 检查是否是占位符（以 [EN] 或 [JA] 开头）
  const isPlaceholder = targetLangValue && typeof targetLangValue === 'string' && 
    (targetLangValue.trim().startsWith('[EN]') || targetLangValue.trim().startsWith('[JA]'));
  
  if (targetLangValue && typeof targetLangValue === 'string' && targetLangValue.trim().length > 0 && !isPlaceholder) {
    return targetLangValue;
  }
  
  // 如果目标语言不存在、为空或是占位符，返回null（不使用任何备用措施）
  return null;
}

/**
 * 获取题目的选项（支持多语言）
 * @param options 选项数组（可能是字符串数组或多语言对象数组）
 * @param locale 目标语言
 * @returns 对应语言的选项数组
 */
export function getQuestionOptions(
  options?: string[] | Array<{ zh: string; en?: string; ja?: string; [key: string]: string | undefined }>,
  locale: Language = 'zh'
): string[] {
  if (!options || options.length === 0) {
    return [];
  }
  
  // 如果第一个选项是字符串，说明是旧格式
  if (typeof options[0] === 'string') {
    return options as string[];
  }
  
  // 新格式：多语言对象数组
  return (options as Array<QuestionContent>).map(option => 
    getQuestionContent(option, locale)
  ).filter((val): val is string => val !== null);
}

