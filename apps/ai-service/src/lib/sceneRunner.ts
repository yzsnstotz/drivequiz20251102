/**
 * ⚠️ 注意：
 * 1. 所有 AI 场景（翻译 / 润色 / 填漏 / 标签 等）的 Prompt 组装、
 *    response_format 设置、JSON 解析逻辑，必须通过本文件中的函数实现。
 * 2. /v1/ask 路由（无论是 ai-service 还是 local-ai-service）只负责：
 *    - 解析 HTTP 请求参数
 *    - 调用 runScene()
 *    - 把结果包装成 HTTP 响应
 *    不允许在路由中再次直接调用 OpenAI/Ollama 或自行处理 JSON。
 * 3. 如果将来要调整 JSON 结构或输出格式：
 *    - 修改 DB 中 ai_scenes.output_format
 *    - 或修改本文件中与 JSON 场景相关的逻辑
 *    严禁只修改某一个服务（例如仅修改 local-ai-service）。
 */

import type { ServiceConfig } from "../index.js";
import { getOpenAIClient } from "./openaiClient.js";

/**
 * 场景配置接口
 */
export interface SceneConfig {
  prompt: string;
  outputFormat: string | null;
}

/**
 * 通用配置接口（兼容 ai-service 和 local-ai-service）
 */
export interface CommonConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  aiModel?: string; // ai-service 需要
}

/**
 * 运行场景的选项
 */
export interface RunSceneOptions {
  sceneKey: string;
  locale: string;
  question: string;
  reference?: string | null;
  userPrefix: string;
  refPrefix: string;
  config: CommonConfig;
  providerKind: "openai" | "ollama";
  // OpenAI 相关
  aiProvider?: "openai" | "openrouter";
  model?: string;
  // OpenAI ServiceConfig（仅当 providerKind === "openai" 时使用）
  serviceConfig?: ServiceConfig;
  // Ollama 相关（仅当 providerKind === "ollama" 时使用）
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  // 占位符替换
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  // 温度设置
  temperature?: number;
  // 场景配置读取超时（可选，默认根据 providerKind 决定）
  sceneConfigTimeoutMs?: number;
}

/**
 * 场景执行结果
 */
export interface SceneResult {
  rawText: string;
  json: any | null; // JSON 场景下为解析后的对象，否则为 null
  // OpenAI API 返回的 tokens 信息（仅当 providerKind === "openai" 时有效）
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
}

/**
 * 从 Supabase 读取场景配置
 * 
 * 注意：此函数在两个服务中都需要使用，但实现略有不同（超时配置等）
 * 因此保留为可配置的函数，允许传入自定义的超时时间
 * 
 * @param sceneKey 场景标识
 * @param locale 语言标识
 * @param config 配置对象（包含 supabaseUrl 和 supabaseServiceKey）
 * @param options 可选配置（timeoutMs：超时时间，默认 5000ms）
 */
