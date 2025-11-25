/**
 * 批量处理工具函数库
 * 从 question-processor 提取的逻辑，用于内部调用
 * 使用与 question-processor 一致的配置和缓存逻辑
 */

import { aiDb } from "@/lib/aiDb";
import { callAiServer, type ServerAiProviderKey } from "@/lib/aiClient.server";
import { mapDbProviderToClientProvider } from "@/lib/aiProviderMapping";
import { loadQpAiConfig, type QpAiConfig } from "@/lib/qpAiConfig";
import { getAiCache, setAiCache } from "@/lib/qpAiCache";
import { normalizeAIResult } from "@/lib/quizTags";
import { buildQuestionTranslationInput, buildQuestionPolishInput, buildQuestionFillMissingInput } from "@/lib/questionPromptBuilder";
import { buildNormalizedQuestion } from "@/lib/questionNormalize";
import { cleanJsonString, sanitizeJsonForDb } from './jsonUtils';

// 在模块级提前加载一次配置（与 question-processor 保持一致）
const qpAiConfig = loadQpAiConfig();

// 可选：在首次加载时打印一行日志
// eslint-disable-next-line no-console
console.log("[batchProcessUtils] AI config:", {
  provider: qpAiConfig.provider,
  renderModel: qpAiConfig.renderModel,
  localModel: qpAiConfig.localModel,
  cacheEnabled: qpAiConfig.cacheEnabled,
  cacheTtlMs: qpAiConfig.cacheTtlMs,
});

export interface TranslateResult {
  content: string;
  options?: string[] | null;
  explanation?: string | null;
  language?: string | null; // 可选：AI 端未来可以返回检测到的语言
}

type QuestionType = "single" | "multiple" | "truefalse";

interface TranslationConstraints {
  sourceLanguage: string;      // "zh" | "ja" | "en"
  targetLanguage: string;      // "zh" | "ja" | "en"
  type: QuestionType; // ✅ 修复：统一使用 type 字段
  hasOriginalOptions: boolean;
  hasOriginalExplanation: boolean;
}

/**
 * 翻译诊断信息类型
 * 用于收集和存储结构化的错误诊断信息
 */
export type TranslationDiagnostic = {
  questionId: string | number | null;
  scene?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  model?: string | null;
  // AI 原始响应 / 清洗后
  parsed?: any;
  sanitized?: any;
  rawAiResponse?: string | null;
  // 语言识别相关
  parsedSourceLanguage?: string | null;
  translationsKeys?: string[];
  detectedLanguage?: string | null;
  // 错误信息
  errorStage?: string | null;   // 如 "JSON_PARSE_ERROR", "TARGET_LANG_MISMATCH"
  errorCode?: string | null;    // 如 "TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE"
  errorMessage?: string | null;
  errorStack?: string | null;
  // 触发条件描述（方便肉眼看）
  conditionDescription?: string | null;
  sampleText?: string | null;   // 截断后的示例文本
  // ✅ Task 4: 添加数据库相关诊断信息
  dbUpdatePayload?: {
    [key: string]: any;
    contentPreview?: string;
    explanationPreview?: string;
  } | null;
  dbRowBefore?: {
    id?: number;
    stage_tag?: string | null;
    topic_tags?: string[] | null;
    license_type_tag?: string[] | null;
    contentPreview?: string;
    explanationPreview?: string;
  } | null;
};

export interface CategoryAndTagsResult {
  license_type_tag?: string[] | null; // 驾照类型标签（数组，可包含多个值）
  stage_tag?: "both" | "provisional" | "regular" | "full" | null; // 阶段标签（兼容旧值）
  topic_tags?: string[] | null; // 主题标签数组
  // 以下字段已废弃，保留用于兼容
  category?: string | null; // 已废弃：category 是卷类，不是标签
  license_types?: string[] | null; // 已废弃：使用 license_type_tag 替代
}

/**
 * 子任务详细信息
 */
export interface SubtaskDetail {
  operation: string; // 操作类型：translate, polish, fill_missing, category_tags
  scene: string; // 场景标识
  sceneName: string; // 场景名称
  prompt: string; // 使用的prompt
  expectedFormat: string | null; // 预期的输出格式
  question: string; // 发送给AI的问题
  answer: string; // AI的回答
  status: "success" | "failed"; // 状态
  error?: string; // 错误信息（如果有）
  timestamp: string; // 时间戳
  aiProvider?: string; // AI 服务提供商（如 Google Gemini, OpenAI 等）
  model?: string; // AI 模型名称
}

/**
 * 获取场景配置（prompt和输出格式）
 */
// 全局 AI 请求队列：确保同一时间只有一个 AI 请求在进行
class AiRequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestId = 0;

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const currentRequestId = ++this.requestId;
    const queueLength = this.queue.length;
    
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          if (queueLength > 0) {
            console.log(`[AiRequestQueue] [Request ${currentRequestId}] 等待队列中，前面还有 ${queueLength} 个请求`);
          }
          console.log(`[AiRequestQueue] [Request ${currentRequestId}] 开始处理 AI 请求`);
          const result = await fn();
          console.log(`[AiRequestQueue] [Request ${currentRequestId}] ✅ AI 请求完成`);
          resolve(result);
        } catch (error) {
          console.log(`[AiRequestQueue] [Request ${currentRequestId}] ❌ AI 请求失败:`, error instanceof Error ? error.message : String(error));
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    console.log(`[AiRequestQueue] 开始处理队列，当前队列长度: ${this.queue.length}`);

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }

    this.processing = false;
    console.log(`[AiRequestQueue] 队列处理完成`);
  }
}

// 创建全局队列实例
const aiRequestQueue = new AiRequestQueue();

/**
 * 分析文本语言特征
 * @param text 待分析的文本
 * @returns 语言特征统计
 */
function analyzeTextLanguage(text: string): {
  englishChars: number;
  chineseChars: number;
  totalChars: number;
  englishRatio: number;
  chineseRatio: number;
} {
  if (!text || typeof text !== "string") {
    return { englishChars: 0, chineseChars: 0, totalChars: 1, englishRatio: 0, chineseRatio: 0 };
  }

  const englishChars = (text.match(/[A-Za-z]/g) ?? []).length;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const totalChars = text.length || 1;
  const englishRatio = englishChars / totalChars;
  const chineseRatio = chineseChars / totalChars;

  return { englishChars, chineseChars, totalChars, englishRatio, chineseRatio };
}

/**
 * 判断文本内容是否为英语（用于 explanation 语言检查）
 * @param text 待检查的文本
 * @returns 如果英文占比 > 30% 且中文占比 < 10%，返回 true
 */
export function isEnglishContent(text: string): boolean {
  const { englishRatio, chineseRatio } = analyzeTextLanguage(text);
  
  // 决策：当英文占比 > 30% 且中文占比 < 10% 时认为是"明显英文"
  const isEnglish = englishRatio > 0.3 && chineseRatio < 0.1;
  
  // 调试日志（通过环境变量控制）
  if (process.env.DEBUG_BATCH_LANG === "1") {
    const { totalChars, englishChars, chineseChars } = analyzeTextLanguage(text);
    console.debug(
      `[isEnglishContent] total=${totalChars}, en=${englishChars} (${englishRatio.toFixed(3)}), zh=${chineseChars} (${chineseRatio.toFixed(3)}), preview="${text.slice(0, 80)}", result=${isEnglish}`,
    );
  }
  
  return isEnglish;
}

/**
 * 判断内容是否几乎为空（只有标点/空格）
 */
function isTrivialText(text: string): boolean {
  return !text || text.trim().length === 0;
}

type ExplanationWriteContext = {
  currentExplanation: any;          // questions.explanation 当前值
  newExplanation: string;           // 准备写入的 explanation 文本
  sourceLanguage: string;           // 源语言，如 "zh"
  targetLang: string;               // 要写入的 key，如 "zh" / "en" / "ja"
};

/**
 * 统一的 explanation 更新函数：
 * - 防止英语误写入 zh
 * - 防止把翻译结果写回源语言 key
 * - 保留原有 explanation 结构（string → { zh: string } 升级）
 */
export function buildUpdatedExplanationWithGuard(ctx: ExplanationWriteContext): any {
  const { currentExplanation, newExplanation, sourceLanguage, targetLang } = ctx;

  if (isTrivialText(newExplanation)) {
    // 空内容：直接返回原值
    return currentExplanation ?? null;
  }

  // 1）禁止把翻译写回"源语言 key"
  //    批量场景里，sourceLanguage 是题目的原始语言，比如 zh
  //    如果 targetLang === sourceLanguage，则直接跳过写入，避免 sourceExplanation 被错写
  if (targetLang === sourceLanguage) {
    console.warn(
      `[ExplanationGuard] Skip writing explanation to source key "${targetLang}" to avoid overwriting original source explanation.`,
    );
    return currentExplanation ?? null;
  }

  // 2）防止英语写入 zh
  if (targetLang === "zh" && isEnglishContent(newExplanation)) {
    console.warn(
      `[ExplanationGuard] Detected English content but targetLang=zh, skip writing explanation.`,
    );
    return currentExplanation ?? null;
  }

  // 3）构造统一的 JSON 结构，并清理语言不匹配的 key
  let base: any;
  if (currentExplanation && typeof currentExplanation === "object" && currentExplanation !== null) {
    base = { ...currentExplanation };
    
    // ✅ 清理语言不匹配的 key（防止保留错误的 explanation）
    // 例如：如果 base.zh 存在但是内容是英文，应该删除
    for (const key of Object.keys(base)) {
      const value = base[key];
      if (typeof value !== "string" || !value) {
        // 删除非字符串或空值
        delete base[key];
        continue;
      }
      
      // 检查语言是否匹配
      const isValueEnglish = isEnglishContent(value);
      const isValueChinese = isChineseContent(value);
      
      if (key === "zh") {
        // zh key 应该包含中文内容
        if (isValueEnglish && !isValueChinese) {
          console.warn(
            `[ExplanationGuard] 检测到 explanation.zh 包含英文内容，已清理`,
          );
          delete base[key];
        }
      } else if (key === "en") {
        // en key 应该包含英文内容
        if (isValueChinese && !isValueEnglish) {
          console.warn(
            `[ExplanationGuard] 检测到 explanation.en 包含中文内容，已清理`,
          );
          delete base[key];
        }
      } else if (key === "ja" || key === "ko") {
        // ja/ko key 不应该包含中文或英文（严格检查）
        if (isValueChinese) {
          console.warn(
            `[ExplanationGuard] 检测到 explanation.${key} 包含中文内容，已清理`,
          );
          delete base[key];
        }
        if (isValueEnglish) {
          console.warn(
            `[ExplanationGuard] 检测到 explanation.${key} 包含英文内容，已清理`,
          );
          delete base[key];
        }
      }
    }
  } else if (typeof currentExplanation === "string") {
    // 兼容旧数据：string → { zh: string }
    // 但需要检查语言是否匹配
    if (isChineseContent(currentExplanation)) {
      base = { zh: currentExplanation };
    } else if (isEnglishContent(currentExplanation)) {
      base = { en: currentExplanation };
    } else {
      // 语言不明确，根据 sourceLanguage 决定
      base = { [sourceLanguage]: currentExplanation };
    }
  } else {
    base = {};
  }

  base[targetLang] = newExplanation;
  return base;
}

/**
 * 检查文本是否为中文内容
 * @param text 待检查的文本
 * @returns 如果中文占比 > 20% 且英文占比 < 30%，返回 true
 */
export function isChineseContent(text: string): boolean {
  const { englishRatio, chineseRatio } = analyzeTextLanguage(text);
  
  // 📊 改进：检测日文假名来区分中文和日文
  // 如果包含平假名或片假名，大概率是日文，不是中文
  const hasHiragana = /[\u3040-\u309F]/.test(text); // 平假名
  const hasKatakana = /[\u30A0-\u30FF]/.test(text); // 片假名
  const hasJapaneseKana = hasHiragana || hasKatakana;
  
  // 如果有日文假名，不判定为中文
  if (hasJapaneseKana) {
    if (process.env.DEBUG_BATCH_LANG === "1") {
      console.debug(
        `[isChineseContent] 检测到日文假名（平假名=${hasHiragana}, 片假名=${hasKatakana}），不判定为中文, preview="${text.slice(0, 80)}"`,
      );
    }
    return false;
  }
  
  // 约定：当中文占比 > 20% 且英文占比 < 30% 时认为是"主要中文"
  const isChinese = chineseRatio > 0.2 && englishRatio < 0.3;
  
  // 调试日志（通过环境变量控制）
  if (process.env.DEBUG_BATCH_LANG === "1") {
    const { totalChars, englishChars, chineseChars } = analyzeTextLanguage(text);
    console.debug(
      `[isChineseContent] total=${totalChars}, en=${englishChars} (${englishRatio.toFixed(3)}), zh=${chineseChars} (${chineseRatio.toFixed(3)}), preview="${text.slice(0, 80)}", result=${isChinese}`,
    );
  }
  
  return isChinese;
}

/**
 * 从 AI 输出中获取源语言 explanation
 * 
 * 策略：
 * 1. 优先使用 parsed.source.explanation（前提：parsed.source.language === sourceLanguage 且语言检测通过）
 * 2. 若无效，再尝试 parsed.translations[sourceLanguage].explanation（只在 DB 中当前源语言解析缺失时启用）
 * 
 * @param params.parsed - AI 返回的完整解析对象
 * @param params.sourceLanguage - 源语言（如 "zh"）
 * @returns 提取到的源语言 explanation 文本，如果无效则返回 null
 */
function getSourceExplanationFromAiOutput(params: {
  parsed: any;
  sourceLanguage: string;
}): string | null {
  const { parsed, sourceLanguage } = params;
  
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  // 1️⃣ 优先使用 parsed.source
  const sourceBlock = parsed.source;
  if (sourceBlock && typeof sourceBlock === "object") {
    const aiSourceLanguage = sourceBlock.language;
    const explanation = sourceBlock.explanation;

    if (typeof explanation === "string" && explanation.trim()) {
      // 要求 AI 明确标记与 sourceLanguage 一致，才认为是源语言解释
      if (aiSourceLanguage === sourceLanguage) {
        const isEn = isEnglishContent(explanation);
        const isZh = isChineseContent(explanation);

        // 根据 sourceLanguage 做语言校验
        if (sourceLanguage === "zh" && isZh && !isEn) {
          return explanation.trim();
        }
        if (sourceLanguage === "en" && isEn && !isZh) {
          return explanation.trim();
        }
        // 其他语言暂时只做非空判断
        if (sourceLanguage !== "zh" && sourceLanguage !== "en") {
          return explanation.trim();
        }
      } else {
        console.warn(
          `[full_pipeline] AI 返回的 source.language=${aiSourceLanguage} 与期望的 ${sourceLanguage} 不匹配，跳过 source.explanation`,
        );
      }
    }
  }

  // 2️⃣ 若 source 不可用，则尝试 translations[sourceLanguage]
  const translations = parsed.translations;
  if (translations && typeof translations === "object") {
    const tl = translations[sourceLanguage];
    if (tl && typeof tl === "object" && typeof tl.explanation === "string") {
      const explanation = tl.explanation.trim();
      if (!explanation) return null;

      const isEn = isEnglishContent(explanation);
      const isZh = isChineseContent(explanation);

      if (sourceLanguage === "zh" && isZh && !isEn) {
        console.log(
          `[full_pipeline] 使用 translations.${sourceLanguage}.explanation 兜底补充源语言解析`,
        );
        return explanation;
      }
      if (sourceLanguage === "en" && isEn && !isZh) {
        console.log(
          `[full_pipeline] 使用 translations.${sourceLanguage}.explanation 兜底补充源语言解析`,
        );
        return explanation;
      }
      if (sourceLanguage !== "zh" && sourceLanguage !== "en") {
        console.log(
          `[full_pipeline] 使用 translations.${sourceLanguage}.explanation 兜底补充源语言解析`,
        );
        return explanation;
      }
    }
  }

  return null;
}

/**
 * 语言检测函数：通过字符集粗略判断语言类型
 */
export function detectLanguageByChars(text: string): "zh_like" | "ja_like" | "latin_like" | "unknown" {
  const s = text || "";
  let hasHiragana = false;
  let hasKatakana = false;
  let hasLatin = false;
  let hasCJK = false;

  for (const ch of s) {
    const code = ch.charCodeAt(0);
    // CJK 统一表意文字
    if (code >= 0x4e00 && code <= 0x9fff) hasCJK = true;
    // 平假名
    else if (code >= 0x3040 && code <= 0x309f) hasHiragana = true;
    // 片假名
    else if (code >= 0x30a0 && code <= 0x30ff) hasKatakana = true;
    // 拉丁字母
    else if (
      (code >= 0x0041 && code <= 0x005a) ||
      (code >= 0x0061 && code <= 0x007a)
    ) {
      hasLatin = true;
    }
  }

  if ((hasHiragana || hasKatakana) && hasCJK) return "ja_like";
  if (hasLatin && !hasCJK) return "latin_like";
  if (hasCJK && !hasHiragana && !hasKatakana) return "zh_like";
  return "unknown";
}

/**
 * 统一翻译结果约束函数：在写库前做总兜底
 * 所有翻译结果（无论通过哪个函数产生）在写入数据库前必须经过此函数校验
 */
