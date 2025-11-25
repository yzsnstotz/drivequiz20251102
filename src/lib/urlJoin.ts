/**
 * URL 拼接工具函数
 * 安全地拼接 base URL 和 path，避免双斜杠、无斜杠、空格等问题
 * 指令版本：0003
 */

/**
 * 安全地拼接 base URL 和 path
 * @param base 基础 URL（如 "https://example.com" 或 "https://example.com/"）
 * @param path 路径（如 "/v1/ask" 或 "v1/ask"）
 * @returns 拼接后的完整 URL
 * 
 * @example
 * joinUrl("https://example.com", "/v1/ask") // "https://example.com/v1/ask"
 * joinUrl("https://example.com/", "/v1/ask") // "https://example.com/v1/ask"
 * joinUrl("https://example.com", "v1/ask") // "https://example.com/v1/ask"
 * joinUrl("https://example.com/", "v1/ask") // "https://example.com/v1/ask"
 */
export function joinUrl(base: string, path: string): string {
  // 移除 base 尾部的所有斜杠
  const b = base.replace(/\/+$/, "");
  // 移除 path 开头的所有斜杠
  const p = path.replace(/^\/+/, "");
  // 拼接，确保只有一个斜杠
  return `${b}/${p}`;
}

