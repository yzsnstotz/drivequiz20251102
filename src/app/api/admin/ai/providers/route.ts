// ============================================================
// 文件路径: src/app/api/admin/ai/providers/route.ts
// 功能: AI Provider 配置管理 API
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { aiDb } from "@/lib/aiDb";
import { sql } from "kysely";

// 响应工具函数
const success = (data: any) => NextResponse.json({ ok: true, data });
const badRequest = (message: string) =>
  NextResponse.json({ ok: false, errorCode: "BAD_REQUEST", message }, { status: 400 });
const internalError = (message: string) =>
  NextResponse.json({ ok: false, errorCode: "INTERNAL_ERROR", message }, { status: 500 });

// Provider 配置行类型
type ProviderConfigRow = {
  id: number;
  provider: string;
  model: string | null;
  is_enabled: boolean;
  daily_limit: number | null;
  priority: number;
  is_local_fallback: boolean;
  created_at: Date;
  updated_at: Date;
};

// 返回给前端的格式（包含今日已用次数）
type ProviderConfigWithUsage = {
  id: number;
  provider: string;
  model: string | null;
  isEnabled: boolean;
  dailyLimit: number | null;
  todayUsed: number;
  priority: number;
  isLocalFallback: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * GET /api/admin/ai/providers
 * 获取所有 Provider 配置（包含今日已用次数）
 */
export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
    // 获取 UTC 日期字符串
    const today = new Date().toISOString().slice(0, 10);

    // 查询所有 Provider 配置
    const configs = await (aiDb as any)
      .selectFrom("ai_provider_config")
      .selectAll()
      .orderBy("priority", "asc")
      .orderBy("provider", "asc")
      .execute() as ProviderConfigRow[];

    // 查询今日统计（按 provider 和 model 聚合）
    // 注意：如果配置的 model 为 null，则统计所有该 provider 的调用（model 为 null 的记录）
    const stats = await (aiDb as any)
      .selectFrom("ai_provider_daily_stats")
      .select([
        "provider",
        "model",
        sql<number>`COALESCE(SUM(total_calls), 0)`.as("total_calls"),
      ])
      .where("stat_date", "=", today)
      .groupBy("provider")
      .groupBy("model")
      .execute() as Array<{ provider: string; model: string | null; total_calls: number }>;

    // 构建统计映射：provider + model -> total_calls
    const statsMap = new Map<string, number>();
    for (const stat of stats) {
      const key = `${stat.provider}:${stat.model || ""}`;
      statsMap.set(key, Number(stat.total_calls));
    }

    // 合并配置和统计
    const result: ProviderConfigWithUsage[] = configs.map((config) => {
      const key = `${config.provider}:${config.model || ""}`;
      const todayUsed = statsMap.get(key) || 0;

      return {
        id: config.id,
        provider: config.provider,
        model: config.model,
        isEnabled: config.is_enabled,
        dailyLimit: config.daily_limit,
        todayUsed,
        priority: config.priority,
        isLocalFallback: config.is_local_fallback,
        createdAt: config.created_at.toISOString(),
        updatedAt: config.updated_at.toISOString(),
      };
    });

    return success(result);
  } catch (err) {
    console.error("[GET /api/admin/ai/providers] Error:", err);
    return internalError(err instanceof Error ? err.message : "Unexpected error");
  }
});

/**
 * POST /api/admin/ai/providers
 * 创建新的 Provider 配置
 * Body: {
 *   provider: string,
 *   model?: string | null,
 *   isEnabled?: boolean,
 *   dailyLimit?: number | null,
 *   priority?: number,
 *   isLocalFallback?: boolean
 * }
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();

    // 校验必填字段
    if (!body.provider || typeof body.provider !== "string") {
      return badRequest("provider is required and must be a string");
    }

    // 校验 provider 值
    const validProviders = [
      "openai",
      "openai_direct",
      "gemini_direct",
      "openrouter",
      "openrouter_direct",
      "local",
      "ollama",
    ];
    if (!validProviders.includes(body.provider)) {
      return badRequest(
        `provider must be one of: ${validProviders.join(", ")}`
      );
    }

    // 校验 priority
    const priority = body.priority !== undefined ? Number(body.priority) : 100;
    if (isNaN(priority) || priority < 0 || priority > 1000) {
      return badRequest("priority must be a number between 0 and 1000");
    }

    // 校验 dailyLimit
    let dailyLimit: number | null = null;
    if (body.dailyLimit !== undefined && body.dailyLimit !== null) {
      const limit = Number(body.dailyLimit);
      if (isNaN(limit) || limit < 0) {
        return badRequest("dailyLimit must be a non-negative number or null");
      }
      dailyLimit = limit === 0 ? null : limit;
    }

    // 校验 isLocalFallback
    const isLocalFallback = Boolean(body.isLocalFallback);
    if (isLocalFallback) {
      // 检查是否已有其他 is_local_fallback = true 的记录
      const existingFallback = await (aiDb as any)
        .selectFrom("ai_provider_config")
        .select(["id"])
        .where("is_local_fallback", "=", true)
        .executeTakeFirst();

      if (existingFallback) {
        return NextResponse.json(
          { 
            ok: false, 
            errorCode: "ONLY_ONE_LOCAL_FALLBACK_ALLOWED", 
            message: "Only one local fallback provider is allowed" 
          },
          { status: 400 }
        );
      }
    }

    // 检查是否已存在相同的 provider + model 组合
    const existing = await (aiDb as any)
      .selectFrom("ai_provider_config")
      .select(["id"])
      .where("provider", "=", body.provider)
      .where("model", "=", body.model || null)
      .executeTakeFirst();

    if (existing) {
      return badRequest(
        `Provider config with provider="${body.provider}" and model="${body.model || "null"}" already exists`
      );
    }

    // 插入新配置
    const result = await (aiDb as any)
      .insertInto("ai_provider_config")
      .values({
        provider: body.provider,
        model: body.model || null,
        is_enabled: body.isEnabled !== undefined ? Boolean(body.isEnabled) : true,
        daily_limit: dailyLimit,
        priority,
        is_local_fallback: isLocalFallback,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirst();

    return success({
      id: result.id,
      provider: result.provider,
      model: result.model,
      isEnabled: result.is_enabled,
      dailyLimit: result.daily_limit,
      priority: result.priority,
      isLocalFallback: result.is_local_fallback,
      createdAt: result.created_at.toISOString(),
      updatedAt: result.updated_at.toISOString(),
    });
  } catch (err) {
    console.error("[POST /api/admin/ai/providers] Error:", err);
    return internalError(err instanceof Error ? err.message : "Unexpected error");
  }
});

