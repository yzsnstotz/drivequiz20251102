// apps/ai-service/src/lib/dbLogger.ts
/**
 * ZALEM · AI-Service
 * Database Logger Utility
 *
 * 功能：
 *  - 提供统一的 ai_logs 写入封装
 *  - 支持使用 Supabase REST API（服务端安全模式）
 *  - 调用失败仅告警，不阻断主业务
 *  - 自动补充 created_at 时间与字段规范化（snake_case）
 *
 * 依赖环境变量：
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_KEY
 *
 * 使用：
 *   import { logAiInteraction } from "../lib/dbLogger";
 *   await logAiInteraction({ userId, question, answer, lang: "ja", model, ragHits, safetyFlag: "ok", costEstUsd });
 */

import { defaultLogger } from "./logger.js";

export type AiLogRecord = {
  userId?: string | null;
  question: string;
  answer: string;
  lang?: string | null; // 存 zh/ja/en
  model: string;
  ragHits: number;
  safetyFlag: "ok" | "needs_human" | "blocked";
  costEstUsd?: number | null;
  createdAtIso?: string;
};

/**
 * 向 Supabase 的 ai_logs 表插入记录（统一入口：logAiInteraction）。
 * 若环境变量缺失或请求失败，则仅打印警告。
 */
export async function logAiInteraction(log: AiLogRecord): Promise<void> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    defaultLogger.warn("skip ai_logs insert: missing SUPABASE env", {
      missingUrl: !SUPABASE_URL,
      missingKey: !SUPABASE_SERVICE_KEY,
    });
    return;
  }

  const payload = [
    {
      user_id: log.userId ?? null,
      question: log.question,
      answer: log.answer,
      locale: log.lang ?? null, // 数据库表中的字段名是 locale，不是 language
      model: log.model,
      rag_hits: log.ragHits,
      safety_flag: log.safetyFlag,
      cost_est: log.costEstUsd ?? null,
      created_at: log.createdAtIso ?? new Date().toISOString(),
    },
  ];

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ai_logs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      defaultLogger.warn("ai_logs insert non-2xx", { status: res.status, text });
    }
  } catch (e) {
    defaultLogger.warn("ai_logs insert failed", { error: (e as Error).message });
  }
}

/**
 * 批量写入（不阻断，自动分批）
 * - 默认分批大小：50
 * - 对每一批独立发送请求
 */
export async function logAiInteractionsBatch(
  records: AiLogRecord[],
  batchSize = 50,
): Promise<void> {
  if (!records || records.length === 0) return;

  const groups: AiLogRecord[][] = [];
  for (let i = 0; i < records.length; i += batchSize) {
    groups.push(records.slice(i, i + batchSize));
  }

  for (const group of groups) {
    try {
      await Promise.all(group.map((r) => logAiInteraction(r)));
    } catch (e) {
      defaultLogger.warn("logAiInteractionsBatch group failed", {
        error: (e as Error).message,
      });
    }
  }
}

// 向后兼容：保留旧函数名
export const insertAiLog = logAiInteraction;
export const insertAiLogsBatch = logAiInteractionsBatch;
