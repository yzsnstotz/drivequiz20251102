import "server-only";

/**
 * AI Provider 超时配置读取工具
 * 根据 provider 从数据库读取对应的超时配置
 * 指令版本：0001
 */

import { aiDb } from "./aiDb";
import type { ServerAiProviderKey } from "./aiClient.server";

/**
 * Provider 到 timeout key 的映射
 * 注意：这里使用数据库中的原始 provider 值，而不是映射后的 "local" | "render"
 */
const PROVIDER_TO_TIMEOUT_KEY: Record<string, string> = {
  // 数据库中的原始 provider 值
  openai: "timeout_openai",
  openai_direct: "timeout_openai_direct",
  openrouter: "timeout_openrouter",
  openrouter_direct: "timeout_openrouter_direct",
  gemini: "timeout_gemini",
  gemini_direct: "timeout_gemini_direct",
  local: "timeout_local",
  // 映射后的 provider 值（用于兼容）
  render: "timeout_openai", // render 默认使用 openai 的超时配置
};

/**
 * 默认超时配置（毫秒）
 */
const DEFAULT_TIMEOUTS: Record<string, number> = {
  timeout_openai: 30000,
  timeout_openai_direct: 30000,
  timeout_openrouter: 30000,
  timeout_openrouter_direct: 30000,
  timeout_gemini: 30000,
  timeout_gemini_direct: 30000,
  timeout_local: 120000,
};

/**
 * 从数据库读取指定 provider 的超时配置
 * @param dbProvider 数据库中的 provider 值（如 "openai", "gemini", "local" 等）
 * @returns 超时时间（毫秒）
 */
export async function getProviderTimeoutFromDb(
  dbProvider: string | null | undefined
): Promise<number> {
  if (!dbProvider) {
    console.warn("[getProviderTimeoutFromDb] provider 为空，使用默认超时 30000ms");
    return 30000;
  }

  const provider = dbProvider.toLowerCase().trim();
  const timeoutKey = PROVIDER_TO_TIMEOUT_KEY[provider];

  if (!timeoutKey) {
    console.warn(
      `[getProviderTimeoutFromDb] 未知的 provider: "${dbProvider}", 使用默认超时 30000ms`
    );
    return DEFAULT_TIMEOUTS.timeout_openai || 30000;
  }

  try {
    const configRow = await (aiDb as any)
      .selectFrom("ai_config")
      .select(["value"])
      .where("key", "=", timeoutKey)
      .executeTakeFirst();

    if (configRow && configRow.value) {
      const timeoutMs = Number(configRow.value);
      if (!isNaN(timeoutMs) && timeoutMs > 0) {
        console.log(`[getProviderTimeoutFromDb] 从数据库读取超时配置:`, {
          provider: dbProvider,
          timeoutKey,
          timeoutMs,
        });
        return timeoutMs;
      }
    }
  } catch (error) {
    console.warn(
      `[getProviderTimeoutFromDb] 读取超时配置失败，使用默认值:`,
      error instanceof Error ? error.message : String(error)
    );
  }

  // 使用默认值
  const defaultTimeout = DEFAULT_TIMEOUTS[timeoutKey] || 30000;
  console.log(`[getProviderTimeoutFromDb] 使用默认超时配置:`, {
    provider: dbProvider,
    timeoutKey,
    defaultTimeout,
  });
  return defaultTimeout;
}

/**
 * 根据映射后的 provider（"local" | "render"）获取超时配置
 * 会自动从数据库读取当前配置的 provider，然后获取对应的超时值
 * @param mappedProvider 映射后的 provider（"local" | "render"）
 * @returns 超时时间（毫秒）
 */
export async function getTimeoutForProvider(
  mappedProvider: ServerAiProviderKey
): Promise<number> {
  // local 模式：直接使用 timeout_local
  if (mappedProvider === "local") {
    return await getProviderTimeoutFromDb("local");
  }

  // render 模式：从数据库读取当前配置的 provider，然后获取对应的超时
  try {
    const configRow = await (aiDb as any)
      .selectFrom("ai_config")
      .select(["value"])
      .where("key", "=", "aiProvider")
      .executeTakeFirst();

    if (configRow && configRow.value) {
      const currentDbProvider = configRow.value.trim();
      return await getProviderTimeoutFromDb(currentDbProvider);
    }
  } catch (error) {
    console.warn(
      `[getTimeoutForProvider] 读取当前 provider 配置失败，使用默认值:`,
      error instanceof Error ? error.message : String(error)
    );
  }

  // 最终降级：使用 render 的默认超时（openai）
  return DEFAULT_TIMEOUTS.timeout_openai || 30000;
}

