"use client";

import { useEffect, useState, useCallback } from "react";

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

type ProviderStatsResp = {
  ok: boolean;
  data?: Array<{
    provider: string;
    model: string | null;
    scene: string | null;
    total_calls: number;
    total_success: number;
    total_error: number;
    success_rate: string;
  }>;
  message?: string;
};

async function fetchProviderStats(dateISO: string, token?: string): Promise<ProviderStatsResp> {
  const base = typeof window !== "undefined" 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
  const url = `${base}/api/admin/ai/stats/providers?date=${encodeURIComponent(dateISO)}`;
  const res = await fetch(url, { 
    cache: "no-store",
    headers: token ? {
      "Authorization": `Bearer ${token}`,
    } : {},
  });
  return (await res.json()) as ProviderStatsResp;
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
  
  // 即使返回非2xx状态码，也尝试解析JSON（后端统一返回JSON格式）
  const data = await res.json().catch(() => ({ 
    ok: false, 
    message: res.status === 502 
      ? "AI服务不可用，请检查服务状态或稍后重试" 
      : `请求失败 (${res.status})` 
  }));
  
  // 如果响应不是ok，返回错误信息
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      message: data.message || data.errorCode || `请求失败 (${res.status})`,
    };
  }
  
  return data as { ok: boolean; message?: string };
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

type HeartbeatResp = {
  ok: boolean;
  data?: {
    checkedAt: string;
    providers: Array<{
      id: string;
      label: string;
      mode: "local" | "remote";
      endpoint: string;
      status: "up" | "down";
      latencyMs: number | null;
      lastError: string | null;
    }>;
  };
  message?: string;
};

async function fetchHeartbeat(token?: string): Promise<HeartbeatResp> {
  const base = typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
  const url = `${base}/api/admin/ai/heartbeat`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: token ? {
      "Authorization": `Bearer ${token}`,
    } : {},
  });
  return (await res.json()) as HeartbeatResp;
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

// 从 localStorage 读取心跳启用状态
function getHeartbeatEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem("ai_monitor_heartbeat_enabled");
  if (stored !== null) {
    try {
      return JSON.parse(stored);
    } catch {
      return true;
    }
  }
  return true; // 默认启用
}

// 保存心跳启用状态到 localStorage
function saveHeartbeatEnabled(enabled: boolean) {
  if (typeof window !== "undefined") {
    localStorage.setItem("ai_monitor_heartbeat_enabled", JSON.stringify(enabled));
  }
}

