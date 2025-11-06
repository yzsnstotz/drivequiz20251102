// ============================================================
// 文件路径: src/app/admin/stats/page.tsx
// 功能: 后台统计页（激活码总数 / 各状态分布 / 使用率图表）
// 依赖: src/lib/apiClient.ts（统一鉴权与错误处理）
// 规范: 接口 GET /api/admin/activation-codes/stats → { ok:true, data }
// 数据结构: { total:number, byStatus:{enabled,disabled,suspended,expired}, usage:{ used, unused, rate }, generatedAt: ISO8601 }
// 说明: 使用原生 SVG 绘制简易饼图与条形图，无第三方图表库
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/apiClient";

type Stats = {
  total: number;
  byStatus: {
    enabled: number;
    disabled: number;
    suspended: number;
    expired: number;
  };
  usage: {
    used: number;
    unused: number;
    rate: number; // 0 ~ 1
  };
  generatedAt: string; // ISO8601
};

type ApiOk = { ok: true; data: Stats };
type ApiErr = { ok: false; errorCode?: string; message?: string };

function toPct(n: number) {
  return (n * 100).toFixed(1) + "%";
}

// ---- 饼图（SVG）工具 ----
function calcPieArcs(values: number[], radius: number) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let angle = -Math.PI / 2; // 从正上开始
  return values.map((v) => {
    const slice = (v / total) * Math.PI * 2;
    const start = angle;
    const end = angle + slice;
    angle = end;
    const largeArc = slice > Math.PI ? 1 : 0;
    const x1 = radius + radius * Math.cos(start);
    const y1 = radius + radius * Math.sin(start);
    const x2 = radius + radius * Math.cos(end);
    const y2 = radius + radius * Math.sin(end);
    return { x1, y1, x2, y2, largeArc, sweep: 1, value: v };
  });
}

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/api/admin/activation-codes/stats");
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
  }, []);

  const statusPairs = useMemo(() => {
    if (!stats) return [];
    return [
      { key: "enabled", label: "enabled", value: stats.byStatus.enabled },
      { key: "disabled", label: "disabled", value: stats.byStatus.disabled },
      { key: "suspended", label: "suspended", value: stats.byStatus.suspended },
      { key: "expired", label: "expired", value: stats.byStatus.expired },
    ];
  }, [stats]);

  const pieData = useMemo(() => statusPairs.map((s) => s.value), [statusPairs]);

  const colors = {
    enabled: "#16a34a", // green-600
    disabled: "#6b7280", // gray-500
    suspended: "#f59e0b", // amber-500
    expired: "#ef4444", // red-500
    used: "#0ea5e9", // sky-500
    unused: "#94a3b8", // slate-400
  } as const;

  const total = stats?.total ?? 0;
  const usedPct = stats ? toPct(stats.usage.rate) : "0.0%";
  const generatedAt = stats?.generatedAt
    ? new Date(stats.generatedAt).toISOString()
    : "";

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">统计概览</h1>
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

      {/* 顶部卡片 */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">激活码总数</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? "…" : total}</div>
          <div className="mt-1 text-xs text-gray-400">生成于: {generatedAt || "-"}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">已使用</div>
          <div className="mt-2 text-2xl font-semibold text-sky-600">
            {loading ? "…" : stats?.usage.used ?? 0}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">未使用</div>
          <div className="mt-2 text-2xl font-semibold text-slate-500">
            {loading ? "…" : stats?.usage.unused ?? 0}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">使用率</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? "…" : usedPct}</div>
        </div>
      </div>

      {/* 中部图表区 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 饼图：状态分布 */}
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-medium">状态分布</div>
            <div className="text-xs text-gray-500">单位：个</div>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">加载中…</div>
          ) : total === 0 ? (
            <div className="p-8 text-center text-gray-400">暂无数据</div>
          ) : (
            <div className="flex items-center gap-6">
              <PieChart
                size={160}
                values={pieData}
                colors={[
                  colors.enabled,
                  colors.disabled,
                  colors.suspended,
                  colors.expired,
                ]}
              />
              <ul className="space-y-2 text-sm">
                {statusPairs.map((s) => {
                  const pct =
                    total > 0 ? ((s.value / total) * 100).toFixed(1) + "%" : "0.0%";
                  const color =
                    s.key === "enabled"
                      ? colors.enabled
                      : s.key === "disabled"
                      ? colors.disabled
                      : s.key === "suspended"
                      ? colors.suspended
                      : colors.expired;
                return (
                  <li key={s.key} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="w-20">{s.label}</span>
                    <span className="tabular-nums">{s.value}</span>
                    <span className="ml-2 text-gray-500">{pct}</span>
                  </li>
                );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* 条形图：使用率 */}
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-medium">使用率</div>
            <div className="text-xs text-gray-500">used vs unused</div>
          </div>
          {loading || !stats ? (
            <div className="p-8 text-center text-gray-400">加载中…</div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                <div>used</div>
                <div className="tabular-nums">{stats.usage.used}</div>
              </div>
              <div className="mb-4 h-3 w-full rounded bg-gray-100">
                <div
                  className="h-3 rounded"
                  style={{
                    width: `${Math.min(100, Math.max(0, stats.usage.rate * 100))}%`,
                    backgroundColor: colors.used,
                  }}
                />
              </div>

              <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                <div>unused</div>
                <div className="tabular-nums">{stats.usage.unused}</div>
              </div>
              <div className="h-3 w-full rounded bg-gray-100">
                <div
                  className="h-3 rounded"
                  style={{
                    width: `${
                      Math.min(100, Math.max(0, (1 - stats.usage.rate) * 100))
                    }%`,
                    backgroundColor: colors.unused,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- 简易饼图组件（SVG）----
function PieChart({
  size = 160,
  values,
  colors,
}: {
  size?: number;
  values: number[];
  colors: string[];
}) {
  const radius = size / 2;
  const arcs = calcPieArcs(values, radius);
  const hasAny = values.some((v) => v > 0);

  if (!hasAny) {
    // 空数据占位圆
    return (
      <svg width={size} height={size} className="shrink-0">
        <circle cx={radius} cy={radius} r={radius - 1} fill="#f3f4f6" stroke="#e5e7eb" />
      </svg>
    );
  }

  let acc = 0;
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <svg width={size} height={size} className="shrink-0">
      {arcs.map((a, i) => {
        const value = values[i] || 0;
        if (value <= 0) return null;
        acc += value;
        const path = describeArc(radius, radius, radius - 1, a.x1, a.y1, a.x2, a.y2, a.largeArc);
        return <path key={i} d={path} fill={colors[i % colors.length]} />;
      })}
      {/* 中心空洞，形成环形图 */}
      <circle cx={radius} cy={radius} r={radius * 0.55} fill="white" />
      {/* 中心文本：总数 */}
      <text
        x={radius}
        y={radius}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-gray-700"
        style={{ fontSize: 14, fontWeight: 600 }}
      >
        {total}
      </text>
    </svg>
  );
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  largeArc: number
) {
  const sweep = 1;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2} Z`;
}
