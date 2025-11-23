"use client";

import { useState, useEffect } from "react";

type TimeoutConfig = {
  provider: string;
  name: string;
  timeout: number;
  defaultTimeout: number;
  description: string;
};

type TimeoutConfigResponse = {
  ok: boolean;
  data?: Record<string, string | number>;
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

async function fetchTimeoutConfig(): Promise<TimeoutConfigResponse> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/config`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

async function saveTimeoutConfig(
  config: Record<string, number>
): Promise<{ ok: boolean; message?: string }> {
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

const PROVIDER_TIMEOUT_CONFIGS: TimeoutConfig[] = [
  {
    provider: "timeoutOpenai",
    name: "OpenAI (通过 Render)",
    timeout: 30000,
    defaultTimeout: 30000,
    description: "默认 30 秒 (30000ms)，范围：1-600 秒",
  },
  {
    provider: "timeoutOpenaiDirect",
    name: "OpenAI (直连)",
    timeout: 30000,
    defaultTimeout: 30000,
    description: "默认 30 秒 (30000ms)，范围：1-600 秒",
  },
  {
    provider: "timeoutOpenrouter",
    name: "OpenRouter (通过 Render)",
    timeout: 30000,
    defaultTimeout: 30000,
    description: "默认 30 秒 (30000ms)，范围：1-600 秒",
  },
  {
    provider: "timeoutOpenrouterDirect",
    name: "OpenRouter (直连)",
    timeout: 30000,
    defaultTimeout: 30000,
    description: "默认 30 秒 (30000ms)，范围：1-600 秒",
  },
  {
    provider: "timeoutGeminiDirect",
    name: "Google Gemini (直连)",
    timeout: 30000,
    defaultTimeout: 30000,
    description: "默认 30 秒 (30000ms)，范围：1-600 秒",
  },
  {
    provider: "timeoutLocal",
    name: "本地 AI (Ollama)",
    timeout: 120000,
    defaultTimeout: 120000,
    description: "默认 120 秒 (120000ms)，本地服务可能较慢，范围：1-600 秒",
  },
];

export default function ProviderTimeoutManager() {
  const [configs, setConfigs] = useState<TimeoutConfig[]>(PROVIDER_TIMEOUT_CONFIGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const resp = await fetchTimeoutConfig();
      if (resp.ok && resp.data) {
        const data = resp.data;
        setConfigs(
          PROVIDER_TIMEOUT_CONFIGS.map((config): TimeoutConfig => ({
            ...config,
            timeout:
              typeof data[config.provider] === "string"
                ? Number(data[config.provider])
                : typeof data[config.provider] === "number"
                ? data[config.provider]
                : config.defaultTimeout,
          }))
        );
      } else {
        setMessage({ type: "error", text: resp.message || "加载失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const configToSave: Record<string, number> = {};
      for (const config of configs) {
        configToSave[config.provider] = config.timeout;
      }

      const resp = await saveTimeoutConfig(configToSave);
      if (resp.ok) {
        setMessage({ type: "success", text: "保存成功，立即生效" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: resp.message || "保存失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  const handleTimeoutChange = (provider: string, value: number) => {
    setConfigs(
      configs.map((config) => (config.provider === provider ? { ...config, timeout: value } : config))
    );
  };

  const handleReset = (provider: string) => {
    const config = PROVIDER_TIMEOUT_CONFIGS.find((c) => c.provider === provider);
    if (config) {
      handleTimeoutChange(provider, config.defaultTimeout);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Provider 超时设置</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存配置"}
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

      <div className="border rounded-lg p-4 space-y-4">
        <div className="space-y-4">
          {configs.map((config) => (
            <div key={config.provider} className="border-b pb-4 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">{config.name}</label>
                <button
                  onClick={() => handleReset(config.provider)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  重置为默认值
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="1000"
                  max="600000"
                  step="1000"
                  value={config.timeout}
                  onChange={(e) => handleTimeoutChange(config.provider, Number(e.target.value))}
                  className="w-32 border rounded px-3 py-2"
                />
                <span className="text-sm text-gray-600">毫秒</span>
                <span className="text-sm text-gray-500">
                  ({Math.floor(config.timeout / 1000)} 秒)
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{config.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-blue-50">
        <h3 className="font-medium text-sm text-blue-900 mb-2">💡 使用说明</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>
            • <strong>超时时间</strong>：设置每个 Provider 的请求超时时间（单位：毫秒）。当请求超过此时间未响应时，系统会自动取消请求。
          </li>
          <li>
            • <strong>范围限制</strong>：超时时间必须在 1 秒（1000ms）到 10 分钟（600000ms）之间。
          </li>
          <li>
            • <strong>本地服务</strong>：本地 AI (Ollama) 默认超时时间较长（120 秒），因为本地服务可能响应较慢。
          </li>
          <li>
            • <strong>立即生效</strong>：配置保存后立即生效，无需重启服务。
          </li>
        </ul>
      </div>
    </div>
  );
}

