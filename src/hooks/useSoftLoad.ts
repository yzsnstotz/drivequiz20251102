// ============================================================
// 文件路径: src/hooks/useSoftLoad.ts
// 功能: 软加载 Hook
// 更新日期: 2025-11-29
// ============================================================

"use client";

import { useEffect, useState, useRef } from "react";
import {
  softLoadingManager,
  LoadPriority,
  type LoadTask,
} from "@/lib/softLoadingManager";

/**
 * 使用软加载的 Hook
 */
export function useSoftLoad<T>(
  taskId: string,
  loadFn: () => Promise<T>,
  options: {
    priority?: LoadPriority;
    cacheKey?: string;
    cacheTTL?: number;
    immediate?: boolean; // 是否立即加载（用于关键数据）
  } = {}
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
} {
  const { priority = LoadPriority.NORMAL, cacheKey, cacheTTL, immediate = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);
  
  // 使用 useRef 存储最新的 loadFn，避免依赖变化导致重复执行
  const loadFnRef = useRef(loadFn);
  useEffect(() => {
    loadFnRef.current = loadFn;
  }, [loadFn]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 使用 ref 中的最新 loadFn
        const currentLoadFn = loadFnRef.current;

        if (immediate || priority === LoadPriority.CRITICAL) {
          // 立即执行关键任务
          const result = await softLoadingManager.executeCritical({
            id: taskId,
            priority,
            loadFn: currentLoadFn,
            cacheKey,
            cacheTTL,
          });
          if (!cancelled) {
            setData(result);
          }
        } else {
          // 添加到软加载队列
          softLoadingManager.addTask({
            id: taskId,
            priority,
            loadFn: async () => {
              const result = await currentLoadFn();
              if (!cancelled) {
                setData(result);
              }
              return result;
            },
            cacheKey,
            cacheTTL,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [taskId, priority, cacheKey, cacheTTL, immediate]);

  return { data, loading, error };
}

