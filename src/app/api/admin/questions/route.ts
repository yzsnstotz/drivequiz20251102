export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // 强制使用 Node.js runtime，避免 Edge runtime 兼容性问题

// ============================================================
// 文件路径: src/app/api/admin/questions/route.ts
// 功能: 题库管理 API - 查询 & 创建
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError, conflict } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";
import { logCreate, logUpdate, logDelete } from "@/app/api/_lib/operationLog";
import { calculateQuestionHash } from "@/lib/questionHash";
import { aiDb } from "@/lib/aiDb";
import fs from "fs/promises";
import path from "path";

// 题目数据类型
export type QuestionType = "single" | "multiple" | "truefalse";

export interface Question {
  id: number;
  type: QuestionType;
  content: string;
  options?: string[];
  correctAnswer: string | string[];
  image?: string;
  explanation?: string;
  category?: string; // 卷类,如 "仮免-1", "免许-1" 等
}

export interface QuestionFile {
  questions: Question[];
}

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

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

// 加载指定卷类的题目文件
async function loadQuestionFile(category: string): Promise<QuestionFile | null> {
  try {
    const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    // 兼容多种格式：{ questions: [...] }、{ version, questions: [...] } 或直接是数组
    if (Array.isArray(data)) {
      return { questions: data };
    }
    return {
      questions: data.questions || [],
    };
  } catch (error) {
    console.error(`[loadQuestionFile] Error loading ${category}:`, error);
    return null;
  }
}

// 根据题目内容查询 AI 回答（从 ai_logs 表查询）
async function getAIAnswerForQuestion(questionContent: string, locale: string = "zh"): Promise<string | null> {
  try {
    // 从 AI 数据库查询最新的 AI 回答
    // 使用 LIKE 查询以支持模糊匹配（因为题目内容可能不完全一致）
    const normalizedContent = questionContent.trim().toLowerCase();
    const result = await aiDb
      .selectFrom("ai_logs")
      .select(["answer"])
      .where("locale", "=", locale)
      .where((eb) =>
        eb.or([
          eb("question", "=", questionContent),
          eb("question", "ilike", `%${normalizedContent}%`),
        ])
      )
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();

    return result?.answer || null;
  } catch (error) {
    console.error("[getAIAnswerForQuestion] Error:", error);
    return null;
  }
}

// 批量查询多个题目的 AI 回答（优化性能）
async function getAIAnswersForQuestions(
  questionContents: string[],
  locale: string = "zh"
): Promise<Map<string, string>> {
  try {
    if (questionContents.length === 0) {
      return new Map();
    }

    // 批量查询：使用 IN 查询和精确匹配
    const exactMatches = await aiDb
      .selectFrom("ai_logs")
      .select(["question", "answer", "created_at"])
      .where("locale", "=", locale)
      .where("question", "in", questionContents)
      .orderBy("created_at", "desc")
      .execute();

    // 构建结果映射（每个题目只保留最新的回答）
    const answerMap = new Map<string, string>();
    const matchedQuestions = new Set<string>();
    
    // 先处理精确匹配
    for (const log of exactMatches) {
      if (!answerMap.has(log.question) && log.answer) {
        answerMap.set(log.question, log.answer);
        matchedQuestions.add(log.question);
      }
    }

    // 对于没有精确匹配的题目，使用模糊匹配（但限制数量以提高性能）
    const unmatchedQuestions = questionContents.filter(
      (q) => !matchedQuestions.has(q)
    );

    if (unmatchedQuestions.length > 0) {
      // 只对前 20 个未匹配的题目进行模糊查询，避免性能问题
      const limitedUnmatched = unmatchedQuestions.slice(0, 20);
      
      for (const questionContent of limitedUnmatched) {
        if (answerMap.has(questionContent)) continue;
        
        const normalizedContent = questionContent.trim().toLowerCase();
        const result = await aiDb
          .selectFrom("ai_logs")
          .select(["answer"])
          .where("locale", "=", locale)
          .where("question", "ilike", `%${normalizedContent}%`)
          .orderBy("created_at", "desc")
          .limit(1)
          .executeTakeFirst();

        if (result && result.answer) {
          answerMap.set(questionContent, result.answer);
        }
      }
    }

    return answerMap;
  } catch (error) {
    console.error("[getAIAnswersForQuestions] Error:", error);
    return new Map();
  }
}

