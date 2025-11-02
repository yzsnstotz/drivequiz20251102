"use client";

/**
 * ZALEM 前端 API 客户端（浏览器端）
 * - 自动附加 Authorization（从 localStorage.ADMIN_TOKEN 读取）
 * - 统一协议解析：{ ok: true, data, pagination? } / { ok: false, errorCode, message }
 * - 统一抛错：ApiError
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiSuccess<T = unknown> {
  ok: true;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiErrorBody {
  ok: false;
  errorCode: string;
  message: string;
  // 允许后端透传更多上下文（可选）
  [k: string]: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly details?: unknown;

  constructor(opts: { status: number; errorCode: string; message: string; details?: unknown }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status;
    this.errorCode = opts.errorCode;
    this.details = opts.details;
  }
}

/**
 * 选项：可配置超时、额外 headers
 */
export interface ApiOptions {
  /** 查询参数，会被追加到 URL 后 */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** 自定义超时（毫秒），默认 20_000ms */
  timeoutMs?: number;
  /** 自定义 headers（将与默认 headers 合并） */
  headers?: Record<string, string>;
}

/** 读取 ADMIN_TOKEN（仅在浏览器环境） */
function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("ADMIN_TOKEN");
  } catch {
    return null;
  }
}

/** 构造查询字符串 */
function buildQueryString(query?: ApiOptions["query"]): string {
  if (!query) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

/** 合并 headers（包含 Authorization 与 JSON） */
function buildHeaders(extra?: Record<string, string>): Headers {
  const h = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
  });
  const token = getAdminToken();
  if (token) {
    h.set("Authorization", `Bearer ${token}`);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) h.set(k, v);
  }
  return h;
}

/** 统一 fetch 执行与解析 */
async function request<T>(
  method: HttpMethod,
  url: string,
  body?: unknown,
  opts?: ApiOptions,
): Promise<ApiSuccess<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 20_000);

  const qs = buildQueryString(opts?.query);
  const finalUrl = `${url}${qs}`;

  const init: RequestInit = {
    method,
    headers: buildHeaders(opts?.headers),
    signal: controller.signal,
  };

  if (body !== undefined && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  let resp: Response;
  try {
    resp = await fetch(finalUrl, init);
  } catch (e) {
    clearTimeout(timeout);
    throw new ApiError({
      status: 0,
      errorCode: "NETWORK_ERROR",
      message: e instanceof Error ? e.message : "Network error",
      details: e,
    });
  } finally {
    // 注意：不能在 finally 里 clearTimeout，因为还需要等 fetch 结束；已在 try/catch 的成功/失败路径中清理
  }

  clearTimeout(timeout);

  // 解析返回（期望为 JSON）
  let payload: ApiResponse<T> | unknown;
  const text = await resp.text();
  try {
    payload = text ? (JSON.parse(text) as ApiResponse<T>) : undefined;
  } catch {
    // 非 JSON 返回
    throw new ApiError({
      status: resp.status,
      errorCode: "BAD_RESPONSE",
      message: `Unexpected response: ${text?.slice(0, 200) ?? ""}`,
      details: text,
    });
  }

  // HTTP 非 2xx → 优先从 body 中提取错误；否则兜底
  if (!resp.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiError({
        status: resp.status,
        errorCode: payload.errorCode || "HTTP_ERROR",
        message: payload.message || `HTTP ${resp.status}`,
        details: payload,
      });
    }
    throw new ApiError({
      status: resp.status,
      errorCode: "HTTP_ERROR",
      message: `HTTP ${resp.status}`,
      details: payload,
    });
  }

  // HTTP 2xx，但 body 有 ok:false（后端显式错误）
  if (isApiErrorBody(payload)) {
    throw new ApiError({
      status: resp.status,
      errorCode: payload.errorCode || "API_ERROR",
      message: payload.message || "API error",
      details: payload,
    });
  }

  // 期望规范成功体
  if (isApiSuccess<T>(payload)) {
    return payload;
  }

  // 其他异常体
  throw new ApiError({
    status: resp.status,
    errorCode: "UNEXPECTED_PAYLOAD",
    message: "Unexpected API payload",
    details: payload,
  });
}

