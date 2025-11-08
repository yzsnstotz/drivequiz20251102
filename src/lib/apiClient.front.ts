"use client";

/**
 * ZALEM 前台 API 客户端（浏览器端）
 * - 自动附加 Authorization（从 Cookie USER_TOKEN 或 localStorage 读取）
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
    totalPages: number;
  };
}

export interface ApiErrorBody {
  ok: false;
  errorCode: string;
  message: string;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiErrorBody;

export interface ApiOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string,
    public readonly message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 获取用户 Token（从 Cookie 或 localStorage）
 */
function getUserToken(): string | null {
  if (typeof window === "undefined") return null;

  // 优先从 Cookie 读取
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "USER_TOKEN" && value) {
      return decodeURIComponent(value);
    }
  }

  // 如果 Cookie 中没有，尝试从 localStorage 读取
  try {
    return localStorage.getItem("USER_TOKEN");
  } catch {
    return null;
  }
}

/**
 * 构建查询字符串
 */
function buildQueryString(query?: Record<string, string | number | boolean | null | undefined>): string {
  if (!query) return "";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) {
      params.append(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * 构建请求头
 */
function buildHeaders(extra?: Record<string, string>): Headers {
  const h = new Headers(extra);
  h.set("Content-Type", "application/json");

  const token = getUserToken();
  if (token) {
    h.set("Authorization", `Bearer ${token}`);
  }

  return h;
}

/**
 * 统一 fetch 执行与解析
 */
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
    // 如果是 abort 错误，不抛出异常，而是返回一个特殊的错误
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError(
        0,
        "REQUEST_ABORTED",
        "Request was aborted",
        e
      );
    }
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      e instanceof Error ? e.message : "Network error",
      e
    );
  }

  clearTimeout(timeout);

  // 解析返回（期望为 JSON）
  let payload: ApiResponse<T>;
  try {
    payload = await resp.json() as ApiResponse<T>;
  } catch {
    throw new ApiError(
      resp.status,
      "INVALID_JSON",
      `Invalid JSON response from ${url}`,
      await resp.text().catch(() => "")
    );
  }

  if (!resp.ok || !isApiSuccess<T>(payload)) {
    const error = isApiErrorBody(payload) ? payload : {
      ok: false as const,
      errorCode: "HTTP_ERROR",
      message: `Request failed: ${resp.status}`,
    };
    throw new ApiError(
      resp.status,
      error.errorCode,
      error.message,
      error.details
    );
  }

  return payload;
}

function isApiSuccess<T>(data: unknown): data is ApiSuccess<T> {
  return typeof data === "object" && data !== null && "ok" in data && data.ok === true;
}

function isApiErrorBody(data: unknown): data is ApiErrorBody {
  return typeof data === "object" && data !== null && "ok" in data && data.ok === false;
}

/* --------------------------
 * 暴露的四个便捷方法
 * -------------------------- */

/**
 * 通用 fetch 函数（支持自定义 method）
 */
export async function apiFetch<T = unknown>(
  url: string,
  opts?: ApiOptions & { method?: HttpMethod; body?: unknown },
): Promise<ApiResponse<T>> {
  const method = opts?.method || "GET";
  const body = opts?.body;
  const { method: _, body: __, ...restOpts } = opts || {};
  
  try {
    const res = await request<T>(method, url, body, restOpts);
    return res;
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        ok: false,
        errorCode: err.errorCode,
        message: err.message,
        details: err.details,
      } as ApiErrorBody;
    }
    throw err;
  }
}

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

export async function apiDelete<T = unknown>(
  url: string,
  opts?: ApiOptions,
): Promise<T> {
  const res = await request<T>("DELETE", url, undefined, opts);
  return res.data;
}

/* --------------------------
 * 默认导出
 * -------------------------- */

const apiClient = {
  get: <T = unknown>(url: string, opts?: ApiOptions): Promise<ApiResponse<T>> =>
    request<T>("GET", url, undefined, opts).catch((err) => {
      if (err instanceof ApiError) {
        return {
          ok: false,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
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
          details: err.details,
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
          details: err.details,
        } as ApiErrorBody;
      }
      throw err;
    }),
  delete: <T = unknown>(url: string, opts?: ApiOptions): Promise<ApiResponse<T>> =>
    request<T>("DELETE", url, undefined, opts).catch((err) => {
      if (err instanceof ApiError) {
        return {
          ok: false,
          errorCode: err.errorCode,
          message: err.message,
          details: err.details,
        } as ApiErrorBody;
      }
      throw err;
    }),
};

export default apiClient;

