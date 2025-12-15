export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // 强制使用 Node.js runtime，避免 Edge runtime 兼容性问题

// ============================================================
// 文件路径: src/app/api/admin/questions/[id]/route.ts
// 功能: 题目详情、更新、删除（仅数据库）
// 说明: 已移除一切 JSON 包/文件系统读写逻辑；编辑/删除仅针对数据库题目
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError, notFound } from "@/app/api/_lib/errors";
import { logUpdate, logDelete } from "@/app/api/_lib/operationLog";
import { calculateQuestionHash } from "@/lib/questionHash";
import { saveQuestionToDb, updateAIAnswerToDb } from "@/lib/questionDb";
import { db } from "@/lib/db";
import type { Question } from "../route";
import type { CorrectAnswer } from "@/lib/types/question";
import { getContentPreview } from "@/lib/questionContentUtils";

// ============================================================
// helpers: normalize i18n content/explanation for DB update
// - Allow string (legacy) or object { zh, ja, en, ... }
// - Trim strings
// - Return undefined when input is undefined (means "no change")
// - Return null when explicitly set to empty (means "invalid")
// ============================================================
function normalizeI18nTextInput(input: any): string | Record<string, string> | null | undefined {
  // undefined => caller didn't send this field => do not change
  if (input === undefined) return undefined;

  // null => treat as empty (invalid for required fields like content)
  if (input === null) return null;

  // string legacy
  if (typeof input === "string") {
    const s = input.trim();
    return s.length > 0 ? s : null;
  }

  // object i18n
  if (typeof input === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(input)) {
      if (typeof v === "string") {
        const s = v.trim();
        if (s) out[k] = s;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  return null;
}


// ============================================================
// DB: 仅从数据库读取题目
// ============================================================
async function findDbQuestionById(
  questionId: number
): Promise<{ question: Question } | null> {
  try {
    const dbQuestion = await db
      .selectFrom("questions")
      .selectAll()
      .where("id", "=", questionId)
      .executeTakeFirst();

    if (!dbQuestion) return null;

    // 保持原格式（可能是字符串或多语言对象）
    const content =
      typeof dbQuestion.content === "string" ? dbQuestion.content : dbQuestion.content;

    const question: Question = {
      id: dbQuestion.id,
      type: dbQuestion.type,
      content,
      options: Array.isArray(dbQuestion.options) ? dbQuestion.options : undefined,
      correctAnswer: dbQuestion.correct_answer as CorrectAnswer | null,
      image: dbQuestion.image || undefined,
      explanation: dbQuestion.explanation || undefined,
      category: dbQuestion.category || "UNKNOWN",
      hash: (dbQuestion as any).content_hash,
    };

    return { question };
  } catch (error) {
    console.error("[findDbQuestionById] Error:", error);
    return null;
  }
}

// ============================================================
// GET /api/admin/questions/:id
// 查询单个题目详情（仅数据库）
// ============================================================
export const GET = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const result = await findDbQuestionById(id);
      if (!result) return notFound("Question not found in database");

      return success(result.question);
    } catch (err: any) {
      console.error("[GET /api/admin/questions/:id] Error:", err);
      if (err.ok === false) return err;
      return internalError("Failed to fetch question");
    }
  }
);

