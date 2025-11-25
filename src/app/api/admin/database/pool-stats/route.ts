/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

// ============================================================
// 文件路径: src/app/api/admin/database/pool-stats/route.ts
// 功能: 数据库连接池监控统计接口
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { getDbPoolStats, type PoolStats } from "@/lib/db";
import { getAiDbPoolStats, type AiDbPoolStats } from "@/lib/aiDb";

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
    // 获取主数据库连接池状态
    const mainDbStats = getDbPoolStats();
    
    // 获取AI数据库连接池状态
    const aiDbStats = getAiDbPoolStats();

    // 生成告警信息
    const alerts: Array<{
      level: "warning" | "critical";
      message: string;
      timestamp: string;
    }> = [];

    if (mainDbStats) {
      if (mainDbStats.status === "critical") {
        alerts.push({
          level: "critical",
          message: `主数据库连接池使用率 ${(mainDbStats.usageRate * 100).toFixed(1)}%，已接近满载！`,
          timestamp: new Date().toISOString(),
        });
      } else if (mainDbStats.status === "warning") {
        alerts.push({
          level: "warning",
          message: `主数据库连接池使用率 ${(mainDbStats.usageRate * 100).toFixed(1)}%，需要关注`,
          timestamp: new Date().toISOString(),
        });
      }

      if (mainDbStats.waiting > 0) {
        alerts.push({
          level: mainDbStats.waiting > 5 ? "critical" : "warning",
          message: `主数据库有 ${mainDbStats.waiting} 个请求正在等待连接`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (aiDbStats) {
      if (aiDbStats.status === "critical") {
        alerts.push({
          level: "critical",
          message: `AI数据库连接池使用率 ${(aiDbStats.usageRate * 100).toFixed(1)}%，已接近满载！`,
          timestamp: new Date().toISOString(),
        });
      } else if (aiDbStats.status === "warning") {
        alerts.push({
          level: "warning",
          message: `AI数据库连接池使用率 ${(aiDbStats.usageRate * 100).toFixed(1)}%，需要关注`,
          timestamp: new Date().toISOString(),
        });
      }

      if (aiDbStats.waiting > 0) {
        alerts.push({
          level: aiDbStats.waiting > 5 ? "critical" : "warning",
          message: `AI数据库有 ${aiDbStats.waiting} 个请求正在等待连接`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 查询统计（暂时返回占位数据，后续可以实现真实的查询统计）
    const queryStats = {
      totalQueries: 0, // 需要实现查询计数器
      slowQueries: 0, // 需要实现慢查询检测
      avgQueryTime: 0, // 需要实现查询时间统计
      lastUpdated: new Date().toISOString(),
    };

    const data = {
      mainDb: mainDbStats || {
        total: 0,
        idle: 0,
        active: 0,
        waiting: 0,
        usageRate: 0,
        status: "healthy" as const,
      },
      aiDb: aiDbStats || {
        total: 0,
        idle: 0,
        active: 0,
        waiting: 0,
        usageRate: 0,
        status: "healthy" as const,
      },
      queryStats,
      alerts,
    };

    return success(data);
  } catch (err) {
    console.error("[GET /api/admin/database/pool-stats] Error:", err);
    return internalError("Failed to fetch database pool statistics");
  }
});

