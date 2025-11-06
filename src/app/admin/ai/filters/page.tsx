"use client";

import { useState, useEffect } from "react";

type FilterItem = {
  id: number;
  type: string;
  pattern: string;
  status: "draft" | "active" | "inactive";
  changedBy?: number;
  changedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type GetResp = {
  ok: boolean;
  data?: { items?: FilterItem[] };
  message?: string;
};

type HistoryItem = {
  id: number;
  filterId: number;
  type: string;
  pattern: string;
  status: "draft" | "active" | "inactive";
  changedBy?: number;
  changedAt?: string;
  action: string;
};

type HistoryResp = {
  ok: boolean;
  data?: { items?: HistoryItem[] };
  message?: string;
};

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
}

function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("ADMIN_TOKEN") || localStorage.getItem("adminToken");
  }
  return null;
}

async function fetchFilters(): Promise<GetResp> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/filters`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

async function saveFilters(items: Array<{ type: string; pattern: string; status?: "draft" | "active" }>): Promise<{ ok: boolean; message?: string }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/filters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ items }),
  });
  return res.json();
}

async function updateStatus(id: number, status: "draft" | "active" | "inactive"): Promise<{ ok: boolean; message?: string }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/filters/${id}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

async function fetchHistory(filterId: number): Promise<HistoryResp> {
  const base = getBaseUrl();
  const token = getAuthToken();
  try {
    const res = await fetch(`${base}/api/admin/ai/filters/history?filterId=${filterId}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    // 检查响应状态
    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await res.json();
        return {
          ok: false,
          message: errorData.message || `HTTP ${res.status}: ${res.statusText}`,
        };
      } else {
        const text = await res.text();
        return {
          ok: false,
          message: `HTTP ${res.status}: ${res.statusText}. ${text.substring(0, 100)}`,
        };
      }
    }

    // 检查 Content-Type 是否为 JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      return {
        ok: false,
        message: `Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`,
      };
    }

    return res.json();
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to fetch history",
    };
  }
}

