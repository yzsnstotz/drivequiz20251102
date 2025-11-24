"use client";

import { useState, useEffect } from "react";
import ProviderConfigManager from "@/components/ProviderConfigManager";
import ProviderTimeoutManager from "@/components/ProviderTimeoutManager";
import ProviderRateLimitManager from "@/components/ProviderRateLimitManager";

type ProviderOption = {
  value: string;
  label: string;
};

type Config = {
  dailyAskLimit: number;
  answerCharLimit: number;
  model: string;
  cacheTtl: number;
  costAlertUsdThreshold: number;
  aiProvider: "render" | "local" | "openai" | "openrouter" | "openrouter_direct" | "openai_direct" | "gemini" | "gemini_direct" | "strategy"; // 支持所有 provider 类型
  aiModelProvider?: "openai" | "openrouter" | "gemini"; // 当 aiProvider 为 render 时，选择具体的大模型提供商
  aiProviderDescription?: string | null; // AI Provider 选项描述（从数据库读取）
  timeoutOpenai?: number;
  timeoutOpenaiDirect?: number;
  timeoutOpenrouter?: number;
  timeoutOpenrouterDirect?: number;
  timeoutGeminiDirect?: number;
  timeoutLocal?: number;
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

/**
 * 解析 aiProvider 的 description 字段，提取所有 provider 选项
 * 格式：'AI服务提供商：openai=OpenAI（通过Render），openai_direct=直连OpenAI（不通过Render），...'
 * 
 * 注意：此函数完全依赖数据库中的 description 字段，不再使用硬编码的默认值
 */
function parseProviderOptions(description: string | null | undefined): ProviderOption[] {
  if (!description) {
    // 如果 description 为空，返回空数组（让用户知道需要配置数据库）
    console.warn("[parseProviderOptions] aiProvider description 为空，请检查数据库配置");
    return [];
  }

  // 提取冒号后的内容
  const colonIndex = description.indexOf("：");
  if (colonIndex === -1) {
    console.warn("[parseProviderOptions] description 格式不正确，未找到冒号分隔符");
    return [];
  }

  const optionsStr = description.substring(colonIndex + 1);
  const options: ProviderOption[] = [];

  // 按中文逗号分割
  const parts = optionsStr.split("，");
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // 格式：key=label
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) {
      console.warn(`[parseProviderOptions] 选项格式不正确，未找到等号: "${trimmed}"`);
      continue;
    }

    const value = trimmed.substring(0, equalIndex).trim();
    const label = trimmed.substring(equalIndex + 1).trim();

    if (value && label) {
      options.push({ value, label });
    } else {
      console.warn(`[parseProviderOptions] 选项值或标签为空: value="${value}", label="${label}"`);
    }
  }

  if (options.length === 0) {
    console.error("[parseProviderOptions] 解析后未找到任何选项，请检查数据库 description 格式");
  }

  return options;
}

