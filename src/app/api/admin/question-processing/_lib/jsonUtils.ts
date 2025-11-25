/**
 * JSON 清理工具函数
 * 
 * 用于处理 AI 返回的 JSON 字符串，确保符合标准 JSON 语法
 */

/**
 * 清理 AI 返回的 JSON 字符串，使其尽量符合标准 JSON 语法：
 * - 去掉 Markdown 代码块包裹
 * - 去掉 BOM / 隐藏字符
 * - 去掉对象/数组结尾处的尾随逗号
 * 
 * @param input 原始 JSON 字符串
 * @returns 清理后的 JSON 字符串
 */
export function cleanJsonString(input: string): string {
  if (!input) return input;

  let s = input.trim();

  // 去掉 UTF-8 BOM / 零宽空格
  s = s.replace(/^[\uFEFF\u200B]+/, '');

  // 去掉 ```json / ``` 包裹
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

  // 去掉对象 / 数组 结尾处的尾随逗号: {...,} / [...,]
  s = s.replace(/,\s*([}\]])/g, '$1');

  return s;
}

/**
 * 递归清理将要写入 JSONB 字段的数据：
 * - 移除所有值为 undefined 的属性
 * - 数组元素中的 undefined 直接丢弃
 * - 保证只包含 JSON 支持的类型（string/number/boolean/null/object/array）
 * 
 * @param value 要清理的值
 * @returns 清理后的值（不包含 undefined）
 */
export function sanitizeJsonForDb<T>(value: T): T | null {
  if (value === undefined) return null;
  if (value === null) return null;

  if (Array.isArray(value)) {
    const arr = value
      .map((v) => sanitizeJsonForDb(v))
      .filter((v) => v !== null) as any[];
    return arr as any;
  }

  if (typeof value === 'object') {
    const obj: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      const sanitized = sanitizeJsonForDb(v as any);
      if (sanitized !== null) {
        obj[k] = sanitized;
      }
    }
    return obj as T;
  }

  // 基本类型：string / number / boolean
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  // 其他类型一律丢弃
  return null;
}

