/**
 * 多语言内容类型定义
 * 支持字符串（兼容旧数据）或 JSONB 对象格式
 */
export type MultilangContent = string | { zh?: string; en?: string; ja?: string; };

/**
 * 多语言内容对象类型
 */
export interface MultilangObject {
  zh?: string;
  en?: string;
  ja?: string;
}

