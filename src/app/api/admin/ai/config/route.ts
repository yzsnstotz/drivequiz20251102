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
        "timeout_openai",
        "timeout_openai_direct",
        "timeout_openrouter",
        "timeout_openrouter_direct",
        "timeout_gemini",
        "timeout_gemini_direct",
        "timeout_local",
        "rate_limit_openai_max",
        "rate_limit_openai_time_window",
        "rate_limit_openai_direct_max",
        "rate_limit_openai_direct_time_window",
        "rate_limit_openrouter_max",
        "rate_limit_openrouter_time_window",
        "rate_limit_openrouter_direct_max",
        "rate_limit_openrouter_direct_time_window",
        "rate_limit_gemini_max",
        "rate_limit_gemini_time_window",
        "rate_limit_gemini_direct_max",
        "rate_limit_gemini_direct_time_window",
        "rate_limit_local_max",
        "rate_limit_local_time_window",
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
      aiProvider: config.aiProvider || "openai",
      timeoutOpenai: config.timeout_openai || "30000",
      timeoutOpenaiDirect: config.timeout_openai_direct || "30000",
      timeoutOpenrouter: config.timeout_openrouter || "30000",
      timeoutOpenrouterDirect: config.timeout_openrouter_direct || "30000",
      timeoutGemini: config.timeout_gemini || "30000",
      timeoutGeminiDirect: config.timeout_gemini_direct || "30000",
      timeoutLocal: config.timeout_local || "120000",
      rateLimitOpenaiMax: config.rate_limit_openai_max || "60",
      rateLimitOpenaiTimeWindow: config.rate_limit_openai_time_window || "60",
      rateLimitOpenaiDirectMax: config.rate_limit_openai_direct_max || "60",
      rateLimitOpenaiDirectTimeWindow: config.rate_limit_openai_direct_time_window || "60",
      rateLimitOpenrouterMax: config.rate_limit_openrouter_max || "60",
      rateLimitOpenrouterTimeWindow: config.rate_limit_openrouter_time_window || "60",
      rateLimitOpenrouterDirectMax: config.rate_limit_openrouter_direct_max || "60",
      rateLimitOpenrouterDirectTimeWindow: config.rate_limit_openrouter_direct_time_window || "60",
      rateLimitGeminiMax: config.rate_limit_gemini_max || "60",
      rateLimitGeminiTimeWindow: config.rate_limit_gemini_time_window || "60",
      rateLimitGeminiDirectMax: config.rate_limit_gemini_direct_max || "60",
      rateLimitGeminiDirectTimeWindow: config.rate_limit_gemini_direct_time_window || "60",
      rateLimitLocalMax: config.rate_limit_local_max || "120",
      rateLimitLocalTimeWindow: config.rate_limit_local_time_window || "60",
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
          aiProvider?: "openai" | "local" | "openrouter" | "openrouter_direct" | "openai_direct" | "gemini" | "gemini_direct" | "strategy";
          timeoutOpenai?: number;
          timeoutOpenaiDirect?: number;
          timeoutOpenrouter?: number;
          timeoutOpenrouterDirect?: number;
          timeoutGemini?: number;
          timeoutGeminiDirect?: number;
          timeoutLocal?: number;
          rateLimitOpenaiMax?: number;
          rateLimitOpenaiTimeWindow?: number;
          rateLimitOpenaiDirectMax?: number;
          rateLimitOpenaiDirectTimeWindow?: number;
          rateLimitOpenrouterMax?: number;
          rateLimitOpenrouterTimeWindow?: number;
          rateLimitOpenrouterDirectMax?: number;
          rateLimitOpenrouterDirectTimeWindow?: number;
          rateLimitGeminiMax?: number;
          rateLimitGeminiTimeWindow?: number;
          rateLimitGeminiDirectMax?: number;
          rateLimitGeminiDirectTimeWindow?: number;
          rateLimitLocalMax?: number;
          rateLimitLocalTimeWindow?: number;
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
      if (
        body.aiProvider !== "openai" &&
        body.aiProvider !== "local" &&
        body.aiProvider !== "openrouter" &&
        body.aiProvider !== "openrouter_direct" &&
        body.aiProvider !== "openai_direct" &&
        body.aiProvider !== "gemini" &&
        body.aiProvider !== "gemini_direct" &&
        body.aiProvider !== "strategy"
      ) {
        return badRequest("aiProvider must be either 'strategy', 'openai', 'local', 'openrouter', 'openrouter_direct', 'openai_direct', 'gemini', or 'gemini_direct'.");
      }
      updates.push({ key: "aiProvider", value: body.aiProvider });
    }

    // 处理超时配置
    if (body.timeoutOpenai !== undefined) {
      const timeout = Number(body.timeoutOpenai);
      if (isNaN(timeout) || timeout < 1000 || timeout > 600000) {
        return badRequest("timeoutOpenai must be a number between 1000 and 600000 (1秒到10分钟).");
      }
      updates.push({ key: "timeout_openai", value: String(timeout) });
    }

    if (body.timeoutOpenaiDirect !== undefined) {
      const timeout = Number(body.timeoutOpenaiDirect);
      if (isNaN(timeout) || timeout < 1000 || timeout > 600000) {
        return badRequest("timeoutOpenaiDirect must be a number between 1000 and 600000 (1秒到10分钟).");
      }
      updates.push({ key: "timeout_openai_direct", value: String(timeout) });
    }

    if (body.timeoutOpenrouter !== undefined) {
      const timeout = Number(body.timeoutOpenrouter);
      if (isNaN(timeout) || timeout < 1000 || timeout > 600000) {
        return badRequest("timeoutOpenrouter must be a number between 1000 and 600000 (1秒到10分钟).");
      }
      updates.push({ key: "timeout_openrouter", value: String(timeout) });
    }

    if (body.timeoutOpenrouterDirect !== undefined) {
      const timeout = Number(body.timeoutOpenrouterDirect);
      if (isNaN(timeout) || timeout < 1000 || timeout > 600000) {
        return badRequest("timeoutOpenrouterDirect must be a number between 1000 and 600000 (1秒到10分钟).");
      }
      updates.push({ key: "timeout_openrouter_direct", value: String(timeout) });
    }

    if (body.timeoutGemini !== undefined) {
      const timeout = Number(body.timeoutGemini);
      if (isNaN(timeout) || timeout < 1000 || timeout > 600000) {
        return badRequest("timeoutGemini must be a number between 1000 and 600000 (1秒到10分钟).");
      }
      updates.push({ key: "timeout_gemini", value: String(timeout) });
    }

    if (body.timeoutGeminiDirect !== undefined) {
      const timeout = Number(body.timeoutGeminiDirect);
      if (isNaN(timeout) || timeout < 1000 || timeout > 600000) {
        return badRequest("timeoutGeminiDirect must be a number between 1000 and 600000 (1秒到10分钟).");
      }
      updates.push({ key: "timeout_gemini_direct", value: String(timeout) });
    }

    if (body.timeoutLocal !== undefined) {
      const timeout = Number(body.timeoutLocal);
      if (isNaN(timeout) || timeout < 1000 || timeout > 600000) {
        return badRequest("timeoutLocal must be a number between 1000 and 600000 (1秒到10分钟).");
      }
      updates.push({ key: "timeout_local", value: String(timeout) });
    }

    // 处理频率限制配置
    if (body.rateLimitOpenaiMax !== undefined) {
      const max = Number(body.rateLimitOpenaiMax);
      if (isNaN(max) || max < 1 || max > 10000) {
        return badRequest("rateLimitOpenaiMax must be a number between 1 and 10000.");
      }
      updates.push({ key: "rate_limit_openai_max", value: String(max) });
    }

    if (body.rateLimitOpenaiTimeWindow !== undefined) {
      const timeWindow = Number(body.rateLimitOpenaiTimeWindow);
      if (isNaN(timeWindow) || timeWindow < 1 || timeWindow > 3600) {
        return badRequest("rateLimitOpenaiTimeWindow must be a number between 1 and 3600 (1秒到1小时).");
      }
      updates.push({ key: "rate_limit_openai_time_window", value: String(timeWindow) });
    }

    if (body.rateLimitOpenaiDirectMax !== undefined) {
      const max = Number(body.rateLimitOpenaiDirectMax);
      if (isNaN(max) || max < 1 || max > 10000) {
        return badRequest("rateLimitOpenaiDirectMax must be a number between 1 and 10000.");
      }
      updates.push({ key: "rate_limit_openai_direct_max", value: String(max) });
    }

    if (body.rateLimitOpenaiDirectTimeWindow !== undefined) {
      const timeWindow = Number(body.rateLimitOpenaiDirectTimeWindow);
      if (isNaN(timeWindow) || timeWindow < 1 || timeWindow > 3600) {
        return badRequest("rateLimitOpenaiDirectTimeWindow must be a number between 1 and 3600 (1秒到1小时).");
      }
      updates.push({ key: "rate_limit_openai_direct_time_window", value: String(timeWindow) });
    }

    if (body.rateLimitOpenrouterMax !== undefined) {
      const max = Number(body.rateLimitOpenrouterMax);
      if (isNaN(max) || max < 1 || max > 10000) {
        return badRequest("rateLimitOpenrouterMax must be a number between 1 and 10000.");
      }
      updates.push({ key: "rate_limit_openrouter_max", value: String(max) });
    }

    if (body.rateLimitOpenrouterTimeWindow !== undefined) {
      const timeWindow = Number(body.rateLimitOpenrouterTimeWindow);
      if (isNaN(timeWindow) || timeWindow < 1 || timeWindow > 3600) {
        return badRequest("rateLimitOpenrouterTimeWindow must be a number between 1 and 3600 (1秒到1小时).");
      }
      updates.push({ key: "rate_limit_openrouter_time_window", value: String(timeWindow) });
    }

    if (body.rateLimitOpenrouterDirectMax !== undefined) {
      const max = Number(body.rateLimitOpenrouterDirectMax);
      if (isNaN(max) || max < 1 || max > 10000) {
        return badRequest("rateLimitOpenrouterDirectMax must be a number between 1 and 10000.");
      }
      updates.push({ key: "rate_limit_openrouter_direct_max", value: String(max) });
    }

    if (body.rateLimitOpenrouterDirectTimeWindow !== undefined) {
      const timeWindow = Number(body.rateLimitOpenrouterDirectTimeWindow);
      if (isNaN(timeWindow) || timeWindow < 1 || timeWindow > 3600) {
        return badRequest("rateLimitOpenrouterDirectTimeWindow must be a number between 1 and 3600 (1秒到1小时).");
      }
      updates.push({ key: "rate_limit_openrouter_direct_time_window", value: String(timeWindow) });
    }

    if (body.rateLimitGeminiMax !== undefined) {
      const max = Number(body.rateLimitGeminiMax);
      if (isNaN(max) || max < 1 || max > 10000) {
        return badRequest("rateLimitGeminiMax must be a number between 1 and 10000.");
      }
      updates.push({ key: "rate_limit_gemini_max", value: String(max) });
    }

    if (body.rateLimitGeminiTimeWindow !== undefined) {
      const timeWindow = Number(body.rateLimitGeminiTimeWindow);
      if (isNaN(timeWindow) || timeWindow < 1 || timeWindow > 3600) {
        return badRequest("rateLimitGeminiTimeWindow must be a number between 1 and 3600 (1秒到1小时).");
      }
      updates.push({ key: "rate_limit_gemini_time_window", value: String(timeWindow) });
    }

    if (body.rateLimitGeminiDirectMax !== undefined) {
      const max = Number(body.rateLimitGeminiDirectMax);
      if (isNaN(max) || max < 1 || max > 10000) {
        return badRequest("rateLimitGeminiDirectMax must be a number between 1 and 10000.");
      }
      updates.push({ key: "rate_limit_gemini_direct_max", value: String(max) });
    }

    if (body.rateLimitGeminiDirectTimeWindow !== undefined) {
      const timeWindow = Number(body.rateLimitGeminiDirectTimeWindow);
      if (isNaN(timeWindow) || timeWindow < 1 || timeWindow > 3600) {
        return badRequest("rateLimitGeminiDirectTimeWindow must be a number between 1 and 3600 (1秒到1小时).");
      }
      updates.push({ key: "rate_limit_gemini_direct_time_window", value: String(timeWindow) });
    }

    if (body.rateLimitLocalMax !== undefined) {
      const max = Number(body.rateLimitLocalMax);
      if (isNaN(max) || max < 1 || max > 10000) {
        return badRequest("rateLimitLocalMax must be a number between 1 and 10000.");
      }
      updates.push({ key: "rate_limit_local_max", value: String(max) });
    }

    if (body.rateLimitLocalTimeWindow !== undefined) {
      const timeWindow = Number(body.rateLimitLocalTimeWindow);
      if (isNaN(timeWindow) || timeWindow < 1 || timeWindow > 3600) {
        return badRequest("rateLimitLocalTimeWindow must be a number between 1 and 3600 (1秒到1小时).");
      }
      updates.push({ key: "rate_limit_local_time_window", value: String(timeWindow) });
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
        "timeout_openai",
        "timeout_openai_direct",
        "timeout_openrouter",
        "timeout_openrouter_direct",
        "timeout_gemini",
        "timeout_gemini_direct",
        "timeout_local",
        "rate_limit_openai_max",
        "rate_limit_openai_time_window",
        "rate_limit_openai_direct_max",
        "rate_limit_openai_direct_time_window",
        "rate_limit_openrouter_max",
        "rate_limit_openrouter_time_window",
        "rate_limit_openrouter_direct_max",
        "rate_limit_openrouter_direct_time_window",
        "rate_limit_gemini_max",
        "rate_limit_gemini_time_window",
        "rate_limit_gemini_direct_max",
        "rate_limit_gemini_direct_time_window",
        "rate_limit_local_max",
        "rate_limit_local_time_window",
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
      aiProvider: configMap.aiProvider || "openai",
      timeoutOpenai: configMap.timeout_openai || "30000",
      timeoutOpenaiDirect: configMap.timeout_openai_direct || "30000",
      timeoutOpenrouter: configMap.timeout_openrouter || "30000",
      timeoutOpenrouterDirect: configMap.timeout_openrouter_direct || "30000",
      timeoutGemini: configMap.timeout_gemini || "30000",
      timeoutGeminiDirect: configMap.timeout_gemini_direct || "30000",
      timeoutLocal: configMap.timeout_local || "120000",
      rateLimitOpenaiMax: configMap.rate_limit_openai_max || "60",
      rateLimitOpenaiTimeWindow: configMap.rate_limit_openai_time_window || "60",
      rateLimitOpenaiDirectMax: configMap.rate_limit_openai_direct_max || "60",
      rateLimitOpenaiDirectTimeWindow: configMap.rate_limit_openai_direct_time_window || "60",
      rateLimitOpenrouterMax: configMap.rate_limit_openrouter_max || "60",
      rateLimitOpenrouterTimeWindow: configMap.rate_limit_openrouter_time_window || "60",
      rateLimitOpenrouterDirectMax: configMap.rate_limit_openrouter_direct_max || "60",
      rateLimitOpenrouterDirectTimeWindow: configMap.rate_limit_openrouter_direct_time_window || "60",
      rateLimitGeminiMax: configMap.rate_limit_gemini_max || "60",
      rateLimitGeminiTimeWindow: configMap.rate_limit_gemini_time_window || "60",
      rateLimitGeminiDirectMax: configMap.rate_limit_gemini_direct_max || "60",
      rateLimitGeminiDirectTimeWindow: configMap.rate_limit_gemini_direct_time_window || "60",
      rateLimitLocalMax: configMap.rate_limit_local_max || "120",
      rateLimitLocalTimeWindow: configMap.rate_limit_local_time_window || "60",
    };

    return success(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return internalError(msg);
  }
});