export async function getSceneConfig(
  sceneKey: string,
  locale: string,
  config: { supabaseUrl: string; supabaseServiceKey: string },
  options?: { timeoutMs?: number }
): Promise<SceneConfig | null> {
  const { supabaseUrl, supabaseServiceKey } = config;
  // 默认超时：Ollama 使用 15000ms（在 runScene 中传入），OpenAI 使用 5000ms
  const timeoutMs = options?.timeoutMs ?? 5000;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("[SCENE-RUNNER] Supabase 配置缺失，无法读取场景配置");
    return null;
  }

  try {
    const url = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/ai_scene_config?scene_key=eq.${encodeURIComponent(sceneKey)}&enabled=eq.true&select=system_prompt_zh,system_prompt_ja,system_prompt_en,output_format`;
    console.log("[SCENE-RUNNER] 读取场景配置:", { sceneKey, locale, timeoutMs, url: url.substring(0, 100) + "..." });
    
    const startTime = Date.now();
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const duration = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.warn("[SCENE-RUNNER] 场景配置请求失败:", { 
        status: res.status, 
        statusText: res.statusText,
        errorText: errorText.substring(0, 200),
        duration: `${duration}ms`,
        timeoutMs
      });
      return null;
    }

    const data = (await res.json()) as Array<{
      system_prompt_zh: string;
      system_prompt_ja: string | null;
      system_prompt_en: string | null;
      output_format: string | null;
    }>;

    if (!data || data.length === 0) {
      console.warn("[SCENE-RUNNER] 场景配置不存在:", { sceneKey, duration: `${duration}ms` });
      return null;
    }

    const sceneConfig = data[0];
    const lang = locale.toLowerCase().trim();

    // 根据语言选择 prompt
    let prompt = sceneConfig.system_prompt_zh;
    let selectedLang = "zh";
    
    if (lang.startsWith("ja") && sceneConfig.system_prompt_ja) {
      prompt = sceneConfig.system_prompt_ja;
      selectedLang = "ja";
      console.log("[SCENE-RUNNER] 使用日文 prompt (locale:", locale, "lang:", lang, ")");
    } else if (lang.startsWith("en") && sceneConfig.system_prompt_en) {
      prompt = sceneConfig.system_prompt_en;
      selectedLang = "en";
      console.log("[SCENE-RUNNER] 使用英文 prompt (locale:", locale, "lang:", lang, ")");
    } else {
      console.log("[SCENE-RUNNER] 使用中文 prompt (locale:", locale, "lang:", lang, ")");
    }

    const finalPrompt = prompt || sceneConfig.system_prompt_zh;
    console.log("[SCENE-RUNNER] 场景配置读取成功:", { 
      sceneKey, 
      locale, 
      selectedLang,
      promptLength: finalPrompt.length,
      promptPreview: finalPrompt.substring(0, 200) + "...",
      duration: `${duration}ms`,
      hasZhPrompt: !!sceneConfig.system_prompt_zh,
      hasJaPrompt: !!sceneConfig.system_prompt_ja,
      hasEnPrompt: !!sceneConfig.system_prompt_en,
      outputFormat: sceneConfig.output_format,
    });

    return {
      prompt: finalPrompt,
      outputFormat: sceneConfig.output_format,
    };
  } catch (error) {
    const isTimeout = error instanceof Error && (
      error.name === "AbortError" || 
      error.message.includes("timeout") ||
      error.message.includes("aborted")
    );
    
    if (isTimeout) {
      console.error(`[SCENE-RUNNER] 读取场景配置超时 (${timeoutMs}ms):`, { sceneKey, locale });
    } else {
      console.error("[SCENE-RUNNER] 读取场景配置失败:", { 
        error: error instanceof Error ? error.message : String(error),
        sceneKey,
        locale,
        timeoutMs
      });
    }
    
    return null;
  }
}

/**
 * 替换 prompt 中的占位符
 */
export function replacePlaceholders(
  prompt: string,
  sourceLanguage?: string | null,
  targetLanguage?: string | null
): string {
  let result = prompt;

  console.log("[SCENE-RUNNER] 替换占位符前:", {
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 200) + "...",
    sourceLanguage,
    targetLanguage,
    hasSourceLanguage: !!sourceLanguage,
    hasTargetLanguage: !!targetLanguage,
  });

  // 替换 {sourceLanguage} 和 {源语言}
  if (sourceLanguage) {
    result = result.replace(/{sourceLanguage}/gi, sourceLanguage);
    result = result.replace(/{源语言}/g, sourceLanguage);
  }

  // 替换 {targetLanguage} 和 {目标语言}
  if (targetLanguage) {
    result = result.replace(/{targetLanguage}/gi, targetLanguage);
    result = result.replace(/{目标语言}/g, targetLanguage);
  }

  console.log("[SCENE-RUNNER] 替换占位符后:", {
    promptLength: result.length,
    promptPreview: result.substring(0, 200) + "...",
    promptAfterReplace: result.substring(0, 500) + "...",
  });

  return result;
}

/**
 * 构建消息列表
 * 
 * 注意：对于翻译和润色场景，直接使用 question 作为用户消息，不添加前缀和 RAG 上下文
 */
export function buildMessages(opts: {
  sysPrompt: string;
  userPrefix: string;
  question: string;
  refPrefix: string;
  reference?: string | null;
  sceneKey?: string; // 场景标识，用于判断是否需要特殊处理
}): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const { sysPrompt, userPrefix, question, refPrefix, reference, sceneKey } = opts;
  
  // 对于翻译和润色场景，直接使用 question 作为用户消息，不添加前缀和 RAG 上下文
  if (sceneKey === "question_translation" || sceneKey === "question_polish") {
    return [
      { role: "system", content: sysPrompt },
      { role: "user", content: question },
    ];
  }
  
  // 其他场景：使用问答格式，包含 RAG 上下文
  return [
    { role: "system", content: sysPrompt },
    {
      role: "user",
      content: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}`,
    },
  ];
}

