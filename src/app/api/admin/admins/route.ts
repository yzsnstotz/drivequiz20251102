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
// 文件路径: src/app/api/admin/admins/route.ts
// 功能: 管理员管理 API - 查询 & 创建
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError, conflict } from "@/app/api/_lib/errors";
import { parsePagination, getPaginationMeta } from "@/app/api/_lib/pagination";
import { logCreate, logUpdate, logDelete } from "@/app/api/_lib/operationLog";
import { db } from "@/lib/db";
import { sql } from "kysely";
import crypto from "crypto";

// ------------------------------------------------------------
// 工具：行数据 snake_case → camelCase，并统一时间为 ISO8601
// ------------------------------------------------------------
type RawRow = {
  id: number;
  username: string;
  token: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type CamelRow = {
  id: number;
  username: string;
  token: string; // ⚠️ 返回时应该隐藏token，只显示部分
  isActive: boolean;
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
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
  return {
    id: r.id,
    username: r.username,
    token: r.token.substring(0, 8) + "***", // 只显示前8位，其余隐藏
    isActive: r.is_active,
    createdAt: toISO(r.created_at) ?? "",
    updatedAt: toISO(r.updated_at) ?? "",
  };
}

// ------------------------------------------------------------
// 排序白名单映射
// ------------------------------------------------------------
const SORT_MAP: Record<string, keyof RawRow> = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  username: "username",
  id: "id",
};

// ============================================================
// GET /api/admin/admins
// 查询管理员列表（分页、筛选、排序）
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const query = req.nextUrl.searchParams;
    const { page, limit, offset, sortBy, order } = parsePagination(query);

    const username = query.get("username");
    const isActive = query.get("isActive");

    // 排序白名单校验
    const sortKey = sortBy || "createdAt";
    const sortColumn = SORT_MAP[sortKey];
    if (!sortColumn) {
      return badRequest("Invalid sortBy");
    }

    // 基础查询
    let baseQ = db.selectFrom("admins");

    if (username) {
      baseQ = baseQ.where("username", "like", `%${username}%`);
    }

    if (isActive !== null && isActive !== undefined) {
      const active = isActive === "true" || isActive === "1";
      baseQ = baseQ.where("is_active", "=", active);
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
    console.error("[GET /api/admin/admins] Error:", err);
    return internalError("Failed to fetch admins");
  }
});

// ============================================================
// POST /api/admin/admins
// 创建新管理员
// ============================================================
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { username, token, isActive } = body;

    // 校验输入
    if (!username || typeof username !== "string" || username.trim().length === 0) {
      return badRequest("Username is required");
    }

    if (username.length < 3 || username.length > 50) {
      return badRequest("Username must be between 3 and 50 characters");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return badRequest("Username can only contain letters, numbers, underscores, and hyphens");
    }

    // 检查用户名是否已存在
    const existing = await db
      .selectFrom("admins")
      .select(["id"])
      .where("username", "=", username.trim())
      .executeTakeFirst();

    if (existing) {
      return conflict("Username already exists");
    }

    // 生成token（如果未提供）
    let adminToken = token;
    if (!adminToken || typeof adminToken !== "string" || adminToken.trim().length === 0) {
      // 生成32位随机token
      adminToken = crypto.randomBytes(16).toString("hex");
    } else {
      adminToken = adminToken.trim();
      if (adminToken.length < 8) {
        return badRequest("Token must be at least 8 characters");
      }

      // 检查token是否已存在
      const existingToken = await db
        .selectFrom("admins")
        .select(["id"])
        .where("token", "=", adminToken)
        .executeTakeFirst();

      if (existingToken) {
        return conflict("Token already exists");
      }
    }

    // 创建管理员
    const now = new Date().toISOString();
    const inserted = await db
      .insertInto("admins")
      .values({
        username: username.trim(),
        token: adminToken,
        is_active: isActive !== undefined ? Boolean(isActive) : true,
        created_at: sql`${now}::timestamp`,
        updated_at: sql`${now}::timestamp`,
      })
      .returningAll()
      .executeTakeFirst();

    if (!inserted) {
      return internalError("Failed to create admin");
    }

    // 记录操作日志
    await logCreate(
      req,
      "admins",
      inserted.id,
      inserted,
      `创建管理员: ${inserted.username}`
    );

    // 返回完整token（仅在创建时返回，用于管理员保存）
    const data = {
      id: inserted.id,
      username: inserted.username,
      token: inserted.token, // 完整token，仅创建时返回
      isActive: inserted.is_active,
      createdAt: toISO(inserted.created_at) ?? "",
      updatedAt: toISO(inserted.updated_at) ?? "",
    };

    return success(data);
  } catch (err: any) {
    console.error("[POST /api/admin/admins] Error:", err);
    if (err && err.ok === false) return err;
    return badRequest("Failed to create admin");
  }
});

