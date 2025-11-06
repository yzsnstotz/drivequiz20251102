// ============================================================
// 文件路径: src/app/api/_lib/validators.ts
// 功能: 参数与输入验证工具
// 规范: Zalem 后台管理接口规范 v1.0 第 4 节
// ============================================================

import { badRequest } from "@/app/api/_lib/errors";

// ------------------------------------------------------------
// 状态枚举 (统一来源)
// ------------------------------------------------------------
export const VALID_STATUSES = [
  "disabled",
  "enabled",
  "suspended",
  "expired",
] as const;

export type ActivationStatus = (typeof VALID_STATUSES)[number];

// ------------------------------------------------------------
// 日期与数值验证
// ------------------------------------------------------------

export function parseISODate(input?: string | null): Date | null {
  if (!input) return null;
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    throw badRequest("Invalid date format, must be ISO8601 (e.g. 2025-12-31T23:59:59Z)");
  }
  return date;
}

export function validateUsageLimit(limit: number) {
  if (limit < 1) throw badRequest("usageLimit must be ≥ 1");
}

export function validateCount(count: number) {
  if (count < 1 || count > 10000)
    throw badRequest("count must be between 1 and 10000");
}

export function validateStatus(status: string) {
  if (!VALID_STATUSES.includes(status as ActivationStatus)) {
    throw badRequest(
      `Invalid status value. Must be one of: ${VALID_STATUSES.join(", ")}`
    );
  }
}

// ------------------------------------------------------------
// 通用校验入口 (组合使用)
// ------------------------------------------------------------

export function validateActivationCodeCreate(body: any) {
  if (!body) throw badRequest("Request body is required");

  const { count, usageLimit, status, validityPeriod, validityUnit } = body;

  validateCount(Number(count));
  validateUsageLimit(Number(usageLimit));

  if (status) validateStatus(status);

  // 验证有效期字段
  const period = validityPeriod !== undefined ? Number(validityPeriod) : null;
  const unit = validityUnit || null;

  if (period !== null) {
    if (!Number.isFinite(period) || period <= 0) {
      throw badRequest("validityPeriod must be a positive number");
    }
    if (!unit || !["day", "month", "year"].includes(unit)) {
      throw badRequest("validityUnit must be one of: day, month, year");
    }
  } else if (unit !== null) {
    throw badRequest("validityUnit requires validityPeriod");
  }

  return {
    count: Number(count),
    usageLimit: Number(usageLimit),
    status: (status || "disabled") as ActivationStatus,
    validityPeriod: period,
    validityUnit: unit,
    notes: body.notes || null,
  };
}

// ------------------------------------------------------------
// 💡 使用示例
// ------------------------------------------------------------
// import { validateActivationCodeCreate } from "@/app/api/_lib/validators";
// 
// export const POST = withAdminAuth(async (req) => {
//   const data = await req.json();
//   const payload = validateActivationCodeCreate(data);
//   // payload => { count, usageLimit, status, expiresAt, notes }
// });
// ------------------------------------------------------------
