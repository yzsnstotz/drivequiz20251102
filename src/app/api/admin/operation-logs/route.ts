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
// 文件路径: src/app/api/admin/operation-logs/route.ts
// 功能: 操作日志查询 API
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";
import { db } from "@/lib/db";

// ------------------------------------------------------------
// 敏感字段脱敏（与 operationLog.ts 中的定义保持一致）
// ------------------------------------------------------------
const SENSITIVE_FIELDS = ["token", "password", "pwd", "secret", "key"];

/**
 * 脱敏敏感字段的值
 * 完全隐藏内容和长度，统一使用固定格式
 */
function maskSensitiveValue(value: string): string {
  if (!value || typeof value !== "string") return "***";
  // 完全隐藏内容和长度，统一使用固定格式，不泄露任何信息
  return "••••••••••";
}

/**
 * 递归脱敏对象中的敏感字段（双重保护，确保API返回时再次脱敏）
 */
function sanitizeSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeSensitiveData(item));
  }

  if (typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field));

      if (isSensitive && typeof value === "string" && value.length > 0) {
        sanitized[key] = maskSensitiveValue(value);
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeSensitiveData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return obj;
}

// ------------------------------------------------------------
// 工具：行数据 snake_case → camelCase，并统一时间为 ISO8601
// ------------------------------------------------------------
type RawRow = {
  id: number;
  admin_id: number;
  admin_username: string;
  action: "create" | "update" | "delete";
  table_name: string;
  record_id: number | null;
  old_value: any | null;
  new_value: any | null;
  description: string | null;
  created_at: Date | string;
};

type CamelRow = {
  id: number;
  adminId: number;
  adminUsername: string;
  action: "create" | "update" | "delete";
  tableName: string;
  recordId: number | null;
  oldValue: any | null;
  newValue: any | null;
  description: string | null;
  createdAt: string; // ISO8601
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

function mapRow(r: RawRow): CamelRow {
  // 双重保护：在API返回时再次进行脱敏处理
  return {
    id: r.id,
    adminId: r.admin_id,
    adminUsername: r.admin_username,
    action: r.action,
    tableName: r.table_name,
    recordId: r.record_id,
    oldValue: sanitizeSensitiveData(r.old_value),
    newValue: sanitizeSensitiveData(r.new_value),
    description: r.description,
    createdAt: toISO(r.created_at) ?? "",
  };
}

// ------------------------------------------------------------
// 排序白名单映射
// ------------------------------------------------------------
const SORT_MAP: Record<string, keyof RawRow> = {
  createdAt: "created_at",
  id: "id",
  adminId: "admin_id",
  tableName: "table_name",
  action: "action",
};

// ============================================================
// GET /api/admin/operation-logs
// 查询操作日志列表（分页、筛选、排序）
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const query = req.nextUrl.searchParams;
    const { page, limit, offset, sortBy, order } = parsePagination(query);

    const adminUsername = query.get("adminUsername");
    const tableName = query.get("tableName");
    const action = query.get("action");
    const recordId = query.get("recordId");
    const startDate = query.get("startDate");
    const endDate = query.get("endDate");

    // 排序白名单校验
    const sortKey = sortBy || "createdAt";
    const sortColumn = SORT_MAP[sortKey];
    if (!sortColumn) {
      return badRequest("Invalid sortBy");
    }

    // 基础查询
    let baseQ = db.selectFrom("operation_logs");

    if (adminUsername) {
      baseQ = baseQ.where("admin_username", "like", `%${adminUsername}%`);
    }

    if (tableName) {
      baseQ = baseQ.where("table_name", "=", tableName);
    }

    if (action && ["create", "update", "delete"].includes(action)) {
      baseQ = baseQ.where("action", "=", action as "create" | "update" | "delete");
    }

    if (recordId) {
      const recordIdNum = Number(recordId);
      if (!isNaN(recordIdNum)) {
        baseQ = baseQ.where("record_id", "=", recordIdNum);
      }
    }

    if (startDate) {
      try {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          baseQ = baseQ.where("created_at", ">=", start);
        }
      } catch {
        // 忽略无效日期
      }
    }

    if (endDate) {
      try {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          baseQ = baseQ.where("created_at", "<=", end);
        }
      } catch {
        // 忽略无效日期
      }
    }

    // 计数查询
    const totalRow = await baseQ
      .select(({ fn }) => fn.count<number>("id").as("count"))
      .executeTakeFirst();
    const total = totalRow ? Number(totalRow.count) : 0;

    // 列表查询（选择全部列 + 排序 + 分页）
    const rows = await baseQ
      .selectAll()
      .orderBy(sortColumn, order)
      .limit(limit)
      .offset(offset)
      .execute();

    const data = rows.map(mapRow);
    const pagination = getPaginationMeta(page, limit, total);

    return success(data, pagination);
  } catch (err: any) {
    console.error("[GET /api/admin/operation-logs] Error:", err);
    return internalError("Failed to fetch operation logs");
  }
});

