import { NextRequest } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";

/** S-4：排序白名单类型 */
type UserSortKey = "activatedAt" | "email" | "code";

/** S-4：严格白名单 */
const SORT_WHITELIST = new Set<UserSortKey>(["activatedAt", "email", "code"]);

/** S-4：列映射（返回合规列名字符串） */
function mapSort(
  key: UserSortKey
): "a.activated_at" | "a.email" | "a.activation_code" {
  switch (key) {
    case "email":
      return "a.email";
    case "code":
      return "a.activation_code";
    case "activatedAt":
    default:
      return "a.activated_at";
  }
}

/**
 * GET /api/admin/users
 * query:
 *  - email?: string (不区分大小写模糊)
 *  - code?:  string (不区分大小写模糊)
 *  - page?:  number (default 1)
 *  - limit?: number (default 20, max 100)
 *  - sortBy?: 'activatedAt' | 'email' | 'code' (default 'activatedAt')
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
    const sortKey: UserSortKey = (sortBy as UserSortKey) || "activatedAt";
    if (!SORT_WHITELIST.has(sortKey)) {
      return badRequest("Invalid sortBy");
    }
    const sortColumn = mapSort(sortKey);
    const sortOrder: "asc" | "desc" = order === "asc" ? "asc" : "desc";

    // ====== K-6/K-5：计数查询独立构造 + 大小写不敏感匹配用 SQL 模板（K-5.b）======
    let countQ = db
      .selectFrom("activations as a")
      .leftJoin("activation_codes as c", "c.code", "a.activation_code")
      .select((eb) => eb.fn.countAll<number>().as("count"));

    if (email) {
      const pat = "%" + email + "%";
      countQ = countQ.where(
        sql<boolean>`LOWER(${sql.ref("a.email")}) LIKE LOWER(${pat})`
      );
    }
    if (code) {
      const pat = "%" + code + "%";
      countQ = countQ.where(
        sql<boolean>`LOWER(${sql.ref("a.activation_code")}) LIKE LOWER(${pat})`
      );
    }

    const countRow = await countQ.executeTakeFirst();
    const total = Number(countRow?.count ?? 0);

    // ====== 主查询（与计数相同过滤）======
    let q = db
      .selectFrom("activations as a")
      .leftJoin("activation_codes as c", "c.code", "a.activation_code")
      .select([
        "a.id as id",
        "a.email as email",
        "a.activation_code as activation_code",
        "a.activated_at as activated_at",
        "a.ip_address as ip_address",
        "a.user_agent as user_agent",
        "c.status as code_status",
        "c.expires_at as code_expires_at",
        "c.validity_period as validity_period",
        "c.validity_unit as validity_unit",
        "c.activation_started_at as activation_started_at",
      ]);

    if (email) {
      const pat = "%" + email + "%";
      q = q.where(
        sql<boolean>`LOWER(${sql.ref("a.email")}) LIKE LOWER(${pat})`
      );
    }
    if (code) {
      const pat = "%" + code + "%";
      q = q.where(
        sql<boolean>`LOWER(${sql.ref("a.activation_code")}) LIKE LOWER(${pat})`
      );
    }

    // K-7：排序列名必须白名单映射；offset/limit 明确
    q = q.orderBy(sortColumn, sortOrder).limit(safeLimit).offset(offset);

    const rows = await q.execute();

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

    const data = rows.map((r: any) => ({
      id: r.id,
      email: r.email,
      activationCode: r.activation_code,
      activatedAt: r.activated_at
        ? new Date(r.activated_at).toISOString()
        : null,
      codeStatus: r.code_status ?? null,
      codeExpiresAt: calculateActualExpiresAt(
        r.code_expires_at,
        r.activation_started_at,
        r.validity_period,
        r.validity_unit
      ),
      ipAddress: r.ip_address ?? null,
      userAgent: r.user_agent ?? null,
    }));

    // P-5：与当前库保持一致（位置参数版）
    const meta = getPaginationMeta(safePage, safeLimit, total);
    return success(data, meta);
  } catch (err: any) {
    return internalError(err?.message || "Internal Server Error");
  }
});
