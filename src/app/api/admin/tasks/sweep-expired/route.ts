/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 * 原因: 本文件使用了 request.headers / nextUrl.searchParams 等动态上下文
 * 修复策略: 强制动态渲染 + 禁用缓存 + Node.js 运行时
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError, badRequest } from "@/app/api/_lib/errors";

/**
 * POST /api/admin/tasks/sweep-expired
 * 功能：批量将已过期但未标记为 expired 的激活码置为 expired
 * 规则：
 *  - expires_at < NOW()
 *  - status 非 'expired'（且不改动 'used'）
 * 可选参数：
 *  - mode=dry （仅返回将被影响的数量，不执行更新）
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;
    const mode = (sp.get("mode") || "").trim().toLowerCase();

    if (mode && mode !== "dry") {
      return badRequest("Invalid mode");
    }

    // 计算当前时刻（以数据库时区为准；部署要求 TZ=UTC）
    // 选择条件：
    //   - expires_at 非空 且 早于 NOW()
    //   - status 不为 'expired'
    //   - 为安全起见，不修改 'used'（即便过期）
    const whereExpired = sql<boolean>`
      ${sql.ref("activation_codes.expires_at")} IS NOT NULL
      AND ${sql.ref("activation_codes.expires_at")} < NOW()
      AND ${sql.ref("activation_codes.status")} IS DISTINCT FROM 'expired'
      AND ${sql.ref("activation_codes.status")} IS DISTINCT FROM 'used'
    `;

    if (mode === "dry") {
      // 仅统计将受影响的数量
      const row = await db
        .selectFrom("activation_codes")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where(whereExpired)
        .executeTakeFirst();

      const total = Number(row?.count ?? 0);
      return success({
        dryRun: true,
        willAffect: total,
        at: new Date().toISOString(),
      });
    }

    // 执行更新并返回受影响数量（使用 returning 计算长度）
    const updatedRows = await db
      .updateTable("activation_codes")
      .set({
        status: sql`'expired'`,
        // 可选：记录 notes 追加信息（若有 notes 字段）
        // notes: sql`COALESCE(notes, '') || ' [auto-expired at ' || NOW() || ']'`,
      })
      .where(whereExpired)
      .returning(["code"])
      .execute();

    const affected = Array.isArray(updatedRows) ? updatedRows.length : 0;

    return success({
      updated: affected,
      at: new Date().toISOString(),
    });
  } catch (err: any) {
    return internalError(err?.message || "Internal Server Error");
  }
});