// ============================================================
// PUT /api/admin/questions/:id
// 更新题目（仅数据库）
// ============================================================
export const PUT = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const body = await req.json();
      const { type, content, options, correctAnswer, image, explanation, category, aiAnswer } = body;

      const contentNormalized = normalizeI18nTextInput(content);
      const explanationNormalized = normalizeI18nTextInput(explanation);
      // 仅查数据库
      const found = await findDbQuestionById(id);
      if (!found) return notFound("Question not found in database");

      const oldQuestion = found.question;

      // === 新增 correctAnswer 规范化逻辑 ===
      let normalizedCorrectAnswer: CorrectAnswer | undefined = undefined;

      if (correctAnswer !== undefined) {
        const finalType = type ?? oldQuestion.type;

        if (finalType === "truefalse") {
          normalizedCorrectAnswer = {
            type: "boolean",
            value: correctAnswer === true || correctAnswer === "true",
          };
        } else if (finalType === "single") {
          normalizedCorrectAnswer = {
            type: "single_choice",
            value: String(correctAnswer),
          };
        } else if (finalType === "multiple") {
          normalizedCorrectAnswer = {
            type: "multiple_choice",
            value: Array.isArray(correctAnswer) ? correctAnswer : [],
          };
        }
      }

      // 校验
      if (type && !["single", "multiple", "truefalse"].includes(type)) {
        return badRequest("Invalid question type");
      }
      // content: required (but allows i18n object). For update:
      // - if content is undefined => no change
      // - if provided but normalizes to null => invalid
      if (content !== undefined && contentNormalized === null) {
        return badRequest("Question content cannot be empty");
      }

      // explanation: optional. If provided but normalizes to null, we treat as empty string/object removal not allowed here.
      // Keep it permissive: allow clearing by sending empty string/object? -> if you want to allow clearing, remove this check.
      // For now, we keep "null means do not write" behavior in updatedQuestion below.


      // 构建更新后的题目（仅 DB）
      const updatedQuestion: Question = {
        ...oldQuestion,
        ...(type !== undefined ? { type } : {}),
        ...(contentNormalized !== undefined && contentNormalized !== null
          ? { content: contentNormalized as any }
          : {}),
        ...(normalizedCorrectAnswer !== undefined
          ? { correctAnswer: normalizedCorrectAnswer }
          : {}),
        ...(options !== undefined ? { options } : {}),
        ...(explanationNormalized !== undefined
          ? explanationNormalized === null
            ? {}
            : { explanation: explanationNormalized as any }
          : {}),

        ...(category !== undefined ? { category } : {}),
      };

      // 更新数据库（主数据源）
            // 更新数据库（主数据源）
            try {
              console.log("[PUT /api/admin/questions/:id] contentNormalized type =", typeof contentNormalized);
              console.log(
                "[PUT /api/admin/questions/:id] updatedQuestion.content type =",
                typeof (updatedQuestion as any).content
              );
      
              await saveQuestionToDb(updatedQuestion);
      
              console.log("[PUT /api/admin/questions/:id] saveQuestionToDb OK", { id });
            } catch (dbErr: any) {
              console.error("[PUT /api/admin/questions/:id] saveQuestionToDb FAILED:", dbErr);
      
              // 把真实错误“透出”给前端，便于你立刻定位（临时诊断用）
              return internalError(
                `Failed to update question (DB write failed): ${dbErr?.message || String(dbErr)}`
              );
            }
      

      // 更新 AI 回答（可选，不影响主流程）
      if (aiAnswer !== undefined) {
        try {
          const questionHash = calculateQuestionHash(updatedQuestion);
          await updateAIAnswerToDb(
            questionHash,
            aiAnswer ? aiAnswer.trim() : "",
            "zh",
            "manual",
            undefined,
            undefined
          );
        } catch (aiAnswerError) {
          console.error("[PUT /api/admin/questions/:id] Error updating AI answer:", aiAnswerError);
        }
      }

      // 记录操作日志（仅记录，不影响主流程）
      try {
        await logUpdate(
          req,
          "question",
          id,
          {
            category: oldQuestion.category,
            type: oldQuestion.type,
            content: getContentPreview(oldQuestion.content, 50),
          },
          {
            category: updatedQuestion.category,
            type: updatedQuestion.type,
            content: getContentPreview(updatedQuestion.content, 50),
          }
        );
      } catch (logErr) {
        console.error("[PUT /api/admin/questions/:id] Log error:", logErr);
      }

      return success(updatedQuestion);
    } catch (err: any) {
      console.error("[PUT /api/admin/questions/:id] Error:", err);
      if (err.ok === false) return err;

      // 临时诊断：把真实错误透出，避免继续黑盒
      return internalError(`Failed to update question: ${err?.message || String(err)}`);
    }

  }
);

// ============================================================
// DELETE /api/admin/questions/:id
// 删除题目（仅数据库）
// ============================================================
export const DELETE = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: idParam } = await params;
      const id = Number(idParam);
      if (isNaN(id)) return badRequest("Invalid ID parameter");

      const found = await findDbQuestionById(id);
      if (!found) return notFound("Question not found in database");

      const question = found.question;

      // 仅删除数据库
      await db.deleteFrom("questions").where("id", "=", id).execute();

      // 记录操作日志
      try {
        await logDelete(req, "question", id, {
          category: question.category,
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
