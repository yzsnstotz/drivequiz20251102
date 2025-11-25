"use client";

/**
 * AI 统计客户端 - 获取预计耗时等信息
 * 指令版本：0003
 */

import { resolveAiEndpoint, type AiProviderKey } from "./aiEndpoint";
import { joinUrl } from "./urlJoin";

export interface AiExpectedTimeResponse {
  expectedTime?: number; // 预计耗时（秒）
  averageTime?: number; // 平均耗时（秒）
  successRate?: number; // 成功率
}

/**
 * 获取 AI 预计耗时
 * @param provider AI Provider 名称（"local" | "render"）
 * @param model 模型名称
 * @returns 预计耗时（秒）
 */
export async function getAiExpectedTime(
  provider: AiProviderKey,
  model?: string
): Promise<number> {
  try {
    // 使用公共的 resolveAiEndpoint 函数
    const { url, token } = resolveAiEndpoint(provider);

    // 使用 joinUrl 安全拼接 URL
    const baseUrl = joinUrl(url, "/v1/admin/stats/expected");
    const apiUrl = new URL(baseUrl);
    apiUrl.searchParams.set("provider", provider);
    if (model) {
      apiUrl.searchParams.set("model", encodeURIComponent(model));
    }

    const response = await fetch(apiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`[getAiExpectedTime] API 调用失败: ${response.status} ${response.statusText} ${text.substring(0, 100)}`);
      return 8; // fallback
    }

    const data = (await response.json()) as AiExpectedTimeResponse;
    return data.expectedTime ?? data.averageTime ?? 8;
  } catch (error) {
    // 如果是环境变量未配置错误，直接抛出
    if (error instanceof Error && error.message.includes("not configured")) {
      console.warn(`[getAiExpectedTime] ${provider} 服务未配置，使用默认值`);
      return 8; // fallback
    }
    console.warn("[getAiExpectedTime] Failed to fetch expected time:", error);
    return 8; // fallback
  }
}

