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
import { db } from "@/lib/db";
import {
  getQuestionsFromDb,
  saveQuestionToDb,
  getAIAnswerFromDb,
  getAIAnswerFromJson,
  loadQuestionFile,
  updateJsonPackage,
  shouldTriggerBatchUpdate,
  batchUpdateJsonPackages,
  normalizeCorrectAnswer,
} from "@/lib/questionDb";
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

// 加载指定卷类的题目文件（本地函数，用于兼容旧逻辑）
async function loadQuestionFileLocal(category: string): Promise<QuestionFile | null> {
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
    console.error(`[loadQuestionFileLocal] Error loading ${category}:`, error);
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

// 从数据库中收集所有题目(带卷类信息)
// 直接从数据库读取所有题目，不依赖文件系统的categories
async function collectAllQuestions(): Promise<Question[]> {
  try {
    // 直接从数据库读取所有题目
    const allDbQuestions = await db
      .selectFrom("questions")
      .selectAll()
      .orderBy("id", "asc")
      .execute();

    console.log(`[collectAllQuestions] 从数据库读取到 ${allDbQuestions.length} 个题目`);

    // 转换为前端格式
    const allQuestions: Question[] = allDbQuestions.map((q) => {
      // 从license_types数组中获取category（取第一个，如果没有则使用"其他"）
      const category = (Array.isArray(q.license_types) && q.license_types.length > 0)
        ? q.license_types[0]
        : "其他";

      return {
        id: q.id,
        type: q.type,
        content: q.content,
        options: Array.isArray(q.options) ? q.options : (q.options ? [q.options] : undefined),
        correctAnswer: normalizeCorrectAnswer(q.correct_answer, q.type),
        image: q.image || undefined,
        explanation: q.explanation || undefined,
        category,
      };
    });

    return allQuestions;
  } catch (error) {
    console.error(`[collectAllQuestions] Error loading all questions from database:`, error);
    return [];
  }
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
    const source = query.get("source"); // 题目源：database（数据库）或版本号（历史JSON包）
    const sortBy = query.get("sortBy") || "id";
    const sortOrder = query.get("sortOrder") || "asc";

    // 收集所有题目
    let allQuestions: Question[] = [];
    
    // 如果指定了版本号（历史JSON包），从JSON包读取
    if (source && source !== "database") {
      // source是版本号，优先从统一的questions.json读取
      let questionsLoaded = false; // 标记是否已加载题目，避免重复加载
      
      try {
        const unifiedFile = await loadQuestionFile(); // 不传参数，读取统一文件
        console.log(`[GET /api/admin/questions] 读取统一文件，版本号: ${unifiedFile?.version}, 请求版本号: ${source}, 题目数: ${unifiedFile?.questions?.length || 0}`);
        
        if (unifiedFile && unifiedFile.questions && unifiedFile.questions.length > 0) {
          // 检查JSON包的版本号是否匹配
          const fileVersion = unifiedFile.version;
          console.log(`[GET /api/admin/questions] 版本号匹配检查: fileVersion=${fileVersion}, source=${source}, 匹配=${fileVersion === source}`);
          
          // 只有当版本号匹配时才加载题目（严格匹配）
          if (fileVersion === source || (!fileVersion && !source)) {
            // 版本号匹配，或者文件没有版本号且请求也没有版本号（兼容旧格式）
            // 如果指定了category筛选，只添加匹配的题目
            if (category) {
              const filteredQuestions = unifiedFile.questions.filter((q) => {
                return q.category === category;
              });
              console.log(`[GET /api/admin/questions] 按category筛选后题目数: ${filteredQuestions.length}`);
              allQuestions.push(...(filteredQuestions as Question[]));
            } else {
              // 没有category筛选，添加所有题目
              console.log(`[GET /api/admin/questions] 添加所有题目: ${unifiedFile.questions.length}`);
              allQuestions.push(...(unifiedFile.questions as Question[]));
            }
            questionsLoaded = true; // 标记已加载
          } else {
            console.warn(`[GET /api/admin/questions] 版本号不匹配: 文件版本=${fileVersion}, 请求版本=${source}，不加载题目`);
            // 版本号不匹配，不加载题目（避免显示错误的版本）
          }
        } else {
          console.warn(`[GET /api/admin/questions] 统一文件为空或没有题目: unifiedFile=${!!unifiedFile}, questions=${unifiedFile?.questions?.length || 0}`);
        }
      } catch (unifiedError) {
        console.error(`[GET /api/admin/questions] 读取统一文件失败:`, unifiedError);
        // 如果统一的questions.json不存在或读取失败，尝试从各个JSON包读取（兼容旧逻辑）
        // 但只有在未加载题目时才执行
        if (!questionsLoaded) {
          const categories = await getAllCategories();
          console.log(`[GET /api/admin/questions] 尝试从各个JSON包读取，categories: ${categories.length}`);
          
          for (const cat of categories) {
            try {
              const file = await loadQuestionFileLocal(cat);
              if (file && file.questions && file.questions.length > 0) {
                // 检查JSON包的版本号是否匹配
                const fileVersion = (file as any).version;
                console.log(`[GET /api/admin/questions] 读取 ${cat}: 版本号=${fileVersion}, 请求版本=${source}`);
                
                if (fileVersion === source || (!fileVersion && !source)) {
                  // 如果指定了category筛选，只添加匹配的题目
                  if (category) {
                    const filteredQuestions = file.questions.filter((q: Question) => {
                      // 如果题目有category字段，使用它；否则使用文件名作为category
                      const qCategory = q.category || cat;
                      return qCategory === category;
                    });
                    allQuestions.push(...filteredQuestions.map((q: Question) => ({
                      ...q,
                      category: q.category || cat,
                    })));
                  } else {
                    // 没有category筛选，添加所有题目
                    allQuestions.push(...file.questions.map((q: Question) => ({
                      ...q,
                      category: q.category || cat,
                    })));
                  }
                  questionsLoaded = true; // 标记已加载
                }
              }
            } catch (error) {
              console.error(`[GET /api/admin/questions] Error loading ${cat} from JSON:`, error);
            }
          }
        }
      }
      
      console.log(`[GET /api/admin/questions] 从JSON包读取后，总题目数: ${allQuestions.length}`);
    } else {
      // 从数据库读取（source === "database" 或未指定）
      console.log(`[GET /api/admin/questions] 从数据库读取，category=${category || "全部"}`);
      
      if (category) {
        // 只加载指定卷类的题目（只从数据库读取）
        try {
          const dbQuestions = await getQuestionsFromDb(category);
          console.log(`[GET /api/admin/questions] 从数据库读取 ${category}，找到 ${dbQuestions.length} 个题目`);
          if (dbQuestions && dbQuestions.length > 0) {
            allQuestions = dbQuestions as Question[];
          } else {
            // 如果通过license_types没找到，尝试直接查询所有题目然后筛选
            console.log(`[GET /api/admin/questions] 通过license_types未找到，尝试直接查询并筛选`);
            const allDbQuestions = await db
              .selectFrom("questions")
              .selectAll()
              .orderBy("id", "asc")
              .execute();
            
            allQuestions = allDbQuestions
              .filter((q) => {
                // 检查license_types数组是否包含category
                if (Array.isArray(q.license_types)) {
                  return q.license_types.includes(category);
                }
                return false;
              })
              .map((q) => ({
                id: q.id,
                type: q.type,
                content: q.content,
                options: Array.isArray(q.options) ? q.options : (q.options ? [q.options] : undefined),
                correctAnswer: normalizeCorrectAnswer(q.correct_answer, q.type),
                image: q.image || undefined,
                explanation: q.explanation || undefined,
                category: category,
              }));
            
            console.log(`[GET /api/admin/questions] 直接查询后筛选，找到 ${allQuestions.length} 个题目`);
          }
        } catch (error) {
          console.error(`[GET /api/admin/questions] Error loading ${category} from database:`, error);
          // 数据库读取失败，返回空数组
        }
      } else {
        // 加载所有题目（只从数据库读取）
        allQuestions = await collectAllQuestions();
        console.log(`[GET /api/admin/questions] 从数据库读取所有题目，共 ${allQuestions.length} 个`);
      }
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

    // 查询当前页题目的 AI 回答
    // 优先从JSON包读取，如果没有则从数据库读取
    const questionsWithHashAndAI = await Promise.all(
      paginatedQuestions.map(async (q) => {
        const questionHash = (q as any).hash || calculateQuestionHash(q);
        
        // 1. 优先从JSON包读取（如果题目有category）
        let aiAnswer: string | null = null;
        if (q.category) {
          aiAnswer = await getAIAnswerFromJson(q.category, questionHash);
        }
        
        // 2. 如果JSON包没有，从数据库读取
        if (!aiAnswer) {
          aiAnswer = await getAIAnswerFromDb(questionHash, "zh");
        }
        
        // 3. 如果数据库也没有，从ai_logs表查询（兼容旧逻辑）
        if (!aiAnswer) {
          const logAnswer = await getAIAnswersForQuestions([q.content], "zh");
          aiAnswer = logAnswer.get(q.content) || null;
        }
        
        return {
          ...q,
          aiAnswer: aiAnswer || undefined,
        };
      })
    );

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
    
    // 创建新题目
    const newQuestion: Question = {
      id: 0, // 临时ID，数据库会自动生成
      type,
      content: content.trim(),
      correctAnswer,
      ...(options && options.length > 0 ? { options } : {}),
      ...(image ? { image: image.trim() } : {}),
      ...(explanation ? { explanation: explanation.trim() } : {}),
      category: targetCategory,
    };

    // 1. 保存到数据库（作为数据源）
    const questionId = await saveQuestionToDb(newQuestion);
    newQuestion.id = questionId;

    // 2. 同步到JSON包
    try {
      let file = await loadQuestionFile(targetCategory);
      if (!file) {
        file = { questions: [] };
      }
      
      // 更新题目ID（使用数据库生成的ID）
      const questionWithId = { ...newQuestion, id: questionId };
      file.questions.push(questionWithId);
      
      // 保存到JSON包
      await saveQuestionFile(targetCategory, file as QuestionFile);
    } catch (fileError) {
      console.error("[POST /api/admin/questions] Error syncing to JSON:", fileError);
      // 即使JSON包同步失败，也继续执行（数据库已保存）
    }

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

