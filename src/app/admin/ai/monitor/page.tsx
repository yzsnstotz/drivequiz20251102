"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

type SummaryResp = {
  ok: boolean;
  data?: {
    date: string;
    totalCalls: number;
    avgCostUsd?: number;
    avgCost?: number;
    cacheHitRate: number;
    ragHitRate: number;
    blocked?: number;
    needsHuman?: number;
    locales?: Record<string, number>;
    topQuestions?: Array<{ q: string; count: number } | { question: string; count: number }>;
    totals?: {
      totalCalls?: number;
      cacheHitRate?: number;
      ragHitRate?: number;
      avgCost?: number;
      avgCostUsd?: number;
    };
  };
  message?: string;
};

async function fetchSummary(dateISO: string, token?: string): Promise<SummaryResp> {
  const base = typeof window !== "undefined" 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
  const url = `${base}/api/admin/ai/summary?date=${encodeURIComponent(dateISO)}`;
  const res = await fetch(url, { 
    cache: "no-store",
    headers: token ? {
      "Authorization": `Bearer ${token}`,
    } : {},
  });
  return (await res.json()) as SummaryResp;
}

async function rebuildSummary(dateISO: string, token?: string): Promise<{ ok: boolean; message?: string }> {
  const base = typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
  const url = `${base}/api/admin/ai/summary/rebuild?date=${encodeURIComponent(dateISO)}`;
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: token ? {
      "Authorization": `Bearer ${token}`,
    } : {},
  });
  return (await res.json()) as { ok: boolean; message?: string };
}

async function prewarmCache(token?: string): Promise<{ ok: boolean; message?: string; data?: any }> {
  const base = typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
  const url = `${base}/api/admin/ai/cache/prewarm`;
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: token ? {
      "Authorization": `Bearer ${token}`,
    } : {},
  });
  return (await res.json()) as { ok: boolean; message?: string; data?: any };
}

// 从 localStorage 读取刷新配置
function getRefreshConfig() {
  if (typeof window === "undefined") return { enabled: false, intervalMinutes: 5 };
  const stored = localStorage.getItem("ai_monitor_refresh_config");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { enabled: false, intervalMinutes: 5 };
    }
  }
  return { enabled: false, intervalMinutes: 5 };
}

// 保存刷新配置到 localStorage
function saveRefreshConfig(config: { enabled: boolean; intervalMinutes: number }) {
  if (typeof window !== "undefined") {
    localStorage.setItem("ai_monitor_refresh_config", JSON.stringify(config));
  }
}

