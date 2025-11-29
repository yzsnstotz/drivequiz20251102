/**
 * 轻量级语言检测工具
 * 使用简单字符集规则检测文本语言，不调用外部AI
 */

export type DetectedLang = "en" | "zh" | "ja" | "mixed" | "unknown";

/**
 * 从文本中检测语言
 * @param text 待检测的文本
 * @returns 检测到的语言类型
 */
export function detectLangFromText(text: string | null | undefined): DetectedLang {
  try {
    // 防御处理：null/undefined/非字符串
    if (text === null || text === undefined) {
      return "unknown";
    }
    
    if (typeof text !== "string") {
      return "unknown";
    }
    
    const trimmed = text.trim();
    
    // 太短无法判断
    if (trimmed.length < 3) {
      return "unknown";
    }
    
    // 统计各类字符数量
    let asciiCount = 0; // ASCII字母（a-z, A-Z）
    let cjkCount = 0; // 中文字符（\u4E00-\u9FFF）
    let hiraganaCount = 0; // 平假名（\u3040-\u309F）
    let katakanaCount = 0; // 片假名（\u30A0-\u30FF）
    let totalChars = 0; // 总字符数（排除空格和标点）
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      const code = char.charCodeAt(0);
      
      // ASCII字母
      if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
        asciiCount++;
        totalChars++;
      }
      // 中文字符
      else if (code >= 0x4E00 && code <= 0x9FFF) {
        cjkCount++;
        totalChars++;
      }
      // 平假名
      else if (code >= 0x3040 && code <= 0x309F) {
        hiraganaCount++;
        totalChars++;
      }
      // 片假名
      else if (code >= 0x30A0 && code <= 0x30FF) {
        katakanaCount++;
        totalChars++;
      }
      // 其他字符（空格、标点等）不计入totalChars
    }
    
    // 如果总字符数太少，无法判断
    if (totalChars < 3) {
      return "unknown";
    }
    
    const asciiRatio = asciiCount / totalChars;
    const cjkRatio = cjkCount / totalChars;
    const japaneseRatio = (hiraganaCount + katakanaCount) / totalChars;
    
    // 检测日文：存在大量假名
    if (japaneseRatio > 0.1) {
      return "ja";
    }
    
    // 检测中文：大量CJK字符且几乎无假名
    if (cjkRatio > 0.3 && japaneseRatio < 0.05) {
      return "zh";
    }
    
    // 检测英文：大量ASCII字母且少量CJK
    if (asciiRatio > 0.5 && cjkRatio < 0.1) {
      return "en";
    }
    
    // 多种字符集混合
    if (asciiRatio > 0.2 && cjkRatio > 0.2) {
      return "mixed";
    }
    if (cjkRatio > 0.1 && japaneseRatio > 0.05) {
      return "mixed";
    }
    
    // 无法判断
    return "unknown";
  } catch (error) {
    // 任何错误都返回unknown，绝不抛错
    console.warn("[detectLangFromText] Error detecting language:", error);
    return "unknown";
  }
}

