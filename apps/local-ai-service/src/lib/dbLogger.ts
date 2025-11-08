// apps/local-ai-service/src/lib/dbLogger.ts
/**
 * ZALEM · Local AI-Service
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
  sources?: any; // JSONB 字段，存储来源信息数组
};

/**
 * 检查是否为有效的 UUID 格式
 */
function isValidUuid(str: string | null | undefined): boolean {
  if (!str || typeof str !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * 规范化 user_id（只保存有效的 UUID 或激活用户ID）
 * - 如果是有效的 UUID，直接返回
 * - 如果是 act- 格式的激活用户ID，直接返回（数据库已支持 TEXT 类型）
 * - 其他格式返回 null（匿名用户）
 * 
 * 注意：数据库表 user_id 字段已改为 TEXT 类型，支持多种格式
 */
function normalizeUserId(userId: string | null | undefined): string | null {
  if (!userId || typeof userId !== "string") {
    return null;
  }

  // 如果是 "anonymous" 字符串，直接返回 null
  if (userId === "anonymous") {
    return null;
  }

  // 如果是匿名 ID 格式（以 "anon-" 开头），返回 null
  if (userId.startsWith("anon-")) {
    return null;
  }

  // 如果是有效的 UUID，直接返回
  if (isValidUuid(userId)) {
    return userId;
  }

  // 如果是 act- 格式，验证格式后直接返回（数据库已支持 TEXT 类型）
  if (userId.startsWith("act-")) {
    // 验证格式：act-{数字}
    const parts = userId.split("-");
    if (parts.length >= 2 && parts[0] === "act") {
      // 取最后一部分作为 activationId
      const activationIdStr = parts[parts.length - 1];
      const activationId = parseInt(activationIdStr, 10);
      if (!isNaN(activationId) && activationId > 0) {
        // 有效的激活用户ID，统一格式为 act-{activationId}
        const normalizedActUserId = `act-${activationId}`;
        return normalizedActUserId;
      }
    }
    // 如果格式不正确，返回 null
    return null;
  }

  // 其他格式返回null（匿名用户）
  return null;
}

/**
 * 向 Supabase 的 ai_logs 表插入记录（统一入口：logAiInteraction）。
 * 若环境变量缺失或请求失败，则仅打印警告。
 */
export async function logAiInteraction(log: AiLogRecord): Promise<void> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return;
  }

  // 规范化 user_id（只保存有效的 UUID 或激活用户ID）
  const normalizedUserId = normalizeUserId(log.userId);
  
  const payload = [
    {
      user_id: normalizedUserId,
      question: log.question,
      answer: log.answer,
      locale: log.lang ?? null, // 数据库表中的字段名是 locale，不是 language
      model: log.model,
      rag_hits: log.ragHits,
      safety_flag: log.safetyFlag,
      cost_est: log.costEstUsd ?? null,
      created_at: log.createdAtIso ?? new Date().toISOString(),
      sources: log.sources ? JSON.stringify(log.sources) : null, // JSONB 字段
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
      // Silent failure
    }
  } catch (e) {
    // Silent failure
  }
}