export function enforceTranslationConstraints(
  result: TranslateResult,
  original: { content: string; options?: string[] | null; explanation?: string | null },
  constraints: TranslationConstraints,
  diagnosticData?: {
    parsed?: any;
    sanitized?: any;
    questionId?: number | string;
    diagnostic?: TranslationDiagnostic; // ✅ A-2: 添加 diagnostic 参数
  },
): TranslateResult {
  const strip = (s?: string | null) => (s || "").replace(/\s+/g, "").trim();
  const { sourceLanguage, targetLanguage, type, hasOriginalOptions } = constraints; // ✅ 修复：统一使用 type

  const src = sourceLanguage.toLowerCase();
  const tgt = targetLanguage.toLowerCase();

  // 1) from != to 且内容几乎完全一致 => 标记为无效翻译（不应写入数据库）
  if (
    src &&
    tgt &&
    src !== tgt &&
    strip(result.content) &&
    strip(original.content) &&
    strip(result.content) === strip(original.content)
  ) {
    console.warn(
      "[enforceTranslationConstraints] ❌ 翻译结果与原文相同（AI 未翻译），标记为无效翻译",
      { from: src, to: tgt, contentSample: result.content.slice(0, 80) },
    );
    // ⚠️ 重要：不能把原文内容赋值给 result（会导致中文写入 ja/en key）
    // 应该标记为无效翻译，让调用方跳过该翻译
    // 使用特殊标记：content 为 null 表示无效翻译
    result.content = null as any;
    result.options = null;
    result.explanation = null as any;
    // 不抛出异常，返回 null 让调用方判断
  }

  // 2) True/False 题：不允许有 options
  if (type === "truefalse") {
    if (result.options && result.options.length > 0) {
      console.warn(
        "[enforceTranslationConstraints] True/False 题翻译返回了 options，强制清空",
      );
    }
    result.options = null;
  }

  // 3) 原题没有 options，则翻译结果也必须没有 options
  if (!hasOriginalOptions) {
    if (result.options && result.options.length > 0) {
      console.warn(
        "[enforceTranslationConstraints] 原题没有 options，但翻译结果返回了 options，强制清空",
      );
    }
    result.options = null;
  }

  // 4) explanation 存在性：源有解析但翻译没返回 -> 先打日志，保持为空由人工复核
  if (constraints.hasOriginalExplanation && !result.explanation) {
    console.warn(
      "[enforceTranslationConstraints] 源有 explanation，但翻译未返回，保持为空，建议人工检查",
      { from: src, to: tgt, explanationSample: original.explanation?.slice(0, 80) },
    );
  }

  // 5) 目标语言粗略校验
  const langHint = detectLanguageByChars(result.content || "");

  if (tgt === "ja") {
    if (langHint === "latin_like") {
      // ========== 诊断输出开始 ==========
      console.error("=".repeat(80));
      console.error("[TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE] 诊断报告");
      console.error("=".repeat(80));
      
      // 1. 打印本次任务中失败题目的原始 AI 响应（parsed 原文）
      if (diagnosticData?.parsed) {
        console.error("\n【1. 原始 AI 响应 (parsed)】");
        console.error(JSON.stringify(diagnosticData.parsed, null, 2));
      } else {
        console.error("\n【1. 原始 AI 响应 (parsed)】");
        console.error("⚠️ parsed 数据不可用（diagnosticData 未传入）");
      }
      
      // 2. 打印 sanitized JSON（清洗后的 JSON）
      if (diagnosticData?.sanitized) {
        console.error("\n【2. 清洗后的 JSON (sanitized)】");
        console.error(JSON.stringify(diagnosticData.sanitized, null, 2));
      } else {
        console.error("\n【2. 清洗后的 JSON (sanitized)】");
        console.error("⚠️ sanitized 数据不可用（diagnosticData 未传入）");
      }
      
      // 3. 打印 translation 识别模块中的信息
      console.error("\n【3. Translation 识别模块信息】");
      console.error(`- 检测到的 targetLanguage: ${tgt}`);
      if (diagnosticData?.parsed?.source?.language) {
        console.error(`- parsed.source.language: ${diagnosticData.parsed.source.language}`);
      } else {
        console.error(`- parsed.source.language: ⚠️ 不存在或未定义`);
      }
      if (diagnosticData?.parsed?.translations) {
        const translationKeys = Object.keys(diagnosticData.parsed.translations);
        console.error(`- parsed.translations 中的所有语言 key: [${translationKeys.join(", ")}]`);
      } else {
        console.error(`- parsed.translations 中的所有语言 key: ⚠️ 不存在或未定义`);
      }
      
      // 4. 标记出导致失败的判断条件
      console.error("\n【4. 导致失败的判断条件】");
      console.error(`- targetLanguage (${tgt}) === "ja"`);
      console.error(`- detectLanguageByChars(result.content) === "latin_like"`);
      console.error(`- 判断结果: ❌ 目标语言为 ja，但检测为 latin_like，拒绝写入`);
      console.error(`- 翻译内容样本: ${result.content?.slice(0, 200) || "[空]"}`);
      
      // 5. 输出该判断是在文件中的具体位置
      console.error("\n【5. 错误位置】");
      console.error(`- 文件: batchProcessUtils.ts`);
      console.error(`- 函数: enforceTranslationConstraints`);
      console.error(`- 行号: 517-523`);
      console.error(`- 判断条件: if (tgt === "ja" && langHint === "latin_like")`);
      
      // 6. 最后输出分析结论
      console.error("\n【6. 分析结论】");
      if (diagnosticData?.parsed?.source?.language) {
        console.error(`- parsed.source.language = "${diagnosticData.parsed.source.language}"`);
        console.error(`- 题目 sourceLanguage = "${sourceLanguage}"`);
        if (diagnosticData.parsed.source.language !== sourceLanguage) {
          console.error(`- ⚠️ parsed.source.language 与题目 sourceLanguage 不一致`);
        }
      }
      console.error(`- 检测到的语言类型: ${langHint}`);
      console.error(`- 目标语言: ${tgt}`);
      console.error(`- 可能原因:`);
      console.error(`  1. AI 输出错语言？${langHint === "latin_like" && tgt === "ja" ? " ✅ 是（AI 返回了英文而非日文）" : " ❌ 否"}`);
      console.error(`  2. 语言检测逻辑错误？${langHint === "latin_like" && result.content && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(result.content) ? " ✅ 可能（检测逻辑可能有问题）" : " ❌ 否"}`);
      console.error(`  3. 正则清洗导致语言字段缺失？${!diagnosticData?.parsed?.source?.language ? " ✅ 可能（source.language 缺失）" : " ❌ 否"}`);
      
      console.error("=".repeat(80));
      // ========== 诊断输出结束 ==========
      
      // ✅ A-2: 填充 diagnostic 信息
      if (diagnosticData?.diagnostic) {
        diagnosticData.diagnostic.errorStage = "TARGET_LANG_MISMATCH";
        diagnosticData.diagnostic.errorCode = "TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE";
        diagnosticData.diagnostic.detectedLanguage = langHint;
        diagnosticData.diagnostic.conditionDescription = `Expected targetLanguage=ja, but detected ${langHint}`;
        diagnosticData.diagnostic.sampleText = result.content?.slice(0, 200) ?? null;
        diagnosticData.diagnostic.targetLanguage = tgt;
        diagnosticData.diagnostic.sourceLanguage = src;
      }
      
      console.error(
        "[enforceTranslationConstraints] 目标语言 ja，但检测为 latin_like，拒绝写入",
        { sample: result.content.slice(0, 80) },
      );
      throw new Error("TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE");
    }
    // 对于日文 & 中文都使用 CJK 的情况，只能放宽处理：ja_like 或 zh_like 都允许，交给人工抽样检查
  }

  if (tgt === "zh") {
    if (langHint === "latin_like" || langHint === "ja_like") {
      // ========== 诊断输出开始 ==========
      console.error("=".repeat(80));
      console.error("[TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE] 诊断报告");
      console.error("=".repeat(80));
      
      // 1. 打印本次任务中失败题目的原始 AI 响应（parsed 原文）
      if (diagnosticData?.parsed) {
        console.error("\n【1. 原始 AI 响应 (parsed)】");
        console.error(JSON.stringify(diagnosticData.parsed, null, 2));
      } else {
        console.error("\n【1. 原始 AI 响应 (parsed)】");
        console.error("⚠️ parsed 数据不可用（diagnosticData 未传入）");
      }
      
      // 2. 打印 sanitized JSON（清洗后的 JSON）
      if (diagnosticData?.sanitized) {
        console.error("\n【2. 清洗后的 JSON (sanitized)】");
        console.error(JSON.stringify(diagnosticData.sanitized, null, 2));
      } else {
        console.error("\n【2. 清洗后的 JSON (sanitized)】");
        console.error("⚠️ sanitized 数据不可用（diagnosticData 未传入）");
      }
      
      // 3. 打印 translation 识别模块中的信息
      console.error("\n【3. Translation 识别模块信息】");
      console.error(`- 检测到的 targetLanguage: ${tgt}`);
      if (diagnosticData?.parsed?.source?.language) {
        console.error(`- parsed.source.language: ${diagnosticData.parsed.source.language}`);
      } else {
        console.error(`- parsed.source.language: ⚠️ 不存在或未定义`);
      }
      if (diagnosticData?.parsed?.translations) {
        const translationKeys = Object.keys(diagnosticData.parsed.translations);
        console.error(`- parsed.translations 中的所有语言 key: [${translationKeys.join(", ")}]`);
      } else {
        console.error(`- parsed.translations 中的所有语言 key: ⚠️ 不存在或未定义`);
      }
      
      // 4. 标记出导致失败的判断条件
      console.error("\n【4. 导致失败的判断条件】");
      console.error(`- targetLanguage (${tgt}) === "zh"`);
      console.error(`- detectLanguageByChars(result.content) === "${langHint}"`);
      console.error(`- 判断结果: ❌ 目标语言为 zh，但检测为 ${langHint}，拒绝写入`);
      console.error(`- 翻译内容样本: ${result.content?.slice(0, 200) || "[空]"}`);
      
      // 5. 输出该判断是在文件中的具体位置
      console.error("\n【5. 错误位置】");
      console.error(`- 文件: batchProcessUtils.ts`);
      console.error(`- 函数: enforceTranslationConstraints`);
      console.error(`- 行号: 528-535`);
      console.error(`- 判断条件: if (tgt === "zh" && (langHint === "latin_like" || langHint === "ja_like"))`);
      
      // 6. 最后输出分析结论
      console.error("\n【6. 分析结论】");
      if (diagnosticData?.parsed?.source?.language) {
        console.error(`- parsed.source.language = "${diagnosticData.parsed.source.language}"`);
        console.error(`- 题目 sourceLanguage = "${sourceLanguage}"`);
        if (diagnosticData.parsed.source.language !== sourceLanguage) {
          console.error(`- ⚠️ parsed.source.language 与题目 sourceLanguage 不一致`);
        }
      }
      console.error(`- 检测到的语言类型: ${langHint}`);
      console.error(`- 目标语言: ${tgt}`);
      console.error(`- 可能原因:`);
      console.error(`  1. AI 输出错语言？${(langHint === "latin_like" || langHint === "ja_like") && tgt === "zh" ? " ✅ 是（AI 返回了非中文内容）" : " ❌ 否"}`);
      console.error(`  2. 语言检测逻辑错误？${langHint === "ja_like" && result.content && !/[\u3040-\u309F\u30A0-\u30FF]/.test(result.content) ? " ✅ 可能（检测逻辑可能有问题）" : " ❌ 否"}`);
      console.error(`  3. 正则清洗导致语言字段缺失？${!diagnosticData?.parsed?.source?.language ? " ✅ 可能（source.language 缺失）" : " ❌ 否"}`);
      
      console.error("=".repeat(80));
      // ========== 诊断输出结束 ==========
      
      // ✅ A-2: 填充 diagnostic 信息
      if (diagnosticData?.diagnostic) {
        diagnosticData.diagnostic.errorStage = "TARGET_LANG_MISMATCH";
        diagnosticData.diagnostic.errorCode = "TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE";
        diagnosticData.diagnostic.detectedLanguage = langHint;
        diagnosticData.diagnostic.conditionDescription = `Expected targetLanguage=zh, but detected ${langHint}`;
        diagnosticData.diagnostic.sampleText = result.content?.slice(0, 200) ?? null;
        diagnosticData.diagnostic.targetLanguage = tgt;
        diagnosticData.diagnostic.sourceLanguage = src;
      }
      
      console.error(
        "[enforceTranslationConstraints] 目标语言 zh，但检测为非中文风格，拒绝写入",
        { sample: result.content.slice(0, 80), langHint },
      );
      throw new Error("TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE");
    }
  }

  if (tgt === "en") {
    if (langHint === "zh_like" || langHint === "ja_like") {
      // ========== 诊断输出开始 ==========
      console.error("=".repeat(80));
      console.error("[TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE] 诊断报告");
      console.error("=".repeat(80));
      
      // 1. 打印本次任务中失败题目的原始 AI 响应（parsed 原文）
      if (diagnosticData?.parsed) {
        console.error("\n【1. 原始 AI 响应 (parsed)】");
        console.error(JSON.stringify(diagnosticData.parsed, null, 2));
      } else {
        console.error("\n【1. 原始 AI 响应 (parsed)】");
        console.error("⚠️ parsed 数据不可用（diagnosticData 未传入）");
      }
      
      // 2. 打印 sanitized JSON（清洗后的 JSON）
      if (diagnosticData?.sanitized) {
        console.error("\n【2. 清洗后的 JSON (sanitized)】");
        console.error(JSON.stringify(diagnosticData.sanitized, null, 2));
      } else {
        console.error("\n【2. 清洗后的 JSON (sanitized)】");
        console.error("⚠️ sanitized 数据不可用（diagnosticData 未传入）");
      }
      
      // 3. 打印 translation 识别模块中的信息
      console.error("\n【3. Translation 识别模块信息】");
      console.error(`- 检测到的 targetLanguage: ${tgt}`);
      if (diagnosticData?.parsed?.source?.language) {
        console.error(`- parsed.source.language: ${diagnosticData.parsed.source.language}`);
      } else {
        console.error(`- parsed.source.language: ⚠️ 不存在或未定义`);
      }
      if (diagnosticData?.parsed?.translations) {
        const translationKeys = Object.keys(diagnosticData.parsed.translations);
        console.error(`- parsed.translations 中的所有语言 key: [${translationKeys.join(", ")}]`);
      } else {
        console.error(`- parsed.translations 中的所有语言 key: ⚠️ 不存在或未定义`);
      }
      
      // 4. 标记出导致失败的判断条件
      console.error("\n【4. 导致失败的判断条件】");
      console.error(`- targetLanguage (${tgt}) === "en"`);
      console.error(`- detectLanguageByChars(result.content) === "${langHint}"`);
      console.error(`- 判断结果: ❌ 目标语言为 en，但检测为 CJK 风格，拒绝写入`);
      console.error(`- 翻译内容样本: ${result.content?.slice(0, 200) || "[空]"}`);
      
      // 5. 输出该判断是在文件中的具体位置
      console.error("\n【5. 错误位置】");
      console.error(`- 文件: batchProcessUtils.ts`);
      console.error(`- 函数: enforceTranslationConstraints`);
      console.error(`- 行号: 538-545`);
      console.error(`- 判断条件: if (tgt === "en" && (langHint === "zh_like" || langHint === "ja_like"))`);
      
      // 6. 最后输出分析结论
      console.error("\n【6. 分析结论】");
      if (diagnosticData?.parsed?.source?.language) {
        console.error(`- parsed.source.language = "${diagnosticData.parsed.source.language}"`);
        console.error(`- 题目 sourceLanguage = "${sourceLanguage}"`);
        if (diagnosticData.parsed.source.language !== sourceLanguage) {
          console.error(`- ⚠️ parsed.source.language 与题目 sourceLanguage 不一致`);
        }
      }
      console.error(`- 检测到的语言类型: ${langHint}`);
      console.error(`- 目标语言: ${tgt}`);
      console.error(`- 可能原因:`);
      console.error(`  1. AI 输出错语言？${(langHint === "zh_like" || langHint === "ja_like") && tgt === "en" ? " ✅ 是（AI 返回了 CJK 内容而非英文）" : " ❌ 否"}`);
      console.error(`  2. 语言检测逻辑错误？${langHint === "zh_like" && result.content && !/[\u4E00-\u9FFF]/.test(result.content) ? " ✅ 可能（检测逻辑可能有问题）" : " ❌ 否"}`);
      console.error(`  3. 正则清洗导致语言字段缺失？${!diagnosticData?.parsed?.source?.language ? " ✅ 可能（source.language 缺失）" : " ❌ 否"}`);
      
      console.error("=".repeat(80));
      // ========== 诊断输出结束 ==========
      
      // ✅ A-2: 填充 diagnostic 信息
      if (diagnosticData?.diagnostic) {
        diagnosticData.diagnostic.errorStage = "TARGET_LANG_MISMATCH";
        diagnosticData.diagnostic.errorCode = "TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE";
        diagnosticData.diagnostic.detectedLanguage = langHint;
        diagnosticData.diagnostic.conditionDescription = `Expected targetLanguage=en, but detected ${langHint}`;
        diagnosticData.diagnostic.sampleText = result.content?.slice(0, 200) ?? null;
        diagnosticData.diagnostic.targetLanguage = tgt;
        diagnosticData.diagnostic.sourceLanguage = src;
      }
      
      console.error(
        "[enforceTranslationConstraints] 目标语言 en，但检测为 CJK 风格，拒绝写入",
        { sample: result.content.slice(0, 80), langHint },
      );
      throw new Error("TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE");
    }
  }

  // 6) 解析 explanation 的语言大致与 content 保持一致（只做弱约束 + 日志）
  if (result.explanation) {
    const contentHint = detectLanguageByChars(result.content || "");
    const explanationHint = detectLanguageByChars(result.explanation || "");

    if (contentHint !== "unknown" && explanationHint !== "unknown" && contentHint !== explanationHint) {
      console.warn(
        "[enforceTranslationConstraints] content 与 explanation 语言风格不一致，建议人工复核",
        {
          from: src,
          to: tgt,
          contentHint,
          explanationHint,
          contentSample: result.content.slice(0, 50),
          explanationSample: result.explanation.slice(0, 50),
        },
      );
      // 暂不强制抛错，避免误伤，但日志会暴露这类问题
    }
  }

  return result;
}

