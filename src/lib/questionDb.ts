// ============================================================
// 文件路径: src/lib/questionDb.ts
// 功能: 题目数据库操作工具函数
// 更新日期: 2025-01-15
// ============================================================

import { db } from "@/lib/db";
import type { Database } from "@/lib/db";
import type { Kysely, Transaction } from "kysely";
import { executeSafely } from "@/lib/dbUtils";
import { calculateQuestionHash, generateVersion, generateUnifiedVersion, calculateContentHash, calculateFullContentHash, calculateAiAnswersHash, Question } from "@/lib/questionHash";
import { sql } from "kysely";
import fs from "fs/promises";
import path from "path";
import { sanitizeJsonForDb } from '../app/api/admin/question-processing/_lib/jsonUtils';

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// 批量更新阈值：每10次新解析后触发打包更新
const BATCH_UPDATE_THRESHOLD = 10;

// ============================================================
// 1. 题目数据库操作
// ============================================================

/**
 * 规范化正确答案格式（处理JSONB格式数据）
 * 确保答案格式统一，便于前端比较
 */
export function normalizeCorrectAnswer(
  correctAnswer: any,
  questionType: "single" | "multiple" | "truefalse"
): string | string[] {
  if (correctAnswer === null || correctAnswer === undefined) {
    // 如果答案为空，根据题目类型返回默认值
    if (questionType === "multiple") {
      return [];
    }
    return "";
  }

  // 处理判断题
  if (questionType === "truefalse") {
    // 新结构：对象 { type: 'boolean', value: true/false }
    if (correctAnswer && typeof correctAnswer === 'object' && !Array.isArray(correctAnswer)) {
      const v = (correctAnswer as any).value;
      if (typeof v === 'boolean') return v ? 'true' : 'false';
    }
    // 如果是布尔值，转换为字符串
    if (typeof correctAnswer === "boolean") {
      return correctAnswer ? "true" : "false";
    }
    // 如果是字符串，确保是 "true" 或 "false"
    const answerStr = String(correctAnswer).toLowerCase().trim();
    if (answerStr === "true" || answerStr === "1" || answerStr === "是" || answerStr === "o") {
      return "true";
    }
    if (answerStr === "false" || answerStr === "0" || answerStr === "否" || answerStr === "x") {
      return "false";
    }
    // 如果无法识别，返回原值（字符串形式）
    return answerStr;
  }

  // 处理多选题
  if (questionType === "multiple") {
    // 如果已经是数组，直接返回
    if (Array.isArray(correctAnswer)) {
      return correctAnswer.map((a) => String(a));
    }
    // 如果是字符串，尝试按逗号分割
    if (typeof correctAnswer === "string") {
      const parts = correctAnswer.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        return parts;
      }
    }
    // 其他情况，转换为数组
    return [String(correctAnswer)];
  }

  // 处理单选题
  // 确保返回字符串
  return String(correctAnswer);
}

/**
 * 从数据库读取题目（按包名）
 */
export async function getQuestionsFromDb(packageName: string): Promise<Question[]> {
  try {
    // 从数据库读取题目（通过license_type_tag或category匹配）
    // 注意：这里简化处理，实际可能需要更复杂的匹配逻辑
    const questions = await db
      .selectFrom("questions")
      .selectAll()
      .where((eb) =>
        eb.or([
          // 检查license_type_tag数组是否包含packageName
          // 使用 sql 模板确保正确的 PostgreSQL JSONB 数组格式
          sql<boolean>`${eb.ref("license_type_tag")} @> ${sql.literal(JSON.stringify([packageName]))}::jsonb`,
          // 或者通过category匹配
          eb("category", "=", packageName),
          // 或者通过version匹配（如果version字段存储了包名）
          eb("version", "=", packageName),
        ])
      )
      .orderBy("id", "asc")
      .execute();

    // 转换为前端格式（保留 content_hash）
    return questions.map((q) => {
      // 处理content字段：如果是多语言对象，提取zh作为默认内容；如果是字符串，直接使用
      let content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
      if (typeof q.content === "string") {
        // 兼容旧格式：单语言字符串
        content = q.content;
      } else {
        // 新格式：多语言对象
        content = q.content;
      }

      return {
        id: q.id,
        type: q.type,
        content,
        options: Array.isArray(q.options) ? q.options : (q.options ? [q.options] : undefined),
        correctAnswer: normalizeCorrectAnswer(q.correct_answer, q.type),
        image: q.image || undefined,
        explanation: q.explanation || undefined,
        category: q.category || packageName,
        hash: q.content_hash, // 使用 content_hash 作为 hash
        license_tags: q.license_type_tag || undefined,
        stage_tag: q.stage_tag || undefined,
        topic_tags: q.topic_tags || undefined,
      };
    });
  } catch (error) {
    console.error(`[getQuestionsFromDb] Error loading ${packageName}:`, error);
    return [];
  }
}

/**
 * 保存题目到数据库
 * @param question 题目对象
 * @param options 可选参数，包含事务连接
 * @param options.dbOrTrx 可选的事务连接，如果不传则使用全局 db 实例
 * @returns 题目的 id
 */
