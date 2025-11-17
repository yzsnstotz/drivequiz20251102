/**
 * 题目拼装工具
 * 
 * 统一管理所有题目相关场景的 question 字段格式化逻辑
 * 确保场景测试和实际业务使用完全一致的格式
 */

export interface QuestionTranslationPayload {
  stem: string;
  options?: string[];
  explanation?: string;
  sourceLanguage: string;
  targetLanguage: string;
  questionType?: "single" | "multiple" | "truefalse"; // 题目类型，用于区分是非题
}

export interface QuestionPolishPayload {
  stem: string;
  options?: string[];
  explanation?: string;
  language: string; // 题目内容语言，如 'zh' | 'ja' | 'en'
  questionType?: "single" | "multiple" | "truefalse"; // 题目类型，用于区分是非题
}

/**
 * 用于 question_translation 场景：
 * 生成发给 AI 的 question 字段内容。
 * 
 * 注意：实现必须与当前业务中已有的格式完全一致。
 * 参考：
 * - src/app/api/admin/question-processing/_lib/batchProcessUtils.ts (translateWithPolish)
 * - apps/question-processor/src/ai.ts (translateWithPolish)
 */
export function buildQuestionTranslationInput(payload: QuestionTranslationPayload): string {
  const { stem, options = [], explanation, questionType } = payload;
  
  // 严格按照现有业务逻辑拼装
  // 格式：Content: ...\nOptions:\n- ...\nExplanation: ...
  const parts: string[] = [];
  
  // Content 部分（必需）
  parts.push(`Content: ${stem}`);
  
  // Options 部分处理
  // 对于是非题（truefalse），不输出 Options 部分
  // 对于单选/多选题，如果有选项则输出，否则不输出
  if (questionType === "truefalse") {
    // 是非题不需要选项，跳过 Options 部分
  } else if (options && options.length > 0) {
    // 单选或多选题：如果有选项则输出
    const optionsText = options.map((o) => `- ${o}`).join("\n");
    parts.push(`Options:\n${optionsText}`);
  }
  // 如果没有选项且不是是非题，也不输出 Options 部分（保持与现有逻辑一致）
  
  // Explanation 部分（如果有解析）
  if (explanation) {
    parts.push(`Explanation: ${explanation}`);
  }
  
  return parts.join("\n");
}

/**
 * 用于 question_polish 场景：
 * 生成发给 AI 的 question 字段内容。
 * 
 * 注意：实现必须与当前业务中已有的格式完全一致。
 * 参考：
 * - src/app/api/admin/question-processing/_lib/batchProcessUtils.ts (polishContent)
 */
export function buildQuestionPolishInput(payload: QuestionPolishPayload): string {
  const { stem, options = [], explanation, language, questionType } = payload;
  
  // 严格按照现有业务逻辑拼装
  // 格式：Language: ...\nContent: ...\nOptions:\n- ...\nExplanation: ...
  const parts: string[] = [];
  
  // Language 部分（必需）
  parts.push(`Language: ${language}`);
  
  // Content 部分（必需）
  parts.push(`Content: ${stem}`);
  
  // Options 部分处理
  // 对于是非题（truefalse），不输出 Options 部分
  // 对于单选/多选题，如果有选项则输出，否则不输出
  if (questionType === "truefalse") {
    // 是非题不需要选项，跳过 Options 部分
  } else if (options && options.length > 0) {
    // 单选或多选题：如果有选项则输出
    const optionsText = options.map((o) => `- ${o}`).join("\n");
    parts.push(`Options:\n${optionsText}`);
  }
  // 如果没有选项且不是是非题，也不输出 Options 部分（保持与现有逻辑一致）
  
  // Explanation 部分（如果有解析）
  if (explanation) {
    parts.push(`Explanation: ${explanation}`);
  }
  
  return parts.join("\n");
}

