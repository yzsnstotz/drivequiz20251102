// ============================================================
// 文件路径: src/app/api/_lib/errors.ts
// 功能: 统一错误响应与辅助方法
// 规范: Zalem 后台管理接口规范 v1.0 第 6 节
// ============================================================

import { NextResponse } from "next/server";

export interface ErrorResponse {
  ok: false;
  errorCode:
    | "AUTH_REQUIRED"
    | "FORBIDDEN"
    | "VALIDATION_FAILED"
    | "NOT_FOUND"
    | "CONFLICT"
    | "INVALID_STATE_TRANSITION"
    | "INTERNAL_ERROR";
  message: string;
}

/**
 * 成功响应模板
 */
export function success(data: any, pagination?: any) {
  return NextResponse.json(
    pagination ? { ok: true, data, pagination } : { ok: true, data },
    { status: 200 }
  );
}

/**
 * 通用错误响应生成器
 */
function error(
  code: ErrorResponse["errorCode"],
  message: string,
  status: number
) {
  return NextResponse.json({ ok: false, errorCode: code, message }, { status });
}

// ------------------------------------------------------------
// 常见错误封装
// ------------------------------------------------------------

export const badRequest = (message = "Validation failed") =>
  error("VALIDATION_FAILED", message, 400);

export const unauthorized = (message = "Authentication required") =>
  error("AUTH_REQUIRED", message, 401);

export const forbidden = (message = "Forbidden") =>
  error("FORBIDDEN", message, 403);

export const notFound = (message = "Resource not found") =>
  error("NOT_FOUND", message, 404);

export const conflict = (message = "Conflict detected") =>
  error("CONFLICT", message, 409);

export const invalidState = (message = "Invalid state transition") =>
  error("INVALID_STATE_TRANSITION", message, 409);

export const internalError = (message = "Internal server error") =>
  error("INTERNAL_ERROR", message, 500);

// ------------------------------------------------------------
// 💡 使用示例
// ------------------------------------------------------------
// import { badRequest, notFound, success } from "@/app/api/_lib/errors";
// 
// export async function GET() {
//   if (!isValid) return badRequest("Missing required parameters");
//   if (!record) return notFound("No record found");
//   return success(record);
// }
// ------------------------------------------------------------