async function testRegex(pattern: string, testText: string): Promise<{ ok: boolean; matches: boolean; error?: string }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  try {
    const res = await fetch(`${base}/api/admin/ai/filters/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ pattern, testText }),
    });
    const data = await res.json();
    if (data.ok) {
      return { ok: true, matches: data.data?.matches ?? false };
    }
    return { ok: false, matches: false, error: data.message || "测试失败" };
  } catch (err) {
    return { ok: false, matches: false, error: err instanceof Error ? err.message : "测试失败" };
  }
}

function TestRegexTool({ pattern, onPatternChange }: { pattern: string; onPatternChange: (p: string) => void }) {
  const [testText, setTestText] = useState("");
  const [result, setResult] = useState<{ matches: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // 前端验证（实时）
  useEffect(() => {
    if (!pattern || !testText) {
      setResult(null);
      return;
    }

    try {
      // 尝试作为正则表达式
      const regex = new RegExp(pattern);
      const matches = regex.test(testText);
      setResult({ matches });
    } catch (err) {
      // 如果不是有效的正则，尝试作为普通字符串或管道分隔
      try {
        const parts = pattern.split("|").map((p) => p.trim());
        const matches = parts.some((p) => {
          try {
            return new RegExp(p).test(testText);
          } catch {
            return testText.includes(p);
          }
        });
        setResult({ matches });
      } catch {
        setResult({ matches: false, error: "无效的正则表达式" });
      }
    }
  }, [pattern, testText]);

  const handleBackendTest = async () => {
    if (!pattern || !testText) return;
    setTesting(true);
    try {
      const backendResult = await testRegex(pattern, testText);
      setResult({ matches: backendResult.matches, error: backendResult.error });
    } catch (err) {
      setResult({ matches: false, error: err instanceof Error ? err.message : "后端测试失败" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="font-medium text-sm">测试正则表达式</h3>
      <div>
        <label className="block text-xs text-gray-600 mb-1">测试文本</label>
        <input
          type="text"
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="输入样例问题"
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </div>
      {result !== null && (
        <div className={`text-sm p-2 rounded ${result.matches ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {result.error ? (
            <span className="text-amber-600">{result.error}</span>
          ) : (
            <span>{result.matches ? "❌ 会被拦截" : "✅ 不会被拦截"}</span>
          )}
          {!result.error && (
            <span className="ml-2 text-xs text-gray-500">
              （前端预览）
              <button
                onClick={handleBackendTest}
                disabled={testing}
                className="ml-2 text-blue-600 hover:underline text-xs"
              >
                {testing ? "测试中..." : "后端校验"}
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAiFiltersPage() {
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notDriving, setNotDriving] = useState("");
  const [sensitive, setSensitive] = useState("");
  const [notDrivingStatus, setNotDrivingStatus] = useState<"draft" | "active">("draft");
  const [sensitiveStatus, setSensitiveStatus] = useState<"draft" | "active">("draft");
  const [selectedFilter, setSelectedFilter] = useState<FilterItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    setLoading(true);
    try {
      const resp = await fetchFilters();
      if (resp.ok && resp.data?.items) {
        const items = resp.data.items;
        setFilters(items);
        const notDrivingItem = items.find((x) => x.type === "not-driving");
        const sensitiveItem = items.find((x) => x.type === "sensitive");
        setNotDriving(notDrivingItem?.pattern ?? "");
        setSensitive(sensitiveItem?.pattern ?? "");
        setNotDrivingStatus(notDrivingItem?.status === "active" ? "active" : "draft");
        setSensitiveStatus(sensitiveItem?.status === "active" ? "active" : "draft");
      }
    } catch (err) {
      console.error("Failed to load filters:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!notDriving.trim() && !sensitive.trim()) {
      alert("至少需要填写一个规则");
      return;
    }

    setSaving(true);
    try {
      const items = [];
      if (notDriving.trim()) {
        items.push({ type: "not-driving", pattern: notDriving.trim(), status: notDrivingStatus });
      }
      if (sensitive.trim()) {
        items.push({ type: "sensitive", pattern: sensitive.trim(), status: sensitiveStatus });
      }

      const resp = await saveFilters(items);
      if (resp.ok) {
        await loadFilters();
        alert("保存成功");
      } else {
        alert(resp.message || "保存失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: "draft" | "active" | "inactive") => {
    try {
      const resp = await updateStatus(id, newStatus);
      if (resp.ok) {
        await loadFilters();
      } else {
        alert(resp.message || "状态更新失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "状态更新失败");
    }
  };

  const handleViewHistory = async (filter: FilterItem) => {
    setSelectedFilter(filter);
    setShowHistory(true);
    setHistory([]);
    try {
      const resp = await fetchHistory(filter.id);
      if (resp.ok && resp.data?.items) {
        setHistory(resp.data.items);
      } else {
        console.error("Failed to load history:", resp.message);
        alert(resp.message || "获取历史记录失败");
      }
    } catch (err) {
      console.error("Failed to load history:", err);
      alert(err instanceof Error ? err.message : "获取历史记录失败");
    }
  };

  const getStatusBadge = (status: "draft" | "active" | "inactive") => {
    const colors = {
      draft: "bg-gray-100 text-gray-700",
      active: "bg-green-100 text-green-700",
      inactive: "bg-red-100 text-red-700",
    };
    const labels = {
      draft: "草案",
      active: "生效",
      inactive: "停用",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs ${colors[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">AI 过滤规则</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：规则列表 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">类型</th>
                  <th className="px-4 py-2 text-left">规则</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {filters.map((filter) => (
                  <tr key={filter.id} className="border-t">
                    <td className="px-4 py-2">
                      {filter.type === "not-driving" ? "非驾驶相关" : "敏感规则"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs max-w-xs truncate">
                      {filter.pattern}
                    </td>
                    <td className="px-4 py-2">{getStatusBadge(filter.status)}</td>
                    <td className="px-4 py-2 space-x-2">
                      {filter.status === "draft" && (
                        <button
                          onClick={() => handleStatusChange(filter.id, "active")}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          发布
                        </button>
                      )}
                      {filter.status === "active" && (
                        <button
                          onClick={() => handleStatusChange(filter.id, "inactive")}
                          className="text-xs text-red-600 hover:underline"
                        >
                          停用
                        </button>
                      )}
                      {filter.status === "inactive" && (
                        <button
                          onClick={() => handleStatusChange(filter.id, "active")}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          启用
                        </button>
                      )}
                      <button
                        onClick={() => handleViewHistory(filter)}
                        className="text-xs text-gray-600 hover:underline"
                      >
                        历史
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 编辑表单 */}
          <div className="border rounded-lg p-4 space-y-4">
            <h2 className="font-medium">编辑规则</h2>
            <div>
              <label className="block text-sm font-medium mb-1">非驾驶相关（正则或 | 连接）</label>
              <textarea
                value={notDriving}
                onChange={(e) => setNotDriving(e.target.value)}
                className="w-full border rounded p-2 h-24 font-mono text-sm"
                placeholder="例如: 天气|新闻|娱乐"
              />
              <div className="mt-1 flex items-center gap-2">
                <label className="text-xs">
                  <input
                    type="radio"
                    checked={notDrivingStatus === "draft"}
                    onChange={() => setNotDrivingStatus("draft")}
                    className="mr-1"
                  />
                  草案
                </label>
                <label className="text-xs">
                  <input
                    type="radio"
                    checked={notDrivingStatus === "active"}
                    onChange={() => setNotDrivingStatus("active")}
                    className="mr-1"
                  />
                  生效
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">敏感规则（正则或 | 连接）</label>
              <textarea
                value={sensitive}
                onChange={(e) => setSensitive(e.target.value)}
                className="w-full border rounded p-2 h-24 font-mono text-sm"
                placeholder="例如: 政治|暴力|色情"
              />
              <div className="mt-1 flex items-center gap-2">
                <label className="text-xs">
                  <input
                    type="radio"
                    checked={sensitiveStatus === "draft"}
                    onChange={() => setSensitiveStatus("draft")}
                    className="mr-1"
                  />
                  草案
                </label>
                <label className="text-xs">
                  <input
                    type="radio"
                    checked={sensitiveStatus === "active"}
                    onChange={() => setSensitiveStatus("active")}
                    className="mr-1"
                  />
                  生效
                </label>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>

        {/* 右侧：测试工具 */}
        <div className="space-y-4">
          {notDriving && (
            <div>
              <div className="text-xs text-gray-600 mb-1">非驾驶相关规则测试</div>
              <TestRegexTool
                pattern={notDriving}
                onPatternChange={setNotDriving}
              />
            </div>
          )}
          {sensitive && (
            <div>
              <div className="text-xs text-gray-600 mb-1">敏感规则测试</div>
              <TestRegexTool
                pattern={sensitive}
                onPatternChange={setSensitive}
              />
            </div>
          )}
          {!notDriving && !sensitive && (
            <div className="text-sm text-gray-500">
              请在左侧输入规则后测试
            </div>
          )}
        </div>
      </div>

      {/* 历史记录模态框 */}
      {showHistory && selectedFilter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {selectedFilter.type === "not-driving" ? "非驾驶相关" : "敏感规则"} - 变更历史
              </h2>
              <button
                onClick={() => {
                  setShowHistory(false);
                  setSelectedFilter(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="text-gray-500 text-sm">暂无历史记录</div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="border rounded p-3 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{getStatusBadge(item.status)}</span>
                      <span className="text-gray-500 text-xs">
                        {item.changedAt ? new Date(item.changedAt).toLocaleString() : ""}
                      </span>
                    </div>
                    <div className="font-mono text-xs bg-gray-50 p-2 rounded mb-2">{item.pattern}</div>
                    <div className="text-xs text-gray-500">
                      操作: {item.action === "create" ? "创建" : item.action === "status_change" ? "状态变更" : "更新"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
