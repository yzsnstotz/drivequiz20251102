// src/app/api/admin/ai/heartbeat/route.ts
import { NextRequest, NextResponse } from "next/server";

// 运行时配置
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 指令版本：0002

type Ok<T> = { ok: true; data: T };
type Err = {
  ok: false;
  errorCode: "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_FAILED" | "INTERNAL_ERROR";
  message: string;
  details?: Record<string, unknown>;
};

// 统一响应构造
const ok = <T>(data: T) => NextResponse.json<Ok<T>>({ ok: true, data }, { status: 200 });

const internalError = (message = "Internal server error") =>
  NextResponse.json<Err>(
    { ok: false, errorCode: "INTERNAL_ERROR", message },
    { status: 500 },
  );

// Admin 鉴权
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";

type HeartbeatProvider = "local" | "render";

type ProviderStatus = {
  id: HeartbeatProvider;
  label: string;
  mode: "local" | "remote";
  endpoint: string;
  status: "up" | "down";
  latencyMs: number | null;
  lastError: string | null;
};

/**
 * 获取服务端环境变量配置的端点
 * @param provider Provider 名称
 * @returns 服务端点配置（URL + TOKEN）
 */
function getServerEndpoint(provider: HeartbeatProvider): { url: string | undefined; token: string | undefined } {
  if (provider === "local") {
    return {
      url: process.env.AI_LOCAL_SERVICE_URL,
      token: process.env.AI_LOCAL_SERVICE_TOKEN,
    };
  }
  // render
  return {
    url: process.env.AI_RENDER_SERVICE_URL,
    token: process.env.AI_RENDER_SERVICE_TOKEN,
  };
}

/**
 * 检查单个 provider 的健康状态
 * @param provider Provider 名称
 * @returns Provider 状态
 */
async function checkProviderHealth(provider: HeartbeatProvider): Promise<ProviderStatus> {
  const { url, token } = getServerEndpoint(provider);
  
  const providerStatus: ProviderStatus = {
    id: provider,
    label: provider === "local" ? "Local AI Service" : "Render AI Service",
    mode: provider === "local" ? "local" : "remote",
    endpoint: url || "未配置",
        status: "down",
        latencyMs: null,
        lastError: null,
      };

  if (!url) {
    providerStatus.lastError = "URL not configured";
    console.warn(`[heartbeat] ${provider} URL 未配置`);
    return providerStatus;
  }

      const start = Date.now();
      try {
        // 移除尾部的斜杠和 /v1 路径（健康检查端点在根路径）
    let baseUrl = url.replace(/\/+$/, "");
        // 如果 URL 以 /v1 结尾，移除它
        if (baseUrl.endsWith("/v1")) {
          baseUrl = baseUrl.slice(0, -3);
        }
        const healthUrl = `${baseUrl}/healthz`;

    // 检查是否是 localhost（本地服务）
    const isLocalhost = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

    console.log(`[heartbeat] 检查 ${provider} 服务:`, {
      url: `${url.substring(0, 50)}...`,
      healthUrl,
      hasToken: !!token,
      isLocalhost,
    });
        
        const controller = new AbortController();
    // 增加超时时间：local 5秒，render 10秒（网络可能较慢）
    const timeoutMs = provider === "local" ? 5000 : 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(healthUrl, {
          method: "GET",
      headers: token
            ? {
            Authorization: `Bearer ${token}`,
              }
            : {},
          signal: controller.signal,
          cache: "no-store",
        });

        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;
    providerStatus.latencyMs = latencyMs;

    console.log(`[heartbeat] ${provider} 健康检查响应:`, {
      status: res.status,
      statusText: res.statusText,
      latencyMs,
    });

        if (res.ok) {
      providerStatus.status = "up";
        } else {
      providerStatus.status = "down";
      const errorText = await res.text().catch(() => "");
      providerStatus.lastError = `HTTP ${res.status}${errorText ? `: ${errorText.substring(0, 100)}` : ""}`;
      console.error(`[heartbeat] ${provider} 健康检查失败:`, {
        status: res.status,
        statusText: res.statusText,
        error: errorText.substring(0, 200),
      });
        }
      } catch (err: any) {
        const latencyMs = Date.now() - start;
    providerStatus.latencyMs = latencyMs;
    providerStatus.status = "down";
    
        if (err.name === "AbortError") {
      const timeoutSeconds = provider === "local" ? "5s" : "10s";
      providerStatus.lastError = `Timeout (${timeoutSeconds})`;
      console.error(`[heartbeat] ${provider} 健康检查超时 (${timeoutSeconds})`);
    } else if (err.message?.includes("fetch failed") || err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      // 网络连接错误
      const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");
      if (isLocalhost && provider === "local") {
        providerStatus.lastError = "Service not running or unreachable (localhost)";
        console.error(`[heartbeat] ${provider} 服务未运行或无法访问:`, {
          url,
          error: err.message,
          hint: "请确保本地 AI 服务正在运行（通常运行在 localhost:8788）",
        });
        } else {
        providerStatus.lastError = `Network error: ${err.message || "Connection failed"}`;
        console.error(`[heartbeat] ${provider} 网络连接错误:`, {
          url,
          error: err.message,
          code: err.code,
        });
      }
    } else {
      providerStatus.lastError = err?.message ?? "Unknown error";
      console.error(`[heartbeat] ${provider} 健康检查错误:`, {
        error: err.message,
        code: err.code,
        stack: err.stack?.substring(0, 500), // 限制堆栈长度
      });
    }
  }

  return providerStatus;
}

/**
 * GET /api/admin/ai/heartbeat
 * 同时检查 local 和 render 两个 AI 服务的健康状态
 */
export const GET = withAdminAuth(async (req: NextRequest): Promise<NextResponse> => {
  try {
    const checkedAt = new Date().toISOString();
    const providers: HeartbeatProvider[] = ["local", "render"];

    // 并行检查所有 provider
    const results = await Promise.all(
      providers.map((provider) => checkProviderHealth(provider))
    );

    return ok({
      checkedAt,
      providers: results,
    });
  } catch (err: unknown) {
    console.error("[GET /api/admin/ai/heartbeat] Error:", err);
    return internalError(
      err instanceof Error ? err.message : "Unexpected error",
    );
  }
});