export default function AdminAiMonitorPage() {
  const [dateISO, setDateISO] = useState(() => new Date().toISOString().slice(0, 10));
  const [resp, setResp] = useState<SummaryResp | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStatsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null);
  const [prewarming, setPrewarming] = useState(false);
  const [prewarmMessage, setPrewarmMessage] = useState<string | null>(null);
  const [refreshConfig, setRefreshConfig] = useState(getRefreshConfig);
  const [showRefreshConfig, setShowRefreshConfig] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatResp | null>(null);
  const [loadingHeartbeat, setLoadingHeartbeat] = useState(false);
  const [heartbeatError, setHeartbeatError] = useState<string | null>(null);
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(getHeartbeatEnabled);

  const loadData = async () => {
    try {
      setLoading(true);
      // 从 localStorage 获取 token（如果存在）
      const token = typeof window !== "undefined" ? localStorage.getItem("ADMIN_TOKEN") : undefined;
      const [summaryData, statsData] = await Promise.all([
        fetchSummary(dateISO, token || undefined),
        fetchProviderStats(dateISO, token || undefined),
      ]);
      setResp(summaryData);
      setProviderStats(statsData);
      setLoading(false);
      setLastRefreshTime(new Date());
    } catch (err) {
      setResp({ ok: false, message: err instanceof Error ? err.message : "unknown error" });
      setLoading(false);
    }
  };

  const fetchHeartbeatData = useCallback(async () => {
    try {
      setLoadingHeartbeat(true);
      setHeartbeatError(null);
      const token = typeof window !== "undefined" ? localStorage.getItem("ADMIN_TOKEN") : undefined;
      const data = await fetchHeartbeat(token || undefined);
      if (!data.ok) {
        throw new Error(data.message || "心跳检查失败");
      }
      setHeartbeat(data);
    } catch (err: any) {
      setHeartbeatError(err?.message ?? "心跳检查失败");
    } finally {
      setLoadingHeartbeat(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let pollTimer: NodeJS.Timeout | null = null;
    let autoRefreshTimer: NodeJS.Timeout | null = null;
    let heartbeatTimer: NodeJS.Timeout | null = null;

    loadData();
    // ✅ 修复：只有在心跳服务启用时才执行初始心跳检查
    if (heartbeatEnabled) {
    fetchHeartbeatData();
    }

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

    // 心跳监控轮询（每60秒）- 仅在启用时执行
    if (heartbeatEnabled) {
      heartbeatTimer = setInterval(() => {
        if (mounted) {
          fetchHeartbeatData();
        }
      }, 60000);
    }

    return () => {
      mounted = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (autoRefreshTimer) clearInterval(autoRefreshTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [dateISO, rebuildMessage, refreshConfig.enabled, refreshConfig.intervalMinutes, fetchHeartbeatData, heartbeatEnabled]);

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
        setRebuildMessage("✅ 重跑任务已启动，10秒后将自动刷新数据");
        // 10秒后自动刷新
        setTimeout(() => {
          loadData();
        }, 10000);
      } else {
        const errorMsg = result.message || "重跑失败";
        setRebuildMessage(`❌ ${errorMsg}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "重跑失败";
      console.error("Rebuild failed:", err);
      setRebuildMessage(`❌ 网络错误: ${errorMsg}`);
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

  const handleViewToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDateISO(today);
  };

  const handleRebuildToday = async () => {
    try {
      setRebuilding(true);
      setRebuildMessage(null);
      const today = new Date().toISOString().slice(0, 10);
      
      const token = typeof window !== "undefined" ? localStorage.getItem("ADMIN_TOKEN") : undefined;
      const result = await rebuildSummary(today, token || undefined);
      
      if (result.ok) {
        setRebuildMessage("✅ 今日汇总重跑任务已启动，10秒后将自动刷新数据");
        // 10秒后自动刷新
        setTimeout(() => {
          loadData();
        }, 10000);
      } else {
        const errorMsg = result.message || "重跑失败";
        setRebuildMessage(`❌ ${errorMsg}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "重跑失败";
      console.error("Rebuild today failed:", err);
      setRebuildMessage(`❌ 网络错误: ${errorMsg}`);
    } finally {
      setRebuilding(false);
    }
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

  // 即使 summary 失败，也显示页面，但显示错误提示
  const d = resp?.data;
  const totals = d?.totals || {};
  
  // 确保所有数值都是数字类型
  const normalizeNumber = (value: any): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };
  
  const totalCalls = normalizeNumber(d?.totalCalls || totals.totalCalls || 0);
  const avgCost = normalizeNumber(d?.avgCostUsd || d?.avgCost || totals.avgCost || totals.avgCostUsd || 0);
  const cacheHitRate = normalizeNumber(d?.cacheHitRate || totals.cacheHitRate || 0);
  const ragHitRate = normalizeNumber(d?.ragHitRate || totals.ragHitRate || 0);
  const blocked = normalizeNumber(d?.blocked || 0);
  const needsHuman = normalizeNumber(d?.needsHuman || 0);
  const locales = d?.locales || {};
  const topQuestionsRaw = d?.topQuestions || [];

  // 过滤和规范化 topQuestions，确保所有元素都是有效对象
  // 统一为包含 question 字段的格式，方便后续使用
  const topQuestions: Array<{ question: string; count: number }> = Array.isArray(topQuestionsRaw) 
    ? topQuestionsRaw
        .filter((x): boolean => {
          if (!x || typeof x !== "object") return false;
          const hasQuestion = ("q" in x && x.q) || ("question" in x && x.question);
          const hasCount = "count" in x && (typeof x.count === "number" || typeof x.count === "string");
          return !!(hasQuestion && hasCount);
        })
        .map((x): { question: string; count: number } => {
          // 优先使用 q，如果没有则使用 question
          const q = "q" in x ? (typeof x.q === "string" ? x.q : String(x.q || "")) : undefined;
          const question = "question" in x ? (typeof x.question === "string" ? x.question : String(x.question || "")) : undefined;
          const count = typeof x.count === "number" ? x.count : typeof x.count === "string" ? Number(x.count) || 0 : 0;
          
          // 统一返回包含 question 字段的格式
          return {
            question: q || question || "",
            count,
          };
        })
    : [];

  // 计算 locales 饼图数据
  // 确保 locales 的值都是数字，键都是字符串
  const normalizedLocales = Object.entries(locales).reduce((acc, [key, value]) => {
    // 确保 key 是字符串
    const stringKey = typeof key === "string" ? key : String(key || "");
    if (!stringKey) return acc;
    
    const numValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
    if (numValue > 0 && !isNaN(numValue)) {
      acc[stringKey] = numValue;
    }
    return acc;
  }, {} as Record<string, number>);
  
  const localeEntries = Object.entries(normalizedLocales)
    .filter(([key, value]) => typeof key === "string" && typeof value === "number" && !isNaN(value))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const localeTotal = Object.values(normalizedLocales).reduce((sum, v) => sum + (typeof v === "number" && !isNaN(v) ? v : 0), 0);

  // 检查是否有实际数据（避免渲染空对象）
  // 不仅要检查对象是否有键，还要检查是否有实际的数据值
  const hasData = d && typeof d === "object" && d !== null && !Array.isArray(d) && 
    (Object.keys(d).length > 0 && (
      d.totalCalls !== undefined || 
      d.avgCost !== undefined || 
      d.avgCostUsd !== undefined ||
      d.cacheHitRate !== undefined ||
      d.ragHitRate !== undefined ||
      (d.locales && Object.keys(d.locales).length > 0) ||
      (d.topQuestions && Array.isArray(d.topQuestions) && d.topQuestions.length > 0)
    ));

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">AI 每日摘要</h1>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-neutral-600">日期（UTC）：</label>
              <input
                type="date"
                value={dateISO}
                onChange={(e) => setDateISO(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <button
              onClick={handleViewToday}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
              title="快速切换到今天"
            >
              查看今天
            </button>
            <div className="text-sm text-neutral-500">
              {lastRefreshTime && (
                <span>
                  · 最后刷新：{lastRefreshTime.toLocaleTimeString()}
                </span>
              )}
            </div>
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
            title="重新计算昨天的汇总数据"
          >
            {rebuilding ? "重跑中..." : "重跑昨日汇总"}
          </button>
          <button
            onClick={handleRebuildToday}
            disabled={rebuilding}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-400 text-sm"
            title="重新计算今天的汇总数据（包含今天0点到现在所有数据）"
          >
            {rebuilding ? "重跑中..." : "重跑今日汇总"}
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

      {!resp?.ok && (
        <div className="p-3 rounded bg-red-100 text-red-700">
          摘要数据加载失败：{resp?.message ?? "unknown error"}
        </div>
      )}

      {/* AI 服务状态 */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">AI 服务状态</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newEnabled = !heartbeatEnabled;
                setHeartbeatEnabled(newEnabled);
                saveHeartbeatEnabled(newEnabled);
              }}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                heartbeatEnabled
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              title={heartbeatEnabled ? "停止自动心跳检查" : "开始自动心跳检查"}
            >
              {heartbeatEnabled ? "⏸️ 停止心跳" : "▶️ 开始心跳"}
            </button>
            <button
              onClick={fetchHeartbeatData}
              disabled={loadingHeartbeat}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400"
              title="立即执行一次心跳检查"
            >
              {loadingHeartbeat ? "刷新中..." : "立刻刷新"}
            </button>
          </div>
        </div>
        {heartbeatError && (
          <p className="mb-2 text-sm text-red-500">
            心跳检查失败：{heartbeatError}
          </p>
        )}
        {heartbeat?.data && heartbeat.data.providers && Array.isArray(heartbeat.data.providers) && (
          <>
            <p className="mb-3 text-xs text-gray-500">
              最近检查时间：{new Date(heartbeat.data.checkedAt).toLocaleString()}
            </p>
            <div className="space-y-2">
              {heartbeat.data.providers
                .filter((p) => p && typeof p === "object" && p.id)
                .map((p) => {
                  // 确保所有字段都是正确的类型
                  const id = String(p.id || "");
                  const label = String(p.label || "");
                  const endpoint = String(p.endpoint || "");
                  const mode = p.mode === "local" ? "本地" : "远程";
                  const status = p.status === "up" ? "在线" : "离线";
                  
                  // 确保 lastError 始终是字符串
                  const errorMessage = p.lastError 
                    ? (typeof p.lastError === "string" 
                        ? p.lastError 
                        : typeof p.lastError === "object" 
                          ? JSON.stringify(p.lastError) 
                          : String(p.lastError))
                    : null;
                  
                  // 确保 latencyMs 是数字
                  const latencyMs = typeof p.latencyMs === "number" && !isNaN(p.latencyMs) ? p.latencyMs : null;
                  
                  if (!id) return null; // 如果 id 为空，跳过
                  
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {label}{" "}
                          <span className="ml-2 text-xs text-gray-500">
                            ({mode})
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {endpoint}
                        </div>
                        {errorMessage && p.status === "down" && (
                          <div className="text-xs text-red-500 mt-1">
                            错误：{errorMessage}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={
                              p.status === "up"
                                ? "h-2 w-2 rounded-full bg-green-500"
                                : "h-2 w-2 rounded-full bg-red-500"
                            }
                          />
                          <span className="text-sm font-medium">
                            {status}
                          </span>
                        </div>
                        {latencyMs !== null && (
                          <div className="mt-1 text-xs text-gray-500">
                            延迟：{latencyMs} ms
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
                .filter(Boolean)}
            </div>
          </>
        )}
        {!heartbeat && !heartbeatError && !loadingHeartbeat && (
          <p className="text-sm text-gray-500">暂无心跳数据。</p>
        )}
        {loadingHeartbeat && !heartbeat && (
          <p className="text-sm text-gray-500">加载中...</p>
        )}
      </div>

      {hasData && (
        <>
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
                // 确保 locale 是字符串，count 是数字（数据已经在前面规范化了）
                const localeStr = typeof locale === "string" ? locale : String(locale || "");
                const countNum = typeof count === "number" && !isNaN(count) ? count : 0;
                const percentage = localeTotal > 0 && countNum > 0 ? ((countNum / localeTotal) * 100).toFixed(1) : "0";
                
                // 如果 locale 为空，跳过这个条目
                if (!localeStr) return null;
                
                return (
                  <div key={localeStr} className="flex items-center gap-2">
                    <div className="text-sm font-medium w-20">{localeStr}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                      <div
                        className="bg-blue-500 h-4 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-sm text-neutral-600 w-20 text-right">
                      {countNum} ({percentage}%)
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        </div>
      )}

            <div>
              <h2 className="font-medium mb-2">Top 问题</h2>
              <ul className="list-disc pl-6">
                {topQuestions.length > 0 ? (
                  topQuestions.map((x, i) => {
                    // 数据已经在前面规范化了，统一为 { question, count } 格式
                    const question = x.question || "";
                    const count = x.count || 0;
                    return (
                      <li key={i} className="text-sm">
                        {String(question)} <span className="text-neutral-400">({Number(count)})</span>
                      </li>
                    );
                  })
                ) : (
                  <li className="text-sm text-neutral-400">无数据</li>
                )}
              </ul>
            </div>
          </>
      )}

      {!hasData && (
        <div className="p-4 text-gray-500 text-center">
          暂无摘要数据
        </div>
      )}

      {/* AI Provider 调用统计 */}
      <div>
        <h2 className="font-medium mb-2">AI Provider 调用统计（{dateISO}）</h2>
        {providerStats?.ok && providerStats.data && providerStats.data.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Provider</th>
                  <th className="px-4 py-2 text-left font-medium">Model</th>
                  <th className="px-4 py-2 text-left font-medium">Scene</th>
                  <th className="px-4 py-2 text-right font-medium">总调用</th>
                  <th className="px-4 py-2 text-right font-medium">成功</th>
                  <th className="px-4 py-2 text-right font-medium">失败</th>
                  <th className="px-4 py-2 text-right font-medium">成功率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {providerStats.data
                  .filter((stat) => stat && typeof stat === "object")
                  .map((stat, i) => {
                    // 确保所有字段都是正确的类型
                    const provider = String(stat.provider || "-");
                    const model = stat.model 
                      ? (typeof stat.model === "string" 
                          ? (stat.model.length > 20 ? stat.model.substring(0, 20) + "..." : stat.model)
                          : String(stat.model))
                      : "-";
                    const scene = String(stat.scene || "-");
                    const totalCalls = normalizeNumber(stat.total_calls);
                    const totalSuccess = normalizeNumber(stat.total_success);
                    const totalError = normalizeNumber(stat.total_error);
                    const successRate = String(stat.success_rate || "0%");
                    
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2">{provider}</td>
                        <td className="px-4 py-2 text-neutral-600">{model}</td>
                        <td className="px-4 py-2 text-neutral-600">{scene}</td>
                        <td className="px-4 py-2 text-right">{totalCalls}</td>
                        <td className="px-4 py-2 text-right text-green-600">{totalSuccess}</td>
                        <td className="px-4 py-2 text-right text-red-600">{totalError}</td>
                        <td className="px-4 py-2 text-right">{successRate}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border rounded-lg p-4 text-sm text-neutral-400">
            暂无数据
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  // 确保 value 始终是字符串或数字，不会是对象
  const displayValue = typeof value === "string" || typeof value === "number" 
    ? value 
    : typeof value === "object" 
      ? JSON.stringify(value) 
      : String(value || "");
  
  return (
    <div className="border rounded-lg p-4">
      <div className="text-xs text-neutral-500">{String(label)}</div>
      <div className="text-lg font-semibold mt-1">{displayValue}</div>
    </div>
  );
}
