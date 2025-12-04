export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // 强制使用 Node.js runtime，避免 Edge runtime 兼容性问题

// ============================================================
// 文件路径: src/app/api/admin/questions/[id]/route.ts
// 功能: 题目详情、更新、删除
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError, notFound } from "@/app/api/_lib/errors";
import { logUpdate, logDelete } from "@/app/api/_lib/operationLog";
import { calculateQuestionHash } from "@/lib/questionHash";
import {
  getQuestionsFromDb,
  saveQuestionToDb,
  normalizeCorrectAnswer,
  updateAIAnswerToDb,
} from "@/lib/questionDb";
import { db } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import type { Question, QuestionFile } from "../route";
import { getContentText, getContentPreview } from "@/lib/questionContentUtils";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// 加载指定卷类的题目文件
async function loadQuestionFile(category: string): Promise<QuestionFile | null> {
  try {
    const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as QuestionFile;
  } catch (error) {
    console.error(`[loadQuestionFile] Error loading ${category}:`, error);
    return null;
  }
}

// 保存题目文件
async function saveQuestionFile(category: string, data: QuestionFile): Promise<void> {
  const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// 获取所有卷类列表
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

// 查找题目所属的卷类文件
// 只从数据库读取，如果数据库没有则返回null
async function findQuestionCategory(questionId: number): Promise<{
  category: string;
  question: Question;
} | null> {
  try {
    // 只从数据库读取
    const dbQuestion = await db
      .selectFrom("questions")
      .selectAll()
      .where("id", "=", questionId)
      .executeTakeFirst();
    
    if (dbQuestion) {
      // ⚠️ 兼容旧逻辑：category 是卷类，不是标签
      // 注意：license_types 和 category 是不同的概念，不应该互相转换
      const category = dbQuestion.category || "免许-1";
      
      // 转换为前端格式
      // 处理content字段：保持原格式（可能是字符串或多语言对象）
      let content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
      if (typeof dbQuestion.content === "string") {
        content = dbQuestion.content;
      } else {
        content = dbQuestion.content;
      }

      const question: Question & { license_type_tag?: string[]; stage_tag?: "both" | "provisional" | "regular"; topic_tags?: string[] } = {
        id: dbQuestion.id,
        type: dbQuestion.type,
        content,
        options: Array.isArray(dbQuestion.options) ? dbQuestion.options : undefined,
        correctAnswer: normalizeCorrectAnswer(dbQuestion.correct_answer, dbQuestion.type),
        image: dbQuestion.image || undefined,
        explanation: dbQuestion.explanation || undefined,
        category: dbQuestion.category || category,
        // ✅ 修复：包含 license_type_tag、stage_tag、topic_tags 字段
        license_type_tag: Array.isArray(dbQuestion.license_type_tag) ? dbQuestion.license_type_tag : undefined,
        stage_tag: dbQuestion.stage_tag || undefined,
        topic_tags: Array.isArray(dbQuestion.topic_tags) ? dbQuestion.topic_tags : undefined,
      };
      
      return { category, question };
    }
  } catch (error) {
    console.error("[findQuestionCategory] Error reading from database:", error);
  }
  
  // 数据库没有，返回null
  return null;
}

// ============================================================
// GET /api/admin/questions/:id
// 查询单个题目详情
// ============================================================
export const GET = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const result = await findQuestionCategory(id);
      if (!result) return notFound("Question not found");

      return success({
        ...result.question,
        category: result.category,
      });
    } catch (err: any) {
      console.error("[GET /api/admin/questions/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to fetch question");
    }
  }
);

