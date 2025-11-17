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
  options?: string[];
  explanation?: string;
}

export interface CategoryAndTagsResult {
  category?: string | null;
  stage_tag?: "both" | "provisional" | "regular" | null;
  topic_tags?: string[] | null;
  license_types?: string[] | null;
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
async function getCurrentAiProviderConfig(): Promise<{ provider: ServerAiProviderKey; model?: string }> {
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
        console.log(`[callAiAskInternal] 准备调用 AI 服务:`, {
          provider,
          scene: params.scene,
          sourceLanguage: params.sourceLanguage,
          targetLanguage: params.targetLanguage,
          locale: params.locale,
        });
        const aiResp = await callAiServer<{ answer: string; aiProvider?: string; model?: string }>(
          {
            provider,
              question: params.question,
              locale: params.locale || "zh-CN",
              scene: params.scene,
              sourceLanguage: params.sourceLanguage,
              targetLanguage: params.targetLanguage,
            model: model,
          },
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
          throw new Error(aiResp.message || "AI call failed");
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
  questionType?: "single" | "multiple" | "truefalse"; // 题目类型，用于区分是非题
  adminToken?: string; // 管理员 token，用于跳过配额限制
  returnDetail?: boolean; // 是否返回详细信息
  mode?: "batch" | "single"; // 调用模式：batch（批量处理）或 single（单题操作）
}): Promise<TranslateResult | { result: TranslateResult; detail: SubtaskDetail }> {
  const { source, from, to, adminToken, returnDetail } = params;
  
  // 验证 from 和 to 参数，并提供默认值
  const sourceLang = from || "zh"; // 默认使用中文作为源语言
  const targetLang = to;
  
  if (!targetLang) {
    throw new Error(`translateWithPolish: to (targetLanguage) is required. Got from=${from}, to=${to}`);
  }
  
  console.log(`[translateWithPolish] 接收到的参数:`, {
    from,
    to,
    sourceLang, // 处理后的值
    targetLang, // 处理后的值
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
    sourceLanguage: sourceLang,
    targetLanguage: targetLang,
    questionType: params.questionType, // 传递题目类型
  });

  const sceneKey = "question_translation";
  let sceneConfig: { prompt: string; outputFormat: string | null; sceneName: string } | null = null;
  
  if (returnDetail) {
    sceneConfig = await getSceneConfig(sceneKey, to);
  }

  // ✅ 根据调用模式决定超时策略
  const callMode = params.mode || "single"; // 默认为 single，批量处理需显式传入 "batch"
  
  console.log(`[translateWithPolish] 准备调用 AI:`, {
    from,
    to,
    sourceLang, // 处理后的值（有默认值）
    targetLang, // 处理后的值
    sceneKey,
    questionLength: questionText.length,
    hasSourceLanguage: sourceLang !== undefined && sourceLang !== null && sourceLang !== "",
    hasTargetLanguage: targetLang !== undefined && targetLang !== null && targetLang !== "",
  });
  
  const data = await callAiAskInternal(
    {
      question: questionText,
      locale: targetLang, // 使用处理后的值
      scene: sceneKey,
      sourceLanguage: sourceLang, // 使用处理后的值（确保有值）
      targetLanguage: targetLang, // 使用处理后的值（确保有值）
      adminToken,
    },
    { mode: callMode, retries: 1 }
  );

  // 提取 AI provider 和 model 信息
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
    parsed = JSON.parse(rawAnswer);
  } catch (parseError) {
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
        parsed = JSON.parse(fixedJson);
      }
    } catch {
      // 如果修复后仍然失败，尝试将整个响应作为纯文本内容处理
      // 这种情况可能是AI没有按照JSON格式返回，而是直接返回了翻译文本
      const trimmedAnswer = rawAnswer.trim();
      if (trimmedAnswer.length > 0) {
        console.warn(`[translateWithPolish] AI response is not JSON format, treating as plain text. Response length: ${trimmedAnswer.length}`);
        console.warn(`[translateWithPolish] Response preview: ${trimmedAnswer.substring(0, 200)}`);
        
        // 将纯文本作为content字段
        // 注意：如果AI只返回了纯文本，我们假设它只翻译了content部分
        // options和explanation保持原样（如果源语言有的话，后续可能需要单独翻译）
        parsed = {
          content: trimmedAnswer,
          // 不设置options和explanation，让它们保持undefined
          // 这样至少能保存content的翻译结果
        };
      } else {
        // 如果修复后仍然失败，记录完整响应用于调试
        console.error(`[translateWithPolish] Failed to parse AI response. Full response length: ${data.answer.length}`);
        console.error(`[translateWithPolish] Response preview: ${data.answer.substring(0, 500)}`);
        throw new Error("AI translation response missing JSON body");
      }
    }
  }
  
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI translation response missing JSON body");
  }
  
  // 验证 content 字段是否存在且非空
  const contentStr = String(parsed.content ?? "").trim();
  if (!contentStr) {
    throw new Error("AI translation response missing content field");
  }
  
  const result: TranslateResult = {
    content: contentStr,
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : undefined,
    explanation: parsed.explanation ? String(parsed.explanation) : undefined,
  };

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
 * 润色内容
 */
