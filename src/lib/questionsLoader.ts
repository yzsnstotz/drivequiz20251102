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
 */
export async function loadUnifiedQuestionsPackage(): Promise<UnifiedPackage | null> {
  // 1) 获取最新版本
  const latestVersion = await getLatestPackageVersion();
  if (!latestVersion) {
    // 版本不可用时，仍尝试直接拉取包（容错）
    const pkg = await fetchUnifiedPackage();
    if (pkg?.version) {
      cachePackage(pkg.version, pkg);
    }
    return pkg;
  }

  // 2) 命中缓存直接返回
  const cached = getCachedPackage(latestVersion);
  if (cached?.questions && cached.questions.length > 0) {
    setToLocalStorage(LS_CURRENT_VERSION_KEY, latestVersion);
    return cached;
  }

  // 3) 拉取并缓存
  const pkg = await fetchUnifiedPackage();
  if (pkg) {
    // 如果返回包含版本，按返回的版本缓存；否则按 latestVersion 缓存
    const versionToUse = pkg.version || latestVersion;
    cachePackage(versionToUse, pkg);
  }
  return pkg;
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


