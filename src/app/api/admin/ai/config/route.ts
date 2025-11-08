// apps/web/app/api/admin/ai/config/route.ts
/* 功能：AI 配置中心 - 读取和更新运营参数 */
import { NextRequest } from "next/server";
import { sql } from "kysely";
import { aiDb } from "@/lib/aiDb";
import { withAdminAuth, getAdminInfo } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { logUpdate } from "@/app/api/_lib/operationLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ConfigRow = {
  key: string;
  value: string;
  description: string | null;
  updated_by: number | null;
  updated_at: Date | string | null;
};

const getAiConfigSelect = () => (aiDb as any).selectFrom("ai_config");
const getAiConfigInsert = (trx: unknown) => (trx as any).insertInto("ai_config");
const getAiConfigUpdate = () => (aiDb as any).updateTable("ai_config");

/**
 * GET /api/admin/ai/config
 * 读取 AI 配置
 */
export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
    const rows = await getAiConfigSelect()
      .selectAll()
      .where("key", "in", [
        "dailyAskLimit",
        "answerCharLimit",
        "model",
        "cacheTtl",
        "costAlertUsdThreshold",
        "aiProvider",
      ])
      .execute() as ConfigRow[];

    // 转换为配置对象
    const config: Record<string, string> = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }

    // 确保所有字段都有默认值
    const result = {
      dailyAskLimit: config.dailyAskLimit || "10",
      answerCharLimit: config.answerCharLimit || "300",
      model: config.model || "gpt-4o-mini",
      cacheTtl: config.cacheTtl || "86400",
      costAlertUsdThreshold: config.costAlertUsdThreshold || "10.00",
      aiProvider: config.aiProvider || "online", // 默认使用在线AI
    };

    return success(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return internalError(msg);
  }
});

/**
 * PUT /api/admin/ai/config
 * 更新 AI 配置
 * Body: {
 *   dailyAskLimit?: number,
 *   answerCharLimit?: number,
 *   model?: string,
 *   cacheTtl?: number,
 *   costAlertUsdThreshold?: number
 * }
 */
export const PUT = withAdminAuth(async (req: NextRequest) => {
  try {
    const adminInfo = await getAdminInfo(req);
    if (!adminInfo) {
      return internalError("Failed to get admin info");
    }

    const body = (await req.json().catch(() => null)) as
      | {
          dailyAskLimit?: number;
          answerCharLimit?: number;
          model?: string;
          cacheTtl?: number;
          costAlertUsdThreshold?: number;
          aiProvider?: "online" | "local" | "openrouter" | "openrouter-direct";
        }
      | null;

    if (!body || typeof body !== "object") {
      return badRequest("Body must be an object.");
    }

    // 验证和准备更新数据
    const updates: Array<{ key: string; value: string }> = [];

    if (body.dailyAskLimit !== undefined) {
      const limit = Number(body.dailyAskLimit);
      if (isNaN(limit) || limit < 1 || limit > 10000) {
        return badRequest("dailyAskLimit must be a number between 1 and 10000.");
      }
      updates.push({ key: "dailyAskLimit", value: String(limit) });
    }

    if (body.answerCharLimit !== undefined) {
      const limit = Number(body.answerCharLimit);
      if (isNaN(limit) || limit < 10 || limit > 10000) {
        return badRequest("answerCharLimit must be a number between 10 and 10000.");
      }
      updates.push({ key: "answerCharLimit", value: String(limit) });
    }

    if (body.model !== undefined) {
      if (typeof body.model !== "string" || body.model.trim().length === 0) {
        return badRequest("model must be a non-empty string.");
      }
      updates.push({ key: "model", value: body.model.trim() });
    }

    if (body.cacheTtl !== undefined) {
      const ttl = Number(body.cacheTtl);
      if (isNaN(ttl) || ttl < 0 || ttl > 604800) {
        return badRequest("cacheTtl must be a number between 0 and 604800 (7 days).");
      }
      updates.push({ key: "cacheTtl", value: String(ttl) });
    }

    if (body.costAlertUsdThreshold !== undefined) {
      const threshold = Number(body.costAlertUsdThreshold);
      if (isNaN(threshold) || threshold < 0 || threshold > 100000) {
        return badRequest("costAlertUsdThreshold must be a number between 0 and 100000.");
      }
      updates.push({ key: "costAlertUsdThreshold", value: threshold.toFixed(2) });
    }

    if (body.aiProvider !== undefined) {
      if (body.aiProvider !== "online" && body.aiProvider !== "local" && body.aiProvider !== "openrouter" && body.aiProvider !== "openrouter-direct") {
        return badRequest("aiProvider must be either 'online', 'local', 'openrouter', or 'openrouter-direct'.");
      }
      updates.push({ key: "aiProvider", value: body.aiProvider });
    }

    if (updates.length === 0) {
      return badRequest("At least one config field must be provided.");
    }

    // 获取旧配置值
    const oldConfigRows = await getAiConfigSelect()
      .selectAll()
      .where("key", "in", updates.map((u) => u.key))
      .execute() as ConfigRow[];

    const oldConfigMap: Record<string, string> = {};
    for (const row of oldConfigRows) {
      oldConfigMap[row.key] = row.value;
    }

    // 在事务中更新所有配置
    await aiDb.transaction().execute(async (trx) => {
      for (const update of updates) {
        await getAiConfigInsert(trx)
          .values({
            key: update.key,
            value: update.value,
            updated_by: adminInfo.id,
            updated_at: sql`NOW()`,
          })
          .onConflict((oc: any) =>
            oc.column("key").doUpdateSet({
              value: sql`excluded.value`,
              updated_by: adminInfo.id,
              updated_at: sql`NOW()`,
            }),
          )
          .execute();
      }
    });

    // 记录操作日志
    const newConfigMap: Record<string, string> = {};
    for (const update of updates) {
      newConfigMap[update.key] = update.value;
      await logUpdate(
        req,
        "ai_config",
        null, // config 表没有 record_id，使用 null
        { [update.key]: oldConfigMap[update.key] || null },
        { [update.key]: update.value },
        `AI config ${update.key} updated`
      );
    }

    // 返回所有配置（与 GET 端点一致）
    const configRows = await getAiConfigSelect()
      .selectAll()
      .where("key", "in", [
        "dailyAskLimit",
        "answerCharLimit",
        "model",
        "cacheTtl",
        "costAlertUsdThreshold",
        "aiProvider",
      ])
      .execute() as ConfigRow[];

    const configMap: Record<string, string> = {};
    for (const row of configRows) {
      configMap[row.key] = row.value;
    }

    const result = {
      dailyAskLimit: configMap.dailyAskLimit || "10",
      answerCharLimit: configMap.answerCharLimit || "300",
      model: configMap.model || "gpt-4o-mini",
      cacheTtl: configMap.cacheTtl || "86400",
      costAlertUsdThreshold: configMap.costAlertUsdThreshold || "10.00",
      aiProvider: configMap.aiProvider || "online",
    };

    return success(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return internalError(msg);
  }
});