// ============================================================
// PUT /api/admin/questions/:id
// 更新题目
// ============================================================
export const PUT = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const body = await req.json();
      const { type, content, options, correctAnswer, image, explanation, category, aiAnswer, license_type_tag, stage_tag, topic_tags } = body;

      // 查找题目
      const result = await findQuestionCategory(id);
      if (!result) return notFound("Question not found");

      const { category: oldCategory, question: oldQuestion } = result;
      const targetCategory = category || oldCategory;

      // 校验
      if (type && !["single", "multiple", "truefalse"].includes(type)) {
        return badRequest("Invalid question type");
      }

      // ✅ 修复：支持多语言对象格式的content和explanation
      // content可以是字符串或多语言对象 {zh, en, ja}
      let normalizedContent: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined } | undefined;
      if (content !== undefined) {
        if (typeof content === "string") {
          // 字符串格式：trim后检查是否为空
          const trimmed = content.trim();
          if (trimmed.length === 0) {
            return badRequest("Question content cannot be empty");
          }
          normalizedContent = trimmed;
        } else if (typeof content === "object" && content !== null) {
          // 多语言对象格式：检查至少有一个语言不为空
          const multilangContent = content as { zh?: string; en?: string; ja?: string };
          const hasContent = 
            (multilangContent.zh && multilangContent.zh.trim().length > 0) ||
            (multilangContent.en && multilangContent.en.trim().length > 0) ||
            (multilangContent.ja && multilangContent.ja.trim().length > 0);
          if (!hasContent) {
            return badRequest("Question content cannot be empty (at least one language required)");
          }
          // 清理空值，只保留有内容的语言，确保至少包含zh
          const cleanedContent: { zh: string; en?: string; ja?: string; [key: string]: string | undefined } = {} as any;
          if (multilangContent.zh && multilangContent.zh.trim().length > 0) {
            cleanedContent.zh = multilangContent.zh.trim();
          } else if (multilangContent.en && multilangContent.en.trim().length > 0) {
            // 如果没有zh，使用en作为主要语言（但类型要求zh，所以这里需要特殊处理）
            cleanedContent.zh = multilangContent.en.trim();
            cleanedContent.en = multilangContent.en.trim();
          } else if (multilangContent.ja && multilangContent.ja.trim().length > 0) {
            // 如果没有zh和en，使用ja作为主要语言
            cleanedContent.zh = multilangContent.ja.trim();
            cleanedContent.ja = multilangContent.ja.trim();
          }
          // 确保zh存在（类型要求）
          if (!cleanedContent.zh) {
            return badRequest("Question content must have at least one language");
          }
          normalizedContent = cleanedContent;
        } else {
          return badRequest("Invalid content format: must be string or multilang object");
        }
      }

      // explanation可以是字符串或多语言对象 {zh, en, ja}
      let normalizedExplanation: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined } | undefined;
      if (explanation !== undefined) {
        if (typeof explanation === "string") {
          normalizedExplanation = explanation.trim() || undefined;
        } else if (typeof explanation === "object" && explanation !== null) {
          // 多语言对象格式：清理空值，只保留有内容的语言，确保至少包含zh
          const multilangExplanation = explanation as { zh?: string; en?: string; ja?: string };
          const cleanedExplanation: { zh: string; en?: string; ja?: string; [key: string]: string | undefined } = {} as any;
          if (multilangExplanation.zh && multilangExplanation.zh.trim().length > 0) {
            cleanedExplanation.zh = multilangExplanation.zh.trim();
          } else if (multilangExplanation.en && multilangExplanation.en.trim().length > 0) {
            // 如果没有zh，使用en作为主要语言
            cleanedExplanation.zh = multilangExplanation.en.trim();
            cleanedExplanation.en = multilangExplanation.en.trim();
          } else if (multilangExplanation.ja && multilangExplanation.ja.trim().length > 0) {
            // 如果没有zh和en，使用ja作为主要语言
            cleanedExplanation.zh = multilangExplanation.ja.trim();
            cleanedExplanation.ja = multilangExplanation.ja.trim();
          }
          // 如果所有语言都为空，设置为undefined
          if (Object.keys(cleanedExplanation).length === 0) {
            normalizedExplanation = undefined;
          } else {
            // 确保zh存在（类型要求）
            if (!cleanedExplanation.zh) {
              normalizedExplanation = undefined;
            } else {
              normalizedExplanation = cleanedExplanation;
            }
          }
        } else {
          return badRequest("Invalid explanation format: must be string or multilang object");
        }
      }

      // ✅ 修复：oldQuestion 包含扩展字段，需要使用类型断言
      const oldQuestionWithTags = oldQuestion as Question & { license_type_tag?: string[]; stage_tag?: "both" | "provisional" | "regular"; topic_tags?: string[] };
      
      // 构建更新后的题目
      const updatedQuestion: Question & { license_type_tag?: string[] | null | undefined; stage_tag?: "both" | "provisional" | "regular" | null | undefined; topic_tags?: string[] | undefined } = {
        ...oldQuestion,
        ...(type ? { type } : {}),
        ...(normalizedContent !== undefined ? { content: normalizedContent } : {}),
        ...(correctAnswer !== undefined ? { correctAnswer } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(image !== undefined ? (image ? { image: image.trim() } : {}) : {}),
        ...(normalizedExplanation !== undefined ? { explanation: normalizedExplanation } : {}),
        category: targetCategory,
        // ✅ 修复：保留 license_type_tag、stage_tag、topic_tags 字段
        // 如果请求中提供了这些字段，使用新值；否则保留原值（从 oldQuestion 中）
        ...(license_type_tag !== undefined 
          ? { license_type_tag: Array.isArray(license_type_tag) && license_type_tag.length > 0 ? license_type_tag : null } 
          : (oldQuestionWithTags.license_type_tag !== undefined ? { license_type_tag: oldQuestionWithTags.license_type_tag } : {})),
        ...(stage_tag !== undefined 
          ? { stage_tag: stage_tag || null } 
          : (oldQuestionWithTags.stage_tag !== undefined ? { stage_tag: oldQuestionWithTags.stage_tag } : {})),
        ...(topic_tags !== undefined 
          ? { topic_tags: Array.isArray(topic_tags) && topic_tags.length > 0 ? topic_tags : undefined } 
          : (oldQuestionWithTags.topic_tags !== undefined && oldQuestionWithTags.topic_tags !== null ? { topic_tags: oldQuestionWithTags.topic_tags } : {})),
      };

      // ✅ 修复：更新数据库时，传入 id 和 mode（使用updateOnly模式）
      // 1. 更新数据库（作为数据源）
      try {
        // 使用updateOnly模式，传入 id 确保通过 id 查找题目（而不是通过 content_hash）
        await saveQuestionToDb({ ...updatedQuestion, id: id, mode: "updateOnly" });
      } catch (dbError: any) {
        console.error("[PUT /api/admin/questions/:id] Error updating database:", {
          error: dbError,
          message: dbError?.message,
          stack: dbError?.stack,
          questionId: id,
          contentHash: oldQuestion.hash || calculateQuestionHash(oldQuestion),
        });
        // ✅ 修复：数据库更新失败时返回详细错误信息
        if (dbError?.message === "QUESTION_NOT_FOUND_FOR_UPDATE") {
          return internalError("Question not found in database for update. Please refresh and try again.");
        }
        // 其他数据库错误也返回详细错误
        return internalError(`Failed to update question in database: ${dbError?.message || String(dbError)}`);
      }

      // 1.5. 更新AI回答（如果提供了 aiAnswer）
      if (aiAnswer !== undefined) {
        try {
          // 计算题目的 hash
          const questionHash = calculateQuestionHash(updatedQuestion);
          
          // 更新或插入 AI 回答（包括空内容，允许清空）
          await updateAIAnswerToDb(
            questionHash,
            aiAnswer ? aiAnswer.trim() : "",
            "zh", // 默认使用中文
            "manual", // 标记为手动编辑
            undefined,
            undefined // createdBy 留空，因为是管理员手动编辑
          );
          console.log(`[PUT /api/admin/questions/:id] 成功更新AI回答`, {
            questionId: id,
            questionHash: questionHash.substring(0, 16) + "...",
            answerLength: aiAnswer ? aiAnswer.trim().length : 0,
            isEmpty: !aiAnswer || aiAnswer.trim().length === 0,
          });
        } catch (aiAnswerError) {
          console.error("[PUT /api/admin/questions/:id] Error updating AI answer:", aiAnswerError);
          // AI回答更新失败不影响主流程
        }
      }

      // 2. 同步到JSON包
      // 如果卷类改变,需要从旧文件删除,添加到新文件
      if (targetCategory !== oldCategory) {
        // 从旧文件删除
        const oldFile = await loadQuestionFile(oldCategory);
        if (oldFile) {
          oldFile.questions = oldFile.questions.filter((q) => q.id !== id);
          await saveQuestionFile(oldCategory, oldFile);
        }

        // 添加到新文件
        let newFile = await loadQuestionFile(targetCategory);
        if (!newFile) {
          newFile = { questions: [] };
        }

        newFile.questions.push(updatedQuestion);
        await saveQuestionFile(targetCategory, newFile);

        // 记录操作日志
        try {
          await logUpdate(
            req,
            "question",
            id,
            {
              category: oldCategory,
              type: oldQuestion.type,
              content: getContentPreview(oldQuestion.content, 50),
            },
            {
              category: targetCategory,
              type: updatedQuestion.type,
              content: getContentPreview(updatedQuestion.content, 50),
            },
            `卷类变更: ${oldCategory} → ${targetCategory}`
          );
        } catch (logErr) {
          console.error("[PUT /api/admin/questions/:id] Log error:", logErr);
        }

        return success({ ...updatedQuestion, category: targetCategory });
      } else {
        // 在同一文件中更新（使用上面已经构建好的updatedQuestion）
        // 注意：updatedQuestion已经在上面构建完成，包含normalizedContent和normalizedExplanation

        // 1. 更新数据库（作为数据源）
        try {
          // 使用updateOnly模式，确保只更新不插入
          await saveQuestionToDb({ ...updatedQuestion, id: id, mode: "updateOnly" });
        } catch (dbError: any) {
          console.error("[PUT /api/admin/questions/:id] Error updating database:", {
            error: dbError,
            message: dbError?.message,
            stack: dbError?.stack,
            questionId: id,
            contentHash: oldQuestion.hash || calculateQuestionHash(oldQuestion),
          });
          // ✅ 修复：数据库更新失败时返回详细错误信息
          if (dbError?.message === "QUESTION_NOT_FOUND_FOR_UPDATE") {
            return internalError("Question not found in database for update. Please refresh and try again.");
          }
          // 其他数据库错误也返回详细错误
          return internalError(`Failed to update question in database: ${dbError?.message || String(dbError)}`);
        }

        // 2. 同步到JSON包（如果文件存在）
        try {
          const file = await loadQuestionFile(targetCategory);
          if (file) {
            const questionIndex = file.questions.findIndex((q) => q.id === id);
            if (questionIndex !== -1) {
              // 题目存在于JSON文件中，更新它
              file.questions[questionIndex] = updatedQuestion;
              await saveQuestionFile(targetCategory, file);
            } else {
              // 题目不在JSON文件中，但数据库更新成功，这是正常的（题目可能只存在于数据库中）
              console.log(`[PUT /api/admin/questions/:id] Question ${id} not found in JSON file, but database update succeeded. This is normal for database-only questions.`);
            }
          } else {
            // JSON文件不存在，但数据库更新成功，这是正常的（题目可能只存在于数据库中）
            console.log(`[PUT /api/admin/questions/:id] JSON file for category ${targetCategory} not found, but database update succeeded. This is normal for database-only questions.`);
          }
        } catch (jsonError) {
          // JSON文件操作失败不影响数据库更新，只记录错误
          console.error("[PUT /api/admin/questions/:id] Error syncing to JSON file:", jsonError);
        }

        // 记录操作日志
        try {
          await logUpdate(
            req,
            "question",
            id,
            {
              category: targetCategory,
              type: oldQuestion.type,
              content: getContentPreview(oldQuestion.content, 50),
            },
            {
              category: targetCategory,
              type: updatedQuestion.type,
              content: getContentPreview(updatedQuestion.content, 50),
            }
          );
        } catch (logErr) {
          console.error("[PUT /api/admin/questions/:id] Log error:", logErr);
        }

        return success({ ...updatedQuestion, category: targetCategory });
      }
    } catch (err: any) {
      console.error("[PUT /api/admin/questions/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to update question");
    }
  }
);

// ============================================================
// DELETE /api/admin/questions/:id
// 删除题目
// ============================================================
export const DELETE = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const result = await findQuestionCategory(id);
      if (!result) return notFound("Question not found");

      const { category, question } = result;

      // 1. 从数据库删除（作为数据源）
      try {
        await db
          .deleteFrom("questions")
          .where("id", "=", id)
          .execute();
      } catch (dbError) {
        console.error("[DELETE /api/admin/questions/:id] Error deleting from database:", dbError);
        // 即使数据库删除失败，也继续从JSON包删除（保持兼容性）
      }

      // 2. 从JSON包删除
      const file = await loadQuestionFile(category);
      if (!file) return internalError("Question file not found");

      file.questions = file.questions.filter((q) => q.id !== id);
      await saveQuestionFile(category, file);

      // 记录操作日志
      try {
        await logDelete(req, "question", id, {
          category,
          type: question.type,
          content: getContentPreview(question.content, 50),
        });
      } catch (logErr) {
        console.error("[DELETE /api/admin/questions/:id] Log error:", logErr);
      }

      return success({ deleted: 1 });
    } catch (err: any) {
      console.error("[DELETE /api/admin/questions/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to delete question");
    }
  }
);

