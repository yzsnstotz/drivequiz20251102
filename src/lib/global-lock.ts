/**
 * 全局调试锁
 * 用于防止重复请求
 */
export const GLOBAL_LOCK = {
  sessionRequested: false,
  activationRequested: false,
};

/**
 * 重置全局锁（用于测试或手动刷新）
 */
export function resetGlobalLock() {
  GLOBAL_LOCK.sessionRequested = false;
  GLOBAL_LOCK.activationRequested = false;
}