export default function AdminAiMonitorPage() {
  const [dateISO, setDateISO] = useState(() => new Date().toISOString().slice(0, 10));
  const [resp, setResp] = useState<SummaryResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null);
  const [prewarming, setPrewarming] = useState(false);
  const [prewarmMessage, setPrewarmMessage] = useState<string | null>(null);
  const [refreshConfig, setRefreshConfig] = useState(getRefreshConfig);
  const [showRefreshConfig, setShowRefreshConfig] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      // 从 localStorage 获取 token（如果存在）
      const token = typeof window !== "undefined" ? localStorage.getItem("ADMIN_TOKEN") : undefined;
      const data = await fetchSummary(dateISO, token || undefined);
      setResp(data);
      setLoading(false);
      setLastRefreshTime(new Date());
    } catch (err) {
      setResp({ ok: false, message: err instanceof Error ? err.message : "unknown error" });
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let pollTimer: NodeJS.Timeout | null = null;
    let autoRefreshTimer: NodeJS.Timeout | null = null;

    loadData();

    // 如果刚执行了重跑，10秒后自动刷新
    if (rebuildMessage) {
      pollTimer = setTimeout(() => {
        if (mounted) {
          loadData();
          setRebuildMessage(null);
        }
      }, 10000);
    }

    // 自动刷新功能
    if (refreshConfig.enabled && refreshConfig.intervalMinutes > 0) {
      const intervalMs = refreshConfig.intervalMinutes * 60 * 1000;
      autoRefreshTimer = setInterval(() => {
        if (mounted) {
          // 不检查 loading，直接刷新（避免在加载时跳过刷新）
          loadData();
        }
      }, intervalMs);
    }

    return () => {
      mounted = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    };
  }, [dateISO, rebuildMessage, refreshConfig.enabled, refreshConfig.intervalMinutes]);

  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      setRebuildMessage(null);
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayISO = yesterday.toISOString().slice(0, 10);
      
      const token = typeof window !== "undefined" ? localStorage.getItem("ADMIN_TOKEN") : undefined;
      const result = await rebuildSummary(yesterdayISO, token || undefined);
      
      if (result.ok) {
        setRebuildMessage("重跑任务已启动，10秒后将自动刷新数据");
        // 10秒后自动刷新
        setTimeout(() => {
          setDateISO(new Date().toISOString().slice(0, 10));
        }, 10000);
      } else {
        setRebuildMessage(result.message || "重跑失败");
      }
    } catch (err) {
      setRebuildMessage(err instanceof Error ? err.message : "重跑失败");
    } finally {
      setRebuilding(false);
    }
  };

  const handlePrewarm = async () => {
    try {
      setPrewarming(true);
      setPrewarmMessage(null);
      
      const token = typeof window !== "undefined" ? localStorage.getItem("ADMIN_TOKEN") : undefined;
      const result = await prewarmCache(token || undefined);
      
      if (result.ok && result.data) {
        const { total, success, failed } = result.data;
        setPrewarmMessage(`预热成功！共处理 ${total} 个问题，成功 ${success} 个，失败 ${failed} 个。命中率预期将提升。`);
      } else {
        setPrewarmMessage(result.message || "预热失败");
      }
    } catch (err) {
      setPrewarmMessage(err instanceof Error ? err.message : "预热失败");
    } finally {
      setPrewarming(false);
    }
  };

  const handleDownloadCSV = () => {
    const base = typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
    const url = `${base}/api/admin/ai/summary?date=${encodeURIComponent(dateISO)}&format=csv`;
    const token = typeof window !== "undefined" ? localStorage.getItem("ADMIN_TOKEN") : undefined;
    
    fetch(url, {
      headers: token ? {
        "Authorization": `Bearer ${token}`,
      } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ai-summary-${dateISO}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch((err) => {
        console.error("Download CSV failed:", err);
        alert("下载失败：" + (err instanceof Error ? err.message : "unknown error"));
      });
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleRefreshConfigChange = (enabled: boolean, intervalMinutes: number) => {
    const newConfig = { enabled, intervalMinutes };
    setRefreshConfig(newConfig);
    saveRefreshConfig(newConfig);
    setShowRefreshConfig(false);
  };

  if (loading && !resp) {
    return <div className="p-4">加载中...</div>;
  }

  if (!resp?.ok || !resp.data) {
    return <div className="p-4 text-red-600">加载失败：{resp?.message ?? "unknown error"}</div>;
  }

  const d = resp.data;
  const totals = d.totals || {};
  const totalCalls = d.totalCalls || totals.totalCalls || 0;
  const avgCost = d.avgCostUsd || d.avgCost || totals.avgCost || totals.avgCostUsd || 0;
  const cacheHitRate = d.cacheHitRate || totals.cacheHitRate || 0;
  const ragHitRate = d.ragHitRate || totals.ragHitRate || 0;
  const blocked = d.blocked || 0;
  const needsHuman = d.needsHuman || 0;
  const locales = d.locales || {};
  const topQuestions = d.topQuestions || [];

  // 计算 locales 饼图数据
  const localeEntries = Object.entries(locales).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const localeTotal = Object.values(locales).reduce((sum, v) => sum + v, 0);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">AI 每日摘要</h1>
          <div className="text-sm text-neutral-500">
            日期（UTC）：{d.date}
            {lastRefreshTime && (
              <span className="ml-2">
                · 最后刷新：{lastRefreshTime.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400 text-sm"
            title="立即刷新数据"
          >
            {loading ? "刷新中..." : "刷新"}
          </button>
          <button
            onClick={() => setShowRefreshConfig(!showRefreshConfig)}
            className={`px-4 py-2 rounded text-sm ${
              refreshConfig.enabled
                ? "bg-green-500 text-white hover:bg-green-600"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            title="配置自动刷新"
          >
            {refreshConfig.enabled
              ? `自动刷新：${refreshConfig.intervalMinutes}分钟`
              : "配置刷新"}
          </button>
          <button
            onClick={handleDownloadCSV}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            下载 CSV
          </button>
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 text-sm"
          >
            {rebuilding ? "重跑中..." : "重跑昨日汇总"}
          </button>
          <button
            onClick={handlePrewarm}
            disabled={prewarming}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400 text-sm"
          >
            {prewarming ? "预热中..." : "预热缓存"}
          </button>
        </div>
      </div>

      {/* 自动刷新配置面板 */}
      {showRefreshConfig && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-medium mb-3">自动刷新配置</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={refreshConfig.enabled}
                onChange={(e) => {
                  const newConfig = { ...refreshConfig, enabled: e.target.checked };
                  setRefreshConfig(newConfig);
                  saveRefreshConfig(newConfig);
                }}
                className="rounded"
              />
              <span className="text-sm">启用自动刷新</span>
            </label>
            {refreshConfig.enabled && (
              <div className="flex items-center gap-2">
                <label className="text-sm">刷新频率：</label>
                <select
                  value={refreshConfig.intervalMinutes}
                  onChange={(e) => {
                    const intervalMinutes = Number(e.target.value);
                    handleRefreshConfigChange(refreshConfig.enabled, intervalMinutes);
                  }}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="1">1 分钟</option>
                  <option value="2">2 分钟</option>
                  <option value="5">5 分钟</option>
                  <option value="10">10 分钟</option>
                  <option value="15">15 分钟</option>
                  <option value="30">30 分钟</option>
                  <option value="60">60 分钟</option>
                </select>
                <span className="text-xs text-gray-500">
                  （最细到分钟级别，适合测试时实时查看）
                </span>
              </div>
            )}
            <div className="text-xs text-gray-500">
              提示：自动刷新会在后台定期更新数据，适合测试时实时查看最新数据。
            </div>
          </div>
        </div>
      )}

      {rebuildMessage && (
        <div className={`p-3 rounded ${rebuildMessage.includes("失败") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {rebuildMessage}
        </div>
      )}

      {prewarmMessage && (
        <div className={`p-3 rounded ${prewarmMessage.includes("失败") ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
          {prewarmMessage}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="总调用" value={totalCalls} />
        <Stat label="平均成本(USD)" value={avgCost.toFixed(4)} />
        <Stat label="缓存命中率" value={(cacheHitRate * 100).toFixed(1) + "%"} />
        <Stat label="RAG 命中率" value={(ragHitRate * 100).toFixed(1) + "%"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Blocked" value={blocked} />
        <Stat label="Needs human" value={needsHuman} />
        <Stat label="Locales" value={localeTotal} />
      </div>

      {localeEntries.length > 0 && (
        <div>
          <h2 className="font-medium mb-2">语言分布（Top 5）</h2>
          <div className="border rounded-lg p-4">
            <div className="space-y-2">
              {localeEntries.map(([locale, count]) => {
                const percentage = localeTotal > 0 ? ((count / localeTotal) * 100).toFixed(1) : "0";
                return (
                  <div key={locale} className="flex items-center gap-2">
                    <div className="text-sm font-medium w-20">{locale}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                      <div
                        className="bg-blue-500 h-4 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-sm text-neutral-600 w-20 text-right">
                      {count} ({percentage}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-medium mb-2">Top 问题</h2>
        <ul className="list-disc pl-6">
          {topQuestions.length > 0 ? (
            topQuestions.map((x, i) => {
              const question = "q" in x ? x.q : x.question;
              return (
                <li key={i} className="text-sm">
                  {question} <span className="text-neutral-400">({x.count})</span>
                </li>
              );
            })
          ) : (
            <li className="text-sm text-neutral-400">无数据</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
