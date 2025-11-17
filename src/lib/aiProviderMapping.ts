/**
 * AI Provider 映射工具
 * 将数据库中的 provider 值映射到前端/服务端使用的 provider
 * 指令版本：0003
 */

import type { AiProviderKey } from "./aiEndpoint";
import type { ServerAiProviderKey } from "./aiClient.server";

/**
 * DB 中可能出现的 render 类 provider（需要映射到 "render"）
 */
const renderLikeProviders = new Set([
  "openai",
  "openrouter",
  "openrouter_direct",
  "openai_direct",
  "gemini",
  "gemini_direct",
  "google",
  "claude",
  "anthropic",
  "cloud",
  "strategy", // 策略模式也走 render
]);

/**
 * 将数据库中的 provider 字符串映射到前端/服务端使用的 provider
 * @param dbProvider 数据库中的 provider 值（可能是 "local" | "openai" | "openrouter" | "gemini" 等）
 * @returns 前端/服务端使用的 provider（"local" | "render"）
 */
export function mapDbProviderToClientProvider(
  dbProvider: string | null | undefined
): AiProviderKey | ServerAiProviderKey {
  if (!dbProvider) {
    return "render"; // 默认使用 render
  }

  const p = dbProvider.toLowerCase().trim();

  // 直接匹配
  if (p === "local") return "local";
  if (p === "render") return "render";

  // 映射到 render
  if (renderLikeProviders.has(p)) {
    return "render";
  }

  // 默认兜底走 render，避免老数据导致崩溃
  console.warn(
    `[mapDbProviderToClientProvider] 未知的 provider 值: "${dbProvider}", 默认使用 "render"`
  );
  return "render";
}

