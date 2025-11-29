// ============================================================
// 文件路径: src/lib/dbUtils.ts
// 功能: 数据库操作工具函数（重试、错误处理等）
// 更新日期: 2025-11-29
// ============================================================

/**
 * 数据库查询重试配置
 */
interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000, // 1秒
  retryableErrors: [
    'Connection terminated',
    'Connection terminated unexpectedly',
    'timeout',
    'Timeout',
    'ECONNRESET',
    'ETIMEDOUT',
  ],
};

/**
 * 检查错误是否可重试
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || String(error);
  const errorCode = error.code || '';
  
  return DEFAULT_RETRY_CONFIG.retryableErrors.some(
    (retryableError) =>
      errorMessage.includes(retryableError) ||
      errorCode.includes(retryableError)
  );
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试机制的数据库查询执行器
 * 
 * @param queryFn 查询函数
 * @param config 重试配置
 * @returns 查询结果
 */
export async function executeWithRetry<T>(
  queryFn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, retryDelay } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error: any) {
      lastError = error;

      // 如果不是可重试的错误，直接抛出
      if (!isRetryableError(error)) {
        throw error;
      }

      // 如果是最后一次尝试，抛出错误
      if (attempt === maxRetries) {
        break;
      }

      // 计算延迟时间（指数退避）
      const delayMs = retryDelay * Math.pow(2, attempt);
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[DB Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delayMs}ms:`,
          error.message
        );
      }

      await delay(delayMs);
    }
  }

  // 所有重试都失败，抛出最后一个错误
  throw lastError;
}

/**
 * 安全执行数据库查询，捕获连接错误并返回默认值
 * 
 * @param queryFn 查询函数
 * @param defaultValue 默认返回值
 * @returns 查询结果或默认值
 */
export async function executeSafely<T>(
  queryFn: () => Promise<T>,
  defaultValue: T
): Promise<T> {
  try {
    return await executeWithRetry(queryFn);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    // 记录错误但不中断应用
    console.error('[DB Safe Execute] Query failed:', errorMessage);
    
    // 如果是连接相关错误，返回默认值
    if (
      errorMessage.includes('Connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('ETIMEDOUT')
    ) {
      return defaultValue;
    }
    
    // 其他错误也返回默认值，避免应用崩溃
    return defaultValue;
  }
}