async function getSceneConfig(sceneKey: string, locale: string = "zh"): Promise<{
  prompt: string;
  outputFormat: string | null;
  sceneName: string;
} | null> {
  try {
    const sceneConfig = await (aiDb as any)
      .selectFrom("ai_scene_config")
      .selectAll()
      .where("scene_key", "=", sceneKey)
      .where("enabled", "=", true)
      .executeTakeFirst();

    if (!sceneConfig) {
      return null;
    }

    // 根据语言选择prompt
    let prompt = sceneConfig.system_prompt_zh;
    const lang = locale.toLowerCase();
    if (lang.startsWith("ja") && sceneConfig.system_prompt_ja) {
      prompt = sceneConfig.system_prompt_ja;
    } else if (lang.startsWith("en") && sceneConfig.system_prompt_en) {
      prompt = sceneConfig.system_prompt_en;
    }

    return {
      prompt: prompt || sceneConfig.system_prompt_zh,
      outputFormat: sceneConfig.output_format || null,
      sceneName: sceneConfig.scene_name || sceneKey,
    };
  } catch (error) {
    console.error(`[getSceneConfig] Failed to get scene config for ${sceneKey}:`, error);
    return null;
  }
}

/**
 * 内部调用 ai-service（直接调用，不再通过 /api/admin/ai/ask）
 * 使用 callAiServer 直接调用 ai-service，支持场景配置，支持长超时
 */
/**
 * 判断是否是配额耗尽错误（不应重试）
 * 优先使用标准 errorCode，与新系统对齐
 */
function isQuotaExceeded(errorText: string, errorData: any): boolean {
  const text = (errorText || "").toLowerCase();
  const message = (errorData?.message || "").toLowerCase();
  const code = (errorData?.errorCode || errorData?.code || "").toUpperCase();

  // ✅ 优先检查标准 errorCode
  if (code === "PROVIDER_QUOTA_EXCEEDED") {
    return true;
  }

  // 兜底：字符串匹配（向后兼容）
  return (
    text.includes("quota exceeded for metric") ||
    text.includes("free_tier_requests") ||
    text.includes("daily ask limit exceeded") ||
    text.includes("provider_quota_exceeded") ||
    message.includes("quota exceeded for metric") ||
    message.includes("free_tier_requests") ||
    message.includes("daily ask limit exceeded") ||
    message.includes("provider_quota_exceeded")
  );
}

/**
 * 判断是否是临时速率限制错误（可以重试）
 * @param response Response 对象（可能为 null，如果是从 callAiServer 返回的错误）
 * @param errorText 错误文本
 * @param errorData 错误数据对象
 */
function isTemporaryRateLimit(response: Response | null, errorText: string, errorData: any): boolean {
  // 如果 response 存在且状态码是 429，可能是临时速率限制
  if (response && response.status === 429) {
    // 如果是配额耗尽，不是临时速率限制
    if (isQuotaExceeded(errorText, errorData)) {
    return false;
    }
    return true;
  }
  
  // 如果 errorData 中有 errorCode，检查是否是速率限制
  const code = (errorData?.errorCode || errorData?.code || "").toUpperCase();
  if (code === "RATE_LIMIT" || code === "TOO_MANY_REQUESTS") {
  // 如果是配额耗尽，不是临时速率限制
  if (isQuotaExceeded(errorText, errorData)) {
    return false;
  }
  return true;
  }
  
  return false;
}

/**
 * 判断是否是网络临时错误（可以重试）
 */
function isNetworkTransientError(error: any): boolean {
  return (
    error.name === "AbortError" ||
    error.message?.includes("ECONNRESET") ||
    error.message?.includes("ETIMEDOUT") ||
    error.message?.includes("network") ||
    error.message?.includes("timeout")
  );
}

/**
 * 获取当前配置的 provider 和 model
 * 优先从数据库读取配置（配置中心设置），如果没有则使用环境变量
 * 批量处理工具应该优先使用配置中心的设置，而不是环境变量
 */
export async function getCurrentAiProviderConfig(): Promise<{ provider: ServerAiProviderKey; model?: string }> {
  // 优先从数据库读取配置（配置中心设置）
  try {
    const configRow = await aiDb
      .selectFrom("ai_config")
      .select(["key", "value"])
      .where("key", "in", ["aiProvider", "model"])
      .execute();

    let aiProvider: string | null = null;
    let model: string | null = null;

    for (const row of configRow) {
      if (row.key === "aiProvider") {
        aiProvider = row.value;
      } else if (row.key === "model") {
        model = row.value;
      }
    }

    // 如果数据库中有配置，优先使用数据库配置
    if (aiProvider) {
      const provider = mapDbProviderToClientProvider(aiProvider) as ServerAiProviderKey;
      console.log("[getCurrentAiProviderConfig] 从数据库读取配置:", {
        dbProvider: aiProvider,
        mappedProvider: provider,
        model: model || undefined,
      });
      return {
        provider,
        model: model || undefined,
      };
    }
  } catch (error) {
    console.warn("[getCurrentAiProviderConfig] 从数据库读取配置失败，尝试使用环境变量:", error);
  }

  // 如果数据库中没有配置，使用环境变量配置（向后兼容）
  if (qpAiConfig.provider) {
    const provider = qpAiConfig.provider;
    const model = provider === "local" ? qpAiConfig.localModel : qpAiConfig.renderModel;
    console.log("[getCurrentAiProviderConfig] 使用环境变量配置:", {
      provider,
      model,
    });
    return {
      provider,
      model,
    };
  }

  // 如果都没有，使用默认值
  console.warn("[getCurrentAiProviderConfig] 未找到配置，使用默认值 render");
  return { provider: "render" };
}

