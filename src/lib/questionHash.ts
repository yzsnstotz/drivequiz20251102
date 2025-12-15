// ============================================================
// 文件路径: src/lib/questionHash.ts
// 功能: 题目 Hash 计算逻辑
// 更新日期: 2025-01-15
// ============================================================

import crypto from "crypto";
import type { CorrectAnswer } from "@/lib/types/question";
import { getBooleanCorrectAnswer } from "@/lib/questions";

// 题目数据类型
export type QuestionType = "single" | "multiple" | "truefalse";

export interface Question {
  id?: number;
  type: QuestionType;
  content: string | {
    zh: string;
    en?: string;
    ja?: string;
    [key: string]: string | undefined; // 支持其他语言
  }; // 支持单语言字符串或多语言对象
  options?: string[];
  correctAnswer: CorrectAnswer | null;
  image?: string;
  explanation?: string | {
    zh: string;
    en?: string;
    ja?: string;
    [key: string]: string | undefined; // 支持其他语言
  }; // 支持单语言字符串或多语言对象
  category?: string;
  hash?: string; // 题目hash（从JSON导入时可能已存在）
  license_tags?: string[]; // 驾照类型标签（兼容旧字段）
  stage_tag?: "both" | "provisional" | "regular"; // 阶段标签
  topic_tags?: string[]; // 主题标签数组
}

/**
 * 计算题目的唯一标识 hash
 * 包含：题干内容 + 选项 + 正确答案 + 图片URL（核心内容）
 * 
 * @param question 题目对象
 * @returns SHA256 hash 字符串（64字符）
 */
export function calculateQuestionHash(question: Question): string {
  // 如果已有hash，直接返回（从JSON导入时可能已存在）
  if (question.hash) {
    return question.hash;
  }

  // 提取题干内容（支持多语言，使用zh作为主要语言）
  let contentText: string;
  if (typeof question.content === "string") {
    // 兼容旧格式：单语言字符串
    contentText = question.content.trim();
  } else {
    // 新格式：多语言对象，使用zh作为主要语言计算hash
    contentText = question.content.zh?.trim() || "";
  }

  // 构建用于 hash 的核心内容
  const coreContent = [
    // 题干内容（必需）
    contentText,
    // 选项（如果有）
    question.options?.join("|") || "",
    // 正确答案（必需）
    (() => {
      if (!question.correctAnswer) return "";
      switch (question.type) {
        case "truefalse": {
          const v = getBooleanCorrectAnswer(question.correctAnswer);
          return v === null ? "" : `boolean:${v ? "true" : "false"}`;
        }
        case "single": {
          if (typeof question.correctAnswer === "object" && question.correctAnswer !== null && "type" in question.correctAnswer) {
            return question.correctAnswer.type === "single_choice"
              ? `single:${question.correctAnswer.value}`
              : "";
          } else if (typeof question.correctAnswer === "string") {
            // 兼容旧格式：直接的字符串答案
            return `single:${question.correctAnswer}`;
          }
          return "";
        }
        case "multiple": {
          if (typeof question.correctAnswer === "object" && question.correctAnswer !== null && "type" in question.correctAnswer) {
            return question.correctAnswer.type === "multiple_choice"
              ? `multiple:${[...question.correctAnswer.value].sort().join("|")}`
              : "";
          } else if (Array.isArray(question.correctAnswer)) {
            // 兼容旧格式：直接的字符串数组答案
            return `multiple:${[...question.correctAnswer].sort().join("|")}`;
          }
          return "";
        }
        default:
          return "";
      }
    })(),
    // 图片 URL（如果有，因为图片可能影响题目）
    question.image?.trim() || "",
  ]
    .filter((part) => part.length > 0) // 过滤空字符串
    .join("\n");

  // 计算 SHA256 hash
  return crypto
    .createHash("sha256")
    .update(coreContent, "utf8")
    .digest("hex");
}

/**
 * 生成版本号
 * 格式：YYYYMMDD-HHMMSS-序号
 * 
 * @param sequence 序号（可选，默认为 1）
 * @returns 版本号字符串
 */
export function generateVersion(sequence: number = 1): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const seq = String(sequence).padStart(3, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}-${seq}`;
}

/**
 * 计算所有题目的内容hash（不包含时间戳）
 * 用于比较内容是否发生变化
 * 
 * @param questions 所有题目列表
 * @returns 内容hash字符串（16位）
 */
export function calculateContentHash(questions: Question[]): string {
  // 1. 计算所有题目的hash并排序（确保一致性）
  const questionHashes = questions
    .map((q) => calculateQuestionHash(q))
    .sort() // 排序确保一致性
    .join("|");

  // 2. 计算所有hash的合并hash
  const allContentHash = crypto
    .createHash("sha256")
    .update(questionHashes, "utf8")
    .digest("hex")
    .substring(0, 16); // 取前16位作为标识

  return allContentHash;
}

/**
 * 计算AI回答的内容hash
 * 用于检测AI回答是否发生变化
 * 
 * @param aiAnswers AI回答对象（questionHash -> answer）
 * @returns AI回答hash字符串（16位）
 */
export function calculateAiAnswersHash(aiAnswers: Record<string, string>): string {
  // 1. 将所有AI回答的hash和内容组合并排序（确保一致性）
  const entries = Object.entries(aiAnswers)
    .map(([hash, answer]) => `${hash}:${answer}`)
    .sort() // 排序确保一致性
    .join("|");

  // 2. 计算合并hash
  const aiAnswersHash = crypto
    .createHash("sha256")
    .update(entries, "utf8")
    .digest("hex")
    .substring(0, 16); // 取前16位作为标识

  return aiAnswersHash;
}

/**
 * 计算完整内容hash（包含题目和AI回答）
 * 用于检测是否有任何内容变化
 * 
 * @param questions 所有题目列表
 * @param aiAnswers AI回答对象（questionHash -> answer）
 * @returns 完整内容hash字符串（33位：题目hash(16) + '-' + AI回答hash(16)）
 */
export function calculateFullContentHash(
  questions: Question[],
  aiAnswers: Record<string, string>
): string {
  const questionsHash = calculateContentHash(questions);
  const aiAnswersHash = calculateAiAnswersHash(aiAnswers);
  return `${questionsHash}-${aiAnswersHash}`;
}

/**
 * 生成统一版本号（包含所有题目的hash + 时间戳）
 * 格式：{所有题目hash的合并hash}-{时间戳}
 * 
 * @param questions 所有题目列表
 * @returns 版本号字符串
 */
export function generateUnifiedVersion(questions: Question[]): string {
  // 1. 计算内容hash
  const allContentHash = calculateContentHash(questions);

  // 2. 生成时间戳
  const now = new Date();
  const timestamp = now.getTime();

  // 3. 组合：hash标识-时间戳
  return `${allContentHash}-${timestamp}`;
}
