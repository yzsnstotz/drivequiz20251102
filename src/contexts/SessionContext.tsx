"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { GLOBAL_LOCK } from "@/lib/global-lock";

// 新增：避免 Provider 内部多次初始化
const sessionFetchLock = { current: false };
const sessionCache: { current: any } = { current: null };
const sessionFetched = { current: false };

type AppSessionStatus = "loading" | "unauthenticated" | "authenticated";

interface AppSessionContextValue {
  session: any | null;
  status: AppSessionStatus;
  loading: boolean;
  // 保持向后兼容，保留 data 字段
  data: any | null;
  // 保持向后兼容，保留 update 方法
  update: () => Promise<any | null>;
}

const AppSessionContext = createContext<AppSessionContextValue | undefined>(
  undefined
);

/**
 * App Session Provider
 * ✅ 修复：彻底重写，不再使用 NextAuth 的 useSession，直接 fetch("/api/auth/session")
 * ✅ 修复：只获取一次，后续不再自动刷新
 * ✅ 修复：切换用户或手动触发才重新获取
 * ✅ 修复：保证 activation 不依赖 session 的加载状态
 */
export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AppSessionStatus>("loading");

  useEffect(() => {
    if (sessionFetched.current) {
      // 已经加载过，直接使用缓存
      setSession(sessionCache.current);
      setStatus(
        sessionCache.current?.user ? "authenticated" : "unauthenticated"
      );
      setLoading(false);
      return;
    }

    if (sessionFetchLock.current) return;

    // 全局锁检查
    if (GLOBAL_LOCK.sessionRequested) {
      // 如果已经在其他地方请求了，等待一下再检查缓存
      const checkInterval = setInterval(() => {
        if (sessionFetched.current) {
          setSession(sessionCache.current);
          setStatus(
            sessionCache.current?.user ? "authenticated" : "unauthenticated"
          );
          setLoading(false);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    sessionFetchLock.current = true;
    GLOBAL_LOCK.sessionRequested = true;

    // ✅ 修复：添加调试日志，方便确认请求次数
    if (process.env.NODE_ENV === "development") {
      console.log("[Diag][SessionContext] fetching /api/auth/session");
    }

    fetch("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        sessionFetched.current = true;
        sessionCache.current = data;
        setSession(data);
        setStatus(data?.user ? "authenticated" : "unauthenticated");
      })
      .catch((err) => {
        console.error("[SessionProvider] fetch session error", err);
        setSession(null);
        setStatus("unauthenticated");
      })
      .finally(() => {
        setLoading(false);
        sessionFetchLock.current = false;
      });
  }, []); // ← 必须为空，禁止依赖任何变量

  // 手动刷新方法
  const update = async () => {
    sessionFetched.current = false;
    sessionCache.current = null;
    sessionFetchLock.current = false;
    GLOBAL_LOCK.sessionRequested = false;

    setLoading(true);
    setStatus("loading");

    try {
      const res = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      sessionFetched.current = true;
      sessionCache.current = data;
      setSession(data);
      setStatus(data?.user ? "authenticated" : "unauthenticated");
      return data;
    } catch (err) {
      console.error("[SessionProvider] update session error", err);
      setSession(null);
      setStatus("unauthenticated");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const value: AppSessionContextValue = {
    session,
    status,
    loading,
    data: session, // 保持向后兼容
    update,
  };

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}

/**
 * 使用 App Session 的 Hook
 * 替代直接使用 useSession()，确保所有组件共享同一个 session 实例
 */
export const useAppSession = (): AppSessionContextValue => {
  const ctx = useContext(AppSessionContext);
  if (!ctx) {
    throw new Error("useAppSession must be used within AppSessionProvider");
  }
  return ctx;
};
