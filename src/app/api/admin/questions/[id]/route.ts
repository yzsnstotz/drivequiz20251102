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
      // 从license_types中获取category
      const category = dbQuestion.license_types?.[0] || "免许-1";
      
      // 转换为前端格式
      // 处理content字段：保持原格式（可能是字符串或多语言对象）
      let content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
      if (typeof dbQuestion.content === "string") {
        content = dbQuestion.content;
      } else {
        content = dbQuestion.content;
      }

      const question: Question = {
        id: dbQuestion.id,
        type: dbQuestion.type,
        content,
        options: Array.isArray(dbQuestion.options) ? dbQuestion.options : undefined,
        correctAnswer: normalizeCorrectAnswer(dbQuestion.correct_answer, dbQuestion.type),
        image: dbQuestion.image || undefined,
        explanation: dbQuestion.explanation || undefined,
        category: dbQuestion.category || category,
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
      const { type, content, options, correctAnswer, image, explanation, category, aiAnswer } = body;

      // 查找题目
      const result = await findQuestionCategory(id);
      if (!result) return notFound("Question not found");

      const { category: oldCategory, question: oldQuestion } = result;
      const targetCategory = category || oldCategory;

      // 校验
      if (type && !["single", "multiple", "truefalse"].includes(type)) {
        return badRequest("Invalid question type");
      }

      if (content && (typeof content !== "string" || content.trim().length === 0)) {
        return badRequest("Question content cannot be empty");
      }

      // 构建更新后的题目
      const updatedQuestion: Question = {
        ...oldQuestion,
        ...(type ? { type } : {}),
        ...(content ? { content: content.trim() } : {}),
        ...(correctAnswer !== undefined ? { correctAnswer } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(image !== undefined ? (image ? { image: image.trim() } : {}) : {}),
        ...(explanation !== undefined ? (explanation ? { explanation: explanation.trim() } : {}) : {}),
        category: targetCategory,
      };

      // 1. 更新数据库（作为数据源）
      try {
        await saveQuestionToDb(updatedQuestion);
      } catch (dbError) {
        console.error("[PUT /api/admin/questions/:id] Error updating database:", dbError);
        // 即使数据库更新失败，也继续同步到JSON包（保持兼容性）
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
        // 在同一文件中更新
        const updatedQuestion: Question = {
          ...oldQuestion,
          ...(type ? { type } : {}),
          ...(content ? { content: content.trim() } : {}),
          ...(correctAnswer !== undefined ? { correctAnswer } : {}),
          ...(options !== undefined ? { options } : {}),
          ...(image !== undefined ? (image ? { image: image.trim() } : {}) : {}),
          ...(explanation !== undefined ? (explanation ? { explanation: explanation.trim() } : {}) : {}),
          category: targetCategory,
        };

        // 1. 更新数据库（作为数据源）
        try {
          await saveQuestionToDb(updatedQuestion);
        } catch (dbError) {
          console.error("[PUT /api/admin/questions/:id] Error updating database:", dbError);
          // 即使数据库更新失败，也继续同步到JSON包（保持兼容性）
        }

        // 2. 同步到JSON包
        const file = await loadQuestionFile(targetCategory);
        if (!file) return internalError("Question file not found");

        const questionIndex = file.questions.findIndex((q) => q.id === id);
        if (questionIndex === -1) return notFound("Question not found");

        file.questions[questionIndex] = updatedQuestion;
        await saveQuestionFile(targetCategory, file);

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

