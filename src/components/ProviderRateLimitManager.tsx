"use client";

import { useState, useEffect } from "react";

type RateLimitConfig = {
  provider: string;
  name: string;
  max: number;
  timeWindow: number;
  defaultMax: number;
  defaultTimeWindow: number;
  description: string;
};

type RateLimitConfigResponse = {
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

async function fetchRateLimitConfig(): Promise<RateLimitConfigResponse> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/config`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

async function saveRateLimitConfig(
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

const PROVIDER_RATE_LIMIT_CONFIGS: RateLimitConfig[] = [
  {
    provider: "rateLimitOpenai",
    name: "OpenAI (通过 Render)",
    max: 60,
    timeWindow: 60,
    defaultMax: 60,
    defaultTimeWindow: 60,
    description: "默认：60 次/60秒，范围：1-10000 次，时间窗口：1-3600 秒",
  },
  {
    provider: "rateLimitOpenaiDirect",
    name: "OpenAI (直连)",
    max: 60,
    timeWindow: 60,
    defaultMax: 60,
    defaultTimeWindow: 60,
    description: "默认：60 次/60秒，范围：1-10000 次，时间窗口：1-3600 秒",
  },
  {
    provider: "rateLimitOpenrouter",
    name: "OpenRouter (通过 Render)",
    max: 60,
    timeWindow: 60,
    defaultMax: 60,
    defaultTimeWindow: 60,
    description: "默认：60 次/60秒，范围：1-10000 次，时间窗口：1-3600 秒",
  },
  {
    provider: "rateLimitOpenrouterDirect",
    name: "OpenRouter (直连)",
    max: 60,
    timeWindow: 60,
    defaultMax: 60,
    defaultTimeWindow: 60,
    description: "默认：60 次/60秒，范围：1-10000 次，时间窗口：1-3600 秒",
  },
  {
    provider: "rateLimitGeminiDirect",
    name: "Google Gemini (直连)",
    max: 60,
    timeWindow: 60,
    defaultMax: 60,
    defaultTimeWindow: 60,
    description: "默认：60 次/60秒，范围：1-10000 次，时间窗口：1-3600 秒",
  },
  {
    provider: "rateLimitLocal",
    name: "本地 AI (Ollama)",
    max: 120,
    timeWindow: 60,
    defaultMax: 120,
    defaultTimeWindow: 60,
    description: "默认：120 次/60秒（本地服务可承受更高频率），范围：1-10000 次，时间窗口：1-3600 秒",
  },
];

export default function ProviderRateLimitManager() {
  const [configs, setConfigs] = useState<RateLimitConfig[]>(PROVIDER_RATE_LIMIT_CONFIGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const resp = await fetchRateLimitConfig();
      if (resp.ok && resp.data) {
        const data = resp.data;
        setConfigs(
          PROVIDER_RATE_LIMIT_CONFIGS.map((config): RateLimitConfig => {
            const maxKey = `${config.provider}Max`;
            const timeWindowKey = `${config.provider}TimeWindow`;
            
            const maxValue = data[maxKey];
            const timeWindowValue = data[timeWindowKey];
            
            return {
              ...config,
              max: (() => {
                if (typeof maxValue === "string") {
                  return Number(maxValue);
                } else if (typeof maxValue === "number") {
                  return maxValue;
                } else {
                  return config.defaultMax;
                }
              })(),
              timeWindow: (() => {
                if (typeof timeWindowValue === "string") {
                  return Number(timeWindowValue);
                } else if (typeof timeWindowValue === "number") {
                  return timeWindowValue;
                } else {
                  return config.defaultTimeWindow;
                }
              })(),
            };
          })
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
        configToSave[`${config.provider}Max`] = config.max;
        configToSave[`${config.provider}TimeWindow`] = config.timeWindow;
      }

      const resp = await saveRateLimitConfig(configToSave);
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

  const handleMaxChange = (provider: string, value: number) => {
    setConfigs(
      configs.map((config) => (config.provider === provider ? { ...config, max: value } : config))
    );
  };

  const handleTimeWindowChange = (provider: string, value: number) => {
    setConfigs(
      configs.map((config) => (config.provider === provider ? { ...config, timeWindow: value } : config))
    );
  };

  const handleReset = (provider: string) => {
    const config = PROVIDER_RATE_LIMIT_CONFIGS.find((c) => c.provider === provider);
    if (config) {
      handleMaxChange(provider, config.defaultMax);
      handleTimeWindowChange(provider, config.defaultTimeWindow);
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
        <h2 className="text-lg font-semibold">Provider 频率限制设置</h2>
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
              
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">最大请求数</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={config.max}
                      onChange={(e) => handleMaxChange(config.provider, Number(e.target.value))}
                      className="w-24 border rounded px-3 py-2"
                    />
                    <span className="text-sm text-gray-600">次</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">时间窗口</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="3600"
                      value={config.timeWindow}
                      onChange={(e) => handleTimeWindowChange(config.provider, Number(e.target.value))}
                      className="w-24 border rounded px-3 py-2"
                    />
                    <span className="text-sm text-gray-600">秒</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                <span>限制：</span>
                <span className="font-mono">{config.max} 次</span>
                <span>/</span>
                <span className="font-mono">{config.timeWindow} 秒</span>
                <span className="text-gray-400">
                  (≈ {((config.max / config.timeWindow) * 60).toFixed(1)} 次/分钟)
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
            • <strong>频率限制</strong>：设置每个 Provider 在指定时间窗口内的最大请求数。超过限制的请求将返回 HTTP 429 错误。
          </li>
          <li>
            • <strong>时间窗口</strong>：限制的时间范围（单位：秒）。例如：60 次/60秒 表示每分钟最多 60 次请求。
          </li>
          <li>
            • <strong>本地服务</strong>：本地 AI (Ollama) 默认频率限制较高（120 次/60秒），因为本地服务通常可以承受更高的请求频率。
          </li>
          <li>
            • <strong>立即生效</strong>：配置保存后，ai-service 会立即应用新的频率限制设置，无需重启服务。
          </li>
          <li>
            • <strong>IP 级别限制</strong>：频率限制基于客户端 IP 地址，每个 IP 独立计算。
          </li>
        </ul>
      </div>
    </div>
  );
}

