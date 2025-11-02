// ============================================================
// 文件路径: src/app/api/admin/activation-codes/stats/route.ts
// 功能: 激活码统计信息接口
// 规范: Zalem 后台管理接口规范 v1.0 第 4.5 节
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { sql } from "kysely";

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
    // 1) 总数
    const totalRow = await db
      .selectFrom("activation_codes")
      .select(({ fn }) => fn.count("id").as("total"))
      .executeTakeFirst();

    const total = totalRow ? Number((totalRow as any).total) : 0;

    // 2) 按状态分布
    const statusRows = await db
      .selectFrom("activation_codes")
      .select(["status"])
      .select(({ fn }) => fn.count("id").as("count"))
      .groupBy("status")
      .execute();

    // 3) 使用情况（used / unused）
    // used: used_count > 0
    const usedRow = await db
      .selectFrom("activation_codes")
      .select((eb) => [
        sql<number>`SUM(CASE WHEN used_count > 0 THEN 1 ELSE 0 END)`.as("used"),
      ])
      .executeTakeFirst();

    const used = usedRow ? Number((usedRow as any).used ?? 0) : 0;
    const unused = Math.max(total - used, 0);

    // 将状态分布组装为对象（确保缺省状态=0）
    const dist = {
      enabled: 0,
      disabled: 0,
      expired: 0,
      suspended: 0,
    } as Record<"enabled" | "disabled" | "expired" | "suspended", number>;

    for (const r of statusRows) {
      const s = (r as any).status as keyof typeof dist;
      const c = Number((r as any).count ?? 0);
      if (s in dist) dist[s] = c;
    }

    // usageRate
    const usageRate = total > 0 ? used / total : 0;

    // 返回符合前端期望的嵌套结构
    const data = {
      total,
      byStatus: {
        enabled: dist.enabled,
        disabled: dist.disabled,
        expired: dist.expired,
        suspended: dist.suspended,
      },
      usage: {
        used,
        unused,
        rate: usageRate,
      },
      generatedAt: new Date().toISOString(),
    };

    return success(data);
  } catch (err) {
    console.error("[GET /activation-codes/stats] Error:", err);
    return internalError("Failed to fetch activation code statistics");
  }
});
