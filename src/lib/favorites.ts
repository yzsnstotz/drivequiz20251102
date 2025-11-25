/**
 * 收藏功能工具函数
 * 管理 localStorage 中的收藏题目列表
 */

const FAVORITES_KEY = "favoriteQuestions";

/**
 * 获取所有收藏的题目 hash 数组
 * @returns 题目 hash 数组
 */
export function getFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];
    const favorites = JSON.parse(stored);
    return Array.isArray(favorites) ? favorites : [];
  } catch {
    return [];
  }
}

/**
 * 检查题目是否已收藏
 * @param questionHash 题目的 hash 值（content_hash 或 hash）
 * @returns 是否已收藏
 */
export function isFavorite(questionHash: string | undefined): boolean {
  if (!questionHash) return false;
  const favorites = getFavorites();
  return favorites.includes(questionHash);
}

/**
 * 添加收藏
 * @param questionHash 题目的 hash 值
 */
export function addFavorite(questionHash: string): void {
  if (typeof window === "undefined") return;
  if (!questionHash) return;

  try {
    const favorites = getFavorites();
    if (!favorites.includes(questionHash)) {
      favorites.push(questionHash);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
  } catch (error) {
    console.error("[addFavorite] 添加收藏失败:", error);
  }
}

/**
 * 移除收藏
 * @param questionHash 题目的 hash 值
 */
export function removeFavorite(questionHash: string): void {
  if (typeof window === "undefined") return;
  if (!questionHash) return;

  try {
    const favorites = getFavorites();
    const filtered = favorites.filter((hash) => hash !== questionHash);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("[removeFavorite] 移除收藏失败:", error);
  }
}

/**
 * 切换收藏状态
 * @param questionHash 题目的 hash 值
 * @returns 新的收藏状态
 */
export function toggleFavorite(questionHash: string): boolean {
  if (isFavorite(questionHash)) {
    removeFavorite(questionHash);
    return false;
  } else {
    addFavorite(questionHash);
    return true;
  }
}