async function callAiAskInternal(
  params: {
    question: string;
    locale?: string;
    scene?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    adminToken?: string; // 管理员 token（保留用于兼容，但不再使用）
    questionPayload?: any; // ✅ Task 1: 新增：完整的题目 payload 对象，用于 full_pipeline 场景
  },
  options?: {
    mode?: "batch" | "single";
    retries?: number;
  }
): Promise<{ answer: string; aiProvider?: string; model?: string }> {
  const mode = options?.mode || "single";
  const retries = options?.retries ?? 1;

  // 获取当前配置的 provider 和 model（优先使用环境变量）
  const { provider, model } = await getCurrentAiProviderConfig();

  // 1. 尝试命中缓存（如果启用）
  if (qpAiConfig.cacheEnabled && params.scene) {
    const cached = getAiCache<{ answer: string; aiProvider?: string; model?: string }>({
      scene: params.scene,
      provider,
      model: model || (provider === "local" ? qpAiConfig.localModel : qpAiConfig.renderModel),
      questionText: params.question,
      sourceLanguage: params.sourceLanguage,
      targetLanguage: params.targetLanguage,
    });
    if (cached) {
      // eslint-disable-next-line no-console
      console.log(
        "[batchProcessUtils] AI cache hit:",
        params.scene,
        provider,
        model,
        params.sourceLanguage,
        params.targetLanguage,
      );
      return cached;
    }
  }

  // 内部调用（使用 callAiServer），带重试机制
  // ✅ 显式区分 batch/single 模式，统一超时策略
  const isBatchProcessing = mode === "batch";
  const overallTimeout = isBatchProcessing ? 250000 : 55000; // 批量处理：250秒，单次调用：55秒
  const singleRequestTimeout = isBatchProcessing ? 120000 : 30000; // 批量处理：120秒，单次调用：30秒
  
  // 将整个重试逻辑（包含所有重试）放入队列，确保同一时间只有一个 AI 请求在执行
  return await aiRequestQueue.enqueue(async () => {
    const MAX_RETRIES = retries; // 包含第一次，总共最多 MAX_RETRIES + 1 次
    const startTime = Date.now();
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 检查是否已经超过总体超时时间
        const elapsed = Date.now() - startTime;
        if (elapsed > overallTimeout) {
          throw new Error(`AI API call timeout: exceeded ${overallTimeout}ms total time`);
        }
        
        // 调用 ai-service
        // ✅ 修复：使用语言代码规范化工具，确保在整个链路中保持一致
        const normalizeLanguageCode = (raw?: string | null): string | undefined => {
          if (!raw) return undefined;
          const s = raw.toLowerCase().trim();
          if (s === "en" || s === "en-us" || s === "english" || s.startsWith("en-")) return "en";
          if (s === "ja" || s === "ja-jp" || s === "jp" || s === "japanese" || s.startsWith("ja-")) return "ja";
          if (s === "zh" || s === "zh-cn" || s === "zh-tw" || s === "chinese" || s.startsWith("zh-")) return "zh";
          return s;
        };
        
        const normalizedTargetLang = normalizeLanguageCode(params.targetLanguage);
        const normalizedSourceLang = normalizeLanguageCode(params.sourceLanguage);
        
        console.log(`[callAiAskInternal] [req-${attempt}] 准备调用 AI 服务:`, {
          provider,
          scene: params.scene,
          sourceLanguage: params.sourceLanguage,
          normalizedSourceLang,
          targetLanguage: params.targetLanguage,
          normalizedTargetLang,
          locale: params.locale,
        });
        
        // ✅ 修复：在 AI 请求参数中强制加入 targetLanguage 和 sourceLanguage
        // ✅ Task 1: 如果提供了 questionPayload，将其传递给 ai-service
        const aiRequestParams: any = {
          provider,
          question: params.question, // 保留原有的 question 字符串（用于 prompt）
          locale: params.locale || "zh-CN",
          scene: params.scene,
          sourceLanguage: normalizedSourceLang || params.sourceLanguage || undefined,
          targetLanguage: normalizedTargetLang || params.targetLanguage || undefined,
          model: model,
        };
        
        // ✅ Task 1: 如果提供了 questionPayload，将其作为 question 字段传递（覆盖字符串 question）
        if (params.questionPayload) {
          aiRequestParams.question = params.questionPayload;
        }
        
        const aiResp = await callAiServer<{ answer: string; aiProvider?: string; model?: string }>(
          aiRequestParams,
          { timeoutMs: singleRequestTimeout }
        );

        if (!aiResp.ok) {
          // ✅ 检查是否是配额耗尽（不应重试），统一转换为标准错误码
          if (isQuotaExceeded(aiResp.message || "", aiResp)) {
            const errorMessage = aiResp.message || "Quota exceeded";
            const providerName = (aiResp.data as any)?.aiProvider || provider || "unknown";
            // 记录配额耗尽日志
            const today = new Date().toISOString().slice(0, 10);
            console.warn(`[callAiAskInternal] AI Provider 配额耗尽`, {
              provider: providerName,
              model: model || null,
              scene: params.scene || null,
              date: today,
              message: errorMessage.substring(0, 200),
              errorCode: "PROVIDER_QUOTA_EXCEEDED",
            });
            // ✅ 统一转换为标准错误码，携带 provider 信息（通过错误对象属性）
            const quotaError = new Error("BATCH_PROVIDER_QUOTA_EXCEEDED") as any;
            quotaError.provider = providerName;
            quotaError.date = today;
            throw quotaError;
          }
          
          // 检查是否是临时速率限制（可以重试一次）
          if (isTemporaryRateLimit(null, aiResp.message || "", aiResp) && attempt < MAX_RETRIES) {
            const elapsed = Date.now() - startTime;
            const remainingTime = overallTimeout - elapsed;
            const delay = Math.min(2000, remainingTime - 5000); // 固定延迟2秒
            
            if (delay < 1000) {
              throw new Error(`AI API call timeout: insufficient time for retry (remaining: ${remainingTime}ms)`);
            }
            
            console.log(`[callAiAskInternal] 临时速率限制错误，等待 ${delay}ms 后重试 (尝试 ${attempt + 1}/${MAX_RETRIES + 1})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // 其他错误直接抛出，不再重试
          // 增强错误信息，包含更多上下文
          const errorMessage = aiResp.message || "AI call failed";
          const errorCode = aiResp.errorCode || "AI_SERVICE_ERROR";
          console.error(`[callAiAskInternal] AI 服务调用失败:`, {
            provider,
            scene: params.scene,
            errorCode,
            message: errorMessage,
            status: (aiResp as any).status,
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES + 1,
          });
          throw new Error(`${errorCode}: ${errorMessage}`);
        }

        // 验证响应数据
        if (!aiResp.data || !aiResp.data.answer) {
          throw new Error("AI service returned empty answer");
        }

        const result = { 
          answer: aiResp.data.answer,
          aiProvider: aiResp.data.aiProvider || provider,
          model: aiResp.data.model || model,
        };

        // 3. 写入缓存（如果启用）
        if (qpAiConfig.cacheEnabled && params.scene) {
          setAiCache(
            {
              scene: params.scene,
              provider,
              model: model || (provider === "local" ? qpAiConfig.localModel : qpAiConfig.renderModel),
              questionText: params.question,
              sourceLanguage: params.sourceLanguage,
              targetLanguage: params.targetLanguage,
            },
            result,
            qpAiConfig.cacheTtlMs,
          );
        }

        return result;
      } catch (error: any) {
        // 如果是最后一次尝试，抛出错误
        if (attempt === MAX_RETRIES) {
          throw error;
        }
        
        // 检查是否是网络临时错误（可以重试一次）
        if (isNetworkTransientError(error) && attempt < MAX_RETRIES) {
          const elapsed = Date.now() - startTime;
          const remainingTime = overallTimeout - elapsed;
          const delay = Math.min(1000, remainingTime - 5000); // 固定延迟1秒
          
          if (delay < 1000) {
            throw error;
          }
          
          console.log(`[callAiAskInternal] 网络临时错误，等待 ${delay}ms 后重试 (尝试 ${attempt + 1}/${MAX_RETRIES + 1}):`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // 其他错误（包括配额耗尽、空答案等）直接抛出，不再重试
        throw error;
      }
    }
    
    throw new Error("AI API call failed after retries");
  });
}

/**
 * 翻译并润色（带详细信息）
 */
export async function translateWithPolish(params: {
  source: { content: string; options?: string[]; explanation?: string };
  from: string;
  to: string;
  type?: "single" | "multiple" | "truefalse"; // ✅ 修复：统一使用 type 字段
  adminToken?: string; // 管理员 token，用于跳过配额限制
  returnDetail?: boolean; // 是否返回详细信息
  mode?: "batch" | "single"; // 调用模式：batch（批量处理）或 single（单题操作）
}): Promise<TranslateResult | { result: TranslateResult; detail: SubtaskDetail }> {
  const { source, from, to, type, adminToken, returnDetail } = params; // ✅ 修复：统一使用 type
  
  // 验证 from 和 to 参数，并提供默认值
  const sourceLang = from || "zh"; // 默认使用中文作为源语言
  const targetLang = to;
  
  if (!targetLang) {
    throw new Error(`translateWithPolish: to (targetLanguage) is required. Got from=${from}, to=${to}`);
  }
  
  // ✅ 修复：使用语言代码规范化工具，确保在整个链路中保持一致
  // 导入 normalizeLanguageCode（如果不存在则使用内联实现）
  const normalizeLanguageCode = (raw?: string | null): string | undefined => {
    if (!raw) return undefined;
    const s = raw.toLowerCase().trim();
    if (s === "en" || s === "en-us" || s === "english" || s.startsWith("en-")) return "en";
    if (s === "ja" || s === "ja-jp" || s === "jp" || s === "japanese" || s.startsWith("ja-")) return "ja";
    if (s === "zh" || s === "zh-cn" || s === "zh-tw" || s === "chinese" || s.startsWith("zh-")) return "zh";
    return s;
  };
  
  const normalizedTargetLang = normalizeLanguageCode(targetLang);
  const normalizedSourceLang = normalizeLanguageCode(sourceLang);
  
  console.log(`[translateWithPolish] [req-${Date.now()}] 接收到的参数:`, {
    from,
    to,
    sourceLang, // 处理后的值
    normalizedSourceLang,
    targetLang, // 处理后的值
    normalizedTargetLang,
    fromType: typeof from,
    toType: typeof to,
    hasFrom: from !== undefined && from !== null && from !== "",
    hasTo: to !== undefined && to !== null && to !== "",
    hasSourceLang: sourceLang !== undefined && sourceLang !== null && sourceLang !== "",
    hasTargetLang: targetLang !== undefined && targetLang !== null && targetLang !== "",
  });
  
  // 使用统一的题目拼装工具
  const questionText = buildQuestionTranslationInput({
    stem: source.content,
    options: source.options,
    explanation: source.explanation,
    sourceLanguage: normalizedSourceLang || sourceLang,
    targetLanguage: normalizedTargetLang || targetLang,
    questionType: params.type, // 使用 questionType 字段
  });

  const sceneKey = "question_translation";
  let sceneConfig: { prompt: string; outputFormat: string | null; sceneName: string } | null = null;
  
  if (returnDetail) {
    sceneConfig = await getSceneConfig(sceneKey, normalizedTargetLang || to);
  }

  // ✅ 根据调用模式决定超时策略
  const callMode = params.mode || "single"; // 默认为 single，批量处理需显式传入 "batch"
  
  console.log(`[translateWithPolish] [req-${Date.now()}] 准备调用 AI:`, {
    from,
    to,
    sourceLang, // 处理后的值（有默认值）
    normalizedSourceLang,
    targetLang, // 处理后的值
    normalizedTargetLang,
    sceneKey,
    questionLength: questionText.length,
    hasSourceLanguage: normalizedSourceLang !== null,
    hasTargetLanguage: normalizedTargetLang !== null,
  });
  
  // ✅ 修复：确保 targetLanguage 在整个链路中保持一致
  const data = await callAiAskInternal(
    {
      question: questionText,
      locale: normalizedTargetLang || targetLang || "zh-CN", // 使用规范化后的值
      scene: sceneKey,
      sourceLanguage: normalizedSourceLang || sourceLang || undefined, // 使用规范化后的值（确保有值）
      targetLanguage: normalizedTargetLang || targetLang || undefined, // 使用规范化后的值（确保有值）
      adminToken,
    },
    { mode: callMode, retries: 1 }
  );

  // 提取 AI provider 和 model 信息
  const aiProvider = data.aiProvider || 'unknown';
  const model = data.model || 'unknown';

  // ✅ 修复 Task 5：必须打印 AI 原始返回（在 dev 环境即可）
  if (process.env.NODE_ENV === "development") {
    console.log(`[translateWithPolish] [AI Raw Response]`, {
      rawAnswer: data.answer,
      rawAnswerLength: data.answer.length,
      rawAnswerPreview: data.answer.substring(0, 500),
    });
  }

  // 解析 JSON 响应
  let parsed: any = null;
  let rawAnswer = data.answer;
  
  // 尝试从代码块中提取 JSON（优先处理）
  const codeBlockMatch = rawAnswer.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    rawAnswer = codeBlockMatch[1].trim();
  }
  
  try {
    parsed = JSON.parse(cleanJsonString(rawAnswer));
  } catch (parseError) {
    // ✅ 修复 Task 5：JSON 解析失败时必须抛出 error，不允许 silent fallback
    console.error(`[translateWithPolish] JSON 解析失败:`, {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      rawAnswerLength: data.answer.length,
      rawAnswerPreview: data.answer.substring(0, 500),
      extractedJsonLength: rawAnswer.length,
      extractedJsonPreview: rawAnswer.substring(0, 500),
    });
    // 如果 JSON 解析失败，尝试修复截断的 JSON
    try {
      let fixedJson = rawAnswer.trim();
      
      // 如果 JSON 被截断，尝试提取已有字段
      // 改进正则表达式，支持多行字符串和转义字符
      const contentMatch = fixedJson.match(/"content"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/);
      const optionsMatch = fixedJson.match(/"options"\s*:\s*\[([^\]]*)\]/);
      const explanationMatch = fixedJson.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/);
      
      if (contentMatch || optionsMatch) {
        // 至少有一个字段，尝试构建有效的 JSON
        parsed = {};
        
        if (contentMatch) {
          parsed.content = contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        }
        
        if (optionsMatch) {
          try {
            // 尝试解析选项数组
            const optionsStr = optionsMatch[1];
            const options = optionsStr
              .split(',')
              .map(opt => opt.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'))
              .filter(opt => opt.length > 0);
            if (options.length > 0) {
              parsed.options = options;
            }
          } catch {
            // 忽略选项解析错误
          }
        }
        
        if (explanationMatch) {
          parsed.explanation = explanationMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        } else {
          // 如果 explanation 被截断，尝试提取部分内容
          const explanationStartMatch = fixedJson.match(/"explanation"\s*:\s*"([^"]*)/);
          if (explanationStartMatch) {
            parsed.explanation = explanationStartMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
          }
        }
        
        // 如果成功提取了至少一个字段，使用它
        if (Object.keys(parsed).length > 0) {
          console.warn(`[translateWithPolish] JSON was truncated, extracted partial data: ${Object.keys(parsed).join(', ')}`);
        } else {
          throw new Error("No valid fields extracted from truncated JSON");
        }
      } else {
        // 尝试添加缺失的闭合括号
        if (!fixedJson.endsWith("}")) {
          const openBraces = (fixedJson.match(/\{/g) || []).length;
          const closeBraces = (fixedJson.match(/\}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          if (missingBraces > 0) {
            fixedJson += "\n" + "}".repeat(missingBraces);
          }
        }
        parsed = JSON.parse(cleanJsonString(fixedJson));
      }
    } catch (finalError) {
      // ✅ 修复 Task 5：JSON 解析失败时必须抛出 error，不允许 silent fallback
      // 如果修复后仍然失败，记录完整响应用于调试并抛出错误
      console.error(`[translateWithPolish] Failed to parse AI response after all attempts. Full response length: ${data.answer.length}`);
      console.error(`[translateWithPolish] Response preview: ${data.answer.substring(0, 500)}`);
      console.error(`[translateWithPolish] Final parse error:`, finalError instanceof Error ? finalError.message : String(finalError));
      throw new Error(`AI translation response missing JSON body. Raw response preview: ${data.answer.substring(0, 200)}`);
    }
  }
  
  // ✅ 修复 Task 5：parsed.content / parsed.explanation 必须都存在，否则标记失败
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI translation response missing JSON body");
  }
  
  // 验证 content 字段是否存在且非空
  const contentStr = String(parsed.content ?? "").trim();
  if (!contentStr) {
    throw new Error("AI translation response missing content field");
  }
  
  // ✅ 修复 Task 5：验证 parsed.content 和 parsed.explanation 必须都存在（如果源内容有 explanation）
  // 注意：如果源内容没有 explanation，则翻译结果也可以没有 explanation
  let result: TranslateResult = {
    content: contentStr,
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : undefined,
    explanation: parsed.explanation !== undefined && parsed.explanation !== null ? String(parsed.explanation) : undefined,
  };

  // ✅ 修复：使用统一约束函数进行翻译结果校验
  const original = {
    content: source.content,
    options: source.options || null,
    explanation: source.explanation || null,
  };

  result = enforceTranslationConstraints(result, original, {
    sourceLanguage: normalizedSourceLang || sourceLang,
    targetLanguage: normalizedTargetLang || targetLang,
    type: (type || "single") as QuestionType,
    hasOriginalOptions: !!(source.options && source.options.length),
    hasOriginalExplanation: !!source.explanation,
  });
  
  // ✅ 修复 Task 2：在 translateWithPolish 内部实现「缺失 explanation 时的二次补救」
  const hasSourceExplanation = !!source.explanation && source.explanation.trim().length > 0;
  const hasTargetExplanation = !!result.explanation && String(result.explanation).trim().length > 0;
  
  if (hasSourceExplanation && !hasTargetExplanation) {
    const requestId = `translate-retry-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.warn(`[translateWithPolish] ⚠️ 源有 explanation，但 AI 第一轮未返回。尝试第二轮 explanation-only 翻译。`, {
      requestId,
      sourceExplanationPreview: source.explanation?.substring(0, 80) || "[empty]",
      targetLanguage: normalizedTargetLang || targetLang,
    });

    try {
      // 构建只翻译 explanation 的问题文本
      const explanationOnlyQuestionText = buildQuestionTranslationInput({
        stem: "", // 不翻译 content
        options: undefined, // 不翻译 options
        explanation: source.explanation, // 只翻译 explanation
        sourceLanguage: normalizedSourceLang || sourceLang,
        targetLanguage: normalizedTargetLang || targetLang,
        questionType: params.type, // 使用 questionType 字段
      });

      // 调用 AI 服务，只翻译 explanation
      const explanationOnlyData = await callAiAskInternal(
        {
          question: explanationOnlyQuestionText,
          locale: normalizedTargetLang || targetLang || "zh-CN",
          scene: sceneKey, // 复用 question_translation 场景
          sourceLanguage: normalizedSourceLang || sourceLang || undefined,
          targetLanguage: normalizedTargetLang || targetLang || undefined,
          adminToken: params.adminToken,
        },
        { mode: callMode, retries: 1 }
      );

      // 解析 explanation-only 响应
      let explanationParsed: any = null;
      let explanationRawAnswer = explanationOnlyData.answer;
      
      // 尝试从代码块中提取 JSON
      const codeBlockMatch = explanationRawAnswer.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlockMatch) {
        explanationRawAnswer = codeBlockMatch[1].trim();
      }
      
      try {
        explanationParsed = JSON.parse(cleanJsonString(explanationRawAnswer));
      } catch (parseError) {
        // 如果 JSON 解析失败，尝试提取 explanation 字段
        const explanationMatch = explanationRawAnswer.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/);
        if (explanationMatch) {
          explanationParsed = { explanation: explanationMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') };
        } else {
          // 如果无法提取，尝试直接使用原始响应作为 explanation
          const trimmed = explanationRawAnswer.trim();
          if (trimmed.length > 0) {
            explanationParsed = { explanation: trimmed };
          }
        }
      }

      if (explanationParsed?.explanation) {
        result.explanation = String(explanationParsed.explanation);
        console.log(`[translateWithPolish] ✅ 第二轮 explanation-only 翻译成功`, {
          requestId,
          explanationLength: result.explanation.length,
        });
      } else if (typeof explanationParsed === "string" && explanationParsed.trim().length > 0) {
        result.explanation = explanationParsed.trim();
        console.log(`[translateWithPolish] ✅ 第二轮 explanation-only 翻译成功（字符串格式）`, {
          requestId,
          explanationLength: result.explanation.length,
        });
      } else {
        console.warn(`[translateWithPolish] ⚠️ 第二轮 explanation-only 翻译未返回有效 explanation`, {
          requestId,
          rawAnswerPreview: explanationOnlyData.answer.substring(0, 200),
        });
      }
    } catch (e) {
      console.error(`[translateWithPolish] ⚠️ explanation-only 重试失败，将保留原 explanation 或置空`, {
        requestId,
        error: String(e),
      });
      // 不再 throw，交由上层容错
    }
  }

  if (returnDetail) {
    const detail: SubtaskDetail = {
      operation: "translate",
      scene: sceneKey,
      sceneName: sceneConfig?.sceneName || sceneKey,
      prompt: sceneConfig?.prompt || "",
      expectedFormat: sceneConfig?.outputFormat || null,
      question: questionText,
      answer: data.answer,
      status: "success",
      timestamp: new Date().toISOString(),
      aiProvider: aiProvider, // 添加 AI provider 信息
      model: model, // 添加 model 信息
    };
    return { result, detail };
  }

  return result;
}

/**
 * 规范化题目数据（在写库前统一处理）
 * 确保 True/False 题的 options 被清空
 * 同时清理 options 数组中的无效元素（如 "explanation"）
 */
export function normalizeQuestionBeforeSave(question: {
  id?: number;
  type: "single" | "multiple" | "truefalse";
  options?: string[] | null;
  [key: string]: any;
}): typeof question {
  // ✅ 修复：先清理 options 数组，移除无效元素
  if (question.options && Array.isArray(question.options)) {
    const cleanedOptions = question.options
      .filter((opt: any) => {
        if (typeof opt !== "string") return false;
        const trimmed = opt.trim();
        // 过滤掉空字符串和无效的选项值
        return trimmed !== "" && trimmed.toLowerCase() !== "explanation";
      })
      .map((opt: any) => {
        // 处理包含多个选项的长字符串（用 \n 分隔）
        if (typeof opt === "string" && opt.includes("\n")) {
          return opt.split("\n")
            .map((line: string) => line.trim())
            .filter((line: string) => line !== "" && line.toLowerCase() !== "explanation");
        }
        return opt.trim();
      })
      .flat(); // 展平数组（处理分割后的选项）
    
    // 如果清理后数组为空，设置为空数组（保持数组类型）
    question.options = cleanedOptions.length > 0 ? cleanedOptions : [];
  }
  
  if (question.type === "truefalse") {
    if (question.options && question.options.length) {
      console.warn(
        "[normalizeQuestionBeforeSave] truefalse 题检测到 options，强制清空",
        { id: question.id, optionsCount: question.options.length },
      );
    }
    question.options = []; // 或者 null，按你的 schema 来
  }

  return question;
}

/**
 * 润色内容
 */
export async function polishContent(params: {
  text: { content: string; options?: string[]; explanation?: string };
  locale: string;
  type?: "single" | "multiple" | "truefalse"; // ✅ 修复：统一使用 type 字段
  adminToken?: string; // 管理员 token，用于跳过配额限制
  returnDetail?: boolean; // 是否返回详细信息
  mode?: "batch" | "single"; // 调用模式：batch（批量处理）或 single（单题操作）
}): Promise<TranslateResult | { result: TranslateResult; detail: SubtaskDetail }> {
  const { text, locale, type } = params; // ✅ 修复：统一使用 type
  
  // 使用统一的题目拼装工具
  const input = buildQuestionPolishInput({
    stem: text.content,
    options: text.options,
    explanation: text.explanation,
    language: locale,
    questionType: type || undefined, // 使用 questionType 字段
  });

  const sceneKey = "question_polish";
  let sceneConfig: { prompt: string; outputFormat: string | null; sceneName: string } | null = null;
  
  if (params.returnDetail) {
    sceneConfig = await getSceneConfig(sceneKey, locale);
  }

  // ✅ 根据调用模式决定超时策略
  const callMode = params.mode || "single"; // 默认为 single，批量处理需显式传入 "batch"
  
  const data = await callAiAskInternal(
    {
      question: input,
      locale: locale,
      scene: sceneKey,
      adminToken: params.adminToken,
    },
    { mode: callMode, retries: 1 }
  );

  const aiProvider = data.aiProvider || 'unknown';
  const model = data.model || 'unknown';

  // 解析 JSON 响应
  let parsed: any = null;
  let rawAnswer = data.answer;
  
  // 尝试从代码块中提取 JSON（优先处理）
  const codeBlockMatch = rawAnswer.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    rawAnswer = codeBlockMatch[1].trim();
  }
  
  try {
    parsed = JSON.parse(cleanJsonString(rawAnswer));
  } catch (parseError) {
    // 如果 JSON 解析失败，尝试修复截断的 JSON
    try {
      let fixedJson = cleanJsonString(rawAnswer);
      
      // 如果 JSON 被截断，尝试提取已有字段
      // 改进正则表达式，支持多行字符串和转义字符
      const contentMatch = fixedJson.match(/"content"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/);
      const optionsMatch = fixedJson.match(/"options"\s*:\s*\[([^\]]*)\]/);
      const explanationMatch = fixedJson.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/);
      
      if (contentMatch || optionsMatch) {
        // 至少有一个字段，尝试构建有效的 JSON
        parsed = {};
        
        if (contentMatch) {
          parsed.content = contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        }
        
        if (optionsMatch) {
          try {
            // 尝试解析选项数组
            const optionsStr = optionsMatch[1];
            const options = optionsStr
              .split(',')
              .map(opt => opt.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'))
              .filter(opt => opt.length > 0);
            if (options.length > 0) {
              parsed.options = options;
            }
          } catch {
            // 忽略选项解析错误
          }
        }
        
        if (explanationMatch) {
          parsed.explanation = explanationMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        } else {
          // 如果 explanation 被截断，尝试提取部分内容
          const explanationStartMatch = fixedJson.match(/"explanation"\s*:\s*"([^"]*)/);
          if (explanationStartMatch) {
            parsed.explanation = explanationStartMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
          }
        }
        
        // 如果成功提取了至少一个字段，使用它
        if (Object.keys(parsed).length > 0) {
          console.warn(`[polishContent] JSON was truncated, extracted partial data: ${Object.keys(parsed).join(', ')}`);
        } else {
          throw new Error("No valid fields extracted from truncated JSON");
        }
      } else {
        // 尝试添加缺失的闭合括号
        if (!fixedJson.endsWith("}")) {
          const openBraces = (fixedJson.match(/\{/g) || []).length;
          const closeBraces = (fixedJson.match(/\}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          if (missingBraces > 0) {
            fixedJson += "\n" + "}".repeat(missingBraces);
          }
        }
        parsed = JSON.parse(cleanJsonString(fixedJson));
      }
    } catch {
      // 如果修复后仍然失败，记录完整响应用于调试
      console.error(`[polishContent] Failed to parse AI response. Full response length: ${data.answer.length}`);
      console.error(`[polishContent] Response preview: ${data.answer.substring(0, 500)}`);
      throw new Error("AI polish response missing JSON body");
    }
  }
  
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI polish response missing JSON body");
  }
  
  // 验证 content 字段是否存在且非空
  const contentStr = String(parsed.content ?? "").trim();
  if (!contentStr) {
    throw new Error("AI polish response missing content field");
  }
  
  const result: TranslateResult = {
    content: contentStr,
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : undefined,
    explanation: parsed.explanation ? String(parsed.explanation) : undefined,
  };

  if (params.returnDetail) {
    const detail: SubtaskDetail = {
      operation: "polish",
      scene: sceneKey,
      sceneName: sceneConfig?.sceneName || sceneKey,
      prompt: sceneConfig?.prompt || "",
      expectedFormat: sceneConfig?.outputFormat || null,
      question: input,
      answer: data.answer,
      status: "success",
      timestamp: new Date().toISOString(),
      aiProvider: aiProvider,
      model: model,
    };
    return { result, detail };
  }
  
  return result;
}

/**
 * 生成分类和标签
 */
