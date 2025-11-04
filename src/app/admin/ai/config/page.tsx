"use client";

import { useState, useEffect } from "react";

type Config = {
  dailyAskLimit: number;
  answerCharLimit: number;
  model: string;
  cacheTtl: number;
  costAlertUsdThreshold: number;
};

type ConfigResp = {
  ok: boolean;
  data?: Config;
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

async function fetchConfig(): Promise<ConfigResp> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/config`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

async function saveConfig(config: Partial<Config>): Promise<{ ok: boolean; message?: string }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(config),
  });
  return res.json();
}

function formatCacheTtl(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} 分钟`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} 小时`;
  }
  return `${Math.floor(seconds / 86400)} 天`;
}

export default function AdminAiConfigPage() {
  const [config, setConfig] = useState<Config>({
    dailyAskLimit: 10,
    answerCharLimit: 300,
    model: "gpt-4o-mini",
    cacheTtl: 86400,
    costAlertUsdThreshold: 10.0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const resp = await fetchConfig();
      if (resp.ok && resp.data) {
        setConfig(resp.data);
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const resp = await saveConfig(config);
      if (resp.ok) {
        setSaveSuccess(true);
        // 3秒后隐藏成功提示
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(resp.message || "保存失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">AI 配置中心</h1>
        {saveSuccess && (
          <div className="px-4 py-2 bg-green-100 text-green-700 rounded text-sm">
            ✅ 保存成功，立即生效
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：配置表单 */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-4">
            <h2 className="font-medium">运营参数</h2>

            <div>
              <label className="block text-sm font-medium mb-1">
                每日提问限制 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={config.dailyAskLimit}
                onChange={(e) =>
                  setConfig({ ...config, dailyAskLimit: Number(e.target.value) })
                }
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">每用户每日可提问的次数</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                回答字符限制 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="10"
                max="10000"
                value={config.answerCharLimit}
                onChange={(e) =>
                  setConfig({ ...config, answerCharLimit: Number(e.target.value) })
                }
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">AI 回答的最大字符数</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                AI 模型 <span className="text-red-500">*</span>
              </label>
              <select
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">当前使用的 AI 模型</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                缓存 TTL（秒） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="604800"
                value={config.cacheTtl}
                onChange={(e) =>
                  setConfig({ ...config, cacheTtl: Number(e.target.value) })
                }
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                缓存有效期（秒），0 表示不缓存，最大 7 天（604800 秒）
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                成本警告阈值（USD） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={config.costAlertUsdThreshold}
                onChange={(e) =>
                  setConfig({ ...config, costAlertUsdThreshold: Number(e.target.value) })
                }
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">当成本超过此阈值时触发警告</p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存配置"}
            </button>
          </div>
        </div>

        {/* 右侧：辅助提示 */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-3">
            <h2 className="font-medium">配置提示</h2>

            <div className="space-y-2 text-sm">
              <div>
                <div className="font-medium text-gray-700">当前成本阈值</div>
                <div className="text-gray-600">${config.costAlertUsdThreshold.toFixed(2)} USD</div>
                <p className="text-xs text-gray-500 mt-1">
                  当每日成本超过此值时，系统会触发警告通知
                </p>
              </div>

              <div className="border-t pt-2">
                <div className="font-medium text-gray-700">当前模型名称</div>
                <div className="text-gray-600 font-mono">{config.model}</div>
                <p className="text-xs text-gray-500 mt-1">
                  当前使用的 AI 模型，影响回答质量和成本
                </p>
              </div>

              <div className="border-t pt-2">
                <div className="font-medium text-gray-700">缓存 TTL</div>
                <div className="text-gray-600">{formatCacheTtl(config.cacheTtl)}</div>
                <p className="text-xs text-gray-500 mt-1">
                  相同问题的回答会在此时间内使用缓存，减少 API 调用成本
                </p>
              </div>

              <div className="border-t pt-2">
                <div className="font-medium text-gray-700">每日提问限制</div>
                <div className="text-gray-600">{config.dailyAskLimit} 次/用户</div>
                <p className="text-xs text-gray-500 mt-1">
                  每个用户每天最多可以提问的次数
                </p>
              </div>

              <div className="border-t pt-2">
                <div className="font-medium text-gray-700">回答字符限制</div>
                <div className="text-gray-600">{config.answerCharLimit} 字符</div>
                <p className="text-xs text-gray-500 mt-1">
                  AI 回答的最大字符数，超过部分会被截断
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="font-medium text-sm text-blue-900 mb-2">💡 提示</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• 配置修改后立即生效，无需重启服务</li>
              <li>• 可在监控页面验证配置是否生效</li>
              <li>• 建议在低峰期调整配置，避免影响用户体验</li>
              <li>• 成本阈值建议根据实际使用情况定期调整</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

