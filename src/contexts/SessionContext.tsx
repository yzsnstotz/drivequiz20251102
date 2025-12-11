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
const lastFetchedAt = { current: 0 };
const sessionFetchPromise: { current: Promise<void> | null } = { current: null };

const MAX_SESSION_AGE_MS = 60 * 1000; // 会话缓存最大有效期

type AppSessionStatus = "loading" | "unauthenticated" | "authenticated";

interface AppSessionContextValue {
  session: any | null;
  status: AppSessionStatus;
  loading: boolean;
  isRefreshing: boolean;
  // 保持向后兼容，保留 data 字段
  data: any | null;
  // 保持向后兼容，保留 update 方法
  update: () => Promise<any | null>;
  isAuthenticatedStrict: boolean;
  fetchSession: (force?: boolean) => Promise<void>;
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSession = React.useCallback(
    async (force = false) => {
      // 若已有刷新中的请求，等待其完成，避免直接返回导致标记提前完成
      if (isRefreshing) {
        if (sessionFetchPromise.current) {
          await sessionFetchPromise.current;
        }
        return;
      }

      const now = Date.now();
      if (
        !force &&
        sessionFetched.current &&
        lastFetchedAt.current &&
        now - lastFetchedAt.current < MAX_SESSION_AGE_MS
      ) {
        // 缓存未过期，直接使用
        setSession(sessionCache.current);
        setStatus(
          sessionCache.current?.user ? "authenticated" : "unauthenticated"
        );
        setLoading(false);
        return;
      }

      if (sessionFetchLock.current && sessionFetched.current && !force) {
        setSession(sessionCache.current);
        setStatus(
          sessionCache.current?.user ? "authenticated" : "unauthenticated"
        );
        setLoading(false);
        return;
      }

      sessionFetchLock.current = true;
      GLOBAL_LOCK.sessionRequested = true;
      setIsRefreshing(true);
      setLoading(true);

      const runner = (async () => {
        try {
          const res = await fetch("/api/auth/session", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });

          const data = res.ok ? await res.json() : null;
          sessionFetched.current = true;
          sessionCache.current = data;
          lastFetchedAt.current = Date.now();

          setSession(data);
          setStatus(data?.user ? "authenticated" : "unauthenticated");
        } catch (err) {
          console.error("[SessionProvider] fetch session error", err);
          sessionFetched.current = true;
          sessionCache.current = null;
          lastFetchedAt.current = Date.now();
          setSession(null);
          setStatus("unauthenticated");
        } finally {
          setLoading(false);
          setIsRefreshing(false);
          sessionFetchLock.current = false;
        }
      })();

      sessionFetchPromise.current = runner;
      await runner;
      sessionFetchPromise.current = null;
    },
    [isRefreshing]
  );

  useEffect(() => {
    if (!sessionFetched.current) {
      void fetchSession(true);
    }
  }, [fetchSession]);

  // 窗口聚焦时强制刷新，防止跨标签/过期会话误判
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleFocus = () => {
      void fetchSession(true);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchSession]);

  // 手动刷新方法
  const update = async () => {
    sessionFetched.current = false;
    sessionCache.current = null;
    sessionFetchLock.current = false;
    GLOBAL_LOCK.sessionRequested = false;
    await fetchSession(true);
    return sessionCache.current;
  };

  const value: AppSessionContextValue = {
    session,
    status,
    loading,
    isRefreshing,
    data: session, // 保持向后兼容
    update,
    isAuthenticatedStrict:
      status === "authenticated" &&
      !!session?.user &&
      typeof session.user.id === "string" &&
      session.user.id.length > 0,
    fetchSession,
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