// 保存题目文件
async function saveQuestionFile(category: string, data: QuestionFile): Promise<void> {
  const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// 从所有文件中收集题目(带卷类信息)
async function collectAllQuestions(): Promise<Question[]> {
  const categories = await getAllCategories();
  const allQuestions: Question[] = [];

  for (const category of categories) {
    const file = await loadQuestionFile(category);
    if (file && file.questions) {
      // 为每个题目添加卷类信息
      const questionsWithCategory = file.questions.map((q) => ({
        ...q,
        category,
      }));
      allQuestions.push(...questionsWithCategory);
    }
  }

  return allQuestions;
}

// 查找题目所属的卷类文件
async function findQuestionCategory(questionId: number): Promise<string | null> {
  const categories = await getAllCategories();
  for (const category of categories) {
    const file = await loadQuestionFile(category);
    if (file && file.questions) {
      const found = file.questions.find((q) => q.id === questionId);
      if (found) return category;
    }
  }
  return null;
}

// ============================================================
// GET /api/admin/questions
// 查询题目列表（分页、筛选、搜索）
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const query = req.nextUrl.searchParams;
    const { page, limit, offset } = parsePagination(query);

    const category = query.get("category"); // 卷类筛选
    const search = query.get("search"); // 内容模糊搜索
    const sortBy = query.get("sortBy") || "id";
    const sortOrder = query.get("sortOrder") || "asc";

    // 收集所有题目
    let allQuestions: Question[] = [];
    
    if (category) {
      // 只加载指定卷类的题目
      const file = await loadQuestionFile(category);
      if (file && file.questions) {
        allQuestions = file.questions.map((q) => ({ ...q, category }));
      }
    } else {
      // 加载所有题目
      allQuestions = await collectAllQuestions();
    }

    // 内容搜索
    if (search) {
      const searchLower = search.toLowerCase();
      allQuestions = allQuestions.filter((q) => {
        // 搜索题目内容、选项、解释
        const contentMatch = q.content?.toLowerCase().includes(searchLower);
        const explanationMatch = q.explanation?.toLowerCase().includes(searchLower);
        const optionsMatch = q.options?.some((opt) =>
          opt.toLowerCase().includes(searchLower)
        );
        return contentMatch || explanationMatch || optionsMatch;
      });
    }

    // 排序
    allQuestions.sort((a, b) => {
      let aVal: any = a[sortBy as keyof Question];
      let bVal: any = b[sortBy as keyof Question];
      
      if (sortBy === "id") {
        aVal = a.id;
        bVal = b.id;
      } else if (sortBy === "content") {
        aVal = a.content || "";
        bVal = b.content || "";
      } else if (sortBy === "category") {
        aVal = a.category || "";
        bVal = b.category || "";
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    // 先计算所有题目的 hash（轻量级操作）
    const questionsWithHash = allQuestions.map((q) => ({
      ...q,
      hash: (q as any).hash || calculateQuestionHash(q),
    }));

    // 分页（在查询 AI 回答之前）
    const total = questionsWithHash.length;
    const paginatedQuestions = questionsWithHash.slice(offset, offset + limit);

    // 只查询当前页题目的 AI 回答（批量查询优化性能）
    const questionContents = paginatedQuestions.map((q) => q.content);
    const aiAnswersMap = await getAIAnswersForQuestions(questionContents, "zh");

    // 为当前页的题目添加 AI 回答
    const questionsWithHashAndAI = paginatedQuestions.map((q) => ({
      ...q,
      aiAnswer: aiAnswersMap.get(q.content) || undefined,
    }));

    const pagination = getPaginationMeta(page, limit, total);

    return success(questionsWithHashAndAI, pagination);
  } catch (err: any) {
    console.error("[GET /api/admin/questions] Error:", err);
    return internalError("Failed to fetch questions");
  }
});

// ============================================================
// POST /api/admin/questions
// 创建新题目
// ============================================================
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { type, content, options, correctAnswer, image, explanation, category } = body;

    // 校验必填字段
    if (!type || !["single", "multiple", "truefalse"].includes(type)) {
      return badRequest("Invalid question type");
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return badRequest("Question content is required");
    }

    if (!correctAnswer) {
      return badRequest("Correct answer is required");
    }

    // 如果是single或multiple类型,必须提供options
    if ((type === "single" || type === "multiple") && (!options || !Array.isArray(options) || options.length === 0)) {
      return badRequest("Options are required for single/multiple choice questions");
    }

    // 如果未指定卷类,使用默认卷类
    const targetCategory = category || "免许-1";
    
    // 加载目标卷类的题目文件
    let file = await loadQuestionFile(targetCategory);
    if (!file) {
      // 如果文件不存在,创建新文件
      file = { questions: [] };
    }

    // 生成新的ID(查找最大ID + 1)
    const maxId = file.questions.length > 0
      ? Math.max(...file.questions.map((q) => q.id))
      : 0;
    const newId = maxId + 1;

    // 创建新题目
    const newQuestion: Question = {
      id: newId,
      type,
      content: content.trim(),
      correctAnswer,
      ...(options && options.length > 0 ? { options } : {}),
      ...(image ? { image: image.trim() } : {}),
      ...(explanation ? { explanation: explanation.trim() } : {}),
    };

    // 添加到文件
    file.questions.push(newQuestion);

    // 保存文件
    await saveQuestionFile(targetCategory, file);

    // 记录操作日志
    try {
      await logCreate(req, "question", newQuestion.id, {
        category: targetCategory,
        type,
        content: content.substring(0, 50),
      });
    } catch (logErr) {
      console.error("[POST /api/admin/questions] Log error:", logErr);
    }

    return success({ ...newQuestion, category: targetCategory });
  } catch (err: any) {
    console.error("[POST /api/admin/questions] Error:", err);
    if (err.ok === false) return err;
    return internalError("Failed to create question");
  }
});

