"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import apiClient, {
  hasAdminToken,
  clearAdminToken,
  ApiErrorBody,
} from "@/lib/apiClient";

type FormState = {
  token: string;
  show: boolean;
  submitting: boolean;
  error?: string;
};

type UiState = "checking" | "form";

function validateToken(token: string): string | null {
  const t = token.trim();
  if (!t) return "请输入 Token";
  if (t.length < 8) return "Token 长度过短（至少 8 位）";
  if (!/^[\w\-.~]+$/i.test(t)) return "Token 仅支持字母/数字/下划线/.-~";
  return null;
}

/**
 * 使用受保护接口进行轻量鉴权探测
 * 通过你现有的 apiClient 协议：
 * - 成功：返回 { ok: true, data: ... } → 视为已登录
 * - 失败：返回 { ok: false, errorCode, message } → 视为未登录
 * - 网络/解析异常：抛错 → 由调用方决定是提示还是退回表单
 */
async function probeAdminAuth(): Promise<"ok" | "unauthorized" | "error"> {
  try {
    // 缩短超时时间到 3 秒，避免长时间等待
    const resp = await apiClient.get<any>("/api/admin/activation-codes", {
      query: { page: 1, limit: 1 },
      timeoutMs: 3_000,
    });
    if ((resp as any)?.ok === true) return "ok";
    // 统一处理 ok:false 的情况（含 AUTH_REQUIRED / HTTP_ERROR 等）
    const body = resp as ApiErrorBody;
    if (body && body.ok === false) {
      // 遇到 401/403 或统一鉴权错误码，都按未授权处理
      if (
        body.errorCode === "AUTH_REQUIRED" ||
        body.errorCode === "HTTP_ERROR" || // 你的封装在 401/403 场景下可能会回落到此
        body.errorCode === "API_ERROR"
      ) {
        return "unauthorized";
      }
      // 其它业务错误也按未授权处理（避免死锁在 Checking）
      return "unauthorized";
    }
    // 容错：意外体
    return "error";
  } catch (err) {
    // 网络/解析异常：记录错误但不阻止用户登录
    console.warn("[AdminLogin] 鉴权探测失败:", err);
    return "error";
  }
}

export default function AdminLoginPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [ui, setUi] = useState<UiState>("checking");
  const [state, setState] = useState<FormState>({
    token: "",
    show: false,
    submitting: false,
  });

  const helpText = useMemo(
    () =>
      "将你的管理口令保存到本机浏览器，仅用于后续访问 /api/admin/** 接口时附加 Authorization 头部。请勿在公共设备上保存。",
    [],
  );

  // 初次挂载：若本地存在 token，则做一次鉴权探测；否则直接显示表单
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 添加备用超时：如果检查超过 5 秒，强制显示表单
    const fallbackTimeout = setTimeout(() => {
      console.warn("[AdminLogin] 检查超时，显示登录表单");
      setUi("form");
    }, 5_000);

    const doCheck = async () => {
      try {
        if (!hasAdminToken()) {
          clearTimeout(fallbackTimeout);
          setUi("form");
          return;
        }

        const r = await probeAdminAuth();
        clearTimeout(fallbackTimeout);

        if (r === "ok") {
          const redirect = search?.get("redirect");
          router.replace(
            redirect && redirect.startsWith("/admin") ? redirect : "/admin",
          );
          return;
        }

        // 未授权或探测异常 → 回表单
        setUi("form");
      } catch (err) {
        // 确保所有异常都会清除超时并显示表单
        clearTimeout(fallbackTimeout);
        console.error("[AdminLogin] 检查异常:", err);
        setUi("form");
      }
    };

    void doCheck();

    // 清理函数
    return () => {
      clearTimeout(fallbackTimeout);
    };
  }, [router, search]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.submitting) return;

    const err = validateToken(state.token);
    if (err) {
      setState((s) => ({ ...s, error: err }));
      return;
    }

    const token = state.token.trim();
    setState((s) => ({ ...s, submitting: true, error: undefined }));

    try {
      // 将 token 写入 localStorage（apiClient 会自动从中读取）
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ADMIN_TOKEN", token);
      }

      const r = await probeAdminAuth();
      if (r !== "ok") {
        // 鉴权失败：清除本地 token，并提示错误
        clearAdminToken();
        setState((s) => ({
          ...s,
          submitting: false,
          error:
            r === "unauthorized"
              ? "口令无效或无权限，请检查后重试。"
              : "登录失败，请稍后重试或联系管理员。",
        }));
        return;
      }

      // 成功跳转
      const redirect = search?.get("redirect");
      router.replace(redirect && redirect.startsWith("/admin") ? redirect : "/admin");
    } catch (err) {
      // 网络异常等：不强制清除 token，允许用户重试
      setState((s) => ({
        ...s,
        submitting: false,
        error:
          err instanceof Error ? err.message : "登录失败，请稍后重试或联系管理员。",
      }));
    }
  }

  // Checking 态：统一占位
  if (ui === "checking") {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center">
          <h1 className="text-lg font-semibold">Checking admin session…</h1>
          <p className="mt-2 text-sm text-gray-500">
            正在验证本机管理员会话与权限，请稍候。
          </p>
          <div className="mt-6 animate-pulse text-gray-400 text-sm">
            连接受保护接口中…
          </div>
        </div>
      </div>
    );
  }

  // 表单态
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">ZALEM Admin 登录</h1>
          <p className="mt-1 text-sm text-gray-500">{helpText}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700">
              管理口令（ADMIN_TOKEN）
            </label>
            <div className="mt-1 relative">
              <input
                id="token"
                name="token"
                type={state.show ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 text-sm outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                placeholder="粘贴你的管理口令…"
                value={state.token}
                onChange={(e) => setState((s) => ({ ...s, token: e.target.value }))}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
                onClick={() => setState((s) => ({ ...s, show: !s.show }))}
                aria-label={state.show ? "隐藏口令" : "显示口令"}
              >
                {state.show ? "隐藏" : "显示"}
              </button>
            </div>
            {state.error ? (
              <p className="mt-2 text-xs text-red-600">{state.error}</p>
            ) : (
              <p className="mt-2 text-xs text-gray-500">
                粘贴后点击登录。该口令仅保存在本机浏览器。
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={state.submitting}
              className={[
                "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium",
                state.submitting
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-gray-900 text-white hover:bg-black",
              ].join(" ")}
            >
              {state.submitting ? "登录中…" : "登录"}
            </button>

            <button
              type="button"
              onClick={() => {
                clearAdminToken();
                setState((s) => ({ ...s, token: "", error: undefined }));
              }}
              className="text-xs text-gray-600 underline underline-offset-4 hover:text-gray-900"
            >
              清除本机口令
            </button>
          </div>
        </form>

        <div className="mt-6 text-[11px] text-gray-400 leading-relaxed">
          <p>注意：口令错误将导致受保护接口返回 401/403（AUTH_REQUIRED）。</p>
          <p>若网络异常或服务暂不可用，请稍后再试或联系管理员。</p>
        </div>
      </div>
    </div>
  );
}
