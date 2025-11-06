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

// ============================================================
// 文件路径: src/app/api/admin/activation-codes/route.ts
// 功能: 激活码管理 API - 查询 & 批量生成
// 规范: Zalem 后台管理接口规范 v1.0 + TypeScript 类型安全增强版
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";
import {
  validateActivationCodeCreate,
  parseISODate,
  VALID_STATUSES,
  ActivationStatus,
} from "@/app/api/_lib/validators";
import { logCreate } from "@/app/api/_lib/operationLog";
import { db } from "@/lib/db";
import { sql } from "kysely";

// ------------------------------------------------------------
// 工具：行数据 snake_case → camelCase，并统一时间为 ISO8601
// ------------------------------------------------------------
type RawRow = {
  id: number;
  code: string;
  usage_limit: number | null;
  used_count: number;
  status: ActivationStatus;
  expires_at: Date | string | null;
  enabled_at: Date | string | null;
  notes: string | null;
  validity_period: number | null;
  validity_unit: "day" | "month" | "year" | null;
  activation_started_at: Date | string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

type CamelRow = {
  id: number;
  code: string;
  usageLimit: number | null;
  usedCount: number;
  status: ActivationStatus;
  expiresAt: string | null; // ISO8601 (计算后的到期时间)
  enabledAt: string | null; // ISO8601
  notes: string | null;
  validityPeriod: number | null; // 有效期周期
  validityUnit: "day" | "month" | "year" | null; // 有效期单位
  activationStartedAt: string | null; // ISO8601 (用户激活账户的时间)
  createdAt?: string | null; // ISO8601
  updatedAt?: string | null; // ISO8601
};

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  try {
    if (v instanceof Date) return v.toISOString();
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// 计算实际到期时间（基于激活开始时间和有效期）
function calculateExpiresAt(
  activationStartedAt: Date | string | null,
  validityPeriod: number | null,
  validityUnit: "day" | "month" | "year" | null
): Date | null {
  if (!activationStartedAt || !validityPeriod || !validityUnit) {
    return null;
  }

  const startDate = activationStartedAt instanceof Date
    ? activationStartedAt
    : new Date(activationStartedAt);

  if (isNaN(startDate.getTime())) {
    return null;
  }

  const result = new Date(startDate);

  switch (validityUnit) {
    case "day":
      result.setDate(result.getDate() + validityPeriod);
      break;
    case "month":
      result.setMonth(result.getMonth() + validityPeriod);
      break;
    case "year":
      result.setFullYear(result.getFullYear() + validityPeriod);
      break;
    default:
      return null;
  }

  return result;
}

function mapRow(r: RawRow): CamelRow {
  // 如果已激活，计算实际到期时间
  let actualExpiresAt = toISO(r.expires_at);
  if (r.activation_started_at && r.validity_period && r.validity_unit) {
    const calculated = calculateExpiresAt(
      r.activation_started_at,
      r.validity_period,
      r.validity_unit
    );
    if (calculated) {
      actualExpiresAt = toISO(calculated);
    }
  }

  return {
    id: r.id,
    code: r.code,
    usageLimit: r.usage_limit,
    usedCount: r.used_count,
    status: r.status,
    expiresAt: actualExpiresAt,
    enabledAt: toISO(r.enabled_at),
    notes: r.notes ?? null,
    validityPeriod: r.validity_period,
    validityUnit: r.validity_unit,
    activationStartedAt: toISO(r.activation_started_at),
    createdAt: toISO(r.created_at),
    updatedAt: toISO(r.updated_at),
  };
}

// ------------------------------------------------------------
// 排序白名单映射（仅允许以下字段）
// 前端传入 camelCase → 数据库列名
// ------------------------------------------------------------
const SORT_MAP: Record<
  string,
  { column: keyof RawRow | "created_at" | "enabled_at" | "expires_at" | "used_count" | "usage_limit" | "status" }
> = {
  createdAt: { column: "created_at" },
  enabledAt: { column: "enabled_at" },
  expiresAt: { column: "expires_at" },
  usedCount: { column: "used_count" },
  usageLimit: { column: "usage_limit" },
  status: { column: "status" },
};

// ============================================================
// GET /api/admin/activation-codes
// 查询激活码列表（分页、筛选、排序）
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const query = req.nextUrl.searchParams;
    const { page, limit, offset, sortBy, order } = parsePagination(query);

    const status = query.get("status");
    const code = query.get("code");
    const expiresBefore = parseISODate(query.get("expiresBefore"));
    const expiresAfter = parseISODate(query.get("expiresAfter"));

    // 排序白名单校验
    const sortKey = sortBy || "createdAt";
    const sortDef = SORT_MAP[sortKey];
    if (!sortDef) {
      return badRequest("Invalid sortBy");
    }

    // 基础查询（避免嵌套 where）
    let baseQ = db.selectFrom("activation_codes");

    if (status && VALID_STATUSES.includes(status as ActivationStatus)) {
      baseQ = baseQ.where("status", "=", status as ActivationStatus);
    }

    if (code) {
      // 大小写敏感 LIKE，符合 K-5 禁止 ILIKE 的规范
      baseQ = baseQ.where("code", "like", `%${code}%`);
    }

    if (expiresBefore) {
      baseQ = baseQ.where(
        "expires_at",
        "<",
        sql<Date>`${expiresBefore.toISOString()}::timestamp`
      );
    }

    if (expiresAfter) {
      baseQ = baseQ.where(
        "expires_at",
        ">",
        sql<Date>`${expiresAfter.toISOString()}::timestamp`
      );
    }

    // 计数查询
    const totalRow = await baseQ
      .select(({ fn }) => fn.count<number>("id").as("count"))
      .executeTakeFirst();
    const total = totalRow ? Number(totalRow.count) : 0;

    // 列表查询（选择全部列 + 排序 + 分页）
    const rows = await baseQ
      .selectAll()
      .orderBy(sortDef.column as any, order)
      .limit(limit)
      .offset(offset)
      .execute();

    const data = rows.map(mapRow);
    const pagination = getPaginationMeta(page, limit, total);

    return success(data, pagination);
  } catch (err: any) {
    console.error("[GET /api/admin/activation-codes] Error:", err);
    return internalError("Failed to fetch activation codes");
  }
});

