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
import fs from "fs/promises";
import path from "path";
import type { Question, QuestionFile } from "../route";

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
async function findQuestionCategory(questionId: number): Promise<{
  category: string;
  question: Question;
} | null> {
  const categories = await getAllCategories();
  for (const category of categories) {
    const file = await loadQuestionFile(category);
    if (file && file.questions) {
      const found = file.questions.find((q) => q.id === questionId);
      if (found) {
        return { category, question: found };
      }
    }
  }
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
      const { type, content, options, correctAnswer, image, explanation, category } = body;

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

        const updatedQuestion: Question = {
          ...oldQuestion,
          ...(type ? { type } : {}),
          ...(content ? { content: content.trim() } : {}),
          ...(correctAnswer !== undefined ? { correctAnswer } : {}),
          ...(options !== undefined ? { options } : {}),
          ...(image !== undefined ? (image ? { image: image.trim() } : {}) : {}),
          ...(explanation !== undefined ? (explanation ? { explanation: explanation.trim() } : {}) : {}),
        };

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
              content: oldQuestion.content.substring(0, 50),
            },
            {
              category: targetCategory,
              type: updatedQuestion.type,
              content: updatedQuestion.content.substring(0, 50),
            },
            `卷类变更: ${oldCategory} → ${targetCategory}`
          );
        } catch (logErr) {
          console.error("[PUT /api/admin/questions/:id] Log error:", logErr);
        }

        return success({ ...updatedQuestion, category: targetCategory });
      } else {
        // 在同一文件中更新
        const file = await loadQuestionFile(targetCategory);
        if (!file) return internalError("Question file not found");

        const questionIndex = file.questions.findIndex((q) => q.id === id);
        if (questionIndex === -1) return notFound("Question not found");

        const updatedQuestion: Question = {
          ...oldQuestion,
          ...(type ? { type } : {}),
          ...(content ? { content: content.trim() } : {}),
          ...(correctAnswer !== undefined ? { correctAnswer } : {}),
          ...(options !== undefined ? { options } : {}),
          ...(image !== undefined ? (image ? { image: image.trim() } : {}) : {}),
          ...(explanation !== undefined ? (explanation ? { explanation: explanation.trim() } : {}) : {}),
        };

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
              content: oldQuestion.content.substring(0, 50),
            },
            {
              category: targetCategory,
              type: updatedQuestion.type,
              content: updatedQuestion.content.substring(0, 50),
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

      // 从文件中删除
      const file = await loadQuestionFile(category);
      if (!file) return internalError("Question file not found");

      file.questions = file.questions.filter((q) => q.id !== id);
      await saveQuestionFile(category, file);

      // 记录操作日志
      try {
        await logDelete(req, "question", id, {
          category,
          type: question.type,
          content: question.content.substring(0, 50),
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

