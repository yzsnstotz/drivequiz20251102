// ============================================================
// 文件路径: src/lib/softLoadingManager.ts
// 功能: 软加载管理器（优先级加载和后台预加载）
// 更新日期: 2025-11-29
// ============================================================

/**
 * 数据加载优先级
 */
export enum LoadPriority {
  CRITICAL = 1, // 关键数据：当前页面必需，立即加载
  HIGH = 2, // 高优先级：当前页面相关，优先加载
  NORMAL = 3, // 普通优先级：可缓存数据，软加载
  LOW = 4, // 低优先级：预加载数据，后台加载
}

/**
 * 数据加载任务
 */
export interface LoadTask {
  id: string;
  priority: LoadPriority;
  loadFn: () => Promise<any>;
  cacheKey?: string;
  cacheTTL?: number; // 缓存时间（毫秒）
}

/**
 * 软加载管理器
 */
class SoftLoadingManager {
  private taskQueue: LoadTask[] = [];
  private executingTasks = new Set<string>();
  private cache = new Map<string, { data: any; timestamp: number }>();
  private isIdle = true;

  /**
   * 添加加载任务
   */
  addTask(task: LoadTask): void {
    // 检查缓存
    if (task.cacheKey) {
      const cached = this.cache.get(task.cacheKey);
      if (cached && task.cacheTTL) {
        const now = Date.now();
        if (now - cached.timestamp < task.cacheTTL) {
          // 缓存有效，直接返回
          return;
        }
      }
    }

    // 检查是否已在队列中
    if (this.taskQueue.some((t) => t.id === task.id)) {
      return;
    }

    // 按优先级插入队列
    const insertIndex = this.taskQueue.findIndex((t) => t.priority > task.priority);
    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }

    // 触发执行
    this.processQueue();
  }

  /**
   * 立即执行关键任务
   */
  async executeCritical(task: LoadTask): Promise<any> {
    // 检查缓存
    if (task.cacheKey) {
      const cached = this.cache.get(task.cacheKey);
      if (cached && task.cacheTTL) {
        const now = Date.now();
        if (now - cached.timestamp < task.cacheTTL) {
          return cached.data;
        }
      }
    }

    try {
      const data = await task.loadFn();
      
      // 保存到缓存
      if (task.cacheKey) {
        this.cache.set(task.cacheKey, {
          data,
          timestamp: Date.now(),
        });
      }
      
      return data;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[SoftLoadingManager] Critical task failed: ${task.id}`, error);
      }
      throw error;
    }
  }

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    if (!this.isIdle) {
      return;
    }

    this.isIdle = false;

    // 使用 requestIdleCallback 或 setTimeout 延迟执行非关键任务
    const executeNonCritical = () => {
      const nonCriticalTasks = this.taskQueue.filter(
        (task) => task.priority > LoadPriority.CRITICAL && !this.executingTasks.has(task.id)
      );

      for (const task of nonCriticalTasks.slice(0, 3)) {
        // 一次最多执行 3 个非关键任务
        this.executeTask(task);
      }

      if (this.taskQueue.length === 0) {
        this.isIdle = true;
      } else {
        // 继续处理队列
        setTimeout(executeNonCritical, 1000);
      }
    };

    // 立即执行关键任务
    const criticalTasks = this.taskQueue.filter(
      (task) => task.priority === LoadPriority.CRITICAL && !this.executingTasks.has(task.id)
    );

    for (const task of criticalTasks) {
      await this.executeTask(task);
    }

    // 延迟执行非关键任务
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(executeNonCritical, { timeout: 2000 });
    } else {
      setTimeout(executeNonCritical, 100);
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: LoadTask): Promise<void> {
    if (this.executingTasks.has(task.id)) {
      return;
    }

    this.executingTasks.add(task.id);
    const index = this.taskQueue.findIndex((t) => t.id === task.id);
    if (index !== -1) {
      this.taskQueue.splice(index, 1);
    }

    try {
      const data = await task.loadFn();

      // 保存到缓存
      if (task.cacheKey) {
        this.cache.set(task.cacheKey, {
          data,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[SoftLoadingManager] Task failed: ${task.id}`, error);
      }
    } finally {
      this.executingTasks.delete(task.id);
    }
  }

  /**
   * 清除缓存
   */
  clearCache(cacheKey?: string): void {
    if (cacheKey) {
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 获取缓存数据
   */
  getCached(cacheKey: string): any | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }
    return cached.data;
  }
}

// 单例实例
export const softLoadingManager = new SoftLoadingManager();

/**
 * 预定义的数据加载任务类型
 */
export const DataLoadTasks = {
  // 关键数据（立即加载）
  CRITICAL: {
    CURRENT_PAGE_CONTENT: LoadPriority.CRITICAL,
    USER_ACTIVATION_STATUS: LoadPriority.CRITICAL,
    CURRENT_PAGE_ADS: LoadPriority.CRITICAL,
  },
  
  // 可缓存数据（软加载）
  CACHEABLE: {
    MERCHANT_CATEGORIES: LoadPriority.NORMAL,
    AD_SLOTS_CONFIG: LoadPriority.NORMAL,
    OTHER_PAGE_ADS: LoadPriority.NORMAL,
    USER_PREFERENCES: LoadPriority.NORMAL,
  },
  
  // 预加载数据（后台加载）
  PREFETCH: {
    NEXT_PAGE_CONTENT: LoadPriority.LOW,
    RELATED_DATA: LoadPriority.LOW,
  },
};

