/**
 * Question-Processor AI 配置模块
 * 从环境变量读取 AI Provider 和模型配置
 * 指令版本：0003
 */

export type QpAiProvider = "local" | "render";

export interface QpAiConfig {
  provider: QpAiProvider;
  renderModel: string; // 远程 Render 模型，如 "gpt-4o-mini"
  localModel: string; // 本地 Ollama 模型，如 "ollama:llama3"
  cacheEnabled: boolean;
  cacheTtlMs: number;
}

/**
 * 解析 provider 环境变量
 */
function parseProvider(raw: string | undefined): QpAiProvider {
  if (!raw) return "render";
  const p = raw.toLowerCase().trim();
  if (p === "local") return "local";
  if (p === "render") return "render";
  // 默认兜底 render，避免意外值导致崩溃
  return "render";
}

/**
 * 加载 Question-Processor AI 配置
 * 从环境变量读取所有配置项
 */
export function loadQpAiConfig(): QpAiConfig {
  const provider = parseProvider(process.env.QP_AI_PROVIDER);

  // 默认模型可以先写死为相对安全的值，也允许通过 env 覆盖
  const renderModel =
    process.env.QP_AI_RENDER_MODEL?.trim() || "gpt-4o-mini";
  const localModel =
    process.env.QP_AI_LOCAL_MODEL?.trim() || "ollama:llama3";

  const cacheEnabled =
    process.env.QP_AI_CACHE_ENABLED?.toLowerCase() === "true";

  const ttlRaw = process.env.QP_AI_CACHE_TTL_MS;
  const cacheTtlMs =
    ttlRaw && !Number.isNaN(Number(ttlRaw))
      ? Number(ttlRaw)
      : 5 * 60 * 1000; // 默认 5 分钟

  return {
    provider,
    renderModel,
    localModel,
    cacheEnabled,
    cacheTtlMs,
  };
}

