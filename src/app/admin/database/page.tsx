// ============================================================
// 文件路径: src/app/admin/database/page.tsx
// 功能: 数据库连接池监控统计页面
// 依赖: src/lib/apiClient.ts（统一鉴权与错误处理）
// 规范: 接口 GET /api/admin/database/pool-stats → { ok:true, data }
// ============================================================

"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";

type PoolStats = {
  total: number;
  idle: number;
  active: number;
  waiting: number;
  usageRate: number;
  status: "healthy" | "warning" | "critical";
};

type QueryStats = {
  totalQueries: number;
  slowQueries: number;
  avgQueryTime: number;
  lastUpdated: string;
};

type Alert = {
  level: "warning" | "critical";
  message: string;
  timestamp: string;
};

type DatabaseStats = {
  mainDb: PoolStats;
  aiDb: PoolStats;
  queryStats: QueryStats;
  alerts: Alert[];
};

type ApiOk = { ok: true; data: DatabaseStats };
type ApiErr = { ok: false; errorCode?: string; message?: string };

function toPct(n: number) {
  return (n * 100).toFixed(1) + "%";
}

function formatTime(ms: number) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getStatusColor(status: string) {
  switch (status) {
    case "healthy":
      return "text-green-600";
    case "warning":
      return "text-amber-600";
    case "critical":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

function getStatusBgColor(status: string) {
  switch (status) {
    case "healthy":
      return "bg-green-50 border-green-200";
    case "warning":
      return "bg-amber-50 border-amber-200";
    case "critical":
      return "bg-red-50 border-red-200";
    default:
      return "bg-gray-50 border-gray-200";
  }
}

export default function DatabaseStatsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/api/admin/database/pool-stats");
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "加载失败");
      }
      const ok = res as ApiOk;
      setStats(ok.data);
    } catch (e: any) {
      setError(e?.message || "加载失败");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // 每5秒自动刷新
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">数据库连接池监控</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "刷新中…" : "刷新"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 告警信息 */}
      {stats && stats.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {stats.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`rounded-md border p-3 text-sm ${
                alert.level === "critical"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <div className="font-medium">
                {alert.level === "critical" ? "🔴 严重告警" : "⚠️ 警告"}
              </div>
              <div className="mt-1">{alert.message}</div>
              <div className="mt-1 text-xs opacity-70">
                {new Date(alert.timestamp).toLocaleString("zh-CN")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 连接池状态卡片 */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 主数据库 */}
        <div
          className={`rounded-lg border p-6 ${getStatusBgColor(
            stats?.mainDb.status || "healthy"
          )}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">主数据库连接池</h2>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                stats?.mainDb.status || "healthy"
              )}`}
            >
              {stats?.mainDb.status || "healthy"}
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">总连接数</span>
              <span className="font-semibold">{stats?.mainDb.total ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">空闲连接</span>
              <span className="font-semibold text-green-600">
                {stats?.mainDb.idle ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">活动连接</span>
              <span className="font-semibold text-blue-600">
                {stats?.mainDb.active ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">等待连接</span>
              <span
                className={`font-semibold ${
                  (stats?.mainDb.waiting ?? 0) > 0
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {stats?.mainDb.waiting ?? 0}
              </span>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-gray-600">使用率</span>
                <span className="font-semibold">
                  {stats ? toPct(stats.mainDb.usageRate) : "0.0%"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full transition-all ${
                    (stats?.mainDb.usageRate ?? 0) > 0.8
                      ? "bg-red-500"
                      : (stats?.mainDb.usageRate ?? 0) > 0.6
                      ? "bg-amber-500"
                      : "bg-green-500"
                  }`}
                  style={{
                    width: stats
                      ? toPct(stats.mainDb.usageRate)
                      : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI数据库 */}
        <div
          className={`rounded-lg border p-6 ${getStatusBgColor(
            stats?.aiDb.status || "healthy"
          )}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">AI数据库连接池</h2>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                stats?.aiDb.status || "healthy"
              )}`}
            >
              {stats?.aiDb.status || "healthy"}
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">总连接数</span>
              <span className="font-semibold">{stats?.aiDb.total ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">空闲连接</span>
              <span className="font-semibold text-green-600">
                {stats?.aiDb.idle ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">活动连接</span>
              <span className="font-semibold text-blue-600">
                {stats?.aiDb.active ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">等待连接</span>
              <span
                className={`font-semibold ${
                  (stats?.aiDb.waiting ?? 0) > 0
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {stats?.aiDb.waiting ?? 0}
              </span>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-gray-600">使用率</span>
                <span className="font-semibold">
                  {stats ? toPct(stats.aiDb.usageRate) : "0.0%"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full transition-all ${
                    (stats?.aiDb.usageRate ?? 0) > 0.8
                      ? "bg-red-500"
                      : (stats?.aiDb.usageRate ?? 0) > 0.6
                      ? "bg-amber-500"
                      : "bg-green-500"
                  }`}
                  style={{
                    width: stats ? toPct(stats.aiDb.usageRate) : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 查询统计 */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">查询统计</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="text-sm text-gray-600">总查询数</div>
            <div className="mt-2 text-2xl font-semibold">
              {loading ? "…" : stats?.queryStats.totalQueries ?? 0}
            </div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="text-sm text-gray-600">慢查询数</div>
            <div className="mt-2 text-2xl font-semibold text-amber-600">
              {loading ? "…" : stats?.queryStats.slowQueries ?? 0}
            </div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="text-sm text-gray-600">平均查询时间</div>
            <div className="mt-2 text-2xl font-semibold">
              {loading
                ? "…"
                : stats?.queryStats.avgQueryTime
                ? formatTime(stats.queryStats.avgQueryTime)
                : "0ms"}
            </div>
          </div>
        </div>
        {stats?.queryStats.lastUpdated && (
          <div className="mt-4 text-xs text-gray-500">
            最后更新:{" "}
            {new Date(stats.queryStats.lastUpdated).toLocaleString("zh-CN")}
          </div>
        )}
      </div>
    </div>
  );
}