export async function generateCategoryAndTags(params: {
  content: string;
  options?: string[] | null;
  explanation?: string | null;
  locale?: string;
  adminToken?: string; // 管理员 token，用于跳过配额限制
  returnDetail?: boolean; // 是否返回详细信息
  mode?: "batch" | "single"; // 调用模式：batch（批量处理）或 single（单题操作）
}): Promise<CategoryAndTagsResult | { result: CategoryAndTagsResult; detail: SubtaskDetail }> {
  const { content, options, explanation, locale = "zh-CN" } = params;

  const input = [
    `Content: ${content}`,
    options && options.length ? `Options:\n- ${options.join("\n- ")}` : ``,
    explanation ? `Explanation: ${explanation}` : ``,
  ]
    .filter(Boolean)
    .join("\n");

  const sceneKey = "question_category_tags";
  let sceneConfig: { prompt: string; outputFormat: string | null; sceneName: string } | null = null;
  
  if (params.returnDetail) {
    sceneConfig = await getSceneConfig(sceneKey, locale);
  }

  // ✅ 根据调用模式决定超时策略
  const callMode = params.mode || "single"; // 默认为 single，批量处理需显式传入 "batch"
  
  const data = await callAiAskInternal(
    {
      question: input,
      locale: locale,
      scene: sceneKey,
      adminToken: params.adminToken,
    },
    { mode: callMode, retries: 1 }
  );

  const aiProvider = data.aiProvider || 'unknown';
  const model = data.model || 'unknown';

  let parsed: any = null;
  let rawAnswer = data.answer;
  
  // 尝试从代码块中提取 JSON（优先处理）
  const codeBlockMatch = rawAnswer.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    rawAnswer = codeBlockMatch[1].trim();
  }
  
  try {
    parsed = JSON.parse(rawAnswer);
  } catch (parseError) {
    // 如果 JSON 解析失败，记录详细错误信息
    console.error(`[generateCategoryAndTags] Failed to parse AI response. Full response length: ${rawAnswer.length}`);
    console.error(`[generateCategoryAndTags] Response preview: ${rawAnswer.substring(0, 500)}`);
    console.error(`[generateCategoryAndTags] Parse error:`, parseError);
    
    // 尝试修复截断的 JSON
    try {
      let fixedJson = rawAnswer.trim();
      
      // 尝试添加缺失的闭合括号
      if (!fixedJson.endsWith("}")) {
        const openBraces = (fixedJson.match(/\{/g) || []).length;
        const closeBraces = (fixedJson.match(/\}/g) || []).length;
        const missingBraces = openBraces - closeBraces;
        if (missingBraces > 0) {
          fixedJson += "\n" + "}".repeat(missingBraces);
        }
      }
      parsed = JSON.parse(cleanJsonString(fixedJson));
      console.warn(`[generateCategoryAndTags] Successfully fixed truncated JSON`);
    } catch (fixError) {
      // 如果修复后仍然失败，抛出详细错误
      console.error(`[generateCategoryAndTags] Failed to fix JSON:`, fixError);
      throw new Error(`AI category/tags response missing JSON body. Response preview: ${rawAnswer.substring(0, 200)}`);
    }
  }
  
  if (!parsed || typeof parsed !== "object") {
    console.error(`[generateCategoryAndTags] Parsed result is not an object:`, typeof parsed, parsed);
    throw new Error(`AI category/tags response missing JSON body. Response preview: ${rawAnswer.substring(0, 200)}`);
  }

  // 使用统一的规范化函数处理 AI 返回结果
  const normalized = normalizeAIResult(parsed);

  // 转换 stageTag：从新值（"provisional" | "full" | "both"）转换为旧值（兼容）
  let stageTag: "both" | "provisional" | "regular" | "full" | null = null;
  if (normalized.stageTag === "provisional") {
    stageTag = "provisional";
  } else if (normalized.stageTag === "full") {
    stageTag = "regular"; // 兼容旧值：full -> regular
  } else if (normalized.stageTag === "both") {
    stageTag = "both";
  }

  const result: CategoryAndTagsResult = {
    license_type_tag: normalized.licenseTypeTag,
    stage_tag: stageTag,
    topic_tags: normalized.topicTags,
    // 以下字段已废弃，保留 null 用于兼容
    category: null, // category 是卷类，不是标签，不再从 AI 获取
    license_types: null, // 使用 license_type_tag 替代
  };

  if (params.returnDetail) {
    const detail: SubtaskDetail = {
      operation: "category_tags",
      scene: sceneKey,
      sceneName: sceneConfig?.sceneName || sceneKey,
      prompt: sceneConfig?.prompt || "",
      expectedFormat: sceneConfig?.outputFormat || null,
      question: input,
      answer: data.answer,
      status: "success",
      timestamp: new Date().toISOString(),
      aiProvider: aiProvider,
      model: model,
    };
    return { result, detail };
  }

  return result;
}

/**
 * 填充缺失内容
 */
export async function fillMissingContent(params: {
  content: string;
  options?: string[] | null;
  explanation?: string | null;
  locale?: string;
  type?: "single" | "multiple" | "truefalse"; // ✅ 修复：统一使用 type 字段
  adminToken?: string; // 管理员 token，用于跳过配额限制
  returnDetail?: boolean; // 是否返回详细信息
  mode?: "batch" | "single"; // 调用模式：batch（批量处理）或 single（单题操作）
}): Promise<TranslateResult | { result: TranslateResult; detail: SubtaskDetail }> {
  const { content, options, explanation, locale = "zh-CN", type } = params; // ✅ 修复：统一使用 type

  // ✅ 修复：使用统一的题目拼装工具，不再在输入中添加"Question Type"说明文字
  const input = buildQuestionFillMissingInput({
    stem: content,
    options: options,
    explanation: explanation,
    questionType: type, // 使用 questionType 字段
  });

  const sceneKey = "question_fill_missing";
  let sceneConfig: { prompt: string; outputFormat: string | null; sceneName: string } | null = null;
  
  if (params.returnDetail) {
    sceneConfig = await getSceneConfig(sceneKey, locale);
  }

  // ✅ 根据调用模式决定超时策略
  const callMode = params.mode || "single"; // 默认为 single，批量处理需显式传入 "batch"
  
  const data = await callAiAskInternal(
    {
      question: input,
      locale: locale,
      scene: sceneKey,
      adminToken: params.adminToken,
    },
    { mode: callMode, retries: 1 }
  );

  const aiProvider = data.aiProvider || 'unknown';
  const model = data.model || 'unknown';

  let parsed: any = null;
  let rawAnswer = data.answer;
  
  // 尝试从代码块中提取 JSON（优先处理）
  const codeBlockMatch = rawAnswer.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    rawAnswer = codeBlockMatch[1].trim();
  }
  
  try {
    parsed = JSON.parse(cleanJsonString(rawAnswer));
  } catch (parseError) {
    // 如果 JSON 解析失败，尝试修复截断的 JSON
    try {
      let fixedJson = cleanJsonString(rawAnswer);
      
      // 如果 JSON 被截断，尝试提取已有字段
      // 查找最后一个完整的字段
      const contentMatch = fixedJson.match(/"content"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
      const optionsMatch = fixedJson.match(/"options"\s*:\s*\[([^\]]*)\]/);
      const explanationMatch = fixedJson.match(/"explanation"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
      
      if (contentMatch || optionsMatch) {
        // 至少有一个字段，尝试构建有效的 JSON
        parsed = {};
        
        if (contentMatch) {
          parsed.content = contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        }
        
        if (optionsMatch) {
          try {
            // 尝试解析选项数组
            const optionsStr = optionsMatch[1];
            const options = optionsStr
              .split(',')
              .map(opt => opt.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'))
              .filter(opt => opt.length > 0);
            if (options.length > 0) {
              parsed.options = options;
            }
          } catch {
            // 忽略选项解析错误
          }
        }
        
        if (explanationMatch) {
          parsed.explanation = explanationMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        } else {
          // 如果 explanation 被截断，尝试提取部分内容
          const explanationStartMatch = fixedJson.match(/"explanation"\s*:\s*"([^"]*)/);
          if (explanationStartMatch) {
            parsed.explanation = explanationStartMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
          }
        }
        
        // 如果成功提取了至少一个字段，使用它
        if (Object.keys(parsed).length > 0) {
          console.warn(`[fillMissingContent] JSON was truncated, extracted partial data: ${Object.keys(parsed).join(', ')}`);
        } else {
          throw new Error("No valid fields extracted from truncated JSON");
        }
      } else {
        // 尝试添加缺失的闭合括号
        if (!fixedJson.endsWith("}")) {
          const openBraces = (fixedJson.match(/\{/g) || []).length;
          const closeBraces = (fixedJson.match(/\}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          if (missingBraces > 0) {
            fixedJson += "\n" + "}".repeat(missingBraces);
          }
        }
        parsed = JSON.parse(cleanJsonString(fixedJson));
      }
    } catch {
      // 如果修复后仍然失败，记录完整响应用于调试
      console.error(`[fillMissingContent] Failed to parse AI response. Full response length: ${data.answer.length}`);
      console.error(`[fillMissingContent] Response preview: ${data.answer.substring(0, 500)}`);
      throw new Error("AI fill missing response missing JSON body");
    }
  }
  
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI fill missing response missing JSON body");
  }

  // ✅ 修复：添加结果验证逻辑
  const originalContent = content;
  const resultContent = parsed.content;
  const resultExplanation = parsed.explanation;

  // 1) content 结果校验：有原文就必须保持
  if (
    originalContent &&
    originalContent.trim() !== "" &&
    originalContent.trim() !== "[缺失]" &&
    resultContent &&
    String(resultContent).trim() === "[缺失]"
  ) {
    console.warn(
      "[fillMissingContent] AI 返回 content 为 [缺失]，但原始 content 存在，强制回退为原始内容",
      { originalContentPreview: originalContent.substring(0, 100) }
    );
    parsed.content = originalContent;
  }

  // 2) explanation 结果简单校验：明显是格式说明时拒收
  const explanationStr = typeof resultExplanation === "string" ? String(resultExplanation) : "";
  const looksLikeFormatHint =
    explanationStr.includes("options 字段") ||
    explanationStr.includes("JSON 格式") ||
    explanationStr.includes("output_format") ||
    explanationStr.includes("应设为 null") ||
    explanationStr.includes("空数组");

  if (looksLikeFormatHint) {
    console.warn(
      "[fillMissingContent] AI 返回的 explanation 疑似格式说明，丢弃并留空，建议人工复核",
      { explanationPreview: explanationStr.substring(0, 100) }
    );
    parsed.explanation = "";
  }

  const result: TranslateResult = {
    content: String(parsed.content ?? content ?? "").trim(),
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : options || undefined,
    explanation: parsed.explanation ? String(parsed.explanation) : explanation || undefined,
  };

  if (params.returnDetail) {
    const detail: SubtaskDetail = {
      operation: "fill_missing",
      scene: sceneKey,
      sceneName: sceneConfig?.sceneName || sceneKey,
      prompt: sceneConfig?.prompt || "",
      expectedFormat: sceneConfig?.outputFormat || null,
      question: input,
      answer: data.answer,
      status: "success",
      timestamp: new Date().toISOString(),
      aiProvider: aiProvider,
      model: model,
    };
    return { result, detail };
  }

  return result;
}


/**
 * 保存题目翻译到数据库
 * 将翻译结果写入 questions.content 和 questions.explanation 的 JSONB 字段
 */
async function saveQuestionTranslation(
  questionId: number,
  contentHash: string,
  locale: string,
  translation: TranslateResult
): Promise<void> {
  const { db } = await import("@/lib/db");
  
  // 获取当前题目内容
  const currentQuestion = await db
    .selectFrom("questions")
    .select(["content", "explanation"])
    .where("id", "=", questionId)
    .executeTakeFirst();

  if (!currentQuestion) {
    throw new Error(`Question with id ${questionId} not found`);
  }

  // 更新 content JSONB 对象，添加目标语言
  let updatedContent: any;
  if (typeof currentQuestion.content === "object" && currentQuestion.content !== null) {
    updatedContent = { ...currentQuestion.content, [locale]: translation.content };
  } else if (typeof currentQuestion.content === "string") {
    // 如果原本是字符串，转换为 JSONB 对象
    updatedContent = { zh: currentQuestion.content, [locale]: translation.content };
  } else {
    // 如果 content 为空或 null，直接创建新的 JSONB 对象
    updatedContent = { [locale]: translation.content };
  }

  // 更新 explanation JSONB 对象，添加目标语言
  let updatedExplanation: any = null;
  if (translation.explanation) {
    const explanationStr =
      typeof translation.explanation === "string"
        ? translation.explanation
        : String(translation.explanation);
    // 这里假设 locale 即为目标语言，如 "en"/"ja"
    const sourceLanguage =
      (currentQuestion as any).source_language ??
      (translation as any).sourceLanguage ??
      "zh";

    updatedExplanation = buildUpdatedExplanationWithGuard({
      currentExplanation: currentQuestion.explanation,
      newExplanation: explanationStr,
      sourceLanguage,
      targetLang: locale,
    });
  } else if (currentQuestion.explanation) {
    updatedExplanation = currentQuestion.explanation;
  }

  // 更新题目
  await db
    .updateTable("questions")
    .set({
      content: updatedContent as any,
      explanation: updatedExplanation as any,
      updated_at: new Date(),
    })
    .where("id", "=", questionId)
    .execute();
}

/**
 * 应用一体化处理返回的 tags 到题目
 * ✅ Phase 2.1 修复：统一代码层字段名为 license_tags
 */
function applyTagsFromFullPipeline(
  tags: {
    license_type_tag?: string[] | null; // ✅ 修复：使用单数形式，与数据库字段名一致
    stage_tag?: string[] | null; // ✅ 修复：使用单数形式，与数据库字段名一致
    topic_tags?: string[] | null; // 保持复数形式（数据库字段名就是复数）
    difficulty_level?: "easy" | "medium" | "hard" | null;
  },
  question: any
): void {
  if (!tags) {
    console.warn(`[processFullPipelineBatch] [Q${question.id}] AI 未返回 tags，跳过 tag 应用`);
    return;
  }

  // ✅ 修复：使用 license_type_tag（单数，与数据库字段名一致）
  if (Array.isArray(tags.license_type_tag) && tags.license_type_tag.length > 0) {
    const normalized = tags.license_type_tag
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().toUpperCase());

    // 直接使用数据库字段名 license_type_tag
    (question as any).license_type_tag = Array.from(new Set(normalized));
  }
  
  // ✅ 修复：使用 stage_tag（单数，与数据库字段名一致）
  if (Array.isArray(tags.stage_tag) && tags.stage_tag.length > 0) {
    const normalized = tags.stage_tag
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().toUpperCase());

    if (normalized.length > 0) {
      // ✅ 修复：使用更宽松的匹配逻辑，支持 FULL_LICENSE 等多种格式
      const hasBoth = normalized.some((t) => t.includes("BOTH"));
      const hasFull = normalized.some((t) => t.includes("FULL") || t.includes("REGULAR") || t.includes("FULL_LICENSE"));
      const hasProvisional = normalized.some((t) => t.includes("PROVISIONAL"));

      if (hasBoth) {
        question.stage_tag = "both";
      } else if (hasFull) {
        question.stage_tag = "regular";
      } else if (hasProvisional) {
        question.stage_tag = "provisional";
      } else {
        // 兜底：直接用第一个，转小写
        question.stage_tag = normalized[0].toLowerCase();
      }
    }
  }
  
  // 处理 topic_tags（保持复数形式，数据库字段名就是复数）
  const topicTags = tags.topic_tags ?? question.topic_tags ?? [];
  if (Array.isArray(tags.topic_tags) && tags.topic_tags.length > 0) {
    const normalized = tags.topic_tags
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim());

    question.topic_tags = Array.from(new Set(normalized));
  } else if (Array.isArray(topicTags) && topicTags.length > 0) {
    question.topic_tags = topicTags;
  }
  
  // ✅ 修复：添加调试日志，使用数据库字段名
  console.debug(
    `[processFullPipelineBatch] [Q${question.id}] [DEBUG] tags 应用完成: ${JSON.stringify({
      license_type_tag: (question as any).license_type_tag,
      stage_tag: question.stage_tag,
      topic_tags: question.topic_tags,
    })}`,
  );
  
  // difficulty_level 目前没有对应的数据库字段，暂不处理
  // 如果需要，可以在后续添加 difficulty_level 字段
}

/**
 * 清理JSON字符串，移除尾随逗号等无效字符
 * @param jsonStr 原始JSON字符串
 * @returns 清理后的JSON字符串
 */

/**
 * ✅ Task 2: full_pipeline 的落库结构类型定义
 * 用于约束 processed_data 的结构，确保字段名与数据库一致
 */
interface FullPipelineDbPayload {
  // 多语言题干
  content?: Record<string, string>; // 格式：{ "zh": "中文内容", "ja": "日文内容" }
  // 多语言解析
  explanation?: Record<string, string>; // 格式：{ "zh": "中文解析", "ja": "日文解析" }

  // === Tag 映射后的 DB 字段 ===
  stage_tag?: string | null;          // 对应 questions.stage_tag
  topic_tags?: string[] | null;       // 对应 questions.topic_tags
  license_type_tag?: string[] | null; // 对应 questions.license_type_tag(JSONB，内部数组)
}

/**
 * ✅ Task 2: 构建 full_pipeline 的数据库落库结构
 * 将 AI 返回的 tags.stage_tag / tags.license_type_tag（单数形式，与数据库字段名一致）映射到数据库字段名
 */
