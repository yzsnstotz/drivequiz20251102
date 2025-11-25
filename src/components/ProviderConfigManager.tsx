"use client";

import { useState, useEffect } from "react";

type ProviderConfig = {
  id: number;
  provider: string;
  model: string | null;
  isEnabled: boolean;
  dailyLimit: number | null;
  todayUsed: number;
  priority: number;
  isLocalFallback: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProviderConfigResponse = {
  ok: boolean;
  data?: ProviderConfig[];
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

async function fetchProviders(): Promise<ProviderConfigResponse> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/providers`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

async function updateProvider(
  id: number,
  updates: Partial<ProviderConfig>
): Promise<{ ok: boolean; message?: string }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/providers/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(updates),
  });
  return res.json();
}

async function createProvider(
  provider: Partial<ProviderConfig>
): Promise<{ ok: boolean; message?: string; data?: ProviderConfig }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/providers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(provider),
  });
  return res.json();
}

async function deleteProvider(id: number): Promise<{ ok: boolean; message?: string }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/providers/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI (通过 Render)",
  openai_direct: "OpenAI (直连)",
  gemini_direct: "Google Gemini (直连)",
  openrouter: "OpenRouter (通过 Render)",
  openrouter_direct: "OpenRouter (直连)",
  local: "本地 AI (Ollama)",
  ollama: "Ollama",
};

export default function ProviderConfigManager() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingProvider, setEditingProvider] = useState<Partial<ProviderConfig> | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState<Partial<ProviderConfig>>({
    provider: "openai",
    model: null,
    isEnabled: true,
    dailyLimit: null,
    priority: 100,
    isLocalFallback: false,
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const resp = await fetchProviders();
      if (resp.ok && resp.data) {
        setProviders(resp.data);
      } else {
        setMessage({ type: "error", text: resp.message || "加载失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (provider: ProviderConfig) => {
    setEditingId(provider.id);
    setEditingProvider({ ...provider });
  };

  const handleSave = async () => {
    if (!editingId || !editingProvider) return;

    try {
      const resp = await updateProvider(editingId, {
        isEnabled: editingProvider.isEnabled,
        dailyLimit: editingProvider.dailyLimit,
        priority: editingProvider.priority,
        isLocalFallback: editingProvider.isLocalFallback,
      });

      if (resp.ok) {
        setMessage({ type: "success", text: "保存成功" });
        setEditingId(null);
        setEditingProvider(null);
        await loadProviders();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: resp.message || "保存失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "保存失败" });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingProvider(null);
  };

  const handleAdd = async () => {
    try {
      const resp = await createProvider(newProvider);
      if (resp.ok) {
        setMessage({ type: "success", text: "创建成功" });
        setShowAddForm(false);
        setNewProvider({
          provider: "openai",
          model: null,
          isEnabled: true,
          dailyLimit: null,
          priority: 100,
          isLocalFallback: false,
        });
        await loadProviders();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: resp.message || "创建失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "创建失败" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此配置吗？")) return;

    try {
      const resp = await deleteProvider(id);
      if (resp.ok) {
        setMessage({ type: "success", text: "删除成功" });
        await loadProviders();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: resp.message || "删除失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "删除失败" });
    }
  };

  const formatUsage = (used: number, limit: number | null) => {
    if (limit === null || limit === 0) {
      return `${used} / ∞`;
    }
    const percentage = (used / limit) * 100;
    const colorClass = percentage >= 90 ? "text-red-600" : percentage >= 70 ? "text-yellow-600" : "text-gray-600";
    return <span className={colorClass}>{used} / {limit}</span>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Provider 调用策略</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800"
        >
          {showAddForm ? "取消" : "+ 添加 Provider"}
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded text-sm ${
            message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {showAddForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <h3 className="font-medium">添加新 Provider</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Provider</label>
              <select
                value={newProvider.provider || "openai"}
                onChange={(e) => setNewProvider({ ...newProvider, provider: e.target.value })}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                {Object.entries(PROVIDER_NAMES).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Model (可选)</label>
              <input
                type="text"
                value={newProvider.model || ""}
                onChange={(e) => setNewProvider({ ...newProvider, model: e.target.value || null })}
                placeholder="留空表示默认"
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">优先级</label>
              <input
                type="number"
                min="0"
                max="1000"
                value={newProvider.priority || 100}
                onChange={(e) => setNewProvider({ ...newProvider, priority: Number(e.target.value) })}
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">数值越小优先级越高</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">每日上限</label>
              <input
                type="number"
                min="0"
                value={newProvider.dailyLimit || ""}
                onChange={(e) =>
                  setNewProvider({
                    ...newProvider,
                    dailyLimit: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="0 或留空表示无限制"
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={newProvider.isEnabled || false}
                onChange={(e) => setNewProvider({ ...newProvider, isEnabled: e.target.checked })}
                className="rounded"
              />
              <label className="text-xs">启用</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={newProvider.isLocalFallback || false}
                onChange={(e) => setNewProvider({ ...newProvider, isLocalFallback: e.target.checked })}
                className="rounded"
              />
              <label className="text-xs">本地兜底</label>
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800"
          >
            创建
          </button>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Provider</th>
              <th className="px-4 py-2 text-left font-medium">Model</th>
              <th className="px-4 py-2 text-center font-medium">启用</th>
              <th className="px-4 py-2 text-center font-medium">已用 / 上限</th>
              <th className="px-4 py-2 text-center font-medium">优先级</th>
              <th className="px-4 py-2 text-center font-medium">本地兜底</th>
              <th className="px-4 py-2 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {providers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  暂无配置，请添加 Provider
                </td>
              </tr>
            ) : (
              providers.map((provider) => (
                <tr key={provider.id} className="border-t">
                  <td className="px-4 py-2">{PROVIDER_NAMES[provider.provider] || provider.provider}</td>
                  <td className="px-4 py-2 text-gray-600">{provider.model || "-"}</td>
                  <td className="px-4 py-2 text-center">
                    {editingId === provider.id ? (
                      <input
                        type="checkbox"
                        checked={editingProvider?.isEnabled || false}
                        onChange={(e) =>
                          setEditingProvider({ ...editingProvider, isEnabled: e.target.checked })
                        }
                        className="rounded"
                      />
                    ) : (
                      <span className={provider.isEnabled ? "text-green-600" : "text-gray-400"}>
                        {provider.isEnabled ? "✓" : "✗"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {editingId === provider.id ? (
                      <input
                        type="number"
                        min="0"
                        value={editingProvider?.dailyLimit || ""}
                        onChange={(e) =>
                          setEditingProvider({
                            ...editingProvider,
                            dailyLimit: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        placeholder="无限制"
                        className="w-24 border rounded px-2 py-1 text-center"
                      />
                    ) : (
                      formatUsage(provider.todayUsed, provider.dailyLimit)
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {editingId === provider.id ? (
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={editingProvider?.priority || 100}
                        onChange={(e) =>
                          setEditingProvider({ ...editingProvider, priority: Number(e.target.value) })
                        }
                        className="w-20 border rounded px-2 py-1 text-center"
                      />
                    ) : (
                      provider.priority
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {editingId === provider.id ? (
                      <input
                        type="checkbox"
                        checked={editingProvider?.isLocalFallback || false}
                        onChange={(e) =>
                          setEditingProvider({ ...editingProvider, isLocalFallback: e.target.checked })
                        }
                        className="rounded"
                      />
                    ) : (
                      <span className={provider.isLocalFallback ? "text-blue-600" : "text-gray-400"}>
                        {provider.isLocalFallback ? "✓" : "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {editingId === provider.id ? (
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={handleSave}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          保存
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-2 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEdit(provider)}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(provider.id)}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border rounded-lg p-4 bg-blue-50">
        <h3 className="font-medium text-sm text-blue-900 mb-2">💡 使用说明</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>
            • <strong>优先级</strong>：数值越小优先级越高。系统会按优先级顺序选择 Provider，优先使用高优先级且未超过每日上限的 Provider。
          </li>
          <li>
            • <strong>每日上限</strong>：设置为 0 或留空表示无限制。当所有有上限的 Provider 都达到上限后，系统会自动切换到本地兜底 Provider。
          </li>
          <li>
            • <strong>本地兜底</strong>：只能有一个 Provider 设置为本地兜底。本地兜底 Provider 不受每日上限限制，作为最后的备用选项。
          </li>
          <li>
            • <strong>已用 / 上限</strong>：显示今日已调用次数和配置的上限。数据为近实时统计，可能有 1-2 秒延迟。
          </li>
        </ul>
      </div>
    </div>
  );
}

