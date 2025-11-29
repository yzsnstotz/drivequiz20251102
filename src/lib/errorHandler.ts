// ============================================================
// 文件路径: src/lib/errorHandler.ts
// 功能: 全局错误处理
// 更新日期: 2025-11-29
// ============================================================

/**
 * 初始化全局错误处理（保证只注册一次）
 * 应该在应用启动时调用
 */
export function setupGlobalErrorHandlers() {
  // 避免在开发环境 / 热重载 / 多次导入时重复注册监听器
  const g = globalThis as any;
  if (g.__GLOBAL_ERROR_HANDLER_INITIALIZED__) {
    return;
  }
  g.__GLOBAL_ERROR_HANDLER_INITIALIZED__ = true;

  // 可选：放宽监听上限，避免开发环境下的 MaxListeners 警告
  if (typeof process.setMaxListeners === "function") {
    process.setMaxListeners(50);
  }

  // 处理未捕获的异常
  process.on('uncaughtException', (error: Error) => {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || '';
    
    // 检查是否是数据库连接错误
    if (
      errorMessage.includes('Connection terminated') ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('timeout')
    ) {
      // 数据库连接错误，记录但不退出进程（让连接池处理）
      console.error('[Global Error Handler] Uncaught database connection error:', {
        message: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      });
      return; // 不退出进程
    }
    
    // 其他未捕获异常，记录并可能需要退出
    console.error('[Global Error Handler] Uncaught Exception:', {
      message: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    });
    
    // 在生产环境，某些错误可能需要退出进程
    // 但数据库连接错误不应该导致进程退出
    if (process.env.NODE_ENV === 'production') {
      // 可以在这里添加告警通知
    }
  });

  // 处理未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const errorMessage = reason?.message || String(reason);
    const errorStack = reason?.stack || '';
    
    // 检查是否是数据库连接错误
    if (
      errorMessage.includes('Connection terminated') ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('timeout')
    ) {
      // 数据库连接错误，记录但不退出进程
      console.error('[Global Error Handler] Unhandled Rejection (database connection):', {
        message: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      });
      return; // 不退出进程
    }
    
    // 其他未处理的拒绝，记录
    console.error('[Global Error Handler] Unhandled Rejection:', {
      message: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    });
  });

  // 处理警告
  process.on('warning', (warning: Error) => {
    // 只在开发环境记录警告
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Global Error Handler] Warning:', warning.message);
    }
  });
}

/**
 * 在应用启动时调用此函数
 */
if (typeof window === 'undefined') {
  // 仅在服务端执行
  setupGlobalErrorHandlers();
}

