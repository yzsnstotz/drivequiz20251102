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
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";

/** S-4：排序白名单类型 */
type UserSortKey = "createdAt" | "email" | "lastLoginAt";

/** S-4：严格白名单 */
const SORT_WHITELIST = new Set<UserSortKey>(["createdAt", "email", "lastLoginAt"]);

/** S-4：列映射（返回合规列名字符串） */
function mapSort(
  key: UserSortKey
): "u.created_at" | "u.email" | "u.last_login_at" {
  switch (key) {
    case "email":
      return "u.email";
    case "lastLoginAt":
      return "u.last_login_at";
    case "createdAt":
    default:
      return "u.created_at";
  }
}

/**
 * GET /api/admin/users
 * query:
 *  - email?: string (不区分大小写模糊)
 *  - code?:  string (不区分大小写模糊，匹配激活码)
 *  - page?:  number (default 1)
 *  - limit?: number (default 20, max 100)
 *  - sortBy?: 'createdAt' | 'email' | 'lastLoginAt' (default 'createdAt')
 *  - order?:  'asc' | 'desc' (default 'desc')
 */
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;

    const email = (sp.get("email") || "").trim();
    const code = (sp.get("code") || "").trim();

    // 兼容旧版分页库：此处仅取 page/limit/sortBy/order，offset 自行计算
    const { page, limit, sortBy, order } = (parsePagination(sp) as unknown) as {
      page?: number;
      limit?: number;
      sortBy?: string | null;
      order?: "asc" | "desc";
    };

    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 20;
    const offset = (safePage - 1) * safeLimit;

    // S-4：默认与校验
    const sortKey: UserSortKey = (sortBy as UserSortKey) || "createdAt";
    if (!SORT_WHITELIST.has(sortKey)) {
      return badRequest("Invalid sortBy");
    }
    const sortColumn = mapSort(sortKey);
    const sortOrder: "asc" | "desc" = order === "asc" ? "asc" : "desc";

    // ====== K-6/K-5：计数查询独立构造 + 大小写不敏感匹配用 SQL 模板（K-5.b）======
    let countQ = db
      .selectFrom("users as u")
      .leftJoin("activation_codes as c", "c.id", "u.activation_code_id")
      .select((eb) => eb.fn.countAll<number>().as("count"));

    if (email) {
      const pat = "%" + email + "%";
      countQ = countQ.where(
        sql<boolean>`LOWER(${sql.ref("u.email")}) LIKE LOWER(${pat})`
      );
    }
    if (code) {
      const pat = "%" + code + "%";
      countQ = countQ.where(
        sql<boolean>`LOWER(${sql.ref("c.code")}) LIKE LOWER(${pat})`
      );
    }

    const countRow = await countQ.executeTakeFirst();
    const total = Number(countRow?.count ?? 0);

    // ====== 主查询（与计数相同过滤）======
    let q = db
      .selectFrom("users as u")
      .leftJoin("activation_codes as c", "c.id", "u.activation_code_id")
      .select([
        "u.id as id",
        "u.userid as userid", // 添加userid字段
        "u.email as email",
        "u.name as name",
        "u.phone as phone",
        "u.status as status",
        "u.created_at as created_at",
        "u.updated_at as updated_at",
        "u.last_login_at as last_login_at",
        "c.code as activation_code",
        "c.status as code_status",
        "c.expires_at as code_expires_at",
        "c.validity_period as validity_period",
        "c.validity_unit as validity_unit",
        "c.activation_started_at as activation_started_at",
      ]);

    if (email) {
      const pat = "%" + email + "%";
      q = q.where(
        sql<boolean>`LOWER(${sql.ref("u.email")}) LIKE LOWER(${pat})`
      );
    }
    if (code) {
      const pat = "%" + code + "%";
      q = q.where(
        sql<boolean>`LOWER(${sql.ref("c.code")}) LIKE LOWER(${pat})`
      );
    }

    // K-7：排序列名必须白名单映射；offset/limit 明确
    q = q.orderBy(sortColumn, sortOrder).limit(safeLimit).offset(offset);

    const rows = await q.execute();

    // 获取每个用户的最近一次登录 IP 和 User Agent（优化：批量查询避免 N+1）
    const userIds = rows.map((r: any) => r.id).filter((id: number) => id);
    const lastLoginMap = new Map<number, any>();
    
    if (userIds.length > 0) {
      // 获取所有登录记录，在应用层按用户分组取最近一条
      const allLoginBehaviors = await db
        .selectFrom("user_behaviors")
        .select([
          "user_id",
          "ip_address",
          "user_agent",
          "client_type",
          "created_at",
        ])
        .where("behavior_type", "=", "login")
        .where("user_id", "in", userIds)
        .orderBy("created_at", "desc")
        .execute();

      // 按用户ID分组，取每个用户最近一条记录
      const userLatestMap = new Map<number, any>();
      for (const behavior of allLoginBehaviors) {
        if (!userLatestMap.has(behavior.user_id)) {
          userLatestMap.set(behavior.user_id, behavior);
        }
      }

      // 构建最终映射
      userLatestMap.forEach((behavior, userId) => {
        lastLoginMap.set(userId, behavior);
      });
    }

    // 计算实际到期时间的辅助函数
    const calculateActualExpiresAt = (
      expiresAt: Date | string | null,
      activationStartedAt: Date | string | null,
      validityPeriod: number | null,
      validityUnit: string | null
    ): string | null => {
      // 如果已激活且有效期为设置，基于激活开始时间计算
      if (activationStartedAt && validityPeriod && validityUnit) {
        const startDate = new Date(activationStartedAt);
        if (!isNaN(startDate.getTime())) {
          const calculated = new Date(startDate);
          switch (validityUnit) {
            case "day":
              calculated.setDate(calculated.getDate() + Number(validityPeriod));
              break;
            case "month":
              calculated.setMonth(calculated.getMonth() + Number(validityPeriod));
              break;
            case "year":
              calculated.setFullYear(calculated.getFullYear() + Number(validityPeriod));
              break;
          }
          return calculated.toISOString();
        }
      }
      // 兼容旧数据（固定到期时间）
      if (expiresAt) {
        return new Date(expiresAt).toISOString();
      }
      return null;
    };

    const data = rows.map((r: any) => {
      const lastLogin = lastLoginMap.get(r.id);
      return {
        id: r.id,
        userid: r.userid ?? null, // 添加userid字段
        email: r.email,
        name: r.name ?? null,
        phone: r.phone ?? null,
        status: r.status ?? null,
        createdAt: r.created_at
          ? new Date(r.created_at).toISOString()
          : null,
        updatedAt: r.updated_at
          ? new Date(r.updated_at).toISOString()
          : null,
        lastLoginAt: r.last_login_at
          ? new Date(r.last_login_at).toISOString()
          : null,
        activationCode: r.activation_code ?? null,
        codeStatus: r.code_status ?? null,
        codeExpiresAt: calculateActualExpiresAt(
          r.code_expires_at,
          r.activation_started_at,
          r.validity_period,
          r.validity_unit
        ),
        // 最近一次登录的 IP 和 User Agent
        ipAddress: lastLogin?.ip_address ?? null,
        userAgent: lastLogin?.user_agent ?? null,
        clientType: lastLogin?.client_type ?? null,
      };
    });

    // P-5：与当前库保持一致（位置参数版）
    const meta = getPaginationMeta(safePage, safeLimit, total);
    return success(data, meta);
  } catch (err: any) {
    return internalError(err?.message || "Internal Server Error");
  }
});
