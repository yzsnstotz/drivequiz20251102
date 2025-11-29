/**
 * 多语言内容工具函数
 * 用于从 JSONB 格式的多语言内容中获取指定语言的内容
 */

import type { MultilangContent } from "@/types/multilang";

/**
 * 从多语言内容中获取指定语言的内容
 * @param content 多语言内容（字符串或对象）
 * @param locale 目标语言（zh, en, ja）
 * @param fallback 回退值（如果所有语言都不可用）
 * @returns 对应语言的内容字符串
 */
export function getMultilangContent(
  content: MultilangContent | null | undefined,
  locale: string,
  fallback?: string
): string {
  // 如果内容为空，返回回退值或空字符串
  if (!content) {
    return fallback || "";
  }

  // 如果内容是字符串（兼容旧数据），直接返回
  if (typeof content === "string") {
    return content;
  }

  // 如果内容是对象，根据 locale 返回对应语言
  if (typeof content === "object") {
    // 标准化 locale（支持 zh-CN, zh_CN 等变体）
    const normalizedLocale = normalizeLocale(locale);
    
    // 优先返回目标语言
    if (content[normalizedLocale as keyof typeof content]) {
      return content[normalizedLocale as keyof typeof content] || "";
    }

    // 按优先级回退：zh > en > ja > 第一个可用语言
    const fallbackOrder = ["zh", "en", "ja"];
    
    // 先尝试按优先级回退
    for (const lang of fallbackOrder) {
      if (content[lang as keyof typeof content]) {
        return content[lang as keyof typeof content] || "";
      }
    }

    // 如果都没有，返回第一个可用语言
    const firstAvailable = Object.values(content).find((v) => v && typeof v === "string" && v.trim() !== "");
    if (firstAvailable) {
      return firstAvailable;
    }
  }

  // 如果都不匹配，返回回退值或空字符串
  return fallback || "";
}

/**
 * 标准化语言代码
 * @param locale 语言代码
 * @returns 标准化的语言代码（zh, en, ja）
 */
function normalizeLocale(locale: string): string {
  const normalized = locale.toLowerCase().replace(/[_-]/g, "-");
  
  if (normalized.startsWith("zh")) {
    return "zh";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  if (normalized.startsWith("ja")) {
    return "ja";
  }
  
  return normalized;
}

/**
 * 检查多语言内容是否有效（至少有一个语言有值）
 * @param content 多语言内容
 * @returns 是否有效
 */
export function isValidMultilangContent(content: MultilangContent | null | undefined): boolean {
  if (!content) {
    return false;
  }

  if (typeof content === "string") {
    return content.trim() !== "";
  }

  if (typeof content === "object") {
    return Object.values(content).some((v) => v && typeof v === "string" && v.trim() !== "");
  }

  return false;
}

/**
 * 创建多语言对象
 * @param zh 中文内容
 * @param en 英文内容
 * @param ja 日文内容
 * @returns 多语言对象
 */
export function createMultilangObject(
  zh?: string,
  en?: string,
  ja?: string
): { zh?: string; en?: string; ja?: string } {
  const obj: { zh?: string; en?: string; ja?: string } = {};
  
  if (zh && zh.trim()) {
    obj.zh = zh.trim();
  }
  if (en && en.trim()) {
    obj.en = en.trim();
  }
  if (ja && ja.trim()) {
    obj.ja = ja.trim();
  }
  
  return obj;
}