export default function AdminAiConfigPage() {
  const [config, setConfig] = useState<Config>({
    dailyAskLimit: 10,
    answerCharLimit: 300,
    model: "gpt-4o-mini",
    cacheTtl: 86400,
    costAlertUsdThreshold: 10.0,
    aiProvider: "openai", // 默认使用 openai
    aiModelProvider: "openai", // 默认使用 OpenAI
    timeoutOpenai: 30000,
    timeoutOpenaiDirect: 30000,
    timeoutOpenrouter: 30000,
    timeoutOpenrouterDirect: 30000,
    timeoutGeminiDirect: 30000,
    timeoutLocal: 120000,
  });
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "providers" | "timeout" | "rateLimit">("basic");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const resp = await fetchConfig();
      if (resp.ok && resp.data) {
        // API 返回的值是字符串，需要转换为数字
        const data = resp.data;
        
        // 解析 provider 选项（完全依赖数据库，不再使用硬编码）
        const options = parseProviderOptions(data.aiProviderDescription);
        setProviderOptions(options);
        
        // 如果解析失败，显示警告
        if (options.length === 0) {
          console.error("[loadConfig] 无法从数据库解析 provider 选项，请检查 ai_config 表的 aiProvider description 字段");
        }
        
        setConfig({
          dailyAskLimit: typeof data.dailyAskLimit === "string" ? Number(data.dailyAskLimit) : (data.dailyAskLimit ?? 10),
          answerCharLimit: typeof data.answerCharLimit === "string" ? Number(data.answerCharLimit) : (data.answerCharLimit ?? 300),
          model: data.model ?? "gpt-4o-mini",
          cacheTtl: typeof data.cacheTtl === "string" ? Number(data.cacheTtl) : (data.cacheTtl ?? 86400),
          costAlertUsdThreshold: typeof data.costAlertUsdThreshold === "string" ? Number(data.costAlertUsdThreshold) : (data.costAlertUsdThreshold ?? 10.0),
          aiProvider: (data.aiProvider as Config["aiProvider"]) || "openai",
          aiProviderDescription: data.aiProviderDescription || null,
          timeoutOpenai: typeof data.timeoutOpenai === "string" ? Number(data.timeoutOpenai) : (data.timeoutOpenai ?? 30000),
          timeoutOpenaiDirect: typeof data.timeoutOpenaiDirect === "string" ? Number(data.timeoutOpenaiDirect) : (data.timeoutOpenaiDirect ?? 30000),
          timeoutOpenrouter: typeof data.timeoutOpenrouter === "string" ? Number(data.timeoutOpenrouter) : (data.timeoutOpenrouter ?? 30000),
          timeoutOpenrouterDirect: typeof data.timeoutOpenrouterDirect === "string" ? Number(data.timeoutOpenrouterDirect) : (data.timeoutOpenrouterDirect ?? 30000),
          timeoutGeminiDirect: typeof data.timeoutGeminiDirect === "string" ? Number(data.timeoutGeminiDirect) : (data.timeoutGeminiDirect ?? 30000),
          timeoutLocal: typeof data.timeoutLocal === "string" ? Number(data.timeoutLocal) : (data.timeoutLocal ?? 120000),
        });
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
      // 从 basic tab 保存时，排除超时字段（超时设置由独立的 ProviderTimeoutManager 管理）
      const { timeoutOpenai, timeoutOpenaiDirect, timeoutOpenrouter, timeoutOpenrouterDirect, timeoutGeminiDirect, timeoutLocal, ...basicConfig } = config;
      const resp = await saveConfig(basicConfig);
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

      {/* Tab 导航 */}
      <div className="border-b">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab("basic")}
            className={`px-4 py-2 border-b-2 ${
              activeTab === "basic"
                ? "border-black font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            基础配置
          </button>
          <button
            onClick={() => setActiveTab("providers")}
            className={`px-4 py-2 border-b-2 ${
              activeTab === "providers"
                ? "border-black font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Provider 调用策略
          </button>
          <button
            onClick={() => setActiveTab("timeout")}
            className={`px-4 py-2 border-b-2 ${
              activeTab === "timeout"
                ? "border-black font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Provider 超时设置
          </button>
          <button
            onClick={() => setActiveTab("rateLimit")}
            className={`px-4 py-2 border-b-2 ${
              activeTab === "rateLimit"
                ? "border-black font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Provider 频率限制
          </button>
        </div>
      </div>

      {activeTab === "providers" ? (
        <ProviderConfigManager />
      ) : activeTab === "timeout" ? (
        <ProviderTimeoutManager />
      ) : activeTab === "rateLimit" ? (
        <ProviderRateLimitManager />
      ) : (
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
                disabled={config.aiProvider === "local" || config.aiProvider === "strategy"}
              >
                {config.aiProvider === "openai" || config.aiProvider === "openai_direct" ? (
                  <>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                  </>
                ) : config.aiProvider === "gemini" || config.aiProvider === "gemini_direct" ? (
                  <>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (推荐)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gemini-2.0-flash-001">Gemini 2.0 Flash 001</option>
                    {/* 旧模型名称（已停用，会自动映射到新模型） */}
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (已停用，将映射到 2.5 Flash)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (已停用，将映射到 2.5 Pro)</option>
                  </>
                ) : (config.aiProvider === "openrouter" || config.aiProvider === "openrouter_direct") ? (
                  <>
                    <option value="openai/gpt-4o-mini">OpenAI GPT-4o Mini</option>
                    <option value="openai/gpt-4o">OpenAI GPT-4o</option>
                    <option value="openai/gpt-4-turbo">OpenAI GPT-4 Turbo</option>
                    <option value="openai/gpt-3.5-turbo">OpenAI GPT-3.5 Turbo</option>
                    <option value="anthropic/claude-3.5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                    <option value="anthropic/claude-3-opus">Anthropic Claude 3 Opus</option>
                    <option value="anthropic/claude-3-haiku">Anthropic Claude 3 Haiku</option>
                    <option value="google/gemini-pro">Google Gemini Pro</option>
                    <option value="google/gemini-pro-1.5">Google Gemini Pro 1.5</option>
                    <option value="meta-llama/llama-3.1-70b-instruct">Meta Llama 3.1 70B</option>
                    <option value="meta-llama/llama-3.1-8b-instruct">Meta Llama 3.1 8B</option>
                    <option value="mistralai/mistral-7b-instruct">Mistral 7B Instruct</option>
                    <option value="mistralai/mixtral-8x7b-instruct">Mistral Mixtral 8x7B</option>
                    <option value="qwen/qwen-2.5-7b-instruct">Qwen 2.5 7B Instruct</option>
                    <option value="qwen/qwen-2.5-72b-instruct">Qwen 2.5 72B Instruct</option>
                  </>
                ) : (
                  <>
                    <option value="llama3.2:3b">llama3.2:3b</option>
                    <option value="llama3.2:1b">llama3.2:1b</option>
                    <option value="llama3.1:8b">llama3.1:8b</option>
                    <option value="llama3.1:70b">llama3.1:70b</option>
                    <option value="mistral:7b">mistral:7b</option>
                    <option value="qwen2.5:7b">qwen2.5:7b</option>
                  </>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {config.aiProvider === "openai"
                  ? "当前使用的 OpenAI 模型（通过 Render）"
                  : config.aiProvider === "openai_direct"
                  ? "当前使用的 OpenAI 模型（直连，不通过 Render）"
                  : config.aiProvider === "gemini"
                  ? "当前使用的 Google Gemini 模型（通过 Render）"
                  : config.aiProvider === "gemini_direct"
                  ? "当前使用的 Google Gemini 模型（直连，不通过 Render）"
                  : config.aiProvider === "openrouter"
                  ? "当前使用的 OpenRouter 模型（通过 Render，支持多种 AI 服务商）"
                  : config.aiProvider === "openrouter_direct"
                  ? "当前使用的 OpenRouter 模型（直连，不通过 Render，支持多种 AI 服务商）"
                  : config.aiProvider === "strategy"
                  ? "使用调用策略时，模型由策略配置决定，此处显示为参考"
                  : "本地 AI 模型由 Ollama 服务配置，此处仅显示（不可修改）"}
              </p>
              {config.aiProvider === "local" && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ 本地AI模型需要在Ollama服务中配置，此处显示为参考
                </p>
              )}
              {config.aiProvider === "strategy" && (
                <p className="text-xs text-blue-600 mt-1">
                  💡 使用调用策略时，系统会根据 Provider 调用策略配置自动选择 Provider 和模型
                </p>
              )}
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

            <div>
              <label className="block text-sm font-medium mb-1">
                AI 服务提供商 <span className="text-red-500">*</span>
              </label>
              <select
                value={config.aiProvider}
                onChange={(e) => {
                  const newProvider = e.target.value as Config["aiProvider"];
                  // 切换服务提供商时，自动设置对应的默认模型
                  const defaultModel = 
                    newProvider === "strategy"
                      ? config.model // 使用策略时保持当前模型
                      : newProvider === "openai" || newProvider === "openai_direct"
                      ? "gpt-4o-mini"
                      : newProvider === "gemini" || newProvider === "gemini_direct"
                      ? "gemini-2.5-flash"
                      : (newProvider === "openrouter" || newProvider === "openrouter_direct")
                      ? "openai/gpt-4o-mini"
                    : "llama3.2:3b";
                  setConfig({ ...config, aiProvider: newProvider, model: defaultModel });
                }}
                className="w-full border rounded px-3 py-2"
                disabled={providerOptions.length === 0 || loading}
              >
                {loading ? (
                  <option value="">加载中...</option>
                ) : providerOptions.length > 0 ? (
                  providerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                ) : (
                  <option value="">无法加载选项，请检查数据库配置</option>
                )}
              </select>
              {!loading && providerOptions.length === 0 && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ 无法从数据库读取 provider 选项，请检查 ai_config 表的 aiProvider description 字段
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {config.aiProvider === "strategy"
                  ? "根据 Provider 调用策略配置自动选择 Provider，可在「Provider 调用策略」标签页中配置策略"
                  : config.aiProvider === "openai"
                  ? "使用 OpenAI 服务（通过 Render），需要配置 AI_SERVICE_URL 和 AI_SERVICE_TOKEN"
                  : config.aiProvider === "openai_direct"
                  ? "使用 OpenAI 服务（直连，不通过 Render），需要配置 OPENAI_API_KEY 和 OPENAI_BASE_URL"
                  : config.aiProvider === "gemini"
                  ? "使用 Google Gemini 服务（通过 Render），需要配置 AI_SERVICE_URL 和 AI_SERVICE_TOKEN"
                  : config.aiProvider === "gemini_direct"
                  ? "使用 Google Gemini 服务（直连，不通过 Render），需要配置 GEMINI_API_KEY 和 GEMINI_BASE_URL（可选，默认为 https://generativelanguage.googleapis.com/v1beta）"
                  : config.aiProvider === "openrouter"
                  ? "使用 OpenRouter 服务（通过 Render），需要配置 OPENROUTER_API_KEY 和 OPENROUTER_BASE_URL"
                  : config.aiProvider === "openrouter_direct"
                  ? "使用 OpenRouter 服务（直连，不通过 Render），需要配置 OPENROUTER_API_KEY、OPENROUTER_BASE_URL、OPENROUTER_REFERER_URL 和 OPENROUTER_APP_NAME"
                  : "使用本地 AI 服务（Ollama），需要本地 Ollama 服务运行"}
              </p>
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
                <div className="text-gray-600">${(typeof config.costAlertUsdThreshold === "number" ? config.costAlertUsdThreshold : Number(config.costAlertUsdThreshold) || 0).toFixed(2)} USD</div>
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
      )}
    </div>
  );
}

