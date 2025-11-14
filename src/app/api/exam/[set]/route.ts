/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 */
export const dynamic = "force-dynamic";
export const revalidate = 60; // 缓存60秒
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { PaginationMeta } from "@/types/db";
import { db } from "@/lib/db";
import { normalizeCorrectAnswer } from "@/lib/questionDb";

/**
 * 统一成功响应
 */
function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * 统一错误响应
 */
function err(errorCode: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, errorCode, message }, { status });
}

/**
 * 驾照类型白名单
 */
const LICENSE_TYPES = ["provisional", "regular", "foreign", "second", "reacquire"] as const;
type LicenseType = (typeof LICENSE_TYPES)[number];

/**
 * 排序字段白名单
 */
const SORT_BY_WHITELIST = ["id", "created_at"] as const;
type SortBy = (typeof SORT_BY_WHITELIST)[number];

/**
 * GET /api/exam/[set]
 * 获取题目列表（支持多驾照类型）
 * 
 * 查询参数:
 * - licenseType: 驾照类型（provisional/regular/学科講習）
 * - page: 页码（默认1）
 * - limit: 每页数量（默认50，最大100）
 * - sortBy: 排序字段（id/created_at）
 * - order: 排序方向（asc/desc，默认desc）
 * 
 * 响应体: { ok: true, data: [...], pagination: { page, limit, total, totalPages } }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ set: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const resolvedParams = await params;
    const setId = resolvedParams.set;

    // 参数校验
    const licenseType = searchParams.get("licenseType") || "provisional";
    if (!LICENSE_TYPES.includes(licenseType as LicenseType)) {
      return err("VALIDATION_FAILED", `无效的驾照类型，支持: ${LICENSE_TYPES.join(", ")}`, 400);
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    const sortBy = (searchParams.get("sortBy") || "id") as SortBy;
    if (!SORT_BY_WHITELIST.includes(sortBy)) {
      return err("VALIDATION_FAILED", `无效的排序字段，支持: ${SORT_BY_WHITELIST.join(", ")}`, 400);
    }

    const order = (searchParams.get("order") || "desc").toLowerCase();
    if (order !== "asc" && order !== "desc") {
      return err("VALIDATION_FAILED", "排序方向必须是 asc 或 desc", 400);
    }

    // 加载题目：优先从数据库读取，如果数据库没有，再从文件系统读取
    let allQuestions: any[] = [];
    
    // 步骤1：优先从数据库读取（根据category字段匹配setId）
    try {
      const dbQuestions = await db
        .selectFrom("questions")
        .selectAll()
        .where("category", "=", setId)
        .orderBy("id", "asc")
        .execute();

      if (dbQuestions.length > 0) {
        // 转换为前端格式
        allQuestions = dbQuestions.map((q) => {
          // 处理content字段：保持原格式（可能是字符串或多语言对象）
          let content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
          if (typeof q.content === "string") {
            content = q.content;
          } else {
            content = q.content || { zh: "" };
          }

          // 处理explanation字段：支持多语言对象或字符串
          let explanation: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined } | null = null;
          if (q.explanation) {
            if (typeof q.explanation === "string") {
              explanation = q.explanation;
            } else {
              explanation = q.explanation;
            }
          }

          return {
            id: q.id,
            type: q.type,
            content,
            options: Array.isArray(q.options) ? q.options : (q.options ? [q.options] : []),
            correctAnswer: normalizeCorrectAnswer(q.correct_answer, q.type),
            image: q.image || null,
            explanation,
            category: q.category || setId,
          };
        });
        
        console.log(`[Exam API] 从数据库读取到 ${allQuestions.length} 个题目 (category=${setId})`);
      }
    } catch (dbError) {
      console.error("[Exam API] 从数据库读取题目失败:", dbError);
      // 继续尝试从文件系统读取
    }
    
    // 步骤2：如果数据库没有找到题目，从文件系统读取（兼容旧逻辑）
    if (allQuestions.length === 0) {
      const questionsDir = path.join(process.cwd(), "src/data/questions/zh");
      const unifiedFilePath = path.join(questionsDir, "questions.json");
      
      // 优先尝试从统一的questions.json读取
      try {
        if (fs.existsSync(unifiedFilePath)) {
          const unifiedContent = fs.readFileSync(unifiedFilePath, "utf-8");
          const unifiedData = JSON.parse(unifiedContent);
          const allQuestionsFromUnified = Array.isArray(unifiedData) ? unifiedData : (unifiedData.questions || []);
          
          // 根据setId筛选题目（setId对应category字段）
          allQuestions = allQuestionsFromUnified.filter((q: any) => {
            return q.category === setId;
          });
        }
      } catch (unifiedError) {
        console.error("[Exam API] 读取统一文件失败:", unifiedError);
      }
      
      // 如果从统一文件读取但没有找到题目，尝试从指定文件读取（兼容旧逻辑）
      if (allQuestions.length === 0) {
        let fileName = setId;
        
        // 如果setId包含licenseType信息，直接使用；否则根据licenseType推断
        if (licenseType === "学科講習") {
          fileName = setId.startsWith("學科講習") ? setId : `學科講習-${setId}`;
        } else if (licenseType === "provisional") {
          fileName = setId.startsWith("仮免") ? setId : `仮免-${setId}`;
        } else if (licenseType === "regular") {
          fileName = setId.startsWith("免许") ? setId : `免许-${setId}`;
        }

        const filePath = path.join(questionsDir, `${fileName}.json`);
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          const questionData = JSON.parse(fileContent);
          allQuestions = questionData.questions || [];
        }
      }
      
      if (allQuestions.length > 0) {
        console.log(`[Exam API] 从文件系统读取到 ${allQuestions.length} 个题目 (setId=${setId})`);
      }
    }
    
    if (allQuestions.length === 0) {
      return err("NOT_FOUND", `题目集 ${setId} 不存在`, 404);
    }

    // 应用排序
    const sortedQuestions = [...allQuestions].sort((a, b) => {
      if (sortBy === "id") {
        const aId = a.id || 0;
        const bId = b.id || 0;
        return order === "asc" ? aId - bId : bId - aId;
      } else if (sortBy === "created_at") {
        // 如果没有created_at字段，使用id作为fallback
        const aId = a.id || 0;
        const bId = b.id || 0;
        return order === "asc" ? aId - bId : bId - aId;
      }
      return 0;
    });

    // 应用分页
    const total = sortedQuestions.length;
    const paginatedQuestions = sortedQuestions.slice(offset, offset + limit);

    // 格式化题目数据（确保字段与前台已用结构对齐）
    const formattedQuestions = paginatedQuestions.map((q: any) => {
      // 处理content字段：保持原格式（可能是字符串或多语言对象）
      let content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
      if (typeof q.content === "string") {
        content = q.content || "";
      } else {
        content = q.content || { zh: "" };
      }

      return {
        id: q.id,
        type: q.type || "single",
        content,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        image: q.image || null,
        explanation: q.explanation || null,
        category: q.category || null,
      };
    });

    // 开发环境下记录响应时间
    if (process.env.NODE_ENV === "development") {
      console.warn(`[Exam API] GET /api/exam/${setId} - ${formattedQuestions.length} questions returned`);
    }

    // 返回带分页信息的响应
    return NextResponse.json(
      {
        ok: true,
        data: formattedQuestions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("[Exam API] GET error:", error);
    
    // 处理文件读取错误
    if (error instanceof Error && error.message.includes("ENOENT")) {
      return err("NOT_FOUND", "题目文件不存在", 404);
    }
    
    // 处理JSON解析错误
    if (error instanceof SyntaxError) {
      return err("INVALID_DATA", "题目文件格式错误", 500);
    }
    
    return err("INTERNAL_ERROR", "服务器内部错误", 500);
  }
}

