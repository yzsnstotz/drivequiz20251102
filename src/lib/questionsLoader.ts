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

// 后台检查更新相关的变量
let backgroundCheckInProgress = false;
let lastBackgroundCheckTime = 0;
const BACKGROUND_CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查一次

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
 * 后台检查更新（不阻塞主流程）
 * 在后台异步检查版本号，发现新版本时自动更新缓存
 */
async function checkForUpdatesInBackground(localVersion: string): Promise<void> {
  // 防止重复检查
  const now = Date.now();
  if (backgroundCheckInProgress || (now - lastBackgroundCheckTime < BACKGROUND_CHECK_INTERVAL)) {
    return;
  }
  
  backgroundCheckInProgress = true;
  lastBackgroundCheckTime = now;
  
  try {
    // 异步检查版本号（不阻塞）
    const latestVersion = await getLatestPackageVersion();
    
    if (!latestVersion) {
      // 网络失败，忽略（使用本地缓存）
      console.log(`[checkForUpdatesInBackground] 无法获取版本号，继续使用本地缓存`);
      return;
    }
    
    if (localVersion === latestVersion) {
      // 版本一致，无需更新
      console.log(`[checkForUpdatesInBackground] 版本一致，无需更新`);
      return;
    }
    
    // 版本不一致，下载新版本（在后台进行）
    console.log(`[checkForUpdatesInBackground] 发现新版本 ${latestVersion}，开始下载...`);
    const pkg = await fetchUnifiedPackage();
    
    if (pkg) {
      const versionToUse = latestVersion;
      if (pkg.version !== latestVersion) {
        pkg.version = latestVersion;
      }
      
      // 清除旧缓存
      try {
        const oldCacheKey = `${LS_PREFIX}${localVersion}`;
        removeFromLocalStorage(oldCacheKey);
      } catch (error) {
        console.warn(`[checkForUpdatesInBackground] 清除旧版本缓存失败:`, error);
      }
      
      // 保存新版本
      cachePackage(versionToUse, pkg);
      console.log(`[checkForUpdatesInBackground] 新版本已下载并缓存`);
    }
  } catch (error) {
    // 后台更新失败，不影响当前使用（继续使用本地缓存）
    console.warn(`[checkForUpdatesInBackground] 后台更新失败，继续使用本地缓存:`, error);
  } finally {
    backgroundCheckInProgress = false;
  }
}

/**
 * 从服务器加载（仅在无缓存时调用）
 */
async function loadFromServer(): Promise<UnifiedPackage | null> {
  try {
    // 先尝试获取版本号
    const latestVersion = await getLatestPackageVersion();
    
    if (!latestVersion) {
      // 版本不可用时，尝试直接拉取包
      console.warn(`[loadFromServer] 无法获取服务器版本号，尝试直接拉取包`);
      const pkg = await fetchUnifiedPackage();
      if (pkg?.version) {
        cachePackage(pkg.version, pkg);
      }
      return pkg;
    }
    
    // 下载最新版本
    const pkg = await fetchUnifiedPackage();
    if (pkg) {
      const versionToUse = latestVersion;
      if (pkg.version !== latestVersion) {
        pkg.version = latestVersion;
      }
      
      // 清除旧版本缓存
      const localVersion = getLocalPackageVersion();
      if (localVersion && localVersion !== versionToUse) {
        try {
          const oldCacheKey = `${LS_PREFIX}${localVersion}`;
          removeFromLocalStorage(oldCacheKey);
        } catch (error) {
          console.warn(`[loadFromServer] 清除旧版本缓存失败:`, error);
        }
      }
      
      // 保存新版本
      cachePackage(versionToUse, pkg);
      return pkg;
    }
    
    return null;
  } catch (error) {
    console.error(`[loadFromServer] 从服务器加载失败:`, error);
    
    // 如果服务器加载失败，尝试使用任何可用的本地缓存（降级方案）
    const localVersion = getLocalPackageVersion();
    if (localVersion) {
      const cached = getCachedPackage(localVersion);
      if (cached?.questions && cached.questions.length > 0) {
        console.log(`[loadFromServer] 服务器加载失败，使用本地缓存作为降级方案`);
        return cached;
      }
    }
    
    return null;
  }
}

/**
 * 核心入口：带版本检查与本地缓存的统一题库加载
 * 优化逻辑：
 * 1. 先读取本地版本号和缓存（同步操作，立即返回）
 * 2. 如果有缓存，立即返回，后台异步检查更新
 * 3. 如果没有缓存，从服务器加载
 * 4. 网络失败时使用本地缓存作为降级方案
 */
export async function loadUnifiedQuestionsPackage(): Promise<UnifiedPackage | null> {
  // 函数开头打印日志
  console.log("[loadUnifiedQuestionsPackage] start", { timestamp: new Date().toISOString() });
  
  try {
    // 1) 先读取本地版本号和缓存（同步操作，立即返回）
    const localVersion = getLocalPackageVersion();
    
    // 如果有本地缓存，立即返回（不等待网络请求）
    if (localVersion) {
      const cached = getCachedPackage(localVersion);
      const hasTopLevel = !!(cached?.questions && cached.questions.length > 0);
      const hasLocale = !!(cached?.questionsByLocale && Object.values(cached.questionsByLocale).some(arr => Array.isArray(arr) && arr.length > 0));
      if (hasTopLevel || hasLocale) {
        console.log("[loadUnifiedQuestionsPackage] 使用本地缓存", {
          version: localVersion,
          questionCount: hasTopLevel ? (cached!.questions!.length) : 0,
          hasLocale,
        });
        
        checkForUpdatesInBackground(localVersion).catch(err => {
          console.warn(`[loadUnifiedQuestionsPackage] 后台检查更新失败:`, err);
        });
        
        return cached!;
      }
    }
    
    // 如果没有缓存，才需要从服务器加载
    console.log("[loadUnifiedQuestionsPackage] no cache, loadFromServer()");
    const result = await loadFromServer();
    
    if (result) {
      console.log("[loadUnifiedQuestionsPackage] loaded from server", {
        questionCount: result.questions?.length || 0,
      });
    }
    
    return result;
  } catch (error) {
    // 捕获异常时打印错误日志，但不要吞掉错误，交给 Error Boundary 捕获
    console.error("[loadUnifiedQuestionsPackage] error", error);
    throw error; // 重新抛出错误，让 Error Boundary 处理
  }
}


/**
 * 便捷方法：直接拿 questions 数组（为空则返回 []）
 */
export async function loadAllQuestions(): Promise<Question[]> {
  const pkg = await loadUnifiedQuestionsPackage();
  if (!pkg) return [];
  if (pkg.questions && pkg.questions.length > 0) return pkg.questions;
  if (pkg.questionsByLocale) {
    if (pkg.questionsByLocale["zh"] && pkg.questionsByLocale["zh"]!.length > 0) return pkg.questionsByLocale["zh"]!;
    if (pkg.questionsByLocale["zh-CN"] && pkg.questionsByLocale["zh-CN"]!.length > 0) return pkg.questionsByLocale["zh-CN"]!;
    if (pkg.questionsByLocale["zh_CN"] && pkg.questionsByLocale["zh_CN"]!.length > 0) return pkg.questionsByLocale["zh_CN"]!;
    const anyLocale = Object.values(pkg.questionsByLocale).find(arr => Array.isArray(arr) && arr.length > 0);
    if (anyLocale) return anyLocale as Question[];
  }
  return [];
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

