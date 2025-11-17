// ============================================================
// 文件路径: src/app/api/admin/ai/providers/[id]/route.ts
// 功能: AI Provider 配置单个操作 API（PATCH, DELETE）
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { aiDb } from "@/lib/aiDb";

// 响应工具函数
const success = (data: any) => NextResponse.json({ ok: true, data });
const badRequest = (message: string) =>
  NextResponse.json({ ok: false, errorCode: "BAD_REQUEST", message }, { status: 400 });
const notFound = (message: string) =>
  NextResponse.json({ ok: false, errorCode: "NOT_FOUND", message }, { status: 404 });
const internalError = (message: string) =>
  NextResponse.json({ ok: false, errorCode: "INTERNAL_ERROR", message }, { status: 500 });

/**
 * PATCH /api/admin/ai/providers/[id]
 * 更新 Provider 配置
 * Body: {
 *   isEnabled?: boolean,
 *   dailyLimit?: number | null,
 *   priority?: number,
 *   isLocalFallback?: boolean
 * }
 */
export const PATCH = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const id = Number(params.id);
    if (isNaN(id)) {
      return badRequest("Invalid id");
    }

    const body = await req.json();

    // 检查配置是否存在
    const existing = await (aiDb as any)
      .selectFrom("ai_provider_config")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!existing) {
      return notFound("Provider config not found");
    }

    // 构建更新对象
    const updates: any = {
      updated_at: new Date(),
    };

    if (body.isEnabled !== undefined) {
      updates.is_enabled = Boolean(body.isEnabled);
    }

    if (body.dailyLimit !== undefined) {
      if (body.dailyLimit === null || body.dailyLimit === "") {
        updates.daily_limit = null;
      } else {
        const limit = Number(body.dailyLimit);
        if (isNaN(limit) || limit < 0) {
          return badRequest("dailyLimit must be a non-negative number or null");
        }
        updates.daily_limit = limit === 0 ? null : limit;
      }
    }

    if (body.priority !== undefined) {
      const priority = Number(body.priority);
      if (isNaN(priority) || priority < 0 || priority > 1000) {
        return badRequest("priority must be a number between 0 and 1000");
      }
      updates.priority = priority;
    }

    if (body.isLocalFallback !== undefined) {
      const isLocalFallback = Boolean(body.isLocalFallback);
      
      // 如果要设置为 true，检查是否已有其他记录
      if (isLocalFallback) {
        const otherFallback = await (aiDb as any)
          .selectFrom("ai_provider_config")
          .select(["id"])
          .where("is_local_fallback", "=", true)
          .where("id", "!=", id)
          .executeTakeFirst();

        if (otherFallback) {
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
      
      updates.is_local_fallback = isLocalFallback;
    }

    // 执行更新
    const result = await (aiDb as any)
      .updateTable("ai_provider_config")
      .set(updates)
      .where("id", "=", id)
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
    console.error("[PATCH /api/admin/ai/providers/[id]] Error:", err);
    return internalError(err instanceof Error ? err.message : "Unexpected error");
  }
});

/**
 * DELETE /api/admin/ai/providers/[id]
 * 删除 Provider 配置
 */
export const DELETE = withAdminAuth(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const id = Number(params.id);
    if (isNaN(id)) {
      return badRequest("Invalid id");
    }

    // 检查配置是否存在
    const existing = await (aiDb as any)
      .selectFrom("ai_provider_config")
      .select(["id"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!existing) {
      return notFound("Provider config not found");
    }

    // 执行删除
    await (aiDb as any)
      .deleteFrom("ai_provider_config")
      .where("id", "=", id)
      .execute();

    return success({ message: "Provider config deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/admin/ai/providers/[id]] Error:", err);
    return internalError(err instanceof Error ? err.message : "Unexpected error");
  }
});

