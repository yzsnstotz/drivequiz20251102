// ============================================================
// 文件路径: src/lib/questionContentUtils.ts
// 功能: 题目内容处理工具函数（兼容新旧格式）
// ============================================================

import { Language } from './i18n';

export type QuestionContent = string | {
  zh: string;
  en?: string;
  ja?: string;
  [key: string]: string | undefined;
};

/**
 * 获取题目的文本内容（用于显示、搜索等）
 * @param content 题目内容（可能是字符串或多语言对象）
 * @param locale 目标语言（默认zh）
 * @returns 对应语言的文本内容
 */
export function getContentText(
  content: QuestionContent | null | undefined,
  locale: Language = 'zh'
): string {
  if (!content) {
    return '';
  }
  
  if (typeof content === 'string') {
    // 兼容旧格式：单语言字符串
    return content;
  }
  
  // 新格式：多语言对象
  // 优先返回目标语言（必须是有效的非空字符串），如果没有则返回中文，最后返回第一个可用的语言
  const targetLangValue = content[locale];
  if (targetLangValue && typeof targetLangValue === 'string' && targetLangValue.trim().length > 0) {
    return targetLangValue;
  }
  
  // 如果目标语言不存在或为空，回退到中文
  if (content.zh && typeof content.zh === 'string' && content.zh.trim().length > 0) {
    return content.zh;
  }
  
  // 返回第一个可用的有效语言
  for (const key of Object.keys(content)) {
    const value = content[key];
    if (value && typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  
  return '';
}

/**
 * 获取题目的文本内容（用于搜索，转换为小写）
 * @param content 题目内容
 * @param locale 目标语言（默认zh）
 * @returns 小写的文本内容
 */
export function getContentTextLower(
  content: QuestionContent | null | undefined,
  locale: Language = 'zh'
): string {
  return getContentText(content, locale).toLowerCase();
}

/**
 * 检查题目内容是否包含指定文本（用于搜索）
 * @param content 题目内容
 * @param searchText 搜索文本
 * @param locale 目标语言（默认zh）
 * @returns 是否包含
 */
export function contentIncludes(
  content: QuestionContent | null | undefined,
  searchText: string,
  locale: Language = 'zh'
): boolean {
  const contentText = getContentTextLower(content, locale);
  const searchLower = searchText.toLowerCase();
  return contentText.includes(searchLower);
}

/**
 * 获取题目内容的截取（用于日志、预览等）
 * @param content 题目内容
 * @param maxLength 最大长度（默认50）
 * @param locale 目标语言（默认zh）
 * @returns 截取后的文本
 */
export function getContentPreview(
  content: QuestionContent | null | undefined,
  maxLength: number = 50,
  locale: Language = 'zh'
): string {
  const text = getContentText(content, locale);
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * 规范化content字段（确保是多语言对象格式）
 * @param content 题目内容（可能是字符串或多语言对象）
 * @returns 多语言对象
 */
export function normalizeContent(
  content: QuestionContent
): { zh: string; en?: string; ja?: string; [key: string]: string | undefined } {
  if (typeof content === 'string') {
    // 兼容旧格式：单语言字符串转换为多语言对象
    return { zh: content };
  }
  
  // 新格式：多语言对象
  return content;
}

