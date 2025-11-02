// ============================================================
// 文件路径: src/app/api/_lib/operationLog.ts
// 功能: 操作日志记录帮助函数
// ============================================================

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAdminInfo } from "./withAdminAuth";

// ------------------------------------------------------------
// 敏感字段脱敏：用于保护密码/token等敏感信息
// ------------------------------------------------------------
const SENSITIVE_FIELDS = ["token", "password", "pwd", "secret", "key"];

/**
 * 脱敏敏感字段的值
 * @param value 原始值（字符串）
 * @returns 脱敏后的值（完全隐藏内容和长度，统一显示为固定长度）
 */
function maskSensitiveValue(value: string): string {
  if (!value || typeof value !== "string") return "***";
  // 完全隐藏内容和长度，统一使用固定格式，不泄露任何信息
  return "••••••••••";
}

/**
 * 递归脱敏对象中的敏感字段
 * @param obj 要脱敏的对象
 * @returns 脱敏后的对象（深拷贝）
 */
function sanitizeSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 如果是数组，递归处理每个元素
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeSensitiveData(item));
  }

  // 如果是对象，递归处理每个属性
  if (typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      // 检查是否是敏感字段
      const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field));

      if (isSensitive && typeof value === "string" && value.length > 0) {
        // 如果是敏感字段且值是字符串，进行脱敏
        sanitized[key] = maskSensitiveValue(value);
      } else if (typeof value === "object" && value !== null) {
        // 递归处理嵌套对象
        sanitized[key] = sanitizeSensitiveData(value);
      } else {
        // 非敏感字段，直接复制
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  // 原始类型值直接返回
  return obj;
}

// ------------------------------------------------------------
// 操作日志参数类型
// ------------------------------------------------------------
export interface LogOperationParams {
  req: NextRequest;
  action: "create" | "update" | "delete";
  tableName: string;
  recordId?: number | null;
  oldValue?: any;
  newValue?: any;
  description?: string;
}

// ------------------------------------------------------------
// 记录操作日志
// ------------------------------------------------------------
export async function logOperation(params: LogOperationParams): Promise<void> {
  try {
    const adminInfo = await getAdminInfo(params.req);
    if (!adminInfo) {
      // 如果没有管理员信息，不记录日志（可能是在非管理员操作中调用）
      console.warn("[OperationLog] No admin info found, skipping log");
      return;
    }

    // 准备日志数据（对敏感数据进行脱敏）
    const logData = {
      admin_id: adminInfo.id,
      admin_username: adminInfo.username,
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId ?? null,
      old_value: params.oldValue
        ? sanitizeSensitiveData(JSON.parse(JSON.stringify(params.oldValue)))
        : null,
      new_value: params.newValue
        ? sanitizeSensitiveData(JSON.parse(JSON.stringify(params.newValue)))
        : null,
      description: params.description ?? null,
    };

    // 插入操作日志
    await db.insertInto("operation_logs").values(logData).execute();
  } catch (err) {
    // 操作日志记录失败不应影响主业务，只记录错误
    console.error("[OperationLog] Failed to log operation:", err);
  }
}

// ------------------------------------------------------------
// 便捷函数：记录创建操作
// ------------------------------------------------------------
export async function logCreate(
  req: NextRequest,
  tableName: string,
  recordId: number | null,
  newValue: any,
  description?: string
): Promise<void> {
  return logOperation({
    req,
    action: "create",
    tableName,
    recordId,
    newValue,
    description,
  });
}

// ------------------------------------------------------------
// 便捷函数：记录更新操作
// ------------------------------------------------------------
export async function logUpdate(
  req: NextRequest,
  tableName: string,
  recordId: number | null,
  oldValue: any,
  newValue: any,
  description?: string
): Promise<void> {
  return logOperation({
    req,
    action: "update",
    tableName,
    recordId,
    oldValue,
    newValue,
    description,
  });
}

// ------------------------------------------------------------
// 便捷函数：记录删除操作
// ------------------------------------------------------------
export async function logDelete(
  req: NextRequest,
  tableName: string,
  recordId: number | null,
  oldValue: any,
  description?: string
): Promise<void> {
  return logOperation({
    req,
    action: "delete",
    tableName,
    recordId,
    oldValue,
    description,
  });
}