export async function saveQuestionToDb(
  question: Question & { mode?: "upsert" | "updateOnly" },
  options?: { dbOrTrx?: Kysely<Database> | Transaction<Database> }
): Promise<number> {
  try {
    // ✅ 步骤3：使用传入的事务连接或全局 db 实例
    const client = options?.dbOrTrx ?? db;
    
    const mode = (question as any).mode || "upsert"; // 默认 upsert
    // ✅ 修复：如果传入了 hash，使用传入的 hash（原始 content_hash），否则才计算
    // 在 updateOnly 模式下，必须传入原始的 content_hash，不能基于当前内容重新计算
    const contentHash = question.hash || calculateQuestionHash(question);
    
    // ✅ 修复：清理 question 对象，移除可能存在的 tags 字段（防止写入数据库时出错）
    // AI 返回的 tags 字段包含 stage_tags 和 license_type_tags（复数），
    // 但数据库字段是 stage_tag 和 license_type_tag（单数）
    // 这些字段已经通过 applyTagsFromFullPipeline 转换到 question 对象的正确字段上
    const cleanedQuestion = { ...question };
    if ((cleanedQuestion as any).tags) {
      delete (cleanedQuestion as any).tags;
    }
    // 确保不会意外写入复数字段名
    if ((cleanedQuestion as any).stage_tags) {
      delete (cleanedQuestion as any).stage_tags;
    }
    if ((cleanedQuestion as any).license_type_tags) {
      delete (cleanedQuestion as any).license_type_tags;
    }
    
    // ✅ 使用 sanitizeJsonForDb 统一处理 JSONB 字段
    // 规范化content字段：如果是字符串，转换为多语言对象
    let contentMultilang: any = null;
    if (typeof cleanedQuestion.content === "string") {
      // 兼容旧格式：单语言字符串转换为多语言对象
      contentMultilang = { zh: cleanedQuestion.content };
    } else if (cleanedQuestion.content && typeof cleanedQuestion.content === "object") {
      contentMultilang = cleanedQuestion.content;
    }
    // 使用 sanitizeJsonForDb 清理 undefined 和无效值
    contentMultilang = sanitizeJsonForDb(contentMultilang);
    // ✅ 修复：如果 contentMultilang 是空对象，转换为 null
    if (contentMultilang && typeof contentMultilang === "object" && !Array.isArray(contentMultilang) && Object.keys(contentMultilang).length === 0) {
      contentMultilang = null;
    }

    // 规范化explanation字段：如果是字符串，转换为多语言对象
    let explanationMultilang: any = null;
    if (cleanedQuestion.explanation) {
      if (typeof cleanedQuestion.explanation === "string") {
        // 兼容旧格式：单语言字符串转换为多语言对象
        explanationMultilang = { zh: cleanedQuestion.explanation };
      } else if (typeof cleanedQuestion.explanation === "object" && cleanedQuestion.explanation !== null) {
        explanationMultilang = cleanedQuestion.explanation;
      }
    }
    // 使用 sanitizeJsonForDb 清理 undefined 和无效值
    explanationMultilang = sanitizeJsonForDb(explanationMultilang);
    // ✅ 修复：如果 explanationMultilang 是空对象，转换为 null
    if (explanationMultilang && typeof explanationMultilang === "object" && !Array.isArray(explanationMultilang) && Object.keys(explanationMultilang).length === 0) {
      explanationMultilang = null;
    }
    
    // ✅ 使用 sanitizeJsonForDb 清理 options 字段
    let cleanedOptions = sanitizeJsonForDb(cleanedQuestion.options);
    
    // ✅ 修复：额外清理 options 数组，移除无效元素（如 "explanation"）
    if (cleanedOptions && Array.isArray(cleanedOptions)) {
      cleanedOptions = cleanedOptions
        .filter((opt: any) => {
          if (typeof opt !== "string") return false;
          const trimmed = opt.trim();
          // 过滤掉空字符串和无效的选项值
          return trimmed !== "" && trimmed.toLowerCase() !== "explanation";
        })
        .map((opt: any) => {
          // 处理包含多个选项的长字符串（用 \n 分隔）
          if (typeof opt === "string" && opt.includes("\n")) {
            return opt.split("\n")
              .map((line: string) => line.trim())
              .filter((line: string) => line !== "" && line.toLowerCase() !== "explanation");
          }
          return opt;
        })
        .flat(); // 展平数组（处理分割后的选项）
      
      // 如果清理后数组为空，设置为 null
      if (cleanedOptions.length === 0) {
        cleanedOptions = null;
      }
    }

    // ✅ 使用 sanitizeJsonForDb 清理 correct_answer 字段
    let cleanedCorrectAnswer = sanitizeJsonForDb(cleanedQuestion.correctAnswer);
    // ✅ 修复：如果 correct_answer 是空数组或空对象，转换为 null
    if (cleanedCorrectAnswer && Array.isArray(cleanedCorrectAnswer) && cleanedCorrectAnswer.length === 0) {
      cleanedCorrectAnswer = null;
    } else if (cleanedCorrectAnswer && typeof cleanedCorrectAnswer === "object" && !Array.isArray(cleanedCorrectAnswer) && Object.keys(cleanedCorrectAnswer).length === 0) {
      cleanedCorrectAnswer = null;
    }

    // ✅ 轻量验证：确保可以正确序列化（用于提前发现 BigInt 等不支持类型）
    try {
      if (contentMultilang) {
        JSON.stringify(contentMultilang);
      }
      if (explanationMultilang) {
        JSON.stringify(explanationMultilang);
      }
      if (cleanedOptions) {
        JSON.stringify(cleanedOptions);
      }
      if (cleanedCorrectAnswer) {
        JSON.stringify(cleanedCorrectAnswer);
      }
      // ✅ 修复：验证 license_type_tag（JSONB 类型）可以正确序列化
      if ((cleanedQuestion as any).license_type_tag !== null && (cleanedQuestion as any).license_type_tag !== undefined) {
        if (Array.isArray((cleanedQuestion as any).license_type_tag)) {
          JSON.stringify((cleanedQuestion as any).license_type_tag);
        }
      }
    } catch (jsonError) {
      console.error("[saveQuestionToDb] JSON验证失败:", jsonError);
      throw new Error(`JSON格式错误: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
    }

    // ✅ 修复：直接使用 license_type_tag 字段（数据库字段名）
    // license_tags 字段已废弃，不再处理

    // ✅ 步骤1：添加调试日志（输入）
    console.debug("[questionDb] saveQuestionToDb input license_type_tag", {
      questionId: cleanedQuestion.id,
      inputLicenseTypeTag: (cleanedQuestion as any).license_type_tag,
      inputLegacyLicenseTags: (cleanedQuestion as any).license_tags ?? null,
    });

    // ✅ 修复：统一通过 content_hash 查找题目（content_hash 是题目标识的唯一手段）
    // updateOnly 模式：通过 content_hash 查找，找不到则抛出错误
    // upsert 模式：通过 content_hash 查找，找不到则插入新题目
    const existing = await client
      .selectFrom("questions")
      .select(["id"])
      .where("content_hash", "=", contentHash)
      .executeTakeFirst();
    
    if (!existing && mode === "updateOnly") {
      console.error(
        `[saveQuestionToDb] [updateOnly] Question content_hash=${contentHash} not found, aborting without insert.`,
      );
      throw new Error("QUESTION_NOT_FOUND_FOR_UPDATE");
    }

    if (existing) {
      // 更新现有题目
      // ✅ 修复：构建更新对象，只有字段值存在时才更新（null/undefined 时不更新，保留原值）
      const updateData: any = {
        type: cleanedQuestion.type,
        content: contentMultilang as any,
        options: cleanedOptions,
        correct_answer: (cleanedQuestion.type === 'truefalse' && cleanedCorrectAnswer != null)
          ? { type: 'boolean', value: String(cleanedCorrectAnswer).toLowerCase() === 'true' }
          : cleanedCorrectAnswer,
        image: cleanedQuestion.image || null,
        explanation: explanationMultilang as any,
        category: cleanedQuestion.category || null,
        updated_at: new Date(),
      };

      // ✅ 步骤3.2：license_type_tag 清洗逻辑修正（宽松接收 + 严格输出）
      if ((cleanedQuestion as any).license_type_tag !== null && (cleanedQuestion as any).license_type_tag !== undefined) {
        let tags = (cleanedQuestion as any).license_type_tag;

        // 如果是字符串，转为单元素数组
        if (typeof tags === "string") {
          tags = [tags];
        }

        if (Array.isArray(tags)) {
          const cleanedLicenseTypeTag = tags
            .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
            .map((tag: string) => tag.trim());

          updateData.license_type_tag = cleanedLicenseTypeTag.length > 0 ? cleanedLicenseTypeTag : null;
        } else {
          updateData.license_type_tag = null;
        }
      }
      
      // ✅ 步骤3.2：保留对 legacy 字段 license_tags 的兼容逻辑（作为兜底）
      if (
        updateData.license_type_tag == null &&
        Array.isArray((cleanedQuestion as any).license_tags) &&
        (cleanedQuestion as any).license_tags.length > 0
      ) {
        const cleanedLegacy = (cleanedQuestion as any).license_tags
          .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
          .map((tag: string) => tag.trim());

        updateData.license_type_tag = cleanedLegacy.length > 0 ? cleanedLegacy : null;
      }
      
      // ✅ 步骤1：添加调试日志（清洗后）
      console.debug("[questionDb] saveQuestionToDb updateData license_type_tag", {
        questionId: cleanedQuestion.id,
        updateLicenseTypeTag: (updateData as any).license_type_tag ?? null,
      });

      // ✅ 修复：只有 stage_tag 存在时才更新（null/undefined 时不更新，保留原值）
      if (cleanedQuestion.stage_tag !== null && cleanedQuestion.stage_tag !== undefined) {
        updateData.stage_tag = cleanedQuestion.stage_tag;
      }

      // ✅ 修复：清理 topic_tags 数组（TEXT[] 类型）
      if (cleanedQuestion.topic_tags !== null && cleanedQuestion.topic_tags !== undefined) {
        if (Array.isArray(cleanedQuestion.topic_tags)) {
          // 清理数组：只保留有效的非空字符串
          const cleanedTopicTags = cleanedQuestion.topic_tags
            .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
            .map((tag: any) => tag.trim());
          
          // 如果清理后数组为空，设置为 null
          updateData.topic_tags = cleanedTopicTags.length > 0 ? cleanedTopicTags : null;
        } else {
          // 如果不是数组，设置为 null
          updateData.topic_tags = null;
        }
      }

      // ✅ 修复：最终验证和清理所有 JSONB 字段，确保没有空对象或空数组
      // 检查 content（JSONB）
      if (updateData.content && typeof updateData.content === "object" && !Array.isArray(updateData.content) && Object.keys(updateData.content).length === 0) {
        updateData.content = null;
      }
      // 检查 explanation（JSONB）
      if (updateData.explanation && typeof updateData.explanation === "object" && !Array.isArray(updateData.explanation) && Object.keys(updateData.explanation).length === 0) {
        updateData.explanation = null;
      }
      // 检查 options（JSONB）- 确保不是空数组
      if (updateData.options && Array.isArray(updateData.options) && updateData.options.length === 0) {
        updateData.options = null;
      }
      // 检查 correct_answer（JSONB）
      if (updateData.correct_answer && Array.isArray(updateData.correct_answer) && updateData.correct_answer.length === 0) {
        updateData.correct_answer = null;
      } else if (updateData.correct_answer && typeof updateData.correct_answer === "object" && !Array.isArray(updateData.correct_answer) && Object.keys(updateData.correct_answer).length === 0) {
        updateData.correct_answer = null;
      }
      // 检查 license_type_tag（JSONB）- 确保不是空数组
      if (updateData.license_type_tag && Array.isArray(updateData.license_type_tag) && updateData.license_type_tag.length === 0) {
        updateData.license_type_tag = null;
      }

      // ✅ 最终 JSON 序列化验证
      try {
        if (updateData.content) JSON.stringify(updateData.content);
        if (updateData.explanation) JSON.stringify(updateData.explanation);
        if (updateData.options) JSON.stringify(updateData.options);
        if (updateData.correct_answer) JSON.stringify(updateData.correct_answer);
        if (updateData.license_type_tag) JSON.stringify(updateData.license_type_tag);
      } catch (finalJsonError) {
        console.error("[saveQuestionToDb] 最终 JSON 验证失败:", finalJsonError, {
          content: updateData.content,
          explanation: updateData.explanation,
          options: updateData.options,
          correct_answer: updateData.correct_answer,
          license_type_tag: updateData.license_type_tag,
        });
        throw new Error(`最终 JSON 格式错误: ${finalJsonError instanceof Error ? finalJsonError.message : String(finalJsonError)}`);
      }

      // ✅ 修复：使用 sql 模板显式转换所有 JSONB 字段，确保正确序列化
      const finalUpdateData: any = {
        type: updateData.type,
        image: updateData.image,
        category: updateData.category,
        updated_at: updateData.updated_at,
      };

      // 转换 JSONB 字段
      if (updateData.content !== null && updateData.content !== undefined) {
        finalUpdateData.content = sql`${JSON.stringify(updateData.content)}::jsonb`;
      } else {
        finalUpdateData.content = sql`null::jsonb`;
      }

      if (updateData.explanation !== null && updateData.explanation !== undefined) {
        finalUpdateData.explanation = sql`${JSON.stringify(updateData.explanation)}::jsonb`;
      } else {
        finalUpdateData.explanation = sql`null::jsonb`;
      }

      if (updateData.options !== null && updateData.options !== undefined) {
        finalUpdateData.options = sql`${JSON.stringify(updateData.options)}::jsonb`;
      } else {
        finalUpdateData.options = sql`null::jsonb`;
      }

      if (updateData.correct_answer !== null && updateData.correct_answer !== undefined) {
        finalUpdateData.correct_answer = sql`${JSON.stringify(updateData.correct_answer)}::jsonb`;
      } else {
        finalUpdateData.correct_answer = sql`null::jsonb`;
      }

      // 添加非 JSONB 字段
      if (updateData.stage_tag !== null && updateData.stage_tag !== undefined) {
        finalUpdateData.stage_tag = updateData.stage_tag;
      }

      if (updateData.topic_tags !== null && updateData.topic_tags !== undefined) {
        finalUpdateData.topic_tags = updateData.topic_tags;
      }

      if (updateData.license_type_tag !== null && updateData.license_type_tag !== undefined) {
        finalUpdateData.license_type_tag = sql`${JSON.stringify(updateData.license_type_tag)}::jsonb`;
      } else {
        finalUpdateData.license_type_tag = sql`null::jsonb`;
      }

      await client
        .updateTable("questions")
        .set(finalUpdateData)
        .where("id", "=", existing.id)
        .execute();

      return existing.id;
    } else {
      // 插入新题目（仅在 upsert 模式下）
      const insertData: any = {
        content_hash: contentHash,
        type: cleanedQuestion.type,
        content: contentMultilang as any,
        options: cleanedOptions,
        correct_answer: (cleanedQuestion.type === 'truefalse' && cleanedCorrectAnswer != null)
          ? { type: 'boolean', value: String(cleanedCorrectAnswer).toLowerCase() === 'true' }
          : cleanedCorrectAnswer,
        image: cleanedQuestion.image || null,
        explanation: explanationMultilang as any,
        category: cleanedQuestion.category || null,
      };

      // ✅ 修复：插入时，清理 license_type_tag 数组（JSONB 类型）
      if ((cleanedQuestion as any).license_type_tag !== null && (cleanedQuestion as any).license_type_tag !== undefined) {
        if (Array.isArray((cleanedQuestion as any).license_type_tag)) {
          // 清理数组：只保留有效的非空字符串
          const cleanedLicenseTypeTag = (cleanedQuestion as any).license_type_tag
            .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
            .map((tag: any) => tag.trim());
          
          // 如果清理后数组为空，设置为 null
          insertData.license_type_tag = cleanedLicenseTypeTag.length > 0 ? cleanedLicenseTypeTag : null;
        } else {
          insertData.license_type_tag = null;
        }
      } else {
        insertData.license_type_tag = null;
      }

      if (cleanedQuestion.stage_tag !== null && cleanedQuestion.stage_tag !== undefined) {
        insertData.stage_tag = cleanedQuestion.stage_tag;
      } else {
        insertData.stage_tag = null;
      }

      // ✅ 修复：插入时，清理 topic_tags 数组（TEXT[] 类型）
      if (cleanedQuestion.topic_tags !== null && cleanedQuestion.topic_tags !== undefined) {
        if (Array.isArray(cleanedQuestion.topic_tags)) {
          // 清理数组：只保留有效的非空字符串
          const cleanedTopicTags = cleanedQuestion.topic_tags
            .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
            .map((tag: any) => tag.trim());
          
          // 如果清理后数组为空，设置为 null
          insertData.topic_tags = cleanedTopicTags.length > 0 ? cleanedTopicTags : null;
        } else {
          insertData.topic_tags = null;
        }
      } else {
        insertData.topic_tags = null;
      }

      // ✅ 修复：最终验证和清理所有 JSONB 字段，确保没有空对象或空数组
      // 检查 content（JSONB）
      if (insertData.content && typeof insertData.content === "object" && !Array.isArray(insertData.content) && Object.keys(insertData.content).length === 0) {
        insertData.content = null;
      }
      // 检查 explanation（JSONB）
      if (insertData.explanation && typeof insertData.explanation === "object" && !Array.isArray(insertData.explanation) && Object.keys(insertData.explanation).length === 0) {
        insertData.explanation = null;
      }
      // 检查 options（JSONB）- 确保不是空数组
      if (insertData.options && Array.isArray(insertData.options) && insertData.options.length === 0) {
        insertData.options = null;
      }
      // 检查 correct_answer（JSONB）
      if (insertData.correct_answer && Array.isArray(insertData.correct_answer) && insertData.correct_answer.length === 0) {
        insertData.correct_answer = null;
      } else if (insertData.correct_answer && typeof insertData.correct_answer === "object" && !Array.isArray(insertData.correct_answer) && Object.keys(insertData.correct_answer).length === 0) {
        insertData.correct_answer = null;
      }
      // 检查 license_type_tag（JSONB）- 确保不是空数组
      if (insertData.license_type_tag && Array.isArray(insertData.license_type_tag) && insertData.license_type_tag.length === 0) {
        insertData.license_type_tag = null;
      }

      // ✅ 最终 JSON 序列化验证
      try {
        if (insertData.content) JSON.stringify(insertData.content);
        if (insertData.explanation) JSON.stringify(insertData.explanation);
        if (insertData.options) JSON.stringify(insertData.options);
        if (insertData.correct_answer) JSON.stringify(insertData.correct_answer);
        if (insertData.license_type_tag) JSON.stringify(insertData.license_type_tag);
      } catch (finalJsonError) {
        console.error("[saveQuestionToDb] 最终 JSON 验证失败（插入）:", finalJsonError, {
          content: insertData.content,
          explanation: insertData.explanation,
          options: insertData.options,
          correct_answer: insertData.correct_answer,
          license_type_tag: insertData.license_type_tag,
        });
        throw new Error(`最终 JSON 格式错误（插入）: ${finalJsonError instanceof Error ? finalJsonError.message : String(finalJsonError)}`);
      }

      // ✅ 修复：使用 sql 模板显式转换所有 JSONB 字段，确保正确序列化
      const finalInsertData: any = {
        content_hash: insertData.content_hash,
        type: insertData.type,
        image: insertData.image,
        category: insertData.category,
      };

      // 转换 JSONB 字段
      if (insertData.content !== null && insertData.content !== undefined) {
        finalInsertData.content = sql`${JSON.stringify(insertData.content)}::jsonb`;
      } else {
        finalInsertData.content = sql`null::jsonb`;
      }

      if (insertData.explanation !== null && insertData.explanation !== undefined) {
        finalInsertData.explanation = sql`${JSON.stringify(insertData.explanation)}::jsonb`;
      } else {
        finalInsertData.explanation = sql`null::jsonb`;
      }

      if (insertData.options !== null && insertData.options !== undefined) {
        finalInsertData.options = sql`${JSON.stringify(insertData.options)}::jsonb`;
      } else {
        finalInsertData.options = sql`null::jsonb`;
      }

      if (insertData.correct_answer !== null && insertData.correct_answer !== undefined) {
        finalInsertData.correct_answer = sql`${JSON.stringify(insertData.correct_answer)}::jsonb`;
      } else {
        finalInsertData.correct_answer = sql`null::jsonb`;
      }

      // 添加非 JSONB 字段
      if (insertData.stage_tag !== null && insertData.stage_tag !== undefined) {
        finalInsertData.stage_tag = insertData.stage_tag;
      } else {
        finalInsertData.stage_tag = null;
      }

      if (insertData.topic_tags !== null && insertData.topic_tags !== undefined) {
        finalInsertData.topic_tags = insertData.topic_tags;
      } else {
        finalInsertData.topic_tags = null;
      }

      if (insertData.license_type_tag !== null && insertData.license_type_tag !== undefined) {
        finalInsertData.license_type_tag = sql`${JSON.stringify(insertData.license_type_tag)}::jsonb`;
      } else {
        finalInsertData.license_type_tag = sql`null::jsonb`;
      }

      const result = await client
        .insertInto("questions")
        .values(finalInsertData)
        .returning("id")
        .executeTakeFirst();

      return result?.id || 0;
    }
  } catch (error) {
    console.error("[saveQuestionToDb] Error:", error);
    throw error;
  }
}

// ============================================================
// 2. AI回答数据库操作
// ============================================================

/**
 * 从数据库获取题目的AI回答
 */
export async function getAIAnswerFromDb(
  questionHash: string,
  locale: string = "zh"
): Promise<string | null> {
  try {
    const result = await db
      .selectFrom("question_ai_answers")
      .select(["answer"])
      .where("question_hash", "=", questionHash)
      .where("locale", "=", locale)
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();

    return result?.answer || null;
  } catch (error) {
    console.error("[getAIAnswerFromDb] Error:", error);
    return null;
  }
}

/**
 * 验证是否为有效的 UUID 格式
 */
function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * 保存AI回答到数据库
 */
export async function saveAIAnswerToDb(
  questionHash: string,
  answer: string,
  locale: string = "zh",
  model?: string,
  sources?: any[],
  createdBy?: string
): Promise<number> {
  try {
    // 规范化 createdBy：只接受有效的 UUID 格式
    // 如果传入的是 act- 格式或其他非 UUID 格式，设为 null
    let normalizedCreatedBy: string | null = null;
    if (createdBy && isValidUUID(createdBy)) {
      normalizedCreatedBy = createdBy;
    } else if (createdBy) {
      // 如果不是有效的 UUID，记录日志但不抛出错误
      console.warn(`[saveAIAnswerToDb] createdBy 不是有效的 UUID 格式，将设为 null`, {
        createdBy,
        questionHash: questionHash.substring(0, 16) + "...",
      });
    }
    
    // 检查是否已存在
    const existing = await db
      .selectFrom("question_ai_answers")
      .select(["id", "answer"])
      .where("question_hash", "=", questionHash)
      .where("locale", "=", locale)
      .executeTakeFirst();

    if (existing) {
      // 如果数据库已有AI回答，不应该被新回答覆盖
      // 只有在批量更新JSON包时才更新数据库中的AI回答
      console.log(`[saveAIAnswerToDb] 数据库已有AI回答，跳过更新（ID: ${existing.id}）`);
      return existing.id;
    } else {
      // 从questions表获取标签信息（用于同步标签字段）
      const questionInfo = await db
        .selectFrom("questions")
        .select(["category", "stage_tag", "topic_tags"])
        .where("content_hash", "=", questionHash)
        .executeTakeFirst();

      // 统一处理：验证和清理sources JSON（所有Provider共享此逻辑）
      // 确保sources可以正确序列化为JSONB，不写死任何Provider特定逻辑
      let normalizedSources = null;
      if (sources && Array.isArray(sources) && sources.length > 0) {
        try {
          const cleanedSources = sources.map(src => ({
            title: src.title ? String(src.title) : "",
            url: src.url ? String(src.url) : "",
            snippet: src.snippet
              ? String(src.snippet)
                  .replace(/\\/g, "\\\\")
                  .replace(/"/g, '\\"')
              : "",
            score: typeof src.score === "number" ? src.score : undefined,
            version: src.version ? String(src.version) : undefined,
          }));

          JSON.stringify(cleanedSources);
          normalizedSources = cleanedSources;
        } catch (err) {
          console.warn("[saveAIAnswerToDb] invalid JSON, fallback to null", err);
          normalizedSources = null;
        }
      }

      // 插入新回答（只有在数据库中没有时才插入）
      const result = await db
        .insertInto("question_ai_answers")
        .values({
          question_hash: questionHash,
          locale,
          answer,
          sources: normalizedSources
            ? sql`${JSON.stringify(normalizedSources)}::jsonb`
            : null,
          model: model || null,
          created_by: normalizedCreatedBy,
          view_count: 0,
          category: questionInfo?.category || null,
          stage_tag: questionInfo?.stage_tag || null,
          topic_tags: questionInfo?.topic_tags || null,
        })
        .returning("id")
        .executeTakeFirst();

      return result?.id || 0;
    }
  } catch (error) {
    console.warn("[saveAIAnswerToDb] Error:", error);
    throw error;
  }
}

/**
 * 更新AI回答到数据库（如果已存在则更新，不存在则插入）
 */
export async function updateAIAnswerToDb(
  questionHash: string,
  answer: string,
  locale: string = "zh",
  model?: string,
  sources?: any[],
  createdBy?: string
): Promise<number> {
  try {
    // 规范化 createdBy：只接受有效的 UUID 格式
    let normalizedCreatedBy: string | null = null;
    if (createdBy && isValidUUID(createdBy)) {
      normalizedCreatedBy = createdBy;
    } else if (createdBy) {
      console.warn(`[updateAIAnswerToDb] createdBy 不是有效的 UUID 格式，将设为 null`, {
        createdBy,
        questionHash: questionHash.substring(0, 16) + "...",
      });
    }
    
    // 检查是否已存在
    const existing = await db
      .selectFrom("question_ai_answers")
      .select(["id", "answer"])
      .where("question_hash", "=", questionHash)
      .where("locale", "=", locale)
      .executeTakeFirst();

    if (existing) {
      // 更新现有回答
      await db
        .updateTable("question_ai_answers")
        .set({
          answer,
          sources: sources ? (sources as any) : null,
          model: model || null,
          updated_at: new Date(),
        })
        .where("id", "=", existing.id)
        .execute();
      
      console.log(`[updateAIAnswerToDb] 成功更新AI回答（ID: ${existing.id}）`);
      return existing.id;
    } else {
      // 从questions表获取标签信息（用于同步标签字段）
      const questionInfo = await db
        .selectFrom("questions")
        .select(["category", "stage_tag", "topic_tags"])
        .where("content_hash", "=", questionHash)
        .executeTakeFirst();

      // 插入新回答
      const result = await db
        .insertInto("question_ai_answers")
        .values({
          question_hash: questionHash,
          locale,
          answer,
          sources: sources ? (sources as any) : null,
          model: model || null,
          created_by: normalizedCreatedBy,
          view_count: 0,
          category: questionInfo?.category || null,
          stage_tag: questionInfo?.stage_tag || null,
          topic_tags: questionInfo?.topic_tags || null,
        })
        .returning("id")
        .executeTakeFirst();

      return result?.id || 0;
    }
  } catch (error) {
    console.error("[updateAIAnswerToDb] Error:", error);
    throw error;
  }
}

/**
 * 检查是否有待更新的AI回答
 */
export async function checkPendingUpdates(): Promise<number> {
  try {
    const result = await db
      .selectFrom("question_ai_answer_pending_updates")
      .select(({ fn }) => [fn.count<number>("id").as("count")])
      .executeTakeFirst();

    return result?.count || 0;
  } catch (error) {
    console.error("[checkPendingUpdates] Error:", error);
    return 0;
  }
}

/**
 * 添加待更新的AI回答
 */
export async function addPendingUpdate(
  questionHash: string,
  locale: string = "zh",
  packageName?: string
): Promise<void> {
  try {
    await db
      .insertInto("question_ai_answer_pending_updates")
      .values({
        question_hash: questionHash,
        locale,
        package_name: packageName || null,
      })
      .onConflict((oc) =>
        oc.columns(["question_hash", "locale"]).doNothing()
      )
      .execute();
  } catch (error) {
    console.error("[addPendingUpdate] Error:", error);
    throw error;
  }
}

/**
 * 删除待更新的AI回答
 */
export async function removePendingUpdate(
  questionHash: string,
  locale: string = "zh"
): Promise<void> {
  try {
    await db
      .deleteFrom("question_ai_answer_pending_updates")
      .where("question_hash", "=", questionHash)
      .where("locale", "=", locale)
      .execute();
  } catch (error) {
    console.error("[removePendingUpdate] Error:", error);
    throw error;
  }
}

// ============================================================
// 3. JSON包操作
// ============================================================

/**
 * @deprecated 此函数已废弃，题库现在全部来自数据库
 * 保留此函数仅为向后兼容，实际返回 null
 */
export async function loadQuestionFile(
  packageName?: string
): Promise<{ questions: Question[]; version?: string; aiAnswers?: Record<string, string> } | null> {
  // 题库现在全部来自数据库，不再从文件系统读取
  console.log(`[loadQuestionFile] 已废弃：题库现在全部来自数据库，不再从文件系统读取`);
    return null;
}

/**
 * 保存题目到统一的JSON包（questions.json）
 */
export async function saveQuestionFile(
  packageName: string,
  data: {
    questions: Question[];
    version?: string;
    aiAnswers?: Record<string, string>;
    // 兼容扩展：多语言
    questionsByLocale?: Record<string, Question[]>;
    aiAnswersByLocale?: Record<string, Record<string, string>>;
  }
): Promise<void> {
  try {
    // 保存到统一的questions.json
    const unifiedFilePath = path.join(QUESTIONS_DIR, "questions.json");
    
    // 如果是统一包（__unified__），直接覆盖整个文件，不合并
    if (packageName === "__unified__") {
      // 确保所有题目的答案格式都正确（规范化）
      // 同时确保image字段即使为null也包含在JSON中（使用null而不是undefined）
      const normalizedQuestions = data.questions.map((q) => {
        // 确保image字段使用null而不是undefined，这样JSON.stringify不会省略它
        // 注意：确保即使传入的q.image有值，也要正确保留
        let imageValue: string | null = null;
        if (q.image !== null && q.image !== undefined) {
          if (typeof q.image === 'string' && q.image.trim() !== '') {
            imageValue = q.image.trim(); // 保留有效的URL字符串
          } else {
            imageValue = null; // 空字符串或其他类型，使用null
          }
        } else {
          imageValue = null; // null或undefined，使用null
        }
        
        return {
          ...q,
          correctAnswer: normalizeCorrectAnswer(q.correctAnswer, q.type),
          image: imageValue, // 明确设置image字段，确保即使为null也包含在JSON中
        };
      });
      
      const unifiedData: any = {
        questions: normalizedQuestions,
        version: data.version,
        aiAnswers: data.aiAnswers || {},
      };
      // 扩展字段：多语言
      if (data.questionsByLocale) {
        // 为所有 locale 规范化答案
        // 同时确保image字段即使为null也包含在JSON中
        const normalizedByLocale: Record<string, Question[]> = {};
        for (const [loc, list] of Object.entries(data.questionsByLocale)) {
          normalizedByLocale[loc] = list.map((q) => {
            // 确保image字段使用null而不是undefined
            const imageValue = q.image !== undefined && q.image !== null && typeof q.image === 'string' && q.image.trim() !== ''
              ? q.image
              : (q.image === null ? null : undefined);
            
            const normalized: any = {
              ...q,
              correctAnswer: normalizeCorrectAnswer(q.correctAnswer, q.type),
            };
            
            // 明确设置image字段
            if (imageValue !== undefined) {
              normalized.image = imageValue;
            }
            
            return normalized;
          });
        }
        unifiedData.questionsByLocale = normalizedByLocale;
      }
      if (data.aiAnswersByLocale) {
        unifiedData.aiAnswersByLocale = data.aiAnswersByLocale;
      }
      
      await fs.writeFile(unifiedFilePath, JSON.stringify(unifiedData, null, 2), "utf-8");
      
      console.log(`[saveQuestionFile] 已保存到统一的questions.json: ${normalizedQuestions.length} 个题目（覆盖模式）`);
      return;
    }
    
    // 对于其他包，使用合并逻辑（兼容旧逻辑）
    // 读取现有的统一JSON包（如果存在）
    let existingData: { questions: Question[]; version?: string; aiAnswers?: Record<string, string> } = {
      questions: [],
      aiAnswers: {},
    };
    
    try {
      const existingContent = await fs.readFile(unifiedFilePath, "utf-8");
      const parsed = JSON.parse(existingContent);
      existingData = {
        questions: Array.isArray(parsed) ? parsed : (parsed.questions || []),
        version: parsed.version,
        aiAnswers: parsed.aiAnswers || {},
      };
    } catch {
      // 如果文件不存在，使用空数据
    }
    
    // 合并题目：移除相同category的旧题目，添加新题目
    const otherQuestions = existingData.questions.filter((q) => q.category !== packageName);
    
    // 规范化新题目的答案格式
    const normalizedNewQuestions = data.questions.map((q) => ({
      ...q,
      correctAnswer: normalizeCorrectAnswer(q.correctAnswer, q.type),
    }));
    
    const mergedQuestions = [...otherQuestions, ...normalizedNewQuestions];
    
    // 合并AI回答
    const mergedAiAnswers = {
      ...existingData.aiAnswers,
      ...data.aiAnswers,
    };
    
    // 保存到统一的questions.json
    const unifiedData = {
      questions: mergedQuestions,
      version: data.version || existingData.version,
      aiAnswers: mergedAiAnswers,
    };
    
    await fs.writeFile(unifiedFilePath, JSON.stringify(unifiedData, null, 2), "utf-8");
    
    console.log(`[saveQuestionFile] 已保存到统一的questions.json: ${data.questions.length} 个题目（合并模式）`);
  } catch (error) {
    console.error(`[saveQuestionFile] Error saving:`, error);
    throw error;
  }
}

/**
 * 更新JSON包中的单个AI回答（实时更新）
 * @param questionHash 题目hash
 * @param answer AI回答
 * @param locale 语言（默认zh）
 */
export async function updateJsonPackageAiAnswer(
  questionHash: string,
  answer: string,
  locale: string = "zh"
): Promise<void> {
  try {
    // 只更新中文的JSON包（其他语言暂不支持）
    if (locale !== "zh") {
      console.log(`[updateJsonPackageAiAnswer] 跳过非中文语言: ${locale}`);
      return;
    }

    const unifiedFilePath = path.join(QUESTIONS_DIR, "questions.json");
    
    // 读取现有的JSON包
    let existingData: { questions: Question[]; version?: string; aiAnswers?: Record<string, string> } = {
      questions: [],
      aiAnswers: {},
    };
    
    try {
      const existingContent = await fs.readFile(unifiedFilePath, "utf-8");
      const parsed = JSON.parse(existingContent);
      existingData = {
        questions: Array.isArray(parsed) ? parsed : (parsed.questions || []),
        version: parsed.version,
        aiAnswers: parsed.aiAnswers || {},
      };
    } catch (error) {
      // 如果文件不存在，记录错误但不抛出（可能是首次运行）
      console.warn(`[updateJsonPackageAiAnswer] JSON包文件不存在或读取失败:`, (error as Error).message);
      return;
    }
    
    // 更新aiAnswers对象
    const updatedAiAnswers = {
      ...existingData.aiAnswers,
      [questionHash]: answer,
    };
    
    // 保存更新后的JSON包
    const updatedData = {
      questions: existingData.questions,
      version: existingData.version,
      aiAnswers: updatedAiAnswers,
    };
    
    await fs.writeFile(unifiedFilePath, JSON.stringify(updatedData, null, 2), "utf-8");
    
    console.log(`[updateJsonPackageAiAnswer] 成功更新JSON包中的AI回答`, {
      questionHash: questionHash.substring(0, 16) + "...",
      answerLength: answer.length,
      totalAiAnswers: Object.keys(updatedAiAnswers).length,
    });
  } catch (error) {
    // 更新JSON包失败不影响主流程，仅记录日志
    console.error(`[updateJsonPackageAiAnswer] 更新JSON包失败:`, error);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 从JSON包获取题目的AI回答
 * @param packageName 包名（可选），如果不提供，从统一的questions.json读取
 * @param questionHash 题目hash
 */
/**
 * @deprecated 此函数已废弃，题库现在全部来自数据库
 * 保留此函数仅为向后兼容，实际返回 null
 * 请使用 getAIAnswerFromDb 从数据库读取
 */
export async function getAIAnswerFromJson(
  packageName: string | null,
  questionHash: string
): Promise<string | null> {
  // 题库现在全部来自数据库，不再从文件系统读取
  // 直接返回 null，让调用方从数据库读取
  console.log(`[getAIAnswerFromJson] 已废弃：题库现在全部来自数据库，请使用 getAIAnswerFromDb`);
        return null;
}

// ============================================================
// 4. 版本管理（统一版本号）
// ============================================================

/**
 * 获取最新统一版本号
 */
export async function getLatestUnifiedVersion(): Promise<string | null> {
  // 内存缓存，避免高频场景反复访问数据库
  const CACHE_TTL = 5 * 60 * 1000; // 5 分钟
  const g = globalThis as any;
  if (!g.__LATEST_UNIFIED_VERSION_CACHE__) {
    g.__LATEST_UNIFIED_VERSION_CACHE__ = { version: null as string | null, timestamp: 0 };
  }
  const cache = g.__LATEST_UNIFIED_VERSION_CACHE__ as { version: string | null; timestamp: number };

  const now = Date.now();
  if (cache.version && now - cache.timestamp < CACHE_TTL) {
    return cache.version;
  }

  // 使用安全执行包装 DB 查询，连接异常时直接返回 null
  const version = await executeSafely(
    async () => {
      const result = await db
        .selectFrom("question_package_versions")
        .select(["version"])
        .where("package_name", "=", "__unified__") // 使用特殊标识表示统一版本
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst();

      return result?.version || null;
    },
    null as string | null
  );

  if (version) {
    cache.version = version;
    cache.timestamp = now;
  }

  return version;
}

/**
 * 获取最新统一版本号信息（包括版本号和创建时间）
 */
export async function getLatestUnifiedVersionInfo(): Promise<{ version: string; createdAt: Date } | null> {
  try {
    const result = await db
      .selectFrom("question_package_versions")
      .select(["version", "created_at"])
      .where("package_name", "=", "__unified__") // 使用特殊标识表示统一版本
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return {
      version: result.version,
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error("[getLatestUnifiedVersionInfo] Error:", error);
    return null;
  }
}

/**
 * 获取所有历史版本号列表
 */
export async function getAllUnifiedVersions(): Promise<Array<{
  version: string;
  totalQuestions: number;
  aiAnswersCount: number;
  createdAt: Date;
}>> {
  try {
    const results = await db
      .selectFrom("question_package_versions")
      .select(["version", "total_questions", "ai_answers_count", "created_at"])
      .where("package_name", "=", "__unified__")
      .orderBy("created_at", "desc")
      .execute();

    return results.map((r) => ({
      version: r.version,
      totalQuestions: r.total_questions || 0,
      aiAnswersCount: r.ai_answers_count || 0,
      createdAt: r.created_at,
    }));
  } catch (error) {
    console.error("[getAllUnifiedVersions] Error:", error);
    return [];
  }
}

/**
 * 保存统一版本号（保存历史版本，允许多条记录）
 * 注意：如果数据库有唯一索引限制，会先尝试移除唯一索引或使用其他方式保存
 * @param packageContent 可选的JSON包内容，如果提供则保存到数据库
 */
export async function saveUnifiedVersion(
  version: string,
  totalQuestions: number,
  aiAnswersCount: number,
  packageContent?: { questions: Question[]; version?: string; aiAnswers?: Record<string, string> } | null
): Promise<void> {
  try {
    console.log(`[saveUnifiedVersion] 开始保存版本号: ${version}, 题目数: ${totalQuestions}, AI回答数: ${aiAnswersCount}`);
    
    // 检查是否已存在相同的版本号（避免重复）
    const existing = await db
      .selectFrom("question_package_versions")
      .select(["id"])
      .where("package_name", "=", "__unified__")
      .where("version", "=", version)
      .executeTakeFirst();

    if (existing) {
      // 如果已存在相同版本号，更新记录
      console.log(`[saveUnifiedVersion] 版本号 ${version} 已存在，更新记录 ID: ${existing.id}`);
      const updateData: any = {
        total_questions: totalQuestions,
        ai_answers_count: aiAnswersCount,
        updated_at: new Date(),
      };
      // 如果提供了packageContent，也更新它
      if (packageContent !== undefined) {
        updateData.package_content = packageContent as any;
        console.log(`[saveUnifiedVersion] 同时更新JSON包内容`);
      }
      await db
        .updateTable("question_package_versions")
        .set(updateData)
        .where("id", "=", existing.id)
        .execute();
      console.log(`[saveUnifiedVersion] 版本号 ${version} 更新成功`);
    } else {
      // 如果不存在，直接插入新记录（保存历史版本）
      // 如果数据库有唯一索引限制，会抛出错误，但不会删除旧记录
      try {
        console.log(`[saveUnifiedVersion] 保存新版本号 ${version}（历史版本）`);
        const insertData: any = {
          package_name: "__unified__", // 使用特殊标识表示统一版本
          version,
          total_questions: totalQuestions,
          ai_answers_count: aiAnswersCount,
        };
        // 如果提供了packageContent，也保存它
        if (packageContent !== undefined) {
          insertData.package_content = packageContent as any;
          console.log(`[saveUnifiedVersion] 同时保存JSON包内容`);
        }
        await db
          .insertInto("question_package_versions")
          .values(insertData)
          .execute();
        console.log(`[saveUnifiedVersion] 版本号 ${version} 插入成功`);
      } catch (insertError: any) {
        // 如果插入失败（可能是唯一索引冲突），记录错误并提示
        const errorMessage = insertError.message || String(insertError);
        console.error(`[saveUnifiedVersion] 插入失败: ${errorMessage}`);
        
        if (errorMessage.includes("unique") || errorMessage.includes("duplicate") || errorMessage.includes("violates unique constraint")) {
          // 唯一索引冲突：说明数据库有唯一索引限制，无法保存历史版本
          // 提示用户需要移除唯一索引才能保存历史版本
          const errorMsg = `无法保存历史版本：数据库表 question_package_versions 有唯一索引限制（package_name唯一）。` +
            ` 要保存历史版本，需要移除唯一索引 idx_package_versions_package_name_unique。` +
            ` 当前版本号 ${version} 将无法保存。`;
          console.error(`[saveUnifiedVersion] ${errorMsg}`);
          throw new Error(errorMsg);
        } else {
          // 其他错误，直接抛出
          console.error(`[saveUnifiedVersion] 插入失败，错误类型: ${errorMessage}`);
          throw insertError;
        }
      }
    }
    
    // 验证保存是否成功
    const verify = await db
      .selectFrom("question_package_versions")
      .select(["id", "version", "total_questions", "ai_answers_count", "created_at"])
      .where("package_name", "=", "__unified__")
      .where("version", "=", version)
      .executeTakeFirst();
    
    if (verify) {
      console.log(`[saveUnifiedVersion] 版本号 ${version} 保存成功并已验证`, {
        id: verify.id,
        version: verify.version,
        totalQuestions: verify.total_questions,
        aiAnswersCount: verify.ai_answers_count,
        createdAt: verify.created_at,
      });
    } else {
      console.error(`[saveUnifiedVersion] 警告：版本号 ${version} 保存后验证失败`);
    }
  } catch (error) {
    console.error("[saveUnifiedVersion] Error:", error);
    throw error;
  }
}

/**
 * 从数据库获取指定版本号的完整JSON包内容
 * @param version 版本号
 * @returns 如果找到，返回JSON包内容；否则返回null
 */
export async function getUnifiedVersionContent(
  version: string
): Promise<{ questions: Question[]; version: string; aiAnswers: Record<string, string>; questionsByLocale?: Record<string, Question[]>; aiAnswersByLocale?: Record<string, Record<string, string>> } | null> {
  try {
    const result = await db
      .selectFrom("question_package_versions")
      .select(["package_content"])
      .where("package_name", "=", "__unified__")
      .where("version", "=", version)
      .executeTakeFirst();

    if (!result || !result.package_content) {
      console.log(`[getUnifiedVersionContent] 版本号 ${version} 没有找到或没有保存内容`);
      return null;
    }

    const content = result.package_content as any;
    const resultData: any = {
      questions: Array.isArray(content.questions) ? content.questions : [],
      version: content.version || version,
      aiAnswers: content.aiAnswers && typeof content.aiAnswers === 'object' ? content.aiAnswers : {},
    };
    
    // 安全地读取多语言字段
    if (content.questionsByLocale && typeof content.questionsByLocale === 'object') {
      resultData.questionsByLocale = content.questionsByLocale;
    }
    if (content.aiAnswersByLocale && typeof content.aiAnswersByLocale === 'object') {
      resultData.aiAnswersByLocale = content.aiAnswersByLocale;
    }
    
    return resultData;
  } catch (error) {
    console.error(`[getUnifiedVersionContent] Error:`, error);
    return null;
  }
}

/**
 * 从数据库获取最新版本的完整JSON包内容（从package_content字段读取）
 * @returns 如果找到，返回JSON包内容；否则返回null
 */
export async function getLatestUnifiedVersionContent(): Promise<{ questions: Question[]; version: string; aiAnswers: Record<string, string> } | null> {
  try {
    const result = await db
      .selectFrom("question_package_versions")
      .select(["package_content", "version"])
      .where("package_name", "=", "__unified__")
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!result || !result.package_content) {
      console.log(`[getLatestUnifiedVersionContent] 数据库中没有找到最新版本的JSON包内容`);
      return null;
    }

    const content = result.package_content as any;
    return {
      questions: content.questions || [],
      version: result.version,
      aiAnswers: content.aiAnswers || {},
    };
  } catch (error) {
    console.error(`[getLatestUnifiedVersionContent] Error:`, error);
    return null;
  }
}

/**
 * 删除统一版本号（从数据库删除指定版本号的记录）
 */
export async function deleteUnifiedVersion(version: string): Promise<void> {
  try {
    console.log(`[deleteUnifiedVersion] 开始删除版本号: ${version}`);
    
    // 从数据库删除指定版本号的记录
    const result = await db
      .deleteFrom("question_package_versions")
      .where("package_name", "=", "__unified__")
      .where("version", "=", version)
      .execute();
    
    console.log(`[deleteUnifiedVersion] 版本号 ${version} 删除成功，删除记录数: ${result.length}`);
  } catch (error) {
    console.error("[deleteUnifiedVersion] Error:", error);
    throw error;
  }
}

/**
 * 获取题目包版本（兼容旧代码，返回null）
 * @deprecated 已改为统一版本号，此函数保留用于兼容
 */
export async function getPackageVersion(packageName: string): Promise<string | null> {
  return null;
}

/**
 * 更新题目包版本（兼容旧代码，实际使用saveUnifiedVersion）
 * @deprecated 已改为统一版本号，此函数保留用于兼容
 */
export async function updatePackageVersion(
  packageName: string,
  version: string,
  totalQuestions: number,
  aiAnswersCount: number
): Promise<void> {
  // 不再按package_name更新，统一版本号已由saveUnifiedVersion处理
}

// ============================================================
// 5. 批量更新逻辑
// ============================================================

/**
 * 检查是否需要批量更新（每10次新解析后）
 */
export async function shouldTriggerBatchUpdate(): Promise<boolean> {
  try {
    // 统计最近新增的AI回答数量
    const result = await db
      .selectFrom("question_ai_answers")
      .select(({ fn }) => [fn.count<number>("id").as("count")])
      .where("created_at", ">", new Date(Date.now() - 24 * 60 * 60 * 1000)) // 最近24小时
      .executeTakeFirst();

    const newAnswersCount = result?.count || 0;
    
    // 检查是否有待更新的记录
    const pendingCount = await checkPendingUpdates();
    
    // 如果新增回答数达到阈值或待更新记录数达到阈值，触发批量更新
    return newAnswersCount >= BATCH_UPDATE_THRESHOLD || pendingCount >= BATCH_UPDATE_THRESHOLD;
  } catch (error) {
    console.error("[shouldTriggerBatchUpdate] Error:", error);
    return false;
  }
}

/**
 * 获取所有卷类列表（从文件系统）
 */
async function getAllCategories(): Promise<string[]> {
  try {
    const files = await fs.readdir(QUESTIONS_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch (error) {
    console.error("[getAllCategories] Error:", error);
    return [];
  }
}

/**
 * 批量更新JSON包（包括刷新contenthash，更新版本号）
 */
export async function batchUpdateJsonPackages(): Promise<void> {
  try {
    // 获取所有题目包（从文件系统或数据库）
    // 优先从文件系统获取（因为JSON包是用户使用的）
    const categories = await getAllCategories();
    
    // 如果没有从文件系统获取到，尝试从数据库获取
    if (categories.length === 0) {
      try {
        const packages = await db
          .selectFrom("question_package_versions")
          .select(["package_name"])
          .execute();
        
        for (const pkg of packages) {
          categories.push(pkg.package_name);
        }
      } catch (error) {
        console.error("[batchUpdateJsonPackages] Error getting packages from database:", error);
      }
    }
    
    // 更新每个包
    for (const pkg of categories) {
      try {
        await updateJsonPackage(pkg);
      } catch (error) {
        console.error(`[batchUpdateJsonPackages] Error updating package ${pkg}:`, error);
        // 继续处理其他包，不中断
      }
    }
  } catch (error) {
    console.error("[batchUpdateJsonPackages] Error:", error);
    throw error;
  }
}

/**
 * 更新所有JSON包（使用统一版本号）
 */
export async function updateAllJsonPackages(): Promise<{
  version: string;
  totalQuestions: number;
  aiAnswersCount: number;
  previousVersion?: string;
  previousTotalQuestions?: number;
  previousAiAnswersCount?: number;
  questionsAdded?: number;
  questionsUpdated?: number;
  aiAnswersAdded?: number;
  aiAnswersUpdated?: number;
  validationReport?: {
    isConsistent: boolean;
    dbQuestionCount: number;
    jsonQuestionCount: number;
    missingQuestionIds: number[];
    conversionErrors: Array<{ questionId: number; error: string }>;
    warnings: string[];
  };
}> {
  try {
    // 0. 获取上一个版本的信息（用于对比）
    const previousVersionInfo = await getLatestUnifiedVersionInfo();
    const previousVersion = previousVersionInfo?.version;
    let previousTotalQuestions = 0;
    let previousAiAnswersCount = 0;
    
    if (previousVersionInfo && previousVersion) {
      const previousVersionData = await db
        .selectFrom("question_package_versions")
        .select(["total_questions", "ai_answers_count"])
        .where("package_name", "=", "__unified__")
        .where("version", "=", previousVersion)
        .executeTakeFirst();
      
      if (previousVersionData) {
        previousTotalQuestions = previousVersionData.total_questions || 0;
        previousAiAnswersCount = previousVersionData.ai_answers_count || 0;
      }
    }

    // 1. 直接从数据库读取所有题目（不依赖文件系统的categories）
    console.log(`[updateAllJsonPackages] 开始从数据库读取所有题目`);
    const allDbQuestions = await db
      .selectFrom("questions")
      .selectAll()
      .orderBy("id", "asc")
      .execute();

    console.log(`[updateAllJsonPackages] 从数据库读取到 ${allDbQuestions.length} 个题目`);

    // 转换为前端格式（使用content_hash作为hash，不重新计算）
    // 添加错误处理，确保单个题目转换失败不会中断整个流程
    const questionsWithHash: any[] = [];
    const conversionErrors: Array<{ questionId: number; error: string }> = [];
    
    for (const q of allDbQuestions) {
      try {
        // 优先使用category字段，如果没有则从license_type_tag数组中获取（取第一个，如果没有则使用"其他"）
        const category = q.category || 
          (Array.isArray(q.license_type_tag) && q.license_type_tag.length > 0
            ? q.license_type_tag[0]
            : "其他");

        // 处理content字段：保持多语言对象格式
        let content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
        if (typeof q.content === "string") {
          // 兼容旧格式：单语言字符串
          content = q.content;
        } else {
          // 新格式：多语言对象
          content = q.content;
        }

        // 修复image字段处理：使用null而不是undefined，确保JSON序列化时字段不会被省略
        // 如果image为null、undefined或空字符串，统一使用null
        // 注意：确保即使数据库中有有效的URL字符串，也要正确保留
        let imageValue: string | null = null;
        if (q.image !== null && q.image !== undefined) {
          if (typeof q.image === 'string' && q.image.trim() !== '') {
            imageValue = q.image.trim(); // 保留有效的URL字符串
          } else {
            imageValue = null; // 空字符串或其他类型，使用null
          }
        } else {
          imageValue = null; // null或undefined，使用null
        }

        questionsWithHash.push({
          id: q.id,
          type: q.type,
          content,
          options: Array.isArray(q.options) ? q.options : (q.options ? [q.options] : undefined),
          correctAnswer: normalizeCorrectAnswer(q.correct_answer, q.type),
          image: imageValue, // 使用null而不是undefined，确保JSON序列化时字段被包含
          explanation: q.explanation || undefined,
          category,
          hash: q.content_hash, // 使用数据库中的content_hash作为hash（同一个值）
          license_tags: q.license_type_tag || undefined,
          stage_tag: q.stage_tag || undefined,
          topic_tags: q.topic_tags || undefined,
        });
      } catch (error) {
        // 记录转换失败的题目，但不中断整个流程
        const errorMessage = error instanceof Error ? error.message : String(error);
        conversionErrors.push({
          questionId: q.id,
          error: errorMessage,
        });
        console.error(`[updateAllJsonPackages] 题目 ${q.id} 转换失败:`, error);
      }
    }

    // 如果有转换错误，记录警告
    if (conversionErrors.length > 0) {
      console.warn(`[updateAllJsonPackages] ${conversionErrors.length} 个题目转换失败:`, conversionErrors);
    }
    
    // 3. 获取所有题目的AI回答（从数据库，使用hash作为question_hash）
    // 批量查询所有AI回答，提高性能并支持多种locale格式
    const aiAnswers: Record<string, string> = {};
    const aiAnswersByLocale: Record<string, Record<string, string>> = {};
    const questionHashes = questionsWithHash
      .map((q) => (q as any).hash)
      .filter((hash): hash is string => !!hash);
    
    if (questionHashes.length > 0) {
      try {
        // 批量查询所有 locale
        const allAnswers = await db
          .selectFrom("question_ai_answers")
          .select(["question_hash", "answer", "created_at", "locale"])
          .where("question_hash", "in", questionHashes)
          .orderBy("question_hash", "asc")
          .orderBy("created_at", "desc")
          .execute();

        // 每个 locale 构建映射（每个 question_hash 只保留最新的回答）
        for (const row of allAnswers) {
          const loc = row.locale || "zh";
          if (!aiAnswersByLocale[loc]) aiAnswersByLocale[loc] = {};
          if (!aiAnswersByLocale[loc][row.question_hash] && row.answer) {
            aiAnswersByLocale[loc][row.question_hash] = row.answer;
          }
        }
        // 兼容旧字段：默认中文
        const zhMap = aiAnswersByLocale["zh"] || aiAnswersByLocale["zh-CN"] || aiAnswersByLocale["zh_CN"] || {};
        Object.assign(aiAnswers, zhMap);
        
        console.log(`[updateAllJsonPackages] 从数据库批量查询到 ${Object.keys(aiAnswers).length} 个AI回答`);
      } catch (error) {
        console.error(`[updateAllJsonPackages] 批量查询 question_ai_answers 失败:`, error);
        // 如果批量查询失败，回退到逐个查询（兼容旧逻辑）
        console.log(`[updateAllJsonPackages] 回退到逐个查询模式`);
        for (const question of questionsWithHash) {
          const questionHash = (question as any).hash;
          if (questionHash) {
            // 尝试多种 locale 格式
            let answer = await getAIAnswerFromDb(questionHash, "zh");
            if (!answer) {
              answer = await getAIAnswerFromDb(questionHash, "zh-CN");
            }
            if (!answer) {
              answer = await getAIAnswerFromDb(questionHash, "zh_CN");
            }
            if (answer) {
              aiAnswers[questionHash] = answer;
            }
          }
        }
      }
    }

    // 4. 在生成新版本号之前，先保存当前文件内容到数据库（作为历史版本）
    // 这样可以确保在文件被覆盖之前，保存了上一个版本的完整内容
    if (previousVersion && previousVersionInfo) {
      try {
        // 在更新文件之前，先读取当前文件内容
        const currentFile = await loadQuestionFile();
        if (currentFile && currentFile.questions && currentFile.questions.length > 0) {
          // 检查当前文件是否包含上一个版本的内容
          // 如果文件版本号匹配，或者文件没有版本号（兼容旧格式），保存它
          if (!currentFile.version || currentFile.version === previousVersion) {
            console.log(`[updateAllJsonPackages] 保存当前版本 ${previousVersion} 的完整内容到数据库（在更新前）`);
            await saveUnifiedVersion(
              previousVersion,
              previousTotalQuestions,
              previousAiAnswersCount,
              {
                questions: currentFile.questions,
                version: previousVersion,
                aiAnswers: currentFile.aiAnswers || {},
              }
            );
          } else {
            console.log(`[updateAllJsonPackages] 当前文件版本号(${currentFile.version})与上一个版本号(${previousVersion})不匹配，跳过保存历史版本内容`);
          }
        }
      } catch (error) {
        console.error(`[updateAllJsonPackages] 保存当前版本内容失败:`, error);
        // 不抛出错误，继续执行新版本的保存
      }
    }

    // 5. 计算当前完整内容hash（包含题目和AI回答），检查是否与上一个版本相同
    const currentFullContentHash = calculateFullContentHash(questionsWithHash, aiAnswers);
    let version: string;
    
    if (previousVersion && previousVersionInfo) {
      // 尝试从数据库读取上一个版本的完整内容
      try {
        const previousVersionContent = await getUnifiedVersionContent(previousVersion);
        if (previousVersionContent && previousVersionContent.questions) {
          const previousFullContentHash = calculateFullContentHash(
            previousVersionContent.questions,
            previousVersionContent.aiAnswers || {}
          );
          
          // 如果完整内容hash相同，说明内容没有变化，复用上一个版本号
          if (currentFullContentHash === previousFullContentHash) {
            console.log(`[updateAllJsonPackages] 完整内容hash相同(${currentFullContentHash})，复用上一个版本号: ${previousVersion}`);
            version = previousVersion;
          } else {
            // 内容有变化（题目或AI回答），生成新版本号
            console.log(`[updateAllJsonPackages] 完整内容hash不同，生成新版本号。上一个: ${previousFullContentHash}, 当前: ${currentFullContentHash}`);
            version = generateUnifiedVersion(questionsWithHash);
          }
        } else {
          // 无法读取上一个版本内容，生成新版本号
          console.log(`[updateAllJsonPackages] 无法读取上一个版本内容，生成新版本号`);
          version = generateUnifiedVersion(questionsWithHash);
        }
      } catch (error) {
        // 读取失败，生成新版本号
        console.error(`[updateAllJsonPackages] 读取上一个版本内容失败，生成新版本号:`, error);
        version = generateUnifiedVersion(questionsWithHash);
      }
    } else {
      // 没有上一个版本，生成新版本号
      console.log(`[updateAllJsonPackages] 没有上一个版本，生成新版本号`);
      version = generateUnifiedVersion(questionsWithHash);
    }

    // 6. 如果版本号与上一个相同，仍然需要检查并更新数据库（因为AI回答可能已更新）
    // 但为了避免重复记录，先检查是否真的需要更新
    if (version === previousVersion) {
      // 检查AI回答数量或内容是否有变化
      // previousAiAnswersCount 已在前面定义（第1092行）
      const currentAiAnswersCount = Object.keys(aiAnswers).length;
      const previousVersionContent = await getUnifiedVersionContent(previousVersion).catch(() => null);
      const previousAiAnswers = previousVersionContent?.aiAnswers || {};
      
      // 计算AI回答的变化
      const previousAiAnswersHash = calculateAiAnswersHash(previousAiAnswers);
      const currentAiAnswersHash = calculateAiAnswersHash(aiAnswers);
      const aiAnswersChanged = previousAiAnswersHash !== currentAiAnswersHash;
      
      if (aiAnswersChanged || currentAiAnswersCount !== previousAiAnswersCount) {
        console.log(`[updateAllJsonPackages] 版本号未变化但AI回答有变化（数量: ${previousAiAnswersCount} -> ${currentAiAnswersCount}, 内容hash: ${previousAiAnswersHash} -> ${currentAiAnswersHash}），更新数据库`);
        // 更新数据库中的AI回答
        await saveUnifiedVersion(
          version,
          questionsWithHash.length,
          currentAiAnswersCount,
          {
            questions: questionsWithHash,
            version,
            aiAnswers,
          }
        );
      } else {
        console.log(`[updateAllJsonPackages] 版本号未变化且AI回答未变化，只更新文件`);
      }
      
      // 更新文件
      try {
        await saveQuestionFile("__unified__", {
          questions: questionsWithHash,
          version,
          aiAnswers,
        });
      } catch (error) {
        console.error(`[updateAllJsonPackages] Error saving unified package:`, error);
      }
      
      // 返回结果
      const aiAnswersAdded = Math.max(0, currentAiAnswersCount - previousAiAnswersCount);
      return {
        version,
        totalQuestions: questionsWithHash.length,
        aiAnswersCount: currentAiAnswersCount,
        previousVersion,
        previousTotalQuestions,
        previousAiAnswersCount,
        questionsAdded: 0,
        questionsUpdated: 0,
        aiAnswersAdded: aiAnswersChanged ? aiAnswersAdded : 0,
        aiAnswersUpdated: aiAnswersChanged && currentAiAnswersCount === previousAiAnswersCount ? 1 : 0,
      };
    }

    // 6.1 读取启用的语言列表（用于生成 questionsByLocale）
    let enabledLocales: string[] = [];
    try {
      const langs = await db
        .selectFrom("languages")
        .select(["locale"])
        .where("enabled", "=", true)
        .execute();
      enabledLocales = langs.map((l) => l.locale);
    } catch {
      // 若无 languages 表记录，回退到至少包含 zh
      enabledLocales = ["zh"];
    }

    // 6.2 生成各语言的题目列表（从 translations / base）
    const questionsByLocale: Record<string, any[]> = {};
    for (const loc of enabledLocales) {
      if (loc.toLowerCase().startsWith("zh")) {
        questionsByLocale[loc] = questionsWithHash;
        continue;
      }
      // 直接从 questions 表的 JSON 字段中提取对应语言（不再使用 question_translations 表）
      // 基于 base 问题构造该语言的问题（从多语言对象中提取）
      const localized = questionsWithHash.map((q) => {
          // 如果数据库中没有翻译，从多语言对象中提取对应语言
          const localizedQ: any = { ...q };
          
          // 检查是否是占位符的辅助函数
          const isPlaceholder = (value: string | undefined): boolean => {
            return value !== undefined && typeof value === 'string' && 
              (value.trim().startsWith('[EN]') || value.trim().startsWith('[JA]'));
          };
          
          // 处理content字段：从多语言对象中提取对应语言
          if (typeof q.content === "object" && q.content !== null) {
            const contentObj = q.content as { [key: string]: string | undefined };
            const targetValue = contentObj[loc];
            // 如果目标语言的值存在且不是占位符，使用它；否则设为null（不使用任何备用措施）
            if (targetValue && !isPlaceholder(targetValue)) {
              localizedQ.content = targetValue;
            } else {
              localizedQ.content = null; // 没有翻译，返回null
            }
          } else {
            // 如果content是字符串，对于非中文语言返回null
            if (loc.toLowerCase().startsWith("zh")) {
              localizedQ.content = q.content;
            } else {
              localizedQ.content = null;
            }
          }
          
          // 处理explanation字段：从多语言对象中提取对应语言
          if (q.explanation && typeof q.explanation === "object" && q.explanation !== null) {
            const expObj = q.explanation as { [key: string]: string | undefined };
            const targetValue = expObj[loc];
            // 如果目标语言的值存在且不是占位符，使用它；否则设为null（不使用任何备用措施）
            if (targetValue && !isPlaceholder(targetValue)) {
              localizedQ.explanation = targetValue;
            } else {
              localizedQ.explanation = null; // 没有翻译，返回null
            }
          } else if (q.explanation) {
            // 如果explanation是字符串，对于非中文语言返回null
            if (loc.toLowerCase().startsWith("zh")) {
              localizedQ.explanation = q.explanation;
            } else {
              localizedQ.explanation = null;
            }
          }
          
          return localizedQ;
      });
      questionsByLocale[loc] = localized;
    }

    // 7. 保存新版本号到数据库（包含完整JSON包内容，多语言）
    const newPackageContent: any = {
      version,
      questions: questionsWithHash, // 兼容字段（中文）
      aiAnswers,                    // 兼容字段（中文）
      questionsByLocale,
      aiAnswersByLocale,
    };
    await saveUnifiedVersion(
      version,
      questionsWithHash.length,
      Object.keys(aiAnswers).length,
      newPackageContent
    );

    // 7. 保存到统一的questions.json（使用统一版本号，包含多语言）
    try {
      // 按category分组保存（为了兼容旧逻辑，但实际保存到统一文件）
      const categoryGroups = new Map<string, Question[]>();
      questionsWithHash.forEach((q) => {
        const cat = q.category || "default";
        if (!categoryGroups.has(cat)) {
          categoryGroups.set(cat, []);
        }
        categoryGroups.get(cat)!.push(q);
      });
      
      // 保存所有题目到统一的questions.json
      // 注意：这里我们保存所有题目到一个文件，但为了兼容，仍然按category分组处理
      await saveQuestionFile("__unified__", {
        questions: questionsWithHash,
        version, // 使用统一版本号
        aiAnswers,
        questionsByLocale,
        aiAnswersByLocale,
      } as any);
    } catch (error) {
      console.error(`[updateAllJsonPackages] Error saving unified package:`, error);
    }

    const totalQuestions = questionsWithHash.length;
    const aiAnswersCount = Object.keys(aiAnswers).length;
    
    // 计算变化量
    const questionsAdded = previousTotalQuestions > 0 
      ? Math.max(0, totalQuestions - previousTotalQuestions)
      : totalQuestions; // 如果没有上一个版本，所有题目都是新增的
    const questionsUpdated = previousTotalQuestions > 0 
      ? Math.min(previousTotalQuestions, totalQuestions)
      : 0; // 如果没有上一个版本，没有更新的题目
    
    const aiAnswersAdded = previousAiAnswersCount > 0
      ? Math.max(0, aiAnswersCount - previousAiAnswersCount)
      : aiAnswersCount; // 如果没有上一个版本，所有AI回答都是新增的
    const aiAnswersUpdated = previousAiAnswersCount > 0
      ? Math.min(previousAiAnswersCount, aiAnswersCount)
      : 0; // 如果没有上一个版本，没有更新的AI回答

    // 8. 数据一致性验证
    console.log(`[updateAllJsonPackages] 开始数据一致性验证`);
    const dbQuestionCount = allDbQuestions.length;
    const jsonQuestionCount = questionsWithHash.length;
    const warnings: string[] = [];
    
    // 检查题目数量是否一致
    if (dbQuestionCount !== jsonQuestionCount) {
      const warning = `题目数量不一致：数据库中有 ${dbQuestionCount} 个题目，但JSON包中只有 ${jsonQuestionCount} 个题目`;
      console.warn(`[updateAllJsonPackages] ${warning}`);
      warnings.push(warning);
    }
    
    // 检查是否有题目丢失（通过ID对比）
    const dbQuestionIds = new Set(allDbQuestions.map(q => q.id));
    const jsonQuestionIds = new Set(questionsWithHash.map(q => q.id));
    const missingQuestionIds: number[] = [];
    
    for (const dbId of Array.from(dbQuestionIds)) {
      if (!jsonQuestionIds.has(dbId)) {
        missingQuestionIds.push(dbId);
      }
    }
    
    if (missingQuestionIds.length > 0) {
      const warning = `发现 ${missingQuestionIds.length} 个题目在JSON包中丢失，题目ID: ${missingQuestionIds.slice(0, 10).join(', ')}${missingQuestionIds.length > 10 ? '...' : ''}`;
      console.warn(`[updateAllJsonPackages] ${warning}`);
      warnings.push(warning);
    }
    
    // 检查关键字段完整性
    const questionsWithMissingFields: number[] = [];
    for (const q of questionsWithHash) {
      if (!q.id || !q.type || !q.content) {
        questionsWithMissingFields.push(q.id);
      }
    }
    
    if (questionsWithMissingFields.length > 0) {
      const warning = `发现 ${questionsWithMissingFields.length} 个题目缺少关键字段，题目ID: ${questionsWithMissingFields.slice(0, 10).join(', ')}${questionsWithMissingFields.length > 10 ? '...' : ''}`;
      console.warn(`[updateAllJsonPackages] ${warning}`);
      warnings.push(warning);
    }
    
    // 检查image字段是否都包含（即使为null）
    const questionsWithoutImageField: number[] = [];
    for (const q of questionsWithHash) {
      // 检查image字段是否存在（即使是null也应该存在）
      if (!('image' in q)) {
        questionsWithoutImageField.push(q.id);
      }
    }
    
    if (questionsWithoutImageField.length > 0) {
      const warning = `发现 ${questionsWithoutImageField.length} 个题目缺少image字段，题目ID: ${questionsWithoutImageField.slice(0, 10).join(', ')}${questionsWithoutImageField.length > 10 ? '...' : ''}`;
      console.warn(`[updateAllJsonPackages] ${warning}`);
      warnings.push(warning);
    }
    
    // 生成验证报告
    const isConsistent = 
      dbQuestionCount === jsonQuestionCount && 
      missingQuestionIds.length === 0 && 
      questionsWithMissingFields.length === 0 &&
      questionsWithoutImageField.length === 0 &&
      conversionErrors.length === 0;
    
    const validationReport = {
      isConsistent,
      dbQuestionCount,
      jsonQuestionCount,
      missingQuestionIds,
      conversionErrors,
      warnings,
    };
    
    if (isConsistent) {
      console.log(`[updateAllJsonPackages] 数据一致性验证通过`);
    } else {
      console.warn(`[updateAllJsonPackages] 数据一致性验证失败`, validationReport);
    }

    console.log(`[updateAllJsonPackages] Updated all packages to unified version ${version}`, {
      totalQuestions,
      aiAnswersCount,
      previousVersion,
      previousTotalQuestions,
      previousAiAnswersCount,
      questionsAdded,
      questionsUpdated,
      aiAnswersAdded,
      aiAnswersUpdated,
      validationReport,
    });

    return {
      version,
      totalQuestions,
      aiAnswersCount,
      previousVersion,
      previousTotalQuestions,
      previousAiAnswersCount,
      questionsAdded,
      questionsUpdated,
      aiAnswersAdded,
      aiAnswersUpdated,
      validationReport,
    };
  } catch (error) {
    console.error(`[updateAllJsonPackages] Error:`, error);
    throw error;
  }
}

/**
 * 更新单个JSON包（兼容旧代码，实际调用updateAllJsonPackages）
 * @deprecated 已改为统一版本号，此函数保留用于兼容
 */
export async function updateJsonPackage(packageName: string): Promise<void> {
  // 统一版本号下，更新单个包实际是更新所有包
  await updateAllJsonPackages();
}

