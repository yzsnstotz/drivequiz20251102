// ============================================================
// 文件路径: src/contexts/ActivationContext.tsx
// 功能: 激活状态共享 Context（避免重复请求）
// 更新日期: 2025-12-02
// 更新内容: 缓存key从email改为userId，避免email为空或被修改导致的缓存错乱
// ============================================================

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAppSession } from "@/contexts/SessionContext";
import { fetchWithCache } from "@/lib/requestCache";

interface ActivationStatus {
  valid: boolean;
  reasonCode?: string;
  activationCode?: string;
  activatedAt?: string;
  expiresAt?: string | null;
  status?: string;
}

interface ActivationContextType {
  status: ActivationStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
  refreshActivationStatus: () => Promise<void>; // ✅ 新增：强制刷新激活状态
}

const ActivationContext = createContext<ActivationContextType | undefined>(undefined);

// 防抖配置
const DEBOUNCE_DELAY = 1000; // 1 秒
let debounceTimer: NodeJS.Timeout | null = null;

/**
 * 获取激活状态（带缓存和去重）
 * ✅ 修复：使用 requestCache 工具实现请求去重和结果缓存
 * ✅ 修复：使用 userId 作为缓存key（而非 email），避免email为空或被修改导致的缓存错乱
 */
async function fetchActivationStatusCached(userId: string): Promise<ActivationStatus | null> {
  const key = `activation_status:${userId}`;
  const TTL_MS = 5 * 60 * 1000; // 5 分钟

  return fetchWithCache(key, TTL_MS, async () => {
    const res = await fetch("/api/activation/status", {
      method: "GET",
      credentials: "include",
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const result = await res.json();
    if (result.ok && result.data) {
      return result.data as ActivationStatus;
    }
    return null;
  }).catch((error) => {
    if (process.env.NODE_ENV === "development") {
      console.error("[ActivationContext] Fetch failed:", error);
    }
    return null;
  });
}

/**
 * 激活状态 Provider
 */
export function ActivationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useAppSession();
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ 修复：刷新激活状态（带防抖，使用 requestCache）
  const refresh = useCallback(async () => {
    // 清除之前的防抖定时器
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // 设置新的防抖定时器
    return new Promise<void>((resolve) => {
      debounceTimer = setTimeout(async () => {
        if (!session?.user?.id) {
          setStatus({ valid: false, reasonCode: "NOT_LOGGED_IN" });
          setLoading(false);
          resolve();
          return;
        }

        try {
          setLoading(true);
          const newStatus = await fetchActivationStatusCached(session.user.id);
          setStatus(newStatus);
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("[ActivationProvider] Refresh error:", error);
          }
        } finally {
          setLoading(false);
          resolve();
        }
      }, DEBOUNCE_DELAY);
    });
  }, [session?.user?.id]);

  // ✅ 修复：强制刷新激活状态（清除缓存后重新请求）
  const refreshActivationStatus = useCallback(async () => {
    if (!session?.user?.id) {
      setStatus({ valid: false, reasonCode: "NOT_LOGGED_IN" });
      setLoading(false);
      return;
    }

    // 清除缓存
    const { clearCache } = await import("@/lib/requestCache");
    clearCache(`activation_status:${session.user.id}`);

    try {
      setLoading(true);
      const newStatus = await fetchActivationStatusCached(session.user.id);
      setStatus(newStatus);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[ActivationProvider] Force refresh error:", error);
      }
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // 初始加载
  useEffect(() => {
    if (!session?.user?.id) {
      // 没有 session，设置默认状态
      setStatus({ valid: false, reasonCode: "NOT_LOGGED_IN" });
      setLoading(false);
      return;
    }

    // ✅ 修复：使用 requestCache，如果已有缓存会直接返回，不会发起新请求
    setLoading(true);
    fetchActivationStatusCached(session.user.id).then((newStatus) => {
      setStatus(newStatus);
      setLoading(false);
    });
  }, [session?.user?.id]);

  // 当 session 变化时刷新
  useEffect(() => {
    if (session?.user?.id) {
      refresh();
    }
  }, [session?.user?.id, refresh]);

  const value: ActivationContextType = {
    status,
    loading,
    refresh,
    refreshActivationStatus,
  };

  return <ActivationContext.Provider value={value}>{children}</ActivationContext.Provider>;
}

/**
 * 使用激活状态的 Hook
 */
export function useActivation() {
  const context = useContext(ActivationContext);
  if (context === undefined) {
    throw new Error("useActivation must be used within an ActivationProvider");
  }
  return context;
}

/**
 * 清除激活状态缓存（用于激活成功后刷新）
 * ✅ 修复：使用 requestCache 的 clearCache
 * ✅ 修复：参数从 userEmail 改为 userId，避免email为空导致的缓存错乱
 */
export function clearActivationCache(userId?: string) {
  if (userId) {
    const { clearCache } = require("@/lib/requestCache");
    clearCache(`activation_status:${userId}`);
  } else {
    const { clearAllCache } = require("@/lib/requestCache");
    clearAllCache();
  }
}

