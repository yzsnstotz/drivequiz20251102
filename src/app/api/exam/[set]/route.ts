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

    // 加载题目文件
    // 根据licenseType和setId确定文件路径
    const questionsDir = path.join(process.cwd(), "src/data/questions/zh");
    
    // 文件名映射：根据setId和licenseType确定实际文件名
    let fileName = setId;
    
    // 如果setId包含licenseType信息，直接使用；否则根据licenseType推断
    if (licenseType === "学科講習") {
      // 学科講習的题目文件命名规则
      fileName = setId.startsWith("學科講習") ? setId : `學科講習-${setId}`;
    } else if (licenseType === "provisional") {
      // 仮免许的题目文件命名规则
      fileName = setId.startsWith("仮免") ? setId : `仮免-${setId}`;
    } else if (licenseType === "regular") {
      // 正式免许的题目文件命名规则
      fileName = setId.startsWith("免许") ? setId : `免许-${setId}`;
    }

    const filePath = path.join(questionsDir, `${fileName}.json`);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return err("NOT_FOUND", `题目集 ${setId} 不存在`, 404);
    }

    // 读取并解析JSON文件
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const questionData = JSON.parse(fileContent);
    const allQuestions = questionData.questions || [];

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
    const formattedQuestions = paginatedQuestions.map((q: any) => ({
      id: q.id,
      type: q.type || "single",
      content: q.content || "",
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      image: q.image || null,
      explanation: q.explanation || null,
      category: q.category || null,
    }));

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