// ============================================================
// POST /api/admin/activation-codes
// 批量生成激活码
// ============================================================
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const payload = validateActivationCodeCreate(body);

    const codes: { code: string }[] = [];
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    for (let i = 0; i < payload.count; i++) {
      let code = "";
      for (let j = 0; j < 6; j++) {
        code += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      codes.push({ code });
    }

    const now = new Date().toISOString();

    const inserted = await db
      .insertInto("activation_codes")
      .values(
        codes.map((c) => ({
          code: c.code,
          usage_limit: payload.usageLimit,
          used_count: 0,
          status: payload.status,
          expires_at: null, // 初始为 null，用户激活后计算
          enabled_at: null,
          notes: payload.notes ?? null,
          validity_period: payload.validityPeriod,
          validity_unit: payload.validityUnit,
          activation_started_at: null, // 初始为 null，用户激活后设置
          created_at: sql`${now}::timestamp`,
          updated_at: sql`${now}::timestamp`,
        }))
      )
      .returningAll()
      .execute();

    // 记录操作日志（批量创建）
    for (const record of inserted) {
      await logCreate(
        req,
        "activation_codes",
        record.id,
        record,
        `批量创建激活码: ${record.code}`
      );
    }

    const data = inserted.map(mapRow);
    return success(data);
  } catch (err: any) {
    console.error("[POST /activation-codes] Error:", err);
    if (err && err.ok === false) return err;
    return badRequest("Failed to create activation codes");
  }
});