function buildFullPipelineDbPayload(
  sanitized: any,
  opts: {
    sourceLang: string;        // 'zh'
    targetLangs: string[];     // ['ja', ...]
  }
): FullPipelineDbPayload {
  const payload: FullPipelineDbPayload = {};

  // 1) content / explanation 多语言合并
  const content: Record<string, string> = {};
  const explanation: Record<string, string> = {};

  if (sanitized.source?.content) {
    content[opts.sourceLang] = sanitized.source.content;
  }
  if (sanitized.source?.explanation) {
    explanation[opts.sourceLang] = sanitized.source.explanation;
  }

  const translations = sanitized.translations ?? {};
  for (const [lang, value] of Object.entries<any>(translations)) {
    if (value?.content) {
      content[lang] = value.content;
    }
    if (value?.explanation) {
      explanation[lang] = value.explanation;
    }
  }

  if (Object.keys(content).length) {
    payload.content = content;
  }
  if (Object.keys(explanation).length) {
    payload.explanation = explanation;
  }

  // 2) Tags 映射到 DB 字段名
  const rawTags = sanitized.tags ?? {};

  // topic_tags：直接透传 string[]，注意保证数组类型
  if (Array.isArray(rawTags.topic_tags) && rawTags.topic_tags.length > 0) {
    payload.topic_tags = rawTags.topic_tags;
  }

  // license_type_tag：AI 输出为 license_type_tag（单数，与数据库字段名一致），保持数组
  if (Array.isArray(rawTags.license_type_tag) && rawTags.license_type_tag.length > 0) {
    payload.license_type_tag = rawTags.license_type_tag;
  }

  // stage_tag：AI 输出为 stage_tag（单数，与数据库字段名一致），DB 为单值
  // 先采用保守策略：如果只有一个元素，则用该元素；多于一个则暂时保留原 DB 值（在 Save 层合并）
  if (Array.isArray(rawTags.stage_tag) && rawTags.stage_tag.length === 1) {
    // 处理 FULL_LICENSE -> regular 的映射
    const stageTag = rawTags.stage_tag[0].toUpperCase();
    if (stageTag.includes("BOTH")) {
      payload.stage_tag = "both";
    } else if (stageTag.includes("FULL") || stageTag.includes("REGULAR") || stageTag.includes("FULL_LICENSE")) {
      payload.stage_tag = "regular";
    } else if (stageTag.includes("PROVISIONAL")) {
      payload.stage_tag = "provisional";
    } else {
      payload.stage_tag = rawTags.stage_tag[0].toLowerCase();
    }
  } else if (Array.isArray(rawTags.stage_tag) && rawTags.stage_tag.length > 1) {
    // 多值情况：采用与 applyTagsFromFullPipeline 相同的逻辑
    const normalized = rawTags.stage_tag
      .filter((t: unknown) => typeof t === "string" && t.trim().length > 0)
      .map((t: string) => t.trim().toUpperCase());
    
    const hasBoth = normalized.some((t: string) => t.includes("BOTH"));
    const hasFull = normalized.some((t: string) => t.includes("FULL") || t.includes("REGULAR") || t.includes("FULL_LICENSE"));
    const hasProvisional = normalized.some((t: string) => t.includes("PROVISIONAL"));

    if (hasBoth) {
      payload.stage_tag = "both";
    } else if (hasFull) {
      payload.stage_tag = "regular";
    } else if (hasProvisional) {
      payload.stage_tag = "provisional";
    } else {
      payload.stage_tag = normalized[0].toLowerCase();
    }
  } else {
    // 无值的情况留给 Save 层结合原值决定，避免乱写
    payload.stage_tag = null;
  }

  return payload;
}

/**
 * 安全过滤 AI 返回的 payload，只允许白名单字段写入 question 模型
 * 防止 AI 输出多余字段污染数据库
 * 
 * @param aiResult AI 返回的完整结果对象
 * @param params 过滤参数
 * @param params.sourceLanguage 源语言代码（如 'zh'）
 * @param params.targetLanguages 目标语言列表（如 ['ja', 'en']），不传表示保留全部 translations
 * @param params.scene 场景标识（如 'question_full_pipeline' / 'question_translation'），可选
 * @returns 过滤后的安全对象，只包含允许的字段
 */
type SanitizeAiPayloadParams = {
  sourceLanguage: string;          // e.g. 'zh'
  targetLanguages?: string[];      // e.g. ['ja', 'en']，不传表示保留全部 translations
  scene?: string;                  // 可选：question_translation / question_full_pipeline 等
};

function sanitizeAiPayload(
  aiResult: any,
  params: SanitizeAiPayloadParams
): {
  source?: {
    content?: string;
    options?: string[];
    explanation?: string;
  };
  translations?: Record<string, {
    content?: string;
    options?: string[];
    explanation?: string;
  }>;
  tags?: {
    license_type_tag?: string[]; // ✅ 修复：使用单数形式，与数据库字段名一致
    stage_tag?: string[]; // ✅ 修复：使用单数形式，与数据库字段名一致
    topic_tags?: string[]; // 保持复数形式（数据库字段名就是复数）
    difficulty_level?: "easy" | "medium" | "hard" | null;
  };
  correct_answer?: any; // 允许 correct_answer，但会在后续阶段通过 buildNormalizedQuestion 校验
} {
  const { sourceLanguage, targetLanguages, scene } = params;
  const sanitized: any = {};

  // 白名单：source 字段
  if (aiResult.source && typeof aiResult.source === "object") {
    sanitized.source = {};
    if (typeof aiResult.source.content === "string") {
      sanitized.source.content = aiResult.source.content;
    }
    if (Array.isArray(aiResult.source.options)) {
      sanitized.source.options = aiResult.source.options.filter((opt: any) => typeof opt === "string");
    }
    if (typeof aiResult.source.explanation === "string") {
      sanitized.source.explanation = aiResult.source.explanation;
    }
  }

  // 白名单：translations 字段
  // ✅ 增强：在 sanitize 阶段就按照 targetLanguages 做过滤
  const translations = aiResult?.translations ?? {};
  const allowedLangs =
    Array.isArray(targetLanguages) && targetLanguages.length > 0
      ? targetLanguages
      : Object.keys(translations);
  
  const filteredTranslations: Record<string, any> = {};
  for (const lang of allowedLangs) {
    if (translations[lang] && typeof translations[lang] === "object") {
      const sanitizedTranslation: any = {};
      if (typeof translations[lang].content === "string") {
        sanitizedTranslation.content = translations[lang].content;
      }
      if (Array.isArray(translations[lang].options)) {
        sanitizedTranslation.options = translations[lang].options.filter((opt: any) => typeof opt === "string");
      }
      if (typeof translations[lang].explanation === "string") {
        sanitizedTranslation.explanation = translations[lang].explanation;
      }
      if (Object.keys(sanitizedTranslation).length > 0) {
        filteredTranslations[lang] = sanitizedTranslation;
      }
    }
  }

  // ✅ 增强：如果 scene 是 full_pipeline，并且 AI 在 translations 里也返回了源语言，
  // 可以视需要保留 sourceLanguage 项（如果不在已过滤列表中）
  if (
    scene === 'question_full_pipeline' &&
    translations[sourceLanguage] &&
    !filteredTranslations[sourceLanguage]
  ) {
    const sourceTranslation = translations[sourceLanguage];
    if (sourceTranslation && typeof sourceTranslation === "object") {
      const sanitizedSourceTranslation: any = {};
      if (typeof sourceTranslation.content === "string") {
        sanitizedSourceTranslation.content = sourceTranslation.content;
      }
      if (Array.isArray(sourceTranslation.options)) {
        sanitizedSourceTranslation.options = sourceTranslation.options.filter((opt: any) => typeof opt === "string");
      }
      if (typeof sourceTranslation.explanation === "string") {
        sanitizedSourceTranslation.explanation = sourceTranslation.explanation;
      }
      if (Object.keys(sanitizedSourceTranslation).length > 0) {
        filteredTranslations[sourceLanguage] = sanitizedSourceTranslation;
      }
    }
  }

  sanitized.translations = filteredTranslations;

  // 白名单：tags 字段
  // ✅ 修复：严格按照数据库字段名，使用单数形式（stage_tag、license_type_tag）
  // 数据库字段：stage_tag（单数）、license_type_tag（单数）、topic_tags（复数，特例）
  if (aiResult.tags && typeof aiResult.tags === "object") {
    sanitized.tags = {};
    // ✅ 修复：从 license_type_tag（单数，与数据库字段名一致）读取
    if (Array.isArray(aiResult.tags.license_type_tag)) {
      sanitized.tags.license_type_tag = aiResult.tags.license_type_tag.filter((t: any) => typeof t === "string");
    }
    // ✅ 修复：从 stage_tag（单数，与数据库字段名一致）读取
    if (Array.isArray(aiResult.tags.stage_tag)) {
      sanitized.tags.stage_tag = aiResult.tags.stage_tag.filter((t: any) => typeof t === "string");
    }
    // topic_tags 保持复数形式（数据库字段名就是复数）
    if (Array.isArray(aiResult.tags.topic_tags)) {
      sanitized.tags.topic_tags = aiResult.tags.topic_tags.filter((t: any) => typeof t === "string");
    }
    if (["easy", "medium", "hard"].includes(aiResult.tags.difficulty_level)) {
      sanitized.tags.difficulty_level = aiResult.tags.difficulty_level;
    }
  }

  // 白名单：correct_answer 字段（允许，但会在后续阶段校验）
  if ("correct_answer" in aiResult) {
    sanitized.correct_answer = aiResult.correct_answer;
  }

  // ✅ 强制类型检查：translations 必须是 Record<string, any>
  if (sanitized.translations !== undefined) {
    if (typeof sanitized.translations !== 'object' || Array.isArray(sanitized.translations)) {
      throw new Error("[sanitizeAiPayload] translations must be an object");
    }
    
    // 保证所有 language key 都为字符串
    for (const key of Object.keys(sanitized.translations)) {
      if (typeof key !== "string") {
        throw new Error(`[sanitizeAiPayload] Invalid language key: ${key}`);
      }
    }
  }

  return sanitized;
}

/**
 * 一体化 AI 处理批量处理函数
 * 
 * 输入：题干 + 正确答案 + 源语言 + 题型 + 选项
 * 输出：
 * - 源语言的：润色题干 + 补漏选项/解析
 * - 完整 tag：license_type_tag / stage_tag / topic_tag / difficulty
 * - 多语言翻译（多选 zh/ja/en）
 * - 最后一次性写入完整 question
 */
