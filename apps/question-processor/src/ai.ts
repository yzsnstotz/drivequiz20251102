import { z } from "zod";
import { callAiServer } from "../../src/lib/aiClient.server";
import { loadQpAiConfig, type QpAiProvider } from "./aiConfig";
import { getAiCache, setAiCache } from "./aiCache";
import { buildQuestionTranslationInput, buildQuestionPolishInput } from "../../src/lib/questionPromptBuilder";
import { normalizeAIResult } from "../../src/lib/quizTags";

// 在模块级提前加载一次配置（question-processor 通常是长跑任务，这样没问题）
const qpAiConfig = loadQpAiConfig();

// 可选：在首次加载时打印一行日志
// eslint-disable-next-line no-console
console.log("[question-processor] AI config:", {
  provider: qpAiConfig.provider,
  renderModel: qpAiConfig.renderModel,
  localModel: qpAiConfig.localModel,
  cacheEnabled: qpAiConfig.cacheEnabled,
  cacheTtlMs: qpAiConfig.cacheTtlMs,
});

const AskSchema = z.object({
  question: z.string(),
  lang: z.string().optional(),
  userId: z.string().optional(),
  meta: z.any().optional()
});

type AskBody = z.infer<typeof AskSchema>;

export interface TranslateResult {
  content: string;
  options?: string[];
  explanation?: string;
}

/**
 * 统一的 AI 调用封装（带配置和缓存）
 * @param params AI 调用参数
 * @returns AI 响应数据
 */
export async function callQuestionAi(params: {
  scene: string;
  questionText: string;
  locale?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  extraPayload?: Record<string, any>;
}): Promise<{ answer: string; explanation?: string; sources?: any[] }> {
  const { scene, questionText, locale, sourceLanguage, targetLanguage, extraPayload } = params;

  const provider = qpAiConfig.provider;
  const model =
    provider === "local" ? qpAiConfig.localModel : qpAiConfig.renderModel;

  // 1. 尝试命中缓存
  if (qpAiConfig.cacheEnabled) {
    const cached = getAiCache<{ answer: string; explanation?: string; sources?: any[] }>({
      scene,
      provider,
      model,
      questionText,
      sourceLanguage,
      targetLanguage,
    });
    if (cached) {
      // eslint-disable-next-line no-console
      console.log(
        "[question-processor] AI cache hit:",
        scene,
        provider,
        model,
        sourceLanguage,
        targetLanguage,
      );
      return cached;
    }
  }
  
  // 2. 调用 ai-service（通过 callAiServer）
  const aiResp = await callAiServer<{ answer: string; explanation?: string; sources?: any[] }>({
    provider, // "local" | "render"
    scene,
    model,
    question: questionText,
    locale: locale || "zh-CN",
    sourceLanguage,
    targetLanguage,
    ...extraPayload,
  });

  if (!aiResp.ok || !aiResp.data) {
    // 根据现有日志方式保持一致
    // eslint-disable-next-line no-console
    console.error(
      "[question-processor] AI 调用失败:",
      scene,
      provider,
      model,
      aiResp.message,
    );
    throw new Error(
      aiResp.message ??
        `[question-processor] AI 调用失败（scene=${scene}, provider=${provider}, model=${model})`,
    );
  }
  
  const result = aiResp.data;

  // 3. 写入缓存
  if (qpAiConfig.cacheEnabled) {
    setAiCache(
      {
        scene,
        provider,
        model,
        questionText,
        sourceLanguage,
        targetLanguage,
      },
      result,
      qpAiConfig.cacheTtlMs,
    );
  }

  return result;
}

/**
 * 调用 ai-service（直接调用，不再通过主站 /api/ai/ask）
 * 使用统一封装 callQuestionAi（带配置和缓存）
 * @deprecated 建议直接使用 callQuestionAi
 */
export async function askAi(body: AskBody & { scene?: string; sourceLanguage?: string; targetLanguage?: string }): Promise<any> {
  const result = await callQuestionAi({
    scene: body.scene || "default",
    questionText: body.question,
      locale: body.lang || "zh-CN",
    sourceLanguage: body.sourceLanguage,
    targetLanguage: body.targetLanguage,
  });

  // 返回格式兼容旧接口
  return result;
}

