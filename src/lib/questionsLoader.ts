"use client";

import { apiGet } from "@/lib/apiClient.front";

type QuestionType = "single" | "multiple" | "truefalse";

export interface Question {
  id: number;
  type: QuestionType;
  content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
  image?: string;
  options?: string[] | Array<{ zh: string; en?: string; ja?: string; [key: string]: string | undefined }>;
  correctAnswer: string | string[];
  explanation?: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
  hash?: string;
  category?: string;
  license_type_tag?: string[];
  stage_tag?: "provisional" | "regular" | "full" | "both" | null;
}

export interface UnifiedPackage {
  version?: string;
  questions?: Question[];
  aiAnswers?: Record<string, string>;
  // 扩展：多语言
  questionsByLocale?: Record<string, Question[]>;
  aiAnswersByLocale?: Record<string, Record<string, string>>;
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
    const res = await apiGet<{ version: string }>(VERSION_ENDPOINT, { timeoutMs: 10000 }); // 10秒超时
    const version = res?.version || null;
    return version;
  } catch (error) {
    console.error(`[getLatestPackageVersion] 获取版本号失败:`, error);
    return null;
  }
}

async function fetchUnifiedPackage(): Promise<UnifiedPackage | null> {
  try {
    const res = await apiGet<UnifiedPackage>(PACKAGE_ENDPOINT, { timeoutMs: 30000 }); // 30秒超时（题目包较大）
    return res || null;
  } catch (error) {
    console.error(`[fetchUnifiedPackage] 获取题目包失败:`, error);
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
  try {
    const packageKey = `${LS_PREFIX}${version}`;
    const packageData = JSON.stringify(data);
    
    // 检查数据大小（localStorage 通常限制为 5-10MB）
    const dataSize = new Blob([packageData]).size;
    const dataSizeMB = (dataSize / 1024 / 1024).toFixed(2);
    
    if (dataSize > 5 * 1024 * 1024) {
      console.warn(`[cachePackage] 警告：包大小超过 5MB (${dataSizeMB}MB)，可能超出 localStorage 限制`);
    }
    
    setToLocalStorage(packageKey, packageData);
    setToLocalStorage(LS_CURRENT_VERSION_KEY, version);
    
    // 验证是否写入成功
    const verifyPackage = getFromLocalStorage(packageKey);
    const verifyVersion = getFromLocalStorage(LS_CURRENT_VERSION_KEY);
    
    if (!verifyPackage || verifyVersion !== version) {
      console.error(`[cachePackage] 缓存失败！版本: ${version}, 验证版本: ${verifyVersion || "无"}`);
    }
    
    // 可选：清理历史版本，避免无限增长
    try {
      if (typeof window !== "undefined") {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LS_PREFIX) && key !== packageKey) {
            // 保留最近版本，其它的可以按需删除
            // 此处只删除超过2个的历史可以优化；目前简单策略：不删除
          }
        }
      }
    } catch (error) {
      console.warn(`[cachePackage] 清理历史版本失败:`, error);
    }
  } catch (error) {
    console.error(`[cachePackage] 缓存包失败:`, error);
    throw error; // 抛出错误，让调用者知道缓存失败
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
    console.warn(`[loadUnifiedQuestionsPackage] 无法获取服务器版本号，尝试直接拉取包`);
    const pkg = await fetchUnifiedPackage();
    if (pkg?.version) {
      cachePackage(pkg.version, pkg);
    } else {
      console.error(`[loadUnifiedQuestionsPackage] 容错模式：拉取的包没有版本号`);
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
    const pkg = await fetchUnifiedPackage();
    if (pkg) {
      // 优先使用最新版本号，确保版本号一致
      const versionToUse = latestVersion;
      if (pkg.version !== latestVersion) {
        pkg.version = latestVersion;
      }
      cachePackage(versionToUse, pkg);
    }
    return pkg;
  } else {
    // 版本不一致，从服务器下载最新版本并更新 localStorage 和缓存
    
    // 强制清除旧版本的缓存（如果有）
    if (localVersion) {
      try {
        const oldCacheKey = `${LS_PREFIX}${localVersion}`;
        removeFromLocalStorage(oldCacheKey);
      } catch (error) {
        console.warn(`[loadUnifiedQuestionsPackage] 清除旧版本缓存失败:`, error);
      }
    }
    
    const pkg = await fetchUnifiedPackage();
    if (pkg) {
      // 关键修复：优先使用从数据库获取的最新版本号，而不是文件中的版本号
      // 因为文件中的版本号可能过时，而数据库中的版本号是最新的
      const versionToUse = latestVersion;
      
      // 如果包中的版本号与最新版本号不一致，更新包中的版本号
      if (pkg.version !== latestVersion) {
        pkg.version = latestVersion;
      }
      
      // 强制清除可能存在的旧版本缓存（确保使用最新内容）
      try {
        const existingCacheKey = `${LS_PREFIX}${versionToUse}`;
        const existingCache = getFromLocalStorage(existingCacheKey);
        if (existingCache) {
          removeFromLocalStorage(existingCacheKey);
        }
      } catch (error) {
        console.warn(`[loadUnifiedQuestionsPackage] 清除现有缓存失败:`, error);
      }
      
      // 更新 localStorage 和缓存（强制刷新）
      cachePackage(versionToUse, pkg);
      
      // 验证版本号是否已更新
      const verifyVersion = getLocalPackageVersion();
      const verifyCache = getCachedPackage(versionToUse);
      if (verifyVersion !== versionToUse || !verifyCache) {
        console.error(
          `[loadUnifiedQuestionsPackage] 版本更新失败！期望版本: ${versionToUse}, 实际版本: ${verifyVersion || "无"}, 缓存存在: ${!!verifyCache}`
        );
      }
    } else {
      console.error(`[loadUnifiedQuestionsPackage] 下载包失败，无法更新版本号`);
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

/**
 * 获取指定语言的 AI 回答（优先多语言结构，回退到中文）
 */
export async function loadAiAnswersForLocale(locale: string): Promise<Record<string, string>> {
  const pkg = await loadUnifiedQuestionsPackage();
  if (!pkg) return {};
  if (pkg.aiAnswersByLocale && pkg.aiAnswersByLocale[locale]) {
    return pkg.aiAnswersByLocale[locale];
  }
  // 兼容 zh/zh-CN/zh_CN
  if (pkg.aiAnswersByLocale) {
    if (pkg.aiAnswersByLocale["zh"]) return pkg.aiAnswersByLocale["zh"];
    if (pkg.aiAnswersByLocale["zh-CN"]) return pkg.aiAnswersByLocale["zh-CN"];
    if (pkg.aiAnswersByLocale["zh_CN"]) return pkg.aiAnswersByLocale["zh_CN"];
  }
  return pkg.aiAnswers || {};
}


