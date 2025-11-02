/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 * 原因: 本文件使用了 request.headers / nextUrl.searchParams 等动态上下文
 * 修复策略: 强制动态渲染 + 禁用缓存 + Node.js 运行时
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

// ============================================================
// 文件路径: src/app/api/admin/activation-codes/[id]/route.ts
// 功能: 激活码详情查询 (GET)、编辑 (PUT) 与删除 (DELETE)
// 规范: Zalem 后台管理接口规范 v1.0 第 4.3, 4.4 节
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import {
  success,
  badRequest,
  notFound,
  conflict,
  invalidState,
  internalError,
} from "@/app/api/_lib/errors";
import { parseISODate, VALID_STATUSES, ActivationStatus } from "@/app/api/_lib/validators";
import { logUpdate, logDelete } from "@/app/api/_lib/operationLog";
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

// ============================================================
// GET /api/admin/activation-codes/:id
// 查询单个激活码详情
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return badRequest("Invalid ID parameter");

    const row = await db
      .selectFrom("activation_codes")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) return notFound("Activation code not found");

    const data = mapRow(row as unknown as RawRow);
    return success(data);
  } catch (err: any) {
    console.error("[GET /activation-codes/:id] Error:", err);
    if (err.ok === false) return err;
    return internalError("Failed to fetch activation code");
  }
});

// ============================================================
// PUT /api/admin/activation-codes/:id
// 编辑激活码
// ============================================================

export const PUT = withAdminAuth(async (req: NextRequest, { params }: any) => {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return badRequest("Invalid ID parameter");

    const body = await req.json();
    const { usageLimit, status, expiresAt, notes } = body;

    // 校验输入
    if (
      usageLimit === undefined &&
      status === undefined &&
      expiresAt === undefined &&
      notes === undefined
    ) {
      return badRequest("At least one field must be provided");
    }

    // 检查激活码是否存在
    const existing = await db
      .selectFrom("activation_codes")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!existing) return notFound("Activation code not found");

    // 校验状态流转是否合法
    if (status && existing.status === "expired" && status !== "expired") {
      return invalidState("Cannot revert from 'expired' to another status");
    }

    if (status && !VALID_STATUSES.includes(status as ActivationStatus)) {
      return badRequest("Invalid status value");
    }

    // 准备更新数据
    const updates: Record<string, any> = {};
    if (usageLimit !== undefined) updates.usage_limit = Number(usageLimit);
    if (status !== undefined)
      updates.status = status as ActivationStatus;
    if (expiresAt !== undefined)
      updates.expires_at = parseISODate(expiresAt);
    if (notes !== undefined) updates.notes = notes;

    updates.updated_at = sql`NOW()`;

    const updated = await db
      .updateTable("activation_codes")
      .set(updates)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    // 记录操作日志
    if (updated) {
      await logUpdate(
        req,
        "activation_codes",
        id,
        existing,
        updated,
        `更新激活码: ${updated.code}`
      );
    }

    return success(updated);
  } catch (err: any) {
    console.error("[PUT /activation-codes/:id] Error:", err);
    if (err.ok === false) return err;
    return internalError("Failed to update activation code");
  }
});

// ============================================================
// DELETE /api/admin/activation-codes/:id
// 删除激活码
// ============================================================

export const DELETE = withAdminAuth(async (req: NextRequest, { params }: any) => {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return badRequest("Invalid ID parameter");

    const code = await db
      .selectFrom("activation_codes")
      .select(["id", "used_count"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!code) return notFound("Activation code not found");

    // 禁止删除已使用的激活码
    if (code.used_count > 0) {
      return conflict("Cannot delete an already used activation code");
    }

    // 获取完整的激活码信息用于日志记录
    const fullCode = await db
      .selectFrom("activation_codes")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    const deleted = await db
      .deleteFrom("activation_codes")
      .where("id", "=", id)
      .executeTakeFirst();

    // 记录操作日志
    if (fullCode && deleted) {
      await logDelete(
        req,
        "activation_codes",
        id,
        fullCode,
        `删除激活码: ${fullCode.code}`
      );
    }

    return success({ deleted: deleted ? 1 : 0 });
  } catch (err: any) {
    console.error("[DELETE /activation-codes/:id] Error:", err);
    if (err.ok === false) return err;
    return internalError("Failed to delete activation code");
  }
});
