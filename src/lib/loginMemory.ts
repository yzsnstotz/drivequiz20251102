/**
 * 登录记忆功能
 * 用于记住用户上次登录的账号，方便快速重新登录
 */

const LAST_LOGIN_PROVIDER_KEY = 'lastLoginProvider';
const LAST_LOGIN_EMAIL_KEY = 'lastLoginEmail';

export interface LoginMemory {
  provider: string;
  email?: string;
}

/**
 * 保存登录记忆
 */
export function saveLoginMemory(provider: string, email?: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(LAST_LOGIN_PROVIDER_KEY, provider);
    if (email) {
      localStorage.setItem(LAST_LOGIN_EMAIL_KEY, email);
    }
  } catch (error) {
    console.warn('[LoginMemory] Failed to save login memory:', error);
  }
}

/**
 * 获取登录记忆
 */
export function getLoginMemory(): LoginMemory | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const provider = localStorage.getItem(LAST_LOGIN_PROVIDER_KEY);
    if (!provider) return null;
    
    const email = localStorage.getItem(LAST_LOGIN_EMAIL_KEY) || undefined;
    return { provider, email };
  } catch (error) {
    console.warn('[LoginMemory] Failed to get login memory:', error);
    return null;
  }
}

/**
 * 清除登录记忆（用于切换账号）
 */
export function clearLoginMemory(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(LAST_LOGIN_PROVIDER_KEY);
    localStorage.removeItem(LAST_LOGIN_EMAIL_KEY);
  } catch (error) {
    console.warn('[LoginMemory] Failed to clear login memory:', error);
  }
}

/**
 * 检查是否有登录记忆
 */
export function hasLoginMemory(): boolean {
  return getLoginMemory() !== null;
}