export async function translateWithPolish(params: {
  source: { content: string; options?: string[]; explanation?: string };
  from: string;
  to: string;
  questionType?: "single" | "multiple" | "truefalse"; // 题目类型，用于区分是非题
}): Promise<TranslateResult> {
  const { source, from, to, questionType } = params;
  // 使用场景配置，场景配置中的 prompt 已经包含了翻译要求
  // 源语言和目标语言通过 sourceLanguage 和 targetLanguage 参数传递，会在系统 prompt 中动态替换
  // 这里只需要传递题目内容，场景配置会自动应用
  
  // 使用统一的题目拼装工具
  const questionText = buildQuestionTranslationInput({
    stem: source.content,
    options: source.options,
    explanation: source.explanation,
    sourceLanguage: from,
    targetLanguage: to,
    questionType: questionType, // 传递题目类型
  });

  // 使用统一的 callQuestionAi 封装（带配置和缓存）
  const data = await callQuestionAi({
    scene: "question_translation", // 使用翻译场景配置
    questionText,
    locale: to,
    sourceLanguage: from, // 源语言（会在系统 prompt 中动态替换占位符）
    targetLanguage: to // 目标语言（会在系统 prompt 中动态替换占位符）
  });

  // Try parse JSON content from the answer
  let parsed: any = null;
  try {
    parsed = JSON.parse(data.answer);
  } catch {
    // try extract code fence
    const m = data.answer.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (m) {
      parsed = JSON.parse(m[1]);
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI translation response missing JSON body");
  }
  return {
    content: String(parsed.content ?? "").trim(),
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : undefined,
    explanation: parsed.explanation ? String(parsed.explanation) : undefined
  };
}

export async function polishContent(params: {
  text: { content: string; options?: string[]; explanation?: string };
  locale: string;
}): Promise<TranslateResult> {
  const { text, locale } = params;
  // 使用场景配置，场景配置中的 prompt 已经包含了润色要求
  // 这里只需要传递题目内容，场景配置会自动应用
  
  // 使用统一的题目拼装工具
  const input = buildQuestionPolishInput({
    stem: text.content,
    options: text.options,
    explanation: text.explanation,
    language: locale,
  });

  // 使用统一的 callQuestionAi 封装（带配置和缓存）
  const data = await callQuestionAi({
    scene: "question_polish", // 使用润色场景配置
    questionText: input,
    locale: locale,
  });

  let parsed: any = null;
  try {
    parsed = JSON.parse(data.answer);
  } catch {
    const m = data.answer.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (m) {
      parsed = JSON.parse(m[1]);
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI polish response missing JSON body");
  }
  return {
    content: String(parsed.content ?? "").trim(),
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : undefined,
    explanation: parsed.explanation ? String(parsed.explanation) : undefined
  };
}

export interface CategoryAndTagsResult {
  license_type_tag?: string[] | null; // 驾照类型标签（数组，可包含多个值）
  stage_tag?: "both" | "provisional" | "regular" | "full" | null; // 阶段标签（兼容旧值）
  topic_tags?: string[] | null; // 主题标签数组
  // 以下字段已废弃，保留用于兼容
  category?: string | null; // 已废弃：category 是卷类，不是标签
}

/**
 * 使用AI生成题目的分类和标签
 */
export async function generateCategoryAndTags(params: {
  content: string;
  options?: string[] | null;
  explanation?: string | null;
  locale?: string;
}): Promise<CategoryAndTagsResult> {
  const { content, options, explanation, locale = "zh-CN" } = params;
  
  const input = [
    `Content: ${content}`,
    options && options.length ? `Options:\n- ${options.join("\n- ")}` : ``,
    explanation ? `Explanation: ${explanation}` : ``
  ].filter(Boolean).join("\n");

  // 使用统一的 callQuestionAi 封装（带配置和缓存）
  const data = await callQuestionAi({
    scene: "question_category_tags", // 使用分类标签场景配置
    questionText: input,
    locale: locale,
  });

  let parsed: any = null;
  try {
    parsed = JSON.parse(data.answer);
  } catch {
    const m = data.answer.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (m) {
      parsed = JSON.parse(m[1]);
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI category/tags response missing JSON body");
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
  
  return {
    license_type_tag: normalized.licenseTypeTag,
    stage_tag: stageTag,
    topic_tags: normalized.topicTags,
    // 以下字段已废弃，保留 null 用于兼容
    category: null, // category 是卷类，不是标签，不再从 AI 获取
  };
}

/**
 * 使用AI填充缺失的内容（填漏）
 */
export async function fillMissingContent(params: {
  content: string;
  options?: string[] | null;
  explanation?: string | null;
  locale?: string;
}): Promise<TranslateResult> {
  const { content, options, explanation, locale = "zh-CN" } = params;
  
  const input = [
    `Content: ${content || "[缺失]"}`,
    options && options.length ? `Options:\n- ${options.join("\n- ")}` : `Options: [缺失]`,
    explanation ? `Explanation: ${explanation}` : `Explanation: [缺失]`
  ].filter(Boolean).join("\n");

  // 使用统一的 callQuestionAi 封装（带配置和缓存）
  const data = await callQuestionAi({
    scene: "question_fill_missing", // 使用填漏场景配置
    questionText: input,
    locale: locale,
  });

  let parsed: any = null;
  try {
    parsed = JSON.parse(data.answer);
  } catch {
    const m = data.answer.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (m) {
      parsed = JSON.parse(m[1]);
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI fill missing response missing JSON body");
  }
  
  return {
    content: String(parsed.content ?? content ?? "").trim(),
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : (options || undefined),
    explanation: parsed.explanation ? String(parsed.explanation) : (explanation || undefined)
  };
}


