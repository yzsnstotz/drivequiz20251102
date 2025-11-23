/**
 * 数据库 JSON 工具函数
 */

/**
 * 将值转换为文本数组或 null
 * @param value 输入值（可能是数组、字符串或 null）
 * @returns 文本数组或 null
 */
export function toTextArrayOrNull(value: any): string[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === "string") {
    return [value];
  }
  return null;
}

