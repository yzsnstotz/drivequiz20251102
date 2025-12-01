// ============================================================
// 文件路径: src/contexts/ActivationContext.tsx
// 功能: 激活状态共享 Context（避免重复请求）
// 更新日期: 2025-12-02
// 更新内容: 彻底重写，禁止自动轮询，禁止依赖 session 加载状态，只请求一次
// ============================================================

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { GLOBAL_LOCK } from "@/lib/global-lock";

// 新增：全局变量，确保 status 只请求一次
const activationCache: { current: any } = { current: null };
const activationFetched = { current: false };
const activationLock = { current: false };

interface ActivationStatus {
  valid: boolean;
  reasonCode?: string;
  activationCode?: string;
  activatedAt?: string;
  expiresAt?: string | null;
  status?: string;
}

type ActivationState = "unknown" | "loading" | "activated" | "not_activated";

interface ActivationContextValue {
  state: ActivationState;
  status: ActivationStatus | null; // 保留原有字段，保持向后兼容
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const ActivationContext = createContext<ActivationContextValue | undefined>(
  undefined
);

/**
 * 激活状态 Provider
 * ✅ 修复：彻底重写，禁止自动轮询，禁止依赖 session 加载状态，只请求一次
 */
export function ActivationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ActivationState>("unknown");
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (activationFetched.current) {
      // 已经加载过，直接使用缓存
      setStatus(activationCache.current);
      if (activationCache.current) {
        setState(
          activationCache.current.valid === true
            ? "activated"
            : "not_activated"
        );
      }
      setLoading(false);
      return;
    }

    if (activationLock.current) return;

    // 全局锁检查
    if (GLOBAL_LOCK.activationRequested) {
      // 如果已经在其他地方请求了，等待一下再检查缓存
      const checkInterval = setInterval(() => {
        if (activationFetched.current) {
          setStatus(activationCache.current);
          if (activationCache.current) {
            setState(
              activationCache.current.valid === true
                ? "activated"
                : "not_activated"
            );
          }
          setLoading(false);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    activationLock.current = true;
    GLOBAL_LOCK.activationRequested = true;

    setLoading(true);
    setState("loading");

    // ✅ 修复：添加调试日志，方便确认请求次数
    if (process.env.NODE_ENV === "development") {
      console.log("[Diag][ActivationContext] fetching /api/activation/status");
    }

    fetch("/api/activation/status", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        activationFetched.current = true;
        const activationData = data?.ok && data?.data ? data.data : null;
        activationCache.current = activationData;
        setStatus(activationData);
        if (activationData) {
          setState(
            activationData.valid === true ? "activated" : "not_activated"
          );
        } else {
          setState("not_activated");
        }
      })
      .catch((err) => {
        console.error("[ActivationProvider] fetch error", err);
        setError(err as Error);
        setState("not_activated");
      })
      .finally(() => {
        setLoading(false);
        activationLock.current = false;
      });
  }, []); // ← 必须为空，禁止依赖 session/用户

  // 手动刷新方法
  const refresh = async () => {
    activationFetched.current = false;
    activationCache.current = null;
    activationLock.current = false;
    GLOBAL_LOCK.activationRequested = false;

    setLoading(true);
    setState("loading");
    setError(null);

    try {
      const res = await fetch("/api/activation/status", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Activation status error: ${res.status}`);
      }

      const json = await res.json();
      const activationData = json?.ok && json?.data ? json.data : null;

      activationFetched.current = true;
      activationCache.current = activationData;
      setStatus(activationData);

      if (activationData) {
        setState(
          activationData.valid === true ? "activated" : "not_activated"
        );
      } else {
        setState("not_activated");
      }
    } catch (err) {
      console.error("[ActivationProvider] refresh error", err);
      setError(err as Error);
      setState("not_activated");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ActivationContext.Provider
      value={{
        state,
        status,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </ActivationContext.Provider>
  );
}

/**
 * 使用激活状态的 Hook
 */
export const useActivation = (): ActivationContextValue => {
  const ctx = useContext(ActivationContext);
  if (!ctx) {
    throw new Error("useActivation must be used within ActivationProvider");
  }
  return ctx;
};

/**
 * 清除激活状态缓存（用于激活成功后刷新）
 * ✅ 修复：保持向后兼容
 */
export function clearActivationCache(userId?: string) {
  // 这个函数现在主要用于向后兼容，实际刷新通过 refresh() 方法
  if (process.env.NODE_ENV === "development") {
    console.log("[ActivationContext] clearActivationCache called", { userId });
  }
}
