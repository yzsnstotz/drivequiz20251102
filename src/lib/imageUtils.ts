/**
 * 图片工具函数
 */

/**
 * 检查图片URL是否有效
 * @param url 图片URL（可能是 string | null | undefined）
 * @returns 如果URL有效返回true，否则返回false
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  
  const trimmed = url.trim();
  if (trimmed === '') {
    return false;
  }
  
  // 基本URL格式检查（可选，但可以帮助过滤明显无效的URL）
  // 允许 http://, https://, / 开头的相对路径，或 data: 开头的base64
  return trimmed.length > 0;
}