export async function processFullPipelineBatch(
  questions: Array<{
    id: number;
    content_hash: string;
    type: "single" | "multiple" | "truefalse";
    content: any;
    options: any;
    correct_answer: any;
    explanation?: any;
  }>,
  params: {
    sourceLanguage: "zh" | "ja" | "en";
    targetLanguages: string[]; // ["zh","ja","en"] 子集
    type: "single" | "multiple" | "truefalse"; // ✅ 修复：统一使用 type 字段
    adminToken?: string;
    mode?: "batch" | "single";
    // 📊 新增：用于保存调试数据的回调函数
    onProgress?: (questionId: number, debugData: {
      aiRequest?: any;
      aiResponse?: any;
      processedData?: any;
    }) => Promise<void>;
    // ✅ Task 4: 新增：用于写入 AI 诊断日志的回调函数
    onLog?: (questionId: number, log: {
      step: string;
      payload?: any;
      result?: any;
      removedLanguages?: string[];
      cleanedJsonPreview?: string;
      trace_id?: string; // ✅ Task 4: 添加 trace_id
    }) => Promise<void>;
  }
): Promise<Array<{
  questionId: number;
  success: boolean;
  error?: string;
}>> {
  const { sourceLanguage, targetLanguages, type, adminToken, mode = "batch", onProgress, onLog } = params; // ✅ 修复：统一使用 type
  const results: Array<{ questionId: number; success: boolean; error?: string }> = [];
  
  // ✅ Task 4: 为整个批量处理生成统一的 trace_id
  const batchTraceId = crypto.randomUUID();

  console.log(`[processFullPipelineBatch] 开始处理 | 题目数量: ${questions.length} | 源语言: ${sourceLanguage} | 目标语言: ${targetLanguages.join(", ")} | 题型: ${type} | 模式: ${mode}`);

  for (const question of questions) {
    const startTime = Date.now();
    let currentStage = "";
    let aiProvider = "";
    let aiCorrectAnswerUsed = false;
    
    // ✅ A-2: 初始化诊断信息收集器
    const diagnostic: TranslationDiagnostic = {
      questionId: question.id,
      scene: "question_full_pipeline",
      sourceLanguage,
      targetLanguage: targetLanguages.join(","),
    };
    
    // ✅ Task 4: 声明变量，用于错误诊断（在 try 块开始处声明，避免作用域问题）
    let dbUpdatePayload: any = undefined;
    let dbRowBefore: any = undefined;
    
    try {
      // ========== STAGE 1: LOAD_QUESTION ==========
      currentStage = "LOAD_QUESTION";
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 1: LOAD_QUESTION | 题型=${question.type} | correct_answer=${question.correct_answer ?? "null"}`);
      
      // 基本校验
      if (!question.id || !question.type) {
        throw new Error("LOAD_QUESTION_FAILED: 题目缺少必要字段 (id 或 type)");
      }
      
      const sourceLang = sourceLanguage ?? "zh";
      const questionSourceContent =
        typeof question.content === "object"
          ? question.content?.[sourceLang] ?? null
          : question.content ?? null;

      // ========== STAGE 2: BUILD_AI_INPUT ==========
      currentStage = "BUILD_AI_INPUT";
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 2: BUILD_AI_INPUT`);
      
      // 构造完整的 question payload 传给 ai-service
      const aiQuestionPayload = {
        id: question.id,
        sourceLanguage: sourceLang,
        questionText: questionSourceContent?.questionText ?? (typeof questionSourceContent === "string" ? questionSourceContent : null) ?? null,
        correctAnswer: question.correct_answer ?? null,
        type: question.type ?? null,
        options: questionSourceContent?.options ?? question.options ?? null,
        explanation: questionSourceContent?.explanation ?? question.explanation ?? null,
        licenseTypeTag: (question as any).license_type_tag ?? null,
        stageTag: (question as any).stage_tag ?? null,
        topicTags: (question as any).topic_tags ?? [],
      };

      // 构建输入（用于 prompt）
      const stem = typeof question.content === "string" 
        ? question.content 
        : (question.content?.zh || question.content?.[sourceLanguage] || "");
      
      const options = Array.isArray(question.options) 
        ? question.options 
        : (question.options ? [question.options] : null);
      
      const answer = Array.isArray(question.correct_answer)
        ? question.correct_answer.join(",")
        : String(question.correct_answer || "");

      // 使用 buildQuestionTranslationInput 作为替代，因为 full pipeline 主要是翻译场景
      const input = buildQuestionTranslationInput({
        stem,
        options: options || undefined,
        explanation: undefined, // full pipeline 场景不包含 explanation
        sourceLanguage,
        targetLanguage: targetLanguages[0] || sourceLanguage,
        questionType: type, // 使用 questionType 字段
      });

      // ========== STAGE 3: CALL_AI_FULL_PIPELINE ==========
      currentStage = "CALL_AI_FULL_PIPELINE";
      const aiCallStartTime = Date.now();
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 3: CALL_AI_FULL_PIPELINE | scene=question_full_pipeline`);
      
      // 📊 获取 scene 配置（包含 prompt），用于调试数据
      const sceneConfig = await getSceneConfig("question_full_pipeline", sourceLanguage);
      
      // ✅ Task 4: 记录 AI 调用前的日志
      if (onLog) {
        await onLog(question.id, {
          step: 'AI_CALL_BEFORE',
          payload: {
            scene: "question_full_pipeline",
            sourceLanguage,
            targetLanguages,
            type,
            question: input.substring(0, 200), // 限制长度
          },
          trace_id: batchTraceId, // ✅ Task 4: 添加 trace_id
        });
      }
      
      const aiResp = await callAiAskInternal(
        {
          question: input,
          scene: "question_full_pipeline",
          sourceLanguage,
          targetLanguage: targetLanguages[0] || sourceLanguage,
          locale: sourceLanguage,
          adminToken,
          questionPayload: aiQuestionPayload, // ✅ Task 1: 传递完整的 question payload
        },
        { mode, retries: 1 }
      );
      
      aiProvider = aiResp.aiProvider || "unknown";
      const aiCallDuration = Date.now() - aiCallStartTime;
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 3: CALL_AI_FULL_PIPELINE 完成 | provider=${aiProvider} | 耗时=${aiCallDuration}ms | 响应长度=${aiResp.answer?.length ?? 0}`);
      
      // ✅ Task 4: 记录 AI 调用后的日志
      if (onLog) {
        await onLog(question.id, {
          step: 'AI_CALL_AFTER',
          result: {
            provider: aiProvider,
            model: aiResp.model,
            duration: aiCallDuration,
            answerLength: aiResp.answer?.length ?? 0,
            answerPreview: aiResp.answer?.substring(0, 500), // 限制长度
          },
          trace_id: batchTraceId, // ✅ Task 4: 添加 trace_id
        });
      }
      
      // 📊 调试日志：构造完整的 AI 请求和响应数据（包含 prompt）
      const aiRequestDebug = {
        scene: "question_full_pipeline",
        sceneName: sceneConfig?.sceneName || "question_full_pipeline",
        prompt: sceneConfig?.prompt || "[无法获取 prompt]",
        question: input, // 格式化后的题目文本
        questionPayload: aiQuestionPayload, // 额外的题目元数据
        sourceLanguage,
        targetLanguage: targetLanguages[0] || sourceLanguage,
        locale: sourceLanguage,
        type,
        targetLanguages, // 所有目标语言
        outputFormat: sceneConfig?.outputFormat || null,
      };
      const aiResponseDebug = {
        provider: aiProvider,
        answer: aiResp.answer,
        model: aiResp.model,
        duration: aiCallDuration,
      };
      console.log(`[processFullPipelineBatch] [Q${question.id}] 📊 AI 完整请求（含 prompt）:`, JSON.stringify(aiRequestDebug, null, 2));
      console.log(`[processFullPipelineBatch] [Q${question.id}] 📊 AI 完整响应:`, JSON.stringify(aiResponseDebug, null, 2));

      // ========== STAGE 4: PARSE_AND_VALIDATE_AI_RESULT ==========
      currentStage = "PARSE_AND_VALIDATE_AI_RESULT";
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 4: PARSE_AND_VALIDATE_AI_RESULT`);
      
      let parsed: any = null;
      let rawAnswer = aiResp.answer;
      
      // 尝试从代码块中提取 JSON（内部 debug log）
      const codeBlockMatch = rawAnswer.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlockMatch) {
        rawAnswer = codeBlockMatch[1].trim();
        console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] 从代码块中提取 JSON`);
      }
      
      try {
        // ✅ 修复：清理尾随逗号，然后再解析
        parsed = JSON.parse(cleanJsonString(rawAnswer));
        console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] JSON 解析成功 | 包含字段: ${Object.keys(parsed || {}).join(", ")}`);
        
        // ✅ A-2: JSON 解析成功，填充诊断信息
        diagnostic.parsed = parsed;
        diagnostic.parsedSourceLanguage = parsed?.source?.language ?? null;
        diagnostic.translationsKeys = parsed?.translations ? Object.keys(parsed.translations) : [];
      } catch (parseError) {
        // ✅ A-2: JSON 解析失败，填充诊断信息
        diagnostic.errorStage = "JSON_PARSE_ERROR";
        diagnostic.errorCode = "AI_JSON_PARSE_FAILED";
        diagnostic.errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        diagnostic.errorStack = parseError instanceof Error ? parseError.stack ?? null : null;
        diagnostic.rawAiResponse = rawAnswer?.substring(0, 5000) ?? null; // 限制长度避免过大
        
        console.error(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] JSON 解析失败:`, {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          rawAnswerPreview: rawAnswer.substring(0, 500),
        });
        throw new Error("AI_JSON_PARSE_FAILED: AI full pipeline response missing valid JSON body");
      }

      // 验证解析结果
      if (!parsed || typeof parsed !== "object") {
        diagnostic.errorStage = "JSON_PARSE_ERROR";
        diagnostic.errorCode = "AI_JSON_PARSE_FAILED";
        diagnostic.errorMessage = "Parsed result is not an object";
        throw new Error("AI_JSON_PARSE_FAILED: AI full pipeline response missing JSON body");
      }

      if (!parsed.source || !parsed.source.content) {
        diagnostic.errorStage = "AI_VALIDATION_ERROR";
        diagnostic.errorCode = "AI_VALIDATION_FAILED";
        diagnostic.errorMessage = "AI full pipeline response missing source.content";
        throw new Error("AI_VALIDATION_FAILED: AI full pipeline response missing source.content");
      }

      // 检查 AI 输出是否包含 correct_answer（内部 debug log）
      if (
        !("correct_answer" in parsed) ||
        parsed.correct_answer === null ||
        parsed.correct_answer === undefined
      ) {
        console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] AI 输出缺少 correct_answer，将使用 DB correct_answer 兜底`);
      } else {
        aiCorrectAnswerUsed = true;
        console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] AI 输出包含 correct_answer: ${parsed.correct_answer}`);
      }

      // ✅ 安全过滤：只允许白名单字段写入 question 模型
      // ✅ 修复：传入完整的上下文参数，在sanitize阶段就过滤掉不需要的语言
      const sanitized = sanitizeAiPayload(parsed, {
        sourceLanguage,
        targetLanguages,
        scene: 'question_full_pipeline',
      });
      console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] AI payload 安全过滤完成 | 原始字段数=${Object.keys(parsed).length} | 过滤后字段数=${Object.keys(sanitized).length}`);
      
      // ✅ Task 4: 记录 sanitize 之后的日志（展示被过滤掉的语言）
      const originalLanguages = parsed?.translations ? Object.keys(parsed.translations) : [];
      const filteredLanguages = sanitized?.translations ? Object.keys(sanitized.translations) : [];
      const removedLanguages = originalLanguages.filter(lang => !filteredLanguages.includes(lang));
      if (onLog) {
        await onLog(question.id, {
          step: 'SANITIZE_AFTER',
          result: {
            originalFieldCount: Object.keys(parsed).length,
            filteredFieldCount: Object.keys(sanitized).length,
            originalLanguages,
            filteredLanguages,
          },
          removedLanguages,
          trace_id: batchTraceId, // ✅ Task 4: 添加 trace_id
        });
      }
      
      // ✅ A-2: 填充清洗后的数据
      diagnostic.sanitized = sanitized;
      diagnostic.model = aiResp.model ?? null;
      
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 4: PARSE_AND_VALIDATE_AI_RESULT 完成 | source.content存在 | 翻译数量=${sanitized.translations ? Object.keys(sanitized.translations).length : 0}`);

      // ========== STAGE 5: APPLY_AI_RESULT_TO_MODEL ==========
      currentStage = "APPLY_AI_RESULT_TO_MODEL";
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 5: APPLY_AI_RESULT_TO_MODEL`);
      
      // 提取源语言内容（使用过滤后的数据）
      const sourceContent = sanitized.source?.content || "";
      const sourceOptions = Array.isArray(sanitized.source?.options) ? sanitized.source.options : [];
      const sourceExplanation = sanitized.source?.explanation || "";
      
      // 应用 tags（使用过滤后的数据）
      if (sanitized.tags) {
        applyTagsFromFullPipeline(sanitized.tags, question);
        console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] tags 应用完成: ${JSON.stringify(sanitized.tags)}`);
        // ✅ 修复：添加调试日志，确认 tags 是否正确应用到 question 对象
        console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] question 对象上的 tags:`, {
          license_type_tag: (question as any).license_type_tag,
          stage_tag: (question as any).stage_tag,
          topic_tags: (question as any).topic_tags,
        });
      }

      // ⚠️ 重要：full_pipeline 不应修改源语言的 content 和 options
      // 原因：AI 可能返回错误的 source（比如把翻译当成 source），导致覆盖原有内容
      // 只在必要时更新源语言的 explanation（需严格校验）
      // 保持 question.content 和 question.options 不变，只添加翻译
      console.debug(
        `[processFullPipelineBatch] [Q${question.id}] [DEBUG] 保留源语言 content 和 options，不使用 AI 返回的 source（防止覆盖）`,
      );

      // ✅ 处理源语言 explanation：如果数据库中没有，可以使用 AI 返回的（但要校验语言）
      // 1️⃣ 计算当前是否已有源语言解析
      let hasSourceExplanation = false;
      let explanationObject: Record<string, string> = {};
      
      if (typeof question.explanation === "string" && question.explanation.trim()) {
        // 兼容历史数据：如果 explanation 还是 string，认为它就是源语言的解析
        hasSourceExplanation = true;
        explanationObject = { [sourceLanguage]: question.explanation.trim() };
      } else if (
        typeof question.explanation === "object" &&
        question.explanation !== null
      ) {
        explanationObject = { ...(question.explanation as any) };
        hasSourceExplanation = !!explanationObject[sourceLanguage];
      } else {
        explanationObject = {};
      }

      // 2️⃣ 如果还没有源语言解释，则尝试从 AI 输出中提取
      if (!hasSourceExplanation) {
        const extracted = getSourceExplanationFromAiOutput({
          parsed, // 使用 full_pipeline 解析后的原始 AI 响应对象
          sourceLanguage,
        });
        
        if (extracted) {
          explanationObject[sourceLanguage] = extracted;
          hasSourceExplanation = true;
          console.log(
            `[full_pipeline] question ${question.id} 补充源语言(${sourceLanguage}) explanation 来自 AI 输出`,
          );
        }
      } else {
        console.debug(
          `[processFullPipelineBatch] [Q${question.id}] [DEBUG] 保留源语言 explanation，不使用 AI 返回的 sourceExplanation（防止覆盖）`,
        );
      }
      
      // 3️⃣ 更新 question.explanation 对象，供后续使用
      if (Object.keys(explanationObject).length > 0) {
        question.explanation = explanationObject;
      }

      // 准备多语言翻译数据（暂不写入数据库，使用过滤后的数据）
      const translationsToSave: Array<{ lang: string; translation: any }> = [];
      if (sanitized.translations) {
        // 获取数据库中原有的源语言内容（不使用 AI 返回的 source）
        let dbSourceContent = "";
        let dbSourceOptions: any[] = [];
        let dbSourceExplanation = "";
        
        if (typeof question.content === "string") {
          dbSourceContent = question.content;
        } else if (typeof question.content === "object" && question.content !== null) {
          dbSourceContent = question.content[sourceLanguage] || "";
        }
        
        dbSourceOptions = Array.isArray(question.options) ? question.options : [];
        
        if (typeof question.explanation === "string") {
          dbSourceExplanation = question.explanation;
        } else if (typeof question.explanation === "object" && question.explanation !== null) {
          dbSourceExplanation = question.explanation[sourceLanguage] || "";
        }
        
        console.debug(
          `[processFullPipelineBatch] [Q${question.id}] [DEBUG] 使用数据库源内容进行翻译校验（不使用 AI 返回的 source）`,
        );
        
        // ✅ 精简：sanitize 已经保证只剩需要的语言，这里直接使用 sanitized.translations
        // 兜底检查：如果调用方忘记传 targetLanguages，这里做一次轻量 filter
        const translations = sanitized.translations || {};
        const entries = Object.entries(translations);
        const translationsToProcess =
          Array.isArray(targetLanguages) && targetLanguages.length > 0
            ? entries.filter(([lang]) => targetLanguages.includes(lang))
            : entries;
        
        // 遍历过滤后的翻译
        for (const [lang, t] of translationsToProcess) {
          if (!t || !t.content) {
            console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] 跳过语言 ${lang}（无翻译内容）`);
            continue;
          }

          // 使用统一约束函数进行翻译结果校验（使用数据库源内容）
          const constrained = enforceTranslationConstraints(
            {
              content: t.content,
              options: t.options,
              explanation: t.explanation,
            },
            {
              content: dbSourceContent,
              options: dbSourceOptions,
              explanation: dbSourceExplanation,
            },
            {
              sourceLanguage,
              targetLanguage: lang,
              type: type as QuestionType, // ✅ 修复：统一使用 type 字段
              hasOriginalOptions: dbSourceOptions.length > 0,
              hasOriginalExplanation: !!dbSourceExplanation,
            },
            {
              parsed, // 传入原始 AI 响应用于诊断
              sanitized, // 传入清洗后的 JSON 用于诊断
              questionId: question.id, // 传入题目 ID 用于诊断
              diagnostic, // ✅ A-2: 传入 diagnostic 对象用于填充错误信息
            },
          );

          translationsToSave.push({ lang, translation: constrained });
          console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] 语言 ${lang} 翻译校验完成`);
        }
      }
      
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 5: APPLY_AI_RESULT_TO_MODEL 完成 | 翻译语言数=${translationsToSave.length}`);

      // ========== STAGE 6: NORMALIZE_AND_VALIDATE_QUESTION ==========
      currentStage = "NORMALIZE_AND_VALIDATE_QUESTION";
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 6: NORMALIZE_AND_VALIDATE_QUESTION`);
      
      // 使用归一化函数构建题目（强制保证 correctAnswer 非空）
      let normalizedQuestion;
      try {
        normalizedQuestion = buildNormalizedQuestion({
          type: question.type,
          aiResult: {
            type: question.type,
            correct_answer: question.correct_answer,
            source: {
              content: sourceContent,
              options: sourceOptions,
              explanation: sourceExplanation,
            },
          },
          inputPayload: undefined, // full_pipeline 从 DB 跑，不一定有导入 payload
          currentQuestion: question, // ✅ Task 2: 把 DB 原题传进去，用于 correct_answer 兜底
        });
        console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] 归一化完成 | correctAnswer=${normalizedQuestion.correctAnswer ?? "null"}`);
      } catch (err: any) {
        // ✅ Task 3: 捕获 MISSING_CORRECT_ANSWER 错误，附加 debug 信息
        if (err?.message?.includes("MISSING_CORRECT_ANSWER")) {
          const debugInfo = {
            questionId: question.id,
            questionType: question.type,
            dbCorrectAnswer: question.correct_answer ?? null,
            aiCorrectAnswer:
              typeof parsed === "object"
                ? parsed?.correct_answer ?? null
                : null,
          };
          throw new Error(
            `MISSING_CORRECT_ANSWER | debug=${JSON.stringify(debugInfo)}`,
          );
        }
        throw err;
      }

      // 规范化题目（True/False options 清理等）
      const normalized = normalizeQuestionBeforeSave({
        id: question.id,
        type: normalizedQuestion.type,
        options: normalizedQuestion.options || [],
      });
      normalizedQuestion.options = normalized.options || [];
      
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 6: NORMALIZE_AND_VALIDATE_QUESTION 完成 | correctAnswer=${normalizedQuestion.correctAnswer ?? "null"}`);

      // ========== STAGE 7: SAVE_ALL_CHANGES_IN_TX ==========
      currentStage = "SAVE_ALL_CHANGES_IN_TX";
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 7: SAVE_ALL_CHANGES_IN_TX`);
      
      // ✅ Task 2: 构建 full_pipeline 的数据库落库结构
      const dbPayload = buildFullPipelineDbPayload(sanitized, {
        sourceLang: sourceLanguage,
        targetLangs: targetLanguages,
      });
      console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] 构建的 DB payload:`, JSON.stringify(dbPayload, null, 2));
      
      const { db } = await import("@/lib/db");
      const { saveQuestionToDb } = await import("@/lib/questionDb");
      
      // ✅ 使用事务确保保存到 questions 与 translations 的一致性
      // ✅ Task 4: 在事务前读取原题目数据，用于错误诊断
      // ✅ 修复：合并重复查询，一次查询获取所有需要的数据
      dbRowBefore = await db
        .selectFrom("questions")
        .select(["id", "stage_tag", "topic_tags", "license_type_tag", "content", "explanation"])
        .where("id", "=", question.id)
        .executeTakeFirst();
      
      // ✅ 修复：构建传给 saveQuestionToDb 的 payload，优先使用 dbPayload 中的值
      // 使用 dbRowBefore 中的 explanation，避免重复查询
      const savePayload: any = {
        id: question.id,
        hash: question.content_hash,
        type: normalizedQuestion.type,
        content: question.content,
        options: normalizedQuestion.options,
        correctAnswer: normalizedQuestion.correctAnswer,
        explanation: dbRowBefore?.explanation || null,
        mode: "updateOnly",
      };

      // ✅ 修复：优先使用 dbPayload 中的 license_type_tag（数据库字段名）
      if (dbPayload.license_type_tag !== null && dbPayload.license_type_tag !== undefined) {
        savePayload.license_type_tag = dbPayload.license_type_tag;
      }

      // ✅ 修复：优先使用 dbPayload 中的 stage_tag
      if (dbPayload.stage_tag !== null && dbPayload.stage_tag !== undefined) {
        savePayload.stage_tag = dbPayload.stage_tag;
      }

      // ✅ 修复：优先使用 dbPayload 中的 topic_tags
      if (dbPayload.topic_tags !== null && dbPayload.topic_tags !== undefined) {
        savePayload.topic_tags = dbPayload.topic_tags;
      } else if ((question as any).topic_tags !== null && (question as any).topic_tags !== undefined) {
        savePayload.topic_tags = (question as any).topic_tags;
      }

      // ✅ 添加调试日志
      console.log(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] 准备保存 tags:`, {
        dbPayload_license_type_tag: dbPayload.license_type_tag,
        dbPayload_stage_tag: dbPayload.stage_tag,
        dbPayload_topic_tags: dbPayload.topic_tags,
        savePayload_license_type_tag: savePayload.license_type_tag,
        savePayload_stage_tag: savePayload.stage_tag,
        savePayload_topic_tags: savePayload.topic_tags,
      });

      dbUpdatePayload = savePayload;
      
      await db.transaction().execute(async (trx) => {
        // 先读取数据库中的 explanation（保留原有内容）
        const dbQuestion = await trx
          .selectFrom("questions")
          .select(["explanation"])
          .where("id", "=", question.id)
          .executeTakeFirst();
        
        // 1. 保存题目主表
        // ⚠️ 重要：传入数据库中的原有 explanation，让事务的第二步来添加新翻译
        // ✅ 修复：传入原始的 content_hash 作为 hash 字段，确保通过 content_hash 查找题目
        // ✅ 修复：使用 dbPayload 中的 license_type_tag 和 stage_tag（数据库字段名）
        await saveQuestionToDb({
          ...savePayload,
          explanation: dbQuestion?.explanation || null, // ✅ 使用数据库中的原有 explanation
        } as any);
        
        // 2. 保存多语言翻译（在事务中直接更新，不使用 saveQuestionTranslation 函数）
        // ✅ 在进入翻译循环之前，先基于 explanationObject 初始化 updatedExplanation
        // 获取当前题目内容（用于 content 更新）
        const currentQuestion = await trx
          .selectFrom("questions")
          .select(["content", "explanation"])
          .where("id", "=", question.id)
          .executeTakeFirst();
        
        if (!currentQuestion) {
          throw new Error(`Question with id ${question.id} not found in transaction`);
        }
        
        // 初始化 updatedExplanation，优先使用 explanationObject（包含从 AI 提取的源语言 explanation）
        let updatedExplanation: any = null;
        if (explanationObject && Object.keys(explanationObject).length > 0) {
          updatedExplanation = { ...explanationObject };
        } else if (currentQuestion.explanation) {
          // 如果 explanationObject 为空，使用数据库中的原有 explanation
          if (typeof currentQuestion.explanation === "object" && currentQuestion.explanation !== null) {
            updatedExplanation = { ...(currentQuestion.explanation as any) };
          } else if (typeof currentQuestion.explanation === "string") {
            updatedExplanation = { [sourceLanguage]: currentQuestion.explanation };
          } else {
            updatedExplanation = {};
          }
        } else {
          updatedExplanation = {};
        }
        
        // 初始化 updatedContent，用于累积所有语言的翻译
        let updatedContent: any;
        if (typeof currentQuestion.content === "object" && currentQuestion.content !== null) {
          updatedContent = { ...currentQuestion.content };
        } else if (typeof currentQuestion.content === "string") {
          updatedContent = { [sourceLanguage]: currentQuestion.content };
        } else {
          updatedContent = {};
        }
        
        for (const { lang, translation } of translationsToSave) {
          // ✅ Phase 1.3 修复：确保翻译写入逻辑严格区分
          // 示例结构：lang = 'en', sourceLanguage = 'zh'
          
          // 0）检查翻译是否有效（content 不为 null）
          if (!translation.content || translation.content === null) {
            console.warn(
              `[processFullPipelineBatch] [Q${question.id}] ⚠️ 语言 ${lang} 的翻译内容为空或无效（AI 未翻译），跳过`,
            );
            continue;
          }
          
          // 1）lang 必须在 targetLanguages 中，否则跳过
          if (!targetLanguages.includes(lang)) {
            console.warn(
              `[processFullPipelineBatch] [Q${question.id}] ⚠️ 语言 ${lang} 不在目标翻译语言列表中，跳过`,
            );
            continue;
          }

          // 2）lang 不能等于 sourceLanguage（防止把翻译写回源语言 key）
          if (lang === sourceLanguage) {
            console.warn(
              `[full_pipeline] 翻译语言 ${lang} 等于源语言 ${sourceLanguage}，作为翻译跳过（源语言解析已由 getSourceExplanationFromAiOutput 处理）`,
            );
            continue;
          }
          
          // 3）检查翻译内容的语言是否匹配目标语言（防止中文写入 ja/en）
          const translatedContent = String(translation.content);
          const isContentChinese = isChineseContent(translatedContent);
          const isContentEnglish = isEnglishContent(translatedContent);
          
          if (lang === "zh" && !isContentChinese) {
            console.warn(
              `[processFullPipelineBatch] [Q${question.id}] ⚠️ 目标语言为 zh，但翻译内容不是中文，跳过`,
            );
            continue;
          }
          
          if (lang === "en" && !isContentEnglish) {
            console.warn(
              `[processFullPipelineBatch] [Q${question.id}] ⚠️ 目标语言为 en，但翻译内容不是英文，跳过`,
            );
            continue;
          }
          
          if (lang === "ja" && isContentChinese) {
            console.warn(
              `[processFullPipelineBatch] [Q${question.id}] ⚠️ 目标语言为 ja，但翻译内容是中文，跳过`,
            );
            continue;
          }
          
          if ((lang === "ja" || lang === "ko") && isContentEnglish) {
            console.warn(
              `[processFullPipelineBatch] [Q${question.id}] ⚠️ 目标语言为 ${lang}，但翻译内容是英文，跳过`,
            );
            continue;
          }

          // 更新 content JSONB 对象，添加目标语言（累积更新）
          // ✅ 修复：确保content是有效的字符串
          if (translation.content && typeof translation.content === "string") {
            updatedContent[lang] = translation.content;
          } else if (translation.content !== null && translation.content !== undefined) {
            updatedContent[lang] = String(translation.content);
          }
          
          // ✅ Phase 1.3 修复：更新 explanation JSONB 对象，添加目标语言
          // 使用已初始化的 updatedExplanation 作为基础，只添加目标语言的 explanation
          if (translation.explanation && translation.explanation !== null) {
            const explanationStr = typeof translation.explanation === "string"
              ? translation.explanation
              : String(translation.explanation);
            
            // 检查 explanation 的语言是否匹配目标语言
            const isExplanationChinese = isChineseContent(explanationStr);
            const isExplanationEnglish = isEnglishContent(explanationStr);
            
            let shouldSaveExplanation = true;
            
            if (lang === "zh" && !isExplanationChinese) {
              console.warn(
                `[processFullPipelineBatch] [Q${question.id}] ⚠️ 目标语言为 zh，但 explanation 不是中文，跳过写入`,
              );
              shouldSaveExplanation = false;
            }
            
            if (lang === "en" && !isExplanationEnglish) {
              console.warn(
                `[processFullPipelineBatch] [Q${question.id}] ⚠️ 目标语言为 en，但 explanation 不是英文，跳过写入`,
              );
              shouldSaveExplanation = false;
            }
            
            if (lang === "ja" && isExplanationChinese) {
              console.warn(
                `[processFullPipelineBatch] [Q${question.id}] ⚠️ 目标语言为 ja，但 explanation 是中文，跳过写入`,
              );
              shouldSaveExplanation = false;
            }
            
            if ((lang === "ja" || lang === "ko") && isExplanationEnglish) {
              console.warn(
                `[processFullPipelineBatch] [Q${question.id}] ⚠️ 目标语言为 ${lang}，但 explanation 是英文，跳过写入`,
              );
              shouldSaveExplanation = false;
            }
            
            if (shouldSaveExplanation) {
              // 使用 buildUpdatedExplanationWithGuard 来更新 explanation，确保语言一致性
              updatedExplanation = buildUpdatedExplanationWithGuard({
                currentExplanation: updatedExplanation, // 使用已初始化的 updatedExplanation（包含源语言 explanation）
                newExplanation: explanationStr,
                sourceLanguage,
                targetLang: lang, // full_pipeline 中的目标语言
              });
            }
            // 如果 shouldSaveExplanation 为 false，保持 updatedExplanation 不变（已包含源语言 explanation）
          }
          
          // ✅ 使用 sanitizeJsonForDb 统一清理 JSONB 数据，确保不包含 undefined
          // 在写入事务前做一次轻量验证
          const safeContent = sanitizeJsonForDb(updatedContent);
          const safeExplanation = sanitizeJsonForDb(updatedExplanation);
          
          // ✅ Task 4: 记录保存入库前的日志（展示清洗后的 JSON）
          if (onLog) {
            await onLog(question.id, {
              step: 'DB_WRITE_BEFORE',
              cleanedJsonPreview: JSON.stringify({
                content: JSON.stringify(safeContent ?? {}).substring(0, 500),
                explanation: JSON.stringify(safeExplanation ?? {}).substring(0, 500),
              }),
              trace_id: batchTraceId, // ✅ Task 4: 添加 trace_id
            });
          }
          
          // 轻量验证：能否被 JSON.stringify（用于提前发现 BigInt 等不支持类型）
          try {
            JSON.stringify(safeContent ?? {});
            JSON.stringify(safeExplanation ?? {});
          } catch (jsonError) {
            console.error(`[processFullPipelineBatch] [Q${question.id}] JSON验证失败:`, jsonError);
            throw new Error(`JSON格式错误: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
          }
          
          // 在事务中更新题目（使用清理后的安全数据）
          await trx
            .updateTable("questions")
            .set({
              content: safeContent as any,
              explanation: safeExplanation as any,
              updated_at: new Date(),
            })
            .where("id", "=", question.id)
            .execute();
          
          console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] 语言 ${lang} 翻译已在事务中保存`);
        }
        
        // ✅ 如果没有任何翻译需要保存，但源语言的 explanation 已被补充，也需要更新数据库
        if (translationsToSave.length === 0 && updatedExplanation && Object.keys(updatedExplanation).length > 0) {
          const hasSourceExplanationInUpdated = !!updatedExplanation[sourceLanguage];
          const hasSourceExplanationInDb = currentQuestion.explanation && 
            (typeof currentQuestion.explanation === "object" && currentQuestion.explanation !== null
              ? !!(currentQuestion.explanation as any)[sourceLanguage]
              : typeof currentQuestion.explanation === "string");
          
          if (hasSourceExplanationInUpdated && !hasSourceExplanationInDb) {
            // ✅ 使用 sanitizeJsonForDb 清理 explanation
            const safeExplanationForSource = sanitizeJsonForDb(updatedExplanation);
            await trx
              .updateTable("questions")
              .set({
                explanation: safeExplanationForSource as any,
                updated_at: new Date(),
              })
              .where("id", "=", question.id)
              .execute();
            
            console.debug(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] 无翻译需要保存，但已补充源语言(${sourceLanguage}) explanation`);
          }
        }
      });
      
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 7: SAVE_ALL_CHANGES_IN_TX 完成 | 翻译语言数=${translationsToSave.length}`);
      
      // 📊 调试日志：输出最终入库的数据
      const finalDbData = await db
        .selectFrom("questions")
        .select(["content", "explanation", "license_type_tag", "stage_tag", "topic_tags"])
        .where("id", "=", question.id)
        .executeTakeFirst();
      const processedDataDebug = {
        questionId: question.id,
        content: finalDbData?.content,
        explanation: finalDbData?.explanation,
        license_tags: finalDbData?.license_type_tag,
        stage_tag: finalDbData?.stage_tag,
        topic_tags: finalDbData?.topic_tags,
      };
      console.log(`[processFullPipelineBatch] [Q${question.id}] 📊 最终入库数据:`, JSON.stringify(processedDataDebug, null, 2));
      
      // 📊 调用回调函数保存调试数据到数据库
      // ✅ Task 2: 使用构建的 dbPayload 作为 processed_data
      if (onProgress) {
        await onProgress(question.id, {
          aiRequest: aiRequestDebug,
          aiResponse: aiResponseDebug,
          processedData: dbPayload, // ✅ Task 2: 使用构建的 DB payload，字段名已映射为数据库字段
        });
      }

      // ========== STAGE 8: FINALIZE_RESULT ==========
      currentStage = "FINALIZE_RESULT";
      const totalDuration = Date.now() - startTime;
      const summary = {
        questionId: question.id,
        stage: currentStage,
        success: true,
        duration: totalDuration,
        aiProvider,
        aiCorrectAnswerUsed,
        translationsCount: translationsToSave.length,
        tagsApplied: !!parsed.tags,
      };
      
      console.log(`[processFullPipelineBatch] [Q${question.id}] STAGE 8: FINALIZE_RESULT | 成功 | 总耗时=${totalDuration}ms | provider=${aiProvider} | 翻译数=${translationsToSave.length}`);
      results.push({ questionId: question.id, success: true });
    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      const failedStage = currentStage || "UNKNOWN";
      
      console.error(`[processFullPipelineBatch] [Q${question.id}] STAGE 8: FINALIZE_RESULT | 失败 | 失败阶段=${failedStage} | 总耗时=${totalDuration}ms | 错误:`, error);
      
      // ✅ 增强错误处理：针对 MISSING_CORRECT_ANSWER 错误提供详细信息和修复建议
      let errorMessage = error instanceof Error ? error.message : String(error);
      let errorCode = "PROCESSING_FAILED";
      
      if (errorMessage.includes("MISSING_CORRECT_ANSWER")) {
        errorCode = "MISSING_CORRECT_ANSWER";
        // 解析错误信息，提取题目类型、三层 correct_answer 值
        const errorMatch = errorMessage.match(/questionType=(\w+)/);
        const questionType = errorMatch ? errorMatch[1] : question.type || "unknown";
        
        // 提取各层 correct_answer 值
        const inputPayloadMatch = errorMessage.match(/inputPayload=([^|]+)/);
        const dbMatch = errorMessage.match(/db=([^|]+)/);
        const aiMatch = errorMessage.match(/ai=([^|]+)/);
        const suggestionMatch = errorMessage.match(/suggestion=([^|]+)/);
        
        const inputPayloadValue = inputPayloadMatch ? inputPayloadMatch[1] : "null";
        const dbValue = dbMatch ? dbMatch[1] : "null";
        const aiValue = aiMatch ? aiMatch[1] : "null";
        const suggestion = suggestionMatch ? suggestionMatch[1] : "请为该题补充正确答案。";
        
        // 构造友好的错误信息
        errorMessage = `MISSING_CORRECT_ANSWER | 题目ID: ${question.id} | 题目类型: ${questionType} | 输入层: ${inputPayloadValue} | 数据库层: ${dbValue} | AI层: ${aiValue} | 修复建议: ${suggestion} | 请在后台补齐该题的正确答案再重新运行任务`;
        
        console.error(`[processFullPipelineBatch] [Q${question.id}] [DEBUG] MISSING_CORRECT_ANSWER 详细信息:`, {
          questionId: question.id,
          questionType,
          inputPayloadCorrectAnswer: inputPayloadValue,
          dbCorrectAnswer: dbValue,
          aiCorrectAnswer: aiValue,
          suggestion,
        });
      } else if (errorMessage.includes("AI_JSON_PARSE_FAILED")) {
        errorCode = "AI_JSON_PARSE_FAILED";
      } else if (errorMessage.includes("AI_VALIDATION_FAILED")) {
        errorCode = "AI_VALIDATION_FAILED";
      } else if (errorMessage.includes("LOAD_QUESTION_FAILED")) {
        errorCode = "LOAD_QUESTION_FAILED";
      } else if (errorMessage.includes("TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE")) {
        errorCode = "TRANSLATION_FAILED_WRONG_TARGET_LANGUAGE";
      }
      
      // ✅ Task 4: 针对 invalid input syntax for type json 错误，记录详细诊断信息
      if (errorMessage.includes("invalid input syntax for type json") || failedStage === "SAVE_ALL_CHANGES_IN_TX") {
        errorCode = "PROCESSING_FAILED";
        // 记录 dbUpdatePayload 和 dbRowBefore 到 diagnostic（仅在已定义且不为 null 时）
        if (!diagnostic.dbUpdatePayload && dbUpdatePayload !== undefined && dbUpdatePayload !== null) {
          // ✅ 修复：安全地展开对象，避免 null 或 undefined 导致的错误
          const safePayload = typeof dbUpdatePayload === "object" && dbUpdatePayload !== null ? dbUpdatePayload : {};
          diagnostic.dbUpdatePayload = {
            ...safePayload,
            // 简化 content 和 explanation 的预览（避免过大）
            // ✅ 修复：检查 null 和数组，避免 Object.keys(null) 错误
            contentPreview: (typeof dbUpdatePayload.content === "object" && dbUpdatePayload.content !== null && !Array.isArray(dbUpdatePayload.content))
              ? Object.keys(dbUpdatePayload.content).join(",")
              : (dbUpdatePayload.content ? String(dbUpdatePayload.content).substring(0, 100) : "null"),
            explanationPreview: (typeof dbUpdatePayload.explanation === "object" && dbUpdatePayload.explanation !== null && !Array.isArray(dbUpdatePayload.explanation))
              ? Object.keys(dbUpdatePayload.explanation).join(",")
              : (dbUpdatePayload.explanation ? String(dbUpdatePayload.explanation).substring(0, 100) : "null"),
          };
        }
        if (!diagnostic.dbRowBefore && dbRowBefore !== undefined && dbRowBefore !== null) {
          diagnostic.dbRowBefore = {
            id: dbRowBefore.id,
            stage_tag: dbRowBefore.stage_tag,
            topic_tags: dbRowBefore.topic_tags,
            license_type_tag: dbRowBefore.license_type_tag,
            // ✅ 修复：检查 null 和数组，避免 Object.keys(null) 错误
            contentPreview: (typeof dbRowBefore.content === "object" && dbRowBefore.content !== null && !Array.isArray(dbRowBefore.content))
              ? Object.keys(dbRowBefore.content).join(",")
              : (dbRowBefore.content ? String(dbRowBefore.content).substring(0, 100) : "null"),
            explanationPreview: (typeof dbRowBefore.explanation === "object" && dbRowBefore.explanation !== null && !Array.isArray(dbRowBefore.explanation))
              ? Object.keys(dbRowBefore.explanation).join(",")
              : (dbRowBefore.explanation ? String(dbRowBefore.explanation).substring(0, 100) : "null"),
          };
        }
      }
      
      // ✅ A-2: 填充 diagnostic 的 errorMessage 和 errorStack（如果还没有填充）
      if (!diagnostic.errorMessage) {
        diagnostic.errorMessage = errorMessage;
      }
      if (!diagnostic.errorStack) {
        diagnostic.errorStack = error instanceof Error ? error.stack ?? null : null;
      }
      if (!diagnostic.errorCode) {
        diagnostic.errorCode = errorCode;
      }
      if (!diagnostic.errorStage) {
        diagnostic.errorStage = failedStage;
      }
      
      // ✅ A-2: 通过 onProgress 回调传递 error_detail
      if (onProgress) {
        try {
          await onProgress(question.id, {
            errorDetail: diagnostic, // 传递诊断信息
          } as any);
        } catch (progressError) {
          console.error(`[processFullPipelineBatch] [Q${question.id}] 保存 error_detail 失败:`, progressError);
        }
      }
      
      const summary = {
        questionId: question.id,
        stage: failedStage,
        success: false,
        duration: totalDuration,
        errorCode,
        error: errorMessage,
      };
      
      results.push({
        questionId: question.id,
        success: false,
        error: errorMessage,
      });
    }
  }

  console.log(`[processFullPipelineBatch] 处理完成 | 总数=${questions.length} | 成功=${results.filter(r => r.success).length} | 失败=${results.filter(r => !r.success).length}`);
  return results;
}
