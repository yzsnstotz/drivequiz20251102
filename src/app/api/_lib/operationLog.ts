// ============================================================
// 文件路径: src/app/api/_lib/operationLog.ts
// 功能: 操作日志记录帮助函数
// ============================================================

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAdminInfo } from "./withAdminAuth";

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
    const adminInfo = getAdminInfo(params.req);
    if (!adminInfo) {
      // 如果没有管理员信息，不记录日志（可能是在非管理员操作中调用）
      console.warn("[OperationLog] No admin info found, skipping log");
      return;
    }

    // 准备日志数据
    const logData = {
      admin_id: adminInfo.id,
      admin_username: adminInfo.username,
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId ?? null,
      old_value: params.oldValue ? JSON.parse(JSON.stringify(params.oldValue)) : null,
      new_value: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : null,
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

