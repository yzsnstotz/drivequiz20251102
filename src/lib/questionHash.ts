// ============================================================
// 文件路径: src/lib/questionHash.ts
// 功能: 题目 Hash 计算逻辑
// 更新日期: 2025-01-15
// ============================================================

import crypto from "crypto";

// 题目数据类型
export type QuestionType = "single" | "multiple" | "truefalse";

export interface Question {
  id?: number;
  type: QuestionType;
  content: string;
  options?: string[];
  correctAnswer: string | string[];
  image?: string;
  explanation?: string;
  category?: string;
}

/**
 * 计算题目的唯一标识 hash
 * 包含：题干内容 + 选项 + 正确答案 + 图片URL（核心内容）
 * 
 * @param question 题目对象
 * @returns SHA256 hash 字符串（64字符）
 */
export function calculateQuestionHash(question: Question): string {
  // 构建用于 hash 的核心内容
  const coreContent = [
    // 题干内容（必需）
    question.content.trim(),
    // 选项（如果有）
    question.options?.join("|") || "",
    // 正确答案（必需）
    Array.isArray(question.correctAnswer)
      ? question.correctAnswer.sort().join("|") // 排序以确保一致性
      : String(question.correctAnswer),
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