function isApiSuccess<T = unknown>(data: any): data is ApiSuccess<T> {
  return data && data.ok === true && "data" in data;
}

function isApiErrorBody(data: any): data is ApiErrorBody {
  return data && data.ok === false && typeof data.message === "string";
}

/* --------------------------
 * 暴露的四个便捷方法
 * -------------------------- */

export async function apiGet<T = unknown>(
  url: string,
  opts?: ApiOptions,
): Promise<T> {
  const res = await request<T>("GET", url, undefined, opts);
  return res.data;
}

export async function apiPost<T = unknown, B = unknown>(
  url: string,
  body?: B,
  opts?: ApiOptions,
): Promise<T> {
  const res = await request<T>("POST", url, body, opts);
  return res.data;
}

export async function apiPut<T = unknown, B = unknown>(
  url: string,
  body?: B,
  opts?: ApiOptions,
): Promise<T> {
  const res = await request<T>("PUT", url, body, opts);
  return res.data;
}

export async function apiDelete<T = unknown, B = unknown>(
  url: string,
  body?: B,
  opts?: ApiOptions,
): Promise<T> {
  const res = await request<T>("DELETE", url, body, opts);
  return res.data;
}

/* --------------------------
 * 辅助工具：鉴权检测（可选使用）
 * -------------------------- */

/** 是否存在 ADMIN_TOKEN（仅浏览器端有效） */
export function hasAdminToken(): boolean {
  return !!getAdminToken();
}

/** 清除 ADMIN_TOKEN（用于登出） */
export function clearAdminToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("ADMIN_TOKEN");
  } catch {
    // 忽略
  }
}

/* --------------------------
 * 默认导出（兼容旧代码）
 * -------------------------- */

const apiClient = {
  get: <T = unknown>(url: string, opts?: ApiOptions): Promise<ApiResponse<T>> =>
    request<T>("GET", url, undefined, opts).catch((err) => {
      if (err instanceof ApiError) {
        return {
          ok: false,
          errorCode: err.errorCode,
          message: err.message,
          ...(typeof err.details === "object" && err.details !== null ? err.details : {}),
        } as ApiErrorBody;
      }
      throw err;
    }),
  post: <T = unknown, B = unknown>(url: string, body?: B, opts?: ApiOptions): Promise<ApiResponse<T>> =>
    request<T>("POST", url, body, opts).catch((err) => {
      if (err instanceof ApiError) {
        return {
          ok: false,
          errorCode: err.errorCode,
          message: err.message,
          ...(typeof err.details === "object" && err.details !== null ? err.details : {}),
        } as ApiErrorBody;
      }
      throw err;
    }),
  put: <T = unknown, B = unknown>(url: string, body?: B, opts?: ApiOptions): Promise<ApiResponse<T>> =>
    request<T>("PUT", url, body, opts).catch((err) => {
      if (err instanceof ApiError) {
        return {
          ok: false,
          errorCode: err.errorCode,
          message: err.message,
          ...(typeof err.details === "object" && err.details !== null ? err.details : {}),
        } as ApiErrorBody;
      }
      throw err;
    }),
  delete: <T = unknown, B = unknown>(url: string, body?: B, opts?: ApiOptions): Promise<ApiResponse<T>> =>
    request<T>("DELETE", url, body, opts).catch((err) => {
      if (err instanceof ApiError) {
        return {
          ok: false,
          errorCode: err.errorCode,
          message: err.message,
          ...(typeof err.details === "object" && err.details !== null ? err.details : {}),
        } as ApiErrorBody;
      }
      throw err;
    }),
};

export default apiClient;
