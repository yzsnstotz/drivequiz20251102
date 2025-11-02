// ============================================================
// 文件路径: src/app/api/admin/activation-codes/stats/route.ts
// 功能: 激活码统计（总数 / 各状态分布 / 使用率）
// 规范: Zalem 后台管理接口规范 v1.0（鉴权 + { ok, data } + camelCase + ISO8601）
// ============================================================

import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { sql } from "kysely";

// GET /api/admin/activation-codes/stats
export const GET = withAdminAuth(async () => {
  try {
    // 统一一次查询完成：总数 / 各状态 / 已用次数
    // 使用 SUM(CASE WHEN ...) 计算分类计数，避免多次往返
    const row = await db
      .selectFrom("activation_codes as ac")
      .select((eb) => [
        eb.fn.countAll<number>().as("total"),
        // 各状态分布
        sql<number>`SUM(CASE WHEN ac.status = 'enabled'   THEN 1 ELSE 0 END)`.as(
          "enabled_count"
        ),
        sql<number>`SUM(CASE WHEN ac.status = 'disabled'  THEN 1 ELSE 0 END)`.as(
          "disabled_count"
        ),
        sql<number>`SUM(CASE WHEN ac.status = 'suspended' THEN 1 ELSE 0 END)`.as(
          "suspended_count"
        ),
        sql<number>`SUM(CASE WHEN ac.status = 'expired'   THEN 1 ELSE 0 END)`.as(
          "expired_count"
        ),
        // 使用情况
        sql<number>`SUM(CASE WHEN ac.used_count > 0 THEN 1 ELSE 0 END)`.as(
          "used_count"
        ),
      ])
      .executeTakeFirst();

    const total = Number(row?.total ?? 0);
    const byStatus = {
      enabled: Number((row as any)?.enabled_count ?? 0),
      disabled: Number((row as any)?.disabled_count ?? 0),
      suspended: Number((row as any)?.suspended_count ?? 0),
      expired: Number((row as any)?.expired_count ?? 0),
    };
    const used = Number((row as any)?.used_count ?? 0);
    const unused = Math.max(0, total - used);
    const usageRate = total > 0 ? used / total : 0;

    // 输出符合前端期望的 camelCase 结构
    const data = {
      total,
      byStatus,
      usage: {
        used,
        unused,
        rate: usageRate, // 0~1 小数；前端可格式化为百分比
      },
      generatedAt: new Date().toISOString(),
    };

    return success(data);
  } catch (err: any) {
    console.error("[GET /api/admin/activation-codes/stats] Error:", err);
    return internalError("Failed to fetch activation code stats");
  }
});
