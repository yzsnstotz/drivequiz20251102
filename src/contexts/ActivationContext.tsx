// ============================================================
// 文件路径: src/contexts/ActivationContext.tsx
// 功能: 激活状态共享 Context（避免重复请求）
// 更新日期: 2025-11-29
// ============================================================

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

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
}

const ActivationContext = createContext<ActivationContextType | undefined>(undefined);

// 缓存配置
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟（与 API 缓存一致）
let cachedStatus: ActivationStatus | null = null;
let cacheTimestamp = 0;
let pendingRequest: Promise<ActivationStatus | null> | null = null;

// 防抖配置
const DEBOUNCE_DELAY = 1000; // 1 秒
let debounceTimer: NodeJS.Timeout | null = null;

/**
 * 获取激活状态（带缓存和去重）
 */
async function fetchActivationStatus(): Promise<ActivationStatus | null> {
  // 检查缓存
  const now = Date.now();
  if (cachedStatus && now - cacheTimestamp < CACHE_TTL) {
    return cachedStatus;
  }

  // 检查是否有正在进行的请求
  if (pendingRequest) {
    return pendingRequest;
  }

  // 创建新请求
  const promise = fetch("/api/activation/status", {
    method: "GET",
    credentials: "include",
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const result = await res.json();
      if (result.ok && result.data) {
        return result.data as ActivationStatus;
      }
      return null;
    })
    .then((status) => {
      // 更新缓存
      if (status) {
        cachedStatus = status;
        cacheTimestamp = Date.now();
      }
      return status;
    })
    .catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[ActivationContext] Fetch failed:", error);
      }
      return null;
    })
    .finally(() => {
      // 清除正在进行的请求
      pendingRequest = null;
    });

  pendingRequest = promise;
  return promise;
}

/**
 * 激活状态 Provider
 */
export function ActivationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [status, setStatus] = useState<ActivationStatus | null>(cachedStatus);
  const [loading, setLoading] = useState(!cachedStatus);
  const refreshRef = useRef<() => Promise<void>>();

  // 刷新激活状态（带防抖）
  const refresh = useCallback(async () => {
    // 清除之前的防抖定时器
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // 设置新的防抖定时器
    return new Promise<void>((resolve) => {
      debounceTimer = setTimeout(async () => {
        try {
          setLoading(true);
          const newStatus = await fetchActivationStatus();
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
  }, []);

  // 保存 refresh 函数到 ref，供外部使用
  refreshRef.current = refresh;

  // 初始加载
  useEffect(() => {
    if (!session?.user?.email) {
      // 没有 session，设置默认状态
      setStatus({ valid: false, reasonCode: "NOT_LOGGED_IN" });
      setLoading(false);
      return;
    }

    // 如果有缓存，直接使用
    if (cachedStatus && Date.now() - cacheTimestamp < CACHE_TTL) {
      setStatus(cachedStatus);
      setLoading(false);
      return;
    }

    // 加载状态
    fetchActivationStatus().then((newStatus) => {
      setStatus(newStatus);
      setLoading(false);
    });
  }, [session]);

  // 当 session 变化时刷新
  useEffect(() => {
    if (session?.user?.email) {
      // 清除缓存，强制刷新
      cachedStatus = null;
      cacheTimestamp = 0;
      refresh();
    }
  }, [session?.user?.email, refresh]);

  const value: ActivationContextType = {
    status,
    loading,
    refresh,
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
 */
export function clearActivationCache() {
  cachedStatus = null;
  cacheTimestamp = 0;
  pendingRequest = null;
}

