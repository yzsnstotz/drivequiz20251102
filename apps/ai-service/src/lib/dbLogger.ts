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

// Logger import removed for performance

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
 * 检查是否为有效的 UUID 格式
 */
function isValidUuid(str: string | null | undefined): boolean {
  if (!str || typeof str !== "string") return false;
  // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * 规范化 user_id：如果是 "anonymous" 或无效 UUID，则返回 null
 * 注意：如果传入的是 null，直接返回 null（匿名用户）
 * 
 * 注意：对于非 UUID 格式的 ID（如匿名 ID），我们不保存到数据库，
 * 但会在日志中记录原始 userId 用于追踪
 * 
 * 例外：允许 "act-{activationId}" 格式的用户ID（激活系统使用）
 */
function normalizeUserId(userId: string | null | undefined): string | null {
  if (!userId || userId === null) return null;
  // 如果是 "anonymous" 字符串，直接返回 null
  if (userId === "anonymous") return null;
  // 如果是匿名 ID 格式（以 "anon-" 开头），返回 null
  if (userId.startsWith("anon-")) return null;
  // 允许激活系统使用的用户ID格式（act-{activationId}）
  if (userId.startsWith("act-")) {
    // 验证格式：act-{数字}
    // 注意：userId 可能是 "act-123" 格式（从 token 提取的 activationId）
    const parts = userId.split("-");
    if (parts.length >= 2 && parts[0] === "act") {
      // 取最后一部分作为 activationId（处理可能的格式：act-{activationId} 或 act-{hash}-{activationId}）
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
  // 验证是否为有效的 UUID 格式
  if (!isValidUuid(userId)) {
    // 如果不是 UUID，返回 null（但会在日志中记录原始值用于追踪）
    return null;
  }
  return userId;
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
      // Silent failure
    }
  }
}

// 向后兼容：保留旧函数名
export const insertAiLog = logAiInteraction;
export const insertAiLogsBatch = logAiInteractionsBatch;