export async function polishContent(params: {
  text: { content: string; options?: string[]; explanation?: string };
  locale: string;
  adminToken?: string; // 管理员 token，用于跳过配额限制
  returnDetail?: boolean; // 是否返回详细信息
  mode?: "batch" | "single"; // 调用模式：batch（批量处理）或 single（单题操作）
}): Promise<TranslateResult | { result: TranslateResult; detail: SubtaskDetail }> {
  const { text, locale } = params;
  
  // 使用统一的题目拼装工具
  const input = buildQuestionPolishInput({
    stem: text.content,
    options: text.options,
    explanation: text.explanation,
    language: locale,
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
    parsed = JSON.parse(rawAnswer);
  } catch (parseError) {
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
        parsed = JSON.parse(fixedJson);
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

  const result: CategoryAndTagsResult = {
    category: parsed.category ? String(parsed.category) : null,
    stage_tag: parsed.stage_tag && ["both", "provisional", "regular"].includes(parsed.stage_tag)
      ? parsed.stage_tag
      : null,
    topic_tags: Array.isArray(parsed.topic_tags)
      ? parsed.topic_tags.map((s: any) => String(s)).filter(Boolean)
      : null,
    license_types: Array.isArray(parsed.license_types) || Array.isArray(parsed.license_tags)
      ? (parsed.license_types || parsed.license_tags).map((s: any) => String(s)).filter(Boolean)
      : null,
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
  questionType?: "single" | "multiple" | "truefalse"; // 题目类型
  adminToken?: string; // 管理员 token，用于跳过配额限制
  returnDetail?: boolean; // 是否返回详细信息
  mode?: "batch" | "single"; // 调用模式：batch（批量处理）或 single（单题操作）
}): Promise<TranslateResult | { result: TranslateResult; detail: SubtaskDetail }> {
  const { content, options, explanation, locale = "zh-CN", questionType } = params;

  // 根据题目类型决定是否提示 options
  let optionsPrompt = "";
  if (questionType === "truefalse") {
    // 是非题不需要选项
    optionsPrompt = "Question Type: True/False (判断题，不需要选项，options 字段应设为 null 或空数组 [])\n";
  } else {
    // 单选或多选题需要选项
    optionsPrompt = options && options.length 
      ? `Options:\n- ${options.join("\n- ")}` 
      : `Options: [缺失]`;
  }

  const input = [
    `Content: ${content || "[缺失]"}`,
    optionsPrompt,
    explanation ? `Explanation: ${explanation}` : `Explanation: [缺失]`,
  ]
    .filter(Boolean)
    .join("\n");

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
    parsed = JSON.parse(rawAnswer);
  } catch (parseError) {
    // 如果 JSON 解析失败，尝试修复截断的 JSON
    try {
      let fixedJson = rawAnswer.trim();
      
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
        parsed = JSON.parse(fixedJson);
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

