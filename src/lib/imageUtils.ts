/**
 * 图片工具函数
 */

/**
 * 检查图片URL是否有效
 * 简化版本：绝不抛错，只做基本检查
 * @param url 图片URL（可能是 string | null | undefined）
 * @returns 如果URL有效返回true，否则返回false
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  try {
    // 首先检查是否为 null 或 undefined
    if (url === null || url === undefined) {
      return false;
    }
    
    // 确保是字符串类型
    if (typeof url !== 'string') {
      return false;
    }
    
    // 检查 trim 后是否为空字符串
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      return false;
    }
    
    // 只检查基本格式：以 http://, https://, 或 / 开头
    // 使用简单的字符串检查，避免正则或复杂逻辑
    const lowerTrimmed = trimmed.toLowerCase();
    if (
      lowerTrimmed.startsWith('http://') ||
      lowerTrimmed.startsWith('https://') ||
      trimmed.startsWith('/')
    ) {
      return true;
    }
    
    // 所有其他情况返回 false
    return false;
  } catch (error) {
    // 任何错误都被捕获，返回 false，避免阻塞渲染
    // 限流：只在开发环境打印一次警告
    if (process.env.NODE_ENV === 'development') {
      console.warn('[isValidImageUrl] Error checking image URL (suppressed):', error);
    }
    return false;
  }
}

