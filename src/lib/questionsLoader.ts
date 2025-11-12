"use client";

import { apiGet } from "@/lib/apiClient.front";

type QuestionType = "single" | "multiple" | "truefalse";

export interface Question {
  id: number;
  type: QuestionType;
  content: string;
  image?: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  hash?: string;
  category?: string;
}

export interface UnifiedPackage {
  version?: string;
  questions?: Question[];
  aiAnswers?: Record<string, string>;
}

const VERSION_ENDPOINT = "/api/questions/version";
const PACKAGE_ENDPOINT = "/api/questions/package";
const LS_PREFIX = "dq_questions_package_v_";
const LS_CURRENT_VERSION_KEY = "dq_questions_package_current_version";

function getFromLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setToLocalStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota or privacy errors
  }
}

function removeFromLocalStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function getLatestPackageVersion(): Promise<string | null> {
  try {
    const res = await apiGet<{ version: string }>(VERSION_ENDPOINT);
    return (res as any)?.version || null;
  } catch {
    return null;
  }
}

async function fetchUnifiedPackage(): Promise<UnifiedPackage | null> {
  try {
    const res = await apiGet<UnifiedPackage>(PACKAGE_ENDPOINT);
    return res || null;
  } catch {
    return null;
  }
}

function getCachedPackage(version: string): UnifiedPackage | null {
  const raw = getFromLocalStorage(`${LS_PREFIX}${version}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UnifiedPackage;
  } catch {
    return null;
  }
}

function cachePackage(version: string, data: UnifiedPackage): void {
  setToLocalStorage(`${LS_PREFIX}${version}`, JSON.stringify(data));
  setToLocalStorage(LS_CURRENT_VERSION_KEY, version);
  // 可选：清理历史版本，避免无限增长
  try {
    if (typeof window !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LS_PREFIX) && key !== `${LS_PREFIX}${version}`) {
          // 保留最近版本，其它的可以按需删除
          // 此处只删除超过2个的历史可以优化；目前简单策略：不删除
        }
      }
    }
  } catch {
    // ignore
  }
}

export function getLocalPackageVersion(): string | null {
  return getFromLocalStorage(LS_CURRENT_VERSION_KEY);
}

/**
 * 核心入口：带版本检查与本地缓存的统一题库加载
 * 优化逻辑：
 * 1. 先读取 localStorage 中的版本号（同步，快速）
 * 2. 请求服务器最新版本号
 * 3. 比较版本号：
 *    - 如果一致：使用缓存（确保缓存是最新题目）
 *    - 如果不一致：从服务器下载最新版本并更新 localStorage 和缓存
 */
export async function loadUnifiedQuestionsPackage(): Promise<UnifiedPackage | null> {
  // 1) 先读取 localStorage 中的版本号（同步操作，无需等待）
  const localVersion = getLocalPackageVersion();
  
  // 2) 请求服务器最新版本号
  const latestVersion = await getLatestPackageVersion();
  if (!latestVersion) {
    // 版本不可用时，仍尝试直接拉取包（容错）
    const pkg = await fetchUnifiedPackage();
    if (pkg?.version) {
      cachePackage(pkg.version, pkg);
    }
    return pkg;
  }

  // 3) 比较版本号
  if (localVersion === latestVersion) {
    // 版本一致，使用缓存（确保缓存是最新题目）
    const cached = getCachedPackage(latestVersion);
    if (cached?.questions && cached.questions.length > 0) {
      // 确保版本号标记是最新的
      setToLocalStorage(LS_CURRENT_VERSION_KEY, latestVersion);
      return cached;
    }
    // 如果缓存不存在但版本号一致，重新下载（数据可能被清除）
    console.log(
      `[loadUnifiedQuestionsPackage] 版本一致但缓存不存在，重新下载: ${latestVersion}`
    );
    const pkg = await fetchUnifiedPackage();
    if (pkg) {
      const versionToUse = pkg.version || latestVersion;
      cachePackage(versionToUse, pkg);
    }
    return pkg;
  } else {
    // 版本不一致，从服务器下载最新版本并更新 localStorage 和缓存
    console.log(
      `[loadUnifiedQuestionsPackage] 版本不一致，更新中: ${localVersion || "无"} -> ${latestVersion}`
    );
    const pkg = await fetchUnifiedPackage();
    if (pkg) {
      const versionToUse = pkg.version || latestVersion;
      // 更新 localStorage 和缓存
      cachePackage(versionToUse, pkg);
      console.log(
        `[loadUnifiedQuestionsPackage] 版本更新完成: ${versionToUse}`
      );
    }
    return pkg;
  }
}


/**
 * 便捷方法：直接拿 questions 数组（为空则返回 []）
 */
export async function loadAllQuestions(): Promise<Question[]> {
  const pkg = await loadUnifiedQuestionsPackage();
  return pkg?.questions || [];
}

/**
 * 便捷方法：直接拿 aiAnswers（无则返回 {}）
 */
export async function loadAiAnswers(): Promise<Record<string, string>> {
  const pkg = await loadUnifiedQuestionsPackage();
  return pkg?.aiAnswers || {};
}