/**
 * 根据场景配置确定是否需要 JSON 格式输出
 * 
 * 规则：如果 outputFormat 中包含 "json"（不区分大小写），则强制 JSON 输出
 */
export function getResponseFormatForScene(
  sceneConfig: SceneConfig | null
): { type: "json_object" } | undefined {
  if (!sceneConfig?.outputFormat) {
    return undefined;
  }
  
  const of = sceneConfig.outputFormat.toLowerCase();
  
  // 规则：只要 outputFormat 中包含 json，就强制 JSON 输出
  if (of.includes("json")) {
    console.log("[SCENE-RUNNER] 检测到 JSON 格式要求，将使用 response_format: { type: 'json_object' }");
    return { type: "json_object" };
  }
  
  return undefined;
}

/**
 * 调用模型（统一处理 OpenAI 和 Ollama）
 * 
 * @returns 返回模型响应文本和 tokens 信息
 */
export async function callModelWithProvider(
  providerKind: "openai" | "ollama",
  params: {
    model: string;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    responseFormat?: { type: "json_object" };
    serviceConfig?: ServiceConfig;
    aiProvider?: "openai" | "openrouter";
    ollamaBaseUrl?: string;
    temperature?: number;
  }
): Promise<{ text: string; tokens?: { prompt?: number; completion?: number; total?: number } }> {
  const { model, messages, responseFormat, serviceConfig, aiProvider = "openai", ollamaBaseUrl, temperature = 0.4 } = params;

  if (providerKind === "openai") {
    // OpenAI/OpenRouter 调用
    if (!serviceConfig) {
      throw new Error("ServiceConfig is required for OpenAI provider");
    }
    const openai = getOpenAIClient(serviceConfig, aiProvider);
    
    console.log("[SCENE-RUNNER] 调用 OpenAI API:", {
      provider: aiProvider,
      model,
      messageCount: messages.length,
      hasResponseFormat: !!responseFormat,
      responseFormat,
      temperature,
    });
    
    const completion = await openai.chat.completions.create({
      model: model,
      temperature,
      messages,
      ...(responseFormat && { response_format: responseFormat }), // ✅ 关键：添加 JSON 格式强制参数
    });
    
    const inputTokens = completion.usage?.prompt_tokens;
    const outputTokens = completion.usage?.completion_tokens;
    const totalTokens = completion.usage?.total_tokens;
    
    console.log("[SCENE-RUNNER] OpenAI API 调用成功:", {
      model,
      hasAnswer: !!completion.choices?.[0]?.message?.content,
      inputTokens,
      outputTokens,
      totalTokens,
      usedResponseFormat: !!responseFormat,
    });
    
    return {
      text: completion.choices?.[0]?.message?.content?.trim() || "",
      tokens: {
        prompt: inputTokens,
        completion: outputTokens,
        total: totalTokens,
      },
    };
  } else {
    // Ollama 调用
    if (!ollamaBaseUrl) {
      throw new Error("Ollama base URL is required for Ollama provider");
    }
    
    console.log("[SCENE-RUNNER] 调用 Ollama API:", {
      baseUrl: ollamaBaseUrl,
      model,
      messageCount: messages.length,
      temperature,
      // 注意：Ollama 可能不支持 response_format，但我们在 prompt 中已经要求 JSON
    });
    
    const response = await fetch(`${ollamaBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages,
        temperature,
        // 注意：Ollama 可能不支持 response_format 参数，依赖 prompt 约束
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Ollama Chat API 调用失败: ${error}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    
    const answer = data.choices?.[0]?.message?.content?.trim() || "";
    console.log("[SCENE-RUNNER] Ollama API 调用成功:", {
      model,
      answerLength: answer.length,
      answerPreview: answer.substring(0, 200) + "...",
    });
    
    return {
      text: answer,
      tokens: undefined, // Ollama 不返回 tokens 信息
    };
  }
}

/**
 * 尝试解析场景结果（JSON 场景）
 */
export function tryParseSceneResult(
  sceneConfig: SceneConfig | null,
  rawText: string
): SceneResult {
  const responseFormat = getResponseFormatForScene(sceneConfig);
  
  if (!responseFormat) {
    // 非 JSON 场景：保持原样
    return { rawText, json: null };
  }

  // JSON 场景：尝试解析 JSON
  // 先尝试从代码块中提取 JSON
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let jsonText = rawText;
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim();
  }
  
  try {
    const json = JSON.parse(jsonText);
    console.log("[SCENE-RUNNER] JSON 解析成功");
    return { rawText, json };
  } catch (err) {
    // JSON 解析失败，记录详细错误
    console.error("[SCENE-RUNNER] JSON 解析失败:", {
      error: err instanceof Error ? err.message : String(err),
      rawTextLength: rawText.length,
      rawTextPreview: rawText.substring(0, 500),
      jsonTextLength: jsonText.length,
      jsonTextPreview: jsonText.substring(0, 500),
    });
    return { rawText, json: null };
  }
}

/**
 * 运行场景（统一入口）
 * 
 * 这是所有场景执行的核心函数，无论是翻译、润色、填漏还是标签，都通过此函数执行。
 */
export async function runScene(
  options: RunSceneOptions
): Promise<SceneResult> {
  const { 
    sceneKey, 
    locale, 
    question, 
    reference, 
    userPrefix, 
    refPrefix, 
    config, 
    providerKind,
    aiProvider = "openai",
    model,
    ollamaBaseUrl,
    ollamaModel,
    sourceLanguage,
    targetLanguage,
    temperature = 0.4,
  } = options;

  console.log("[SCENE-RUNNER] 开始执行场景:", {
    sceneKey,
    locale,
    providerKind,
    questionLength: question.length,
    hasReference: !!reference,
    sourceLanguage,
    targetLanguage,
  });

  // 1. 读取场景配置
  // 使用传入的超时配置，或根据 providerKind 使用默认值
  const defaultTimeoutMs = providerKind === "ollama" ? 15000 : 5000;
  const sceneConfigTimeoutMs = options.sceneConfigTimeoutMs ?? defaultTimeoutMs;
  
  const sceneConfig = await getSceneConfig(
    sceneKey, 
    locale, 
    config,
    { timeoutMs: sceneConfigTimeoutMs }
  );

  if (!sceneConfig) {
    throw new Error(`Scene not found: ${sceneKey} (${locale})`);
  }

  // 2. 替换占位符
  const sysPrompt = replacePlaceholders(sceneConfig.prompt, sourceLanguage || undefined, targetLanguage || undefined);

  // 3. 构建消息
  const messages = buildMessages({
    sysPrompt,
    userPrefix,
    question,
    refPrefix,
    reference,
    sceneKey, // 传递场景标识，用于判断是否需要特殊处理
  });

  // 4. 确定 response_format
  const responseFormat = getResponseFormatForScene(sceneConfig);
  
  console.log("[SCENE-RUNNER] 准备调用模型:", {
    sceneKey,
    providerKind,
    model: providerKind === "openai" ? model : ollamaModel,
    hasResponseFormat: !!responseFormat,
    responseFormat,
    messageCount: messages.length,
    sysPromptLength: sysPrompt.length,
    sysPromptPreview: sysPrompt.substring(0, 200) + "...",
  });

  // 5. 调用模型
  const actualModel = providerKind === "openai" 
    ? (model || config.aiModel || "gpt-4o-mini") // 默认模型
    : (ollamaModel || "unknown");
    
  const modelResponse = await callModelWithProvider(providerKind, {
    model: actualModel,
    messages,
    responseFormat,
    serviceConfig: options.serviceConfig,
    aiProvider,
    ollamaBaseUrl,
    temperature,
  });

  const rawText = modelResponse.text;
  if (!rawText) {
    throw new Error("Model returned empty response");
  }

  console.log("[SCENE-RUNNER] 模型调用成功:", {
    sceneKey,
    rawTextLength: rawText.length,
    rawTextPreview: rawText.substring(0, 200) + "...",
    hasTokens: !!modelResponse.tokens,
  });

  // 6. 解析结果
  const result = tryParseSceneResult(sceneConfig, rawText);
  
  // 添加 tokens 信息
  if (modelResponse.tokens) {
    result.tokens = modelResponse.tokens;
  }

  console.log("[SCENE-RUNNER] 场景执行完成:", {
    sceneKey,
    hasJson: !!result.json,
    jsonKeys: result.json ? Object.keys(result.json).join(", ") : "none",
  });

  return result;
}

