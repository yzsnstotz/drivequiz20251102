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
  getUnifiedVersionContent,
} from "@/lib/questionDb";
import { getContentText } from "@/lib/questionContentUtils";
import fs from "fs/promises";
import path from "path";

// 题目数据类型
export type QuestionType = "single" | "multiple" | "truefalse";

export interface Question {
  id: number;
  type: QuestionType;
  content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined }; // 支持单语言字符串或多语言对象
  options?: string[];
  correctAnswer: string | string[];
  image?: string;
  explanation?: string;
  category?: string; // 卷类,如 "仮免-1", "免许-1" 等
  hash?: string; // 题目hash
  license_tags?: string[]; // 驾照类型标签
  stage_tag?: "both" | "provisional" | "regular"; // 阶段标签
  topic_tags?: string[]; // 主题标签数组
}

export interface QuestionFile {
  questions: Question[];
  version?: string;
  aiAnswers?: Record<string, string>;
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
      version: data.version,
      aiAnswers: data.aiAnswers || {},
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
async function collectAllQuestions(): Promise<(Question & { content_hash?: string })[]> {
  try {
    // 直接从数据库读取所有题目（包含 content_hash）
    const allDbQuestions = await db
      .selectFrom("questions")
      .selectAll()
      .orderBy("id", "asc")
      .execute();

    console.log(`[collectAllQuestions] 从数据库读取到 ${allDbQuestions.length} 个题目`);

    // 转换为前端格式（保留 content_hash）
    const allQuestions = allDbQuestions.map((q) => {
      // 从license_types数组中获取category（取第一个，如果没有则使用"其他"）
      const category = q.category || 
        (Array.isArray(q.license_types) && q.license_types.length > 0
          ? q.license_types[0]
          : "其他");

      // 处理content字段：保持原格式（可能是字符串或多语言对象）
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
        category,
        content_hash: q.content_hash, // 保留 content_hash 字段
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
    const locale = (query.get("locale") || "zh").trim();

    // 收集所有题目
    let allQuestions: Question[] = [];
    // 保存JSON包的aiAnswers对象（当数据源为JSON包时使用）
    let jsonPackageAiAnswers: Record<string, string> | null = null;
    let jsonPackageAiAnswersByLocale: Record<string, Record<string, string>> | null = null;
    let jsonPackageQuestionsByLocale: Record<string, Question[]> | null = null;
    
    // 如果指定了文件系统源（格式：filesystem:filename）
    if (source && source.startsWith("filesystem:")) {
      const filename = source.replace("filesystem:", "");
      console.log(`[GET /api/admin/questions] 从文件系统读取: ${filename}, locale=${locale || "zh"}, category=${category || "全部"}`);
      
      try {
        const filePath = path.join(QUESTIONS_DIR, filename);
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        
        // 兼容多种格式
        let questions: Question[] = [];
        if (Array.isArray(data)) {
          questions = data;
        } else {
          questions = data.questions || [];
        }
        
        // 如果指定了locale且存在多语言包，优先使用多语言包
        const targetLocale = locale || "zh";
        if (data.questionsByLocale && data.questionsByLocale[targetLocale]) {
          questions = data.questionsByLocale[targetLocale] as Question[];
          console.log(`[GET /api/admin/questions] 使用多语言包 ${targetLocale}，题目数: ${questions.length}`);
        } else {
          // 如果没有多语言包，但题目中的content/explanation可能是多语言对象，需要本地化处理
          if (targetLocale !== "zh") {
            // 对于非中文语言，尝试从多语言对象中提取对应语言
            questions = questions.map((q) => {
              const localized: Question = { ...q };
              
              // 检查是否是占位符的辅助函数
              const isPlaceholder = (value: string | undefined): boolean => {
                return value !== undefined && typeof value === 'string' && 
                  (value.trim().startsWith('[EN]') || value.trim().startsWith('[JA]'));
              };
              
              // 处理content字段
              if (typeof q.content === "object" && q.content !== null) {
                const contentObj = q.content as { [key: string]: string | undefined };
                const targetValue = contentObj[targetLocale];
                // 如果目标语言的值存在且不是占位符，使用它；否则保留原始多语言对象
                if (targetValue && !isPlaceholder(targetValue)) {
                  localized.content = targetValue;
                } else {
                  // 没有翻译，保留原始多语言对象
                  localized.content = q.content;
                }
              } else {
                // 如果content是字符串，保留原始值
                localized.content = q.content;
              }
              
              // 处理explanation字段（如果也是多语言对象）
              if (q.explanation && typeof q.explanation === "object" && q.explanation !== null) {
                const expObj = q.explanation as { [key: string]: string | undefined };
                const targetValue = expObj[targetLocale];
                // 如果目标语言的值存在且不是占位符，使用它；否则设为undefined
                if (targetValue && !isPlaceholder(targetValue)) {
                  localized.explanation = targetValue;
                } else {
                  // 没有翻译，设为undefined（因为explanation是可选的）
                  localized.explanation = undefined;
                }
              } else if (q.explanation) {
                // 如果explanation是字符串，保留原始值
                localized.explanation = q.explanation;
              }
              
              return localized;
            });
            console.log(`[GET /api/admin/questions] 已本地化处理题目内容到 ${targetLocale}`);
          }
        }
        
        // 如果指定了category筛选，在语言切换后进行筛选
        if (category) {
          const beforeFilter = questions.length;
          questions = questions.filter((q) => q.category === category);
          console.log(`[GET /api/admin/questions] 按category筛选: ${category}，筛选前: ${beforeFilter}，筛选后: ${questions.length}`);
        }
        
        allQuestions = questions;
        
        // 保存JSON包的aiAnswers对象
        jsonPackageAiAnswers = data.aiAnswers || {};
        jsonPackageAiAnswersByLocale = data.aiAnswersByLocale || null;
        jsonPackageQuestionsByLocale = data.questionsByLocale || null;
        
        console.log(`[GET /api/admin/questions] 从文件系统读取 ${filename}，最终题目数: ${allQuestions.length}`);
      } catch (fileError) {
        console.error(`[GET /api/admin/questions] 从文件系统读取失败:`, fileError);
        allQuestions = [];
      }
    }
    // 如果指定了版本号（历史JSON包），从数据库读取历史版本内容
    else if (source && source !== "database") {
      // source是版本号，从数据库读取历史版本内容
      try {
        const versionContent = await getUnifiedVersionContent(source);
        if (versionContent && versionContent.questions && versionContent.questions.length > 0) {
          console.log(`[GET /api/admin/questions] 从数据库读取历史版本 ${source}，题目数: ${versionContent.questions.length}`);
          
          // 保存JSON包的aiAnswers对象
          jsonPackageAiAnswers = versionContent.aiAnswers || {};
          console.log(`[GET /api/admin/questions] 保存JSON包的aiAnswers，共 ${Object.keys(jsonPackageAiAnswers).length} 个AI回答`);
          // 尝试读取多语言字段（如果存在）
          jsonPackageAiAnswersByLocale = (versionContent as any).aiAnswersByLocale || null;
          jsonPackageQuestionsByLocale = (versionContent as any).questionsByLocale || null;
          
          // 处理语言切换：优先使用多语言包
          const targetLocale = locale || "zh";
          let base = versionContent.questions as Question[];
          if (jsonPackageQuestionsByLocale && jsonPackageQuestionsByLocale[targetLocale]) {
            base = jsonPackageQuestionsByLocale[targetLocale] as Question[];
            console.log(`[GET /api/admin/questions] 使用多语言包 ${targetLocale}，题目数: ${base.length}`);
          } else if (targetLocale !== "zh") {
            // 如果没有多语言包，但题目中的content/explanation可能是多语言对象，需要本地化处理
            base = base.map((q) => {
              const localized: Question = { ...q };
              
              // 检查是否是占位符的辅助函数
              const isPlaceholder = (value: string | undefined): boolean => {
                return value !== undefined && typeof value === 'string' && 
                  (value.trim().startsWith('[EN]') || value.trim().startsWith('[JA]'));
              };
              
              // 处理content字段
              if (typeof q.content === "object" && q.content !== null) {
                const contentObj = q.content as { [key: string]: string | undefined };
                const targetValue = contentObj[targetLocale];
                // 如果目标语言的值存在且不是占位符，使用它；否则保留原始多语言对象
                if (targetValue && !isPlaceholder(targetValue)) {
                  localized.content = targetValue;
                } else {
                  // 没有翻译，保留原始多语言对象
                  localized.content = q.content;
                }
              } else {
                // 如果content是字符串，保留原始值
                localized.content = q.content;
              }
              
              // 处理explanation字段
              if (q.explanation && typeof q.explanation === "object" && q.explanation !== null) {
                const expObj = q.explanation as { [key: string]: string | undefined };
                const targetValue = expObj[targetLocale];
                // 如果目标语言的值存在且不是占位符，使用它；否则设为undefined
                if (targetValue && !isPlaceholder(targetValue)) {
                  localized.explanation = targetValue;
                } else {
                  // 没有翻译，设为undefined（因为explanation是可选的）
                  localized.explanation = undefined;
                }
              } else if (q.explanation) {
                // 如果explanation是字符串，保留原始值
                localized.explanation = q.explanation;
              }
              
              return localized;
            });
            console.log(`[GET /api/admin/questions] 已本地化处理题目内容到 ${targetLocale}`);
          }
          
          // 如果指定了category筛选，在语言切换后进行筛选
          if (category) {
            const beforeFilter = base.length;
            base = base.filter((q) => q.category === category);
            console.log(`[GET /api/admin/questions] 按category筛选: ${category}，筛选前: ${beforeFilter}，筛选后: ${base.length}`);
          }
          
          allQuestions.push(...base);
        } else {
          console.warn(`[GET /api/admin/questions] 数据库中没有找到版本 ${source} 的内容`);
          // 如果数据库中没有找到，返回空结果
          allQuestions = [];
        }
      } catch (dbError) {
        console.error(`[GET /api/admin/questions] 从数据库读取历史版本失败:`, dbError);
        // 发生错误时，返回空结果
        allQuestions = [];
      }
      
      console.log(`[GET /api/admin/questions] 从历史版本读取后，总题目数: ${allQuestions.length}`);
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
              .map((q) => {
                // 处理content字段：保持原格式
                let content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
                if (typeof q.content === "string") {
                  content = q.content;
                } else {
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
                  category: q.category || category,
                  content_hash: q.content_hash, // 保留 content_hash 字段
                };
              });
            
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

    // 多语言替换（当数据源为数据库时，对题目内容进行本地化）
    // 直接从 questions 表的 JSON 字段中提取对应语言（不再使用 question_translations 表）
    if ((source === "database" || !source) && locale && locale !== "zh") {
      try {
        // 检查是否是占位符的辅助函数
        const isPlaceholder = (value: string | undefined): boolean => {
          return value !== undefined && typeof value === 'string' && 
            (value.trim().startsWith('[EN]') || value.trim().startsWith('[JA]'));
        };
        
        allQuestions = allQuestions.map((q) => {
          const localized: Question = { ...q };
          
          // 处理content字段：从多语言对象中提取对应语言
          if (typeof q.content === "object" && q.content !== null) {
            const contentObj = q.content as { [key: string]: string | undefined };
            const targetValue = contentObj[locale];
            // 如果目标语言的值存在且不是占位符，使用它；否则保留原始多语言对象
            if (targetValue && !isPlaceholder(targetValue)) {
              localized.content = targetValue;
            } else {
              // 没有翻译，保留原始多语言对象
              localized.content = q.content;
            }
          } else {
            // 如果content是字符串，保留原始值
            localized.content = q.content;
          }
          
          // 处理explanation字段：从多语言对象中提取对应语言
          if (q.explanation && typeof q.explanation === "object" && q.explanation !== null) {
            const expObj = q.explanation as { [key: string]: string | undefined };
            const targetValue = expObj[locale];
            // 如果目标语言的值存在且不是占位符，使用它；否则设为undefined
            if (targetValue && !isPlaceholder(targetValue)) {
              localized.explanation = targetValue;
            } else {
              // 没有翻译，设为undefined（因为explanation是可选的）
              localized.explanation = undefined;
            }
          } else if (q.explanation) {
            // 如果explanation是字符串，保留原始值
            localized.explanation = q.explanation;
          }
          
          return localized;
        });
      } catch (e) {
        console.error(`[GET /api/admin/questions] 本地化替换失败(locale=${locale})`, e);
      }
    }

    // 内容搜索
    if (search) {
      const searchLower = search.toLowerCase();
      allQuestions = allQuestions.filter((q) => {
        // 搜索题目内容、选项、解释
        // 处理多语言content字段
        let contentText = '';
        if (typeof q.content === 'string') {
          contentText = q.content.toLowerCase();
        } else if (q.content && typeof q.content === 'object') {
          // 多语言对象，使用指定语言或中文
          const targetLang = locale && locale !== 'zh' ? locale : 'zh';
          contentText = (q.content[targetLang] || q.content.zh || '').toLowerCase();
        }
        const contentMatch = contentText.includes(searchLower);
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
        // 处理多语言content字段
        aVal = getContentText(a.content, locale as any) || "";
        bVal = getContentText(b.content, locale as any) || "";
      } else if (sortBy === "category") {
        aVal = a.category || "";
        bVal = b.category || "";
      } else if (sortBy === "type") {
        // 类型排序：single < multiple < truefalse
        const typeOrder = { single: 1, multiple: 2, truefalse: 3 };
        aVal = typeOrder[a.type as keyof typeof typeOrder] || 0;
        bVal = typeOrder[b.type as keyof typeof typeOrder] || 0;
      } else if (sortBy === "created_at") {
        // 时间排序
        aVal = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
        bVal = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
      } else if (sortBy === "updated_at") {
        // 时间排序
        aVal = (a as any).updated_at ? new Date((a as any).updated_at).getTime() : 0;
        bVal = (b as any).updated_at ? new Date((b as any).updated_at).getTime() : 0;
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
    let questionsWithHashAndAI: any[];
    let cacheCount = 0; // 缓存计数（匹配成功的数量）

    if (source === "database" || !source) {
      // 当数据源为数据库时，只从 question_ai_answers 表查询
      console.log(`[GET /api/admin/questions] 数据源为数据库，从 question_ai_answers 表批量查询 AI 回答`);
      
      // 收集所有题目的 content_hash（从数据库读取的题目应该已经有 content_hash）
      const questionHashes = paginatedQuestions.map((q) => {
        // 优先使用数据库中的 content_hash，如果没有则计算
        return (q as any).content_hash || (q as any).hash || calculateQuestionHash(q);
      });

      // 批量查询 question_ai_answers 表
      // 注意：同时查询 "zh" 和 "zh-CN" 格式，因为历史数据可能使用不同的格式
      const aiAnswersMap = new Map<string, string>();
      if (questionHashes.length > 0) {
        try {
          const aiAnswers = await db
            .selectFrom("question_ai_answers")
            .select(["question_hash", "answer", "created_at", "locale"])
            .where("question_hash", "in", questionHashes)
            .where("locale", "=", locale)
            .orderBy("question_hash", "asc")
            .orderBy("created_at", "desc")
            .execute();

          // 构建映射（每个 question_hash 只保留最新的回答）
          // 由于已经按 question_hash 和 created_at 排序，第一个出现的记录就是最新的
          for (const aiAnswer of aiAnswers) {
            if (!aiAnswersMap.has(aiAnswer.question_hash) && aiAnswer.answer) {
              aiAnswersMap.set(aiAnswer.question_hash, aiAnswer.answer);
              cacheCount++; // 每有一条匹配，计数+1
            }
          }
        } catch (error) {
          console.error(`[GET /api/admin/questions] 批量查询 question_ai_answers 失败:`, error);
        }
      }

      // 将 AI 回答附加到题目上
      questionsWithHashAndAI = paginatedQuestions.map((q) => {
        const questionHash = (q as any).content_hash || (q as any).hash || calculateQuestionHash(q);
        const aiAnswer = aiAnswersMap.get(questionHash) || null;
        
        return {
          ...q,
          aiAnswer: aiAnswer || undefined,
        };
      });

      console.log(`[GET /api/admin/questions] 数据库查询完成，匹配到 ${cacheCount} 条 AI 回答`);
    } else {
      // 当数据源为 JSON 包时，只从该JSON包的aiAnswers对象中读取
      console.log(`[GET /api/admin/questions] 数据源为JSON包，从JSON包的aiAnswers对象读取AI回答`);
      
      questionsWithHashAndAI = paginatedQuestions.map((q) => {
        const questionHash = (q as any).hash || calculateQuestionHash(q);
        
        // 只从该JSON包的aiAnswers对象中读取
        let aiAnswer: string | null = null;
        if (locale && jsonPackageAiAnswersByLocale && jsonPackageAiAnswersByLocale[locale]) {
          aiAnswer = jsonPackageAiAnswersByLocale[locale][questionHash] || null;
        } else if (jsonPackageAiAnswers) {
          aiAnswer = jsonPackageAiAnswers[questionHash] || null; // 兼容旧字段
        }
        
        return {
          ...q,
          aiAnswer: aiAnswer || undefined,
        };
      });
      
      const matchedCount = questionsWithHashAndAI.filter((q) => q.aiAnswer).length;
      console.log(`[GET /api/admin/questions] JSON包查询完成，匹配到 ${matchedCount} 条 AI 回答（共 ${Object.keys(jsonPackageAiAnswers || {}).length} 个AI回答）`);
    }

    const pagination = getPaginationMeta(page, limit, total);

    // 当数据源为数据库时，在响应中添加缓存计数（供"计算统计"功能使用）
    if (source === "database" || !source) {
      // 将 cacheCount 添加到 pagination 对象中，以便前端可以访问
      (pagination as any).cacheCount = cacheCount;
    }

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
        content: getContentText(content).substring(0, 50),
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

