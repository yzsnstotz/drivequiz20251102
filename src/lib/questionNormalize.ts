/**
 * 题目归一化工具函数
 * 用于将 AI 处理结果和数据库题目合并为规范化的题目对象
 */

import { normalizeCorrectAnswer } from "@/lib/questionDb";

export type QuestionType = "single" | "multiple" | "truefalse";

export interface BuildNormalizedQuestionParams {
  type: QuestionType;
  aiResult: {
    type: QuestionType;
    correct_answer?: any;
    source?: {
      content?: string;
      options?: string[];
      explanation?: string;
    };
    translations?: Record<string, {
      content?: string;
      options?: string[];
      explanation?: string;
    }>;
  };
  inputPayload?: any;
  currentQuestion?: {
    id?: number;
    type: QuestionType;
    correct_answer?: any;
    options?: any;
    content?: any;
    explanation?: any;
  };
}

export interface NormalizedQuestion {
  type: QuestionType;
  options: string[];
  correctAnswer: string | string[];
  content?: string;
  explanation?: string;
}

/**
 * 构建规范化题目对象
 * 从 AI 结果和当前题目中提取并合并数据，确保 correctAnswer 非空
 */
export function buildNormalizedQuestion(
  params: BuildNormalizedQuestionParams
): NormalizedQuestion {
  const { type, aiResult, inputPayload, currentQuestion } = params;

  // 1. 提取选项
  let options: string[] = [];
  
  // 优先从 aiResult.source.options 获取
  if (aiResult.source?.options && Array.isArray(aiResult.source.options)) {
    options = aiResult.source.options.filter(
      (opt): opt is string => typeof opt === "string"
    );
  }
  // 如果没有，从 currentQuestion.options 获取
  else if (currentQuestion?.options) {
    if (Array.isArray(currentQuestion.options)) {
      options = currentQuestion.options.filter(
        (opt): opt is string => typeof opt === "string"
      );
    }
  }
  // 如果还没有，从 inputPayload 获取
  else if (inputPayload?.options && Array.isArray(inputPayload.options)) {
    options = inputPayload.options.filter(
      (opt: any): opt is string => typeof opt === "string"
    );
  }

  // 2. 提取正确答案（优先级：aiResult > currentQuestion > inputPayload）
  let correctAnswer: any = null;

  if (aiResult.correct_answer !== undefined && aiResult.correct_answer !== null) {
    correctAnswer = aiResult.correct_answer;
  } else if (currentQuestion?.correct_answer !== undefined && currentQuestion?.correct_answer !== null) {
    correctAnswer = currentQuestion.correct_answer;
  } else if (inputPayload?.correctAnswer !== undefined && inputPayload?.correctAnswer !== null) {
    correctAnswer = inputPayload.correctAnswer;
  } else if (inputPayload?.correct_answer !== undefined && inputPayload?.correct_answer !== null) {
    correctAnswer = inputPayload.correct_answer;
  }

  // 3. 验证正确答案是否存在
  if (correctAnswer === null || correctAnswer === undefined) {
    throw new Error("MISSING_CORRECT_ANSWER");
  }

  // 4. 规范化正确答案格式
  const normalizedCorrectAnswer = normalizeCorrectAnswer(correctAnswer, type);

  // 5. 提取内容（可选）
  const content = aiResult.source?.content || undefined;

  // 6. 提取解析（可选）
  const explanation = aiResult.source?.explanation || undefined;

  // 7. 构建并返回规范化题目
  return {
    type,
    options,
    correctAnswer: normalizedCorrectAnswer,
    ...(content && { content }),
    ...(explanation && { explanation }),
  };
}

