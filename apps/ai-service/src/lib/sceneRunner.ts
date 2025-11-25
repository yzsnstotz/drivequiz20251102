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

// ⚠️ 注意：ServiceConfig 和 getOpenAIClient 只在 OpenAI provider 时使用
// 使用动态导入，避免 local-ai-service 无法解析这些依赖
let getOpenAIClient: any = null; // 将在需要时动态导入

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
 * AI 服务配置接口（用于 runScene）
 */
export interface AiServiceConfig {
  model: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
  geminiApiKey?: string;
  userPrefix: string;
  refPrefix: string;
  version?: string;
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
  aiProvider?: "openai" | "openrouter" | "gemini";
  model?: string;
  // OpenAI ServiceConfig（仅当 providerKind === "openai" 时使用）
  // 注意：使用 any 类型避免 local-ai-service 无法解析 ServiceConfig 类型
  serviceConfig?: any;
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
 * 场景配置缓存（30分钟TTL）
 */
const SCENE_CONFIG_CACHE_TTL = 30 * 60 * 1000; // 30分钟

type SceneConfigCacheEntry = {
  config: SceneConfig;
  lastUpdated: number;
};

// 场景配置缓存：key 为 "sceneKey:locale"
const sceneConfigCache: Map<string, SceneConfigCacheEntry> = new Map();

// 请求去重：key 为 "sceneKey:locale"，值为正在进行的 Promise
const sceneConfigPendingRequests: Map<string, Promise<SceneConfig | null>> = new Map();

/**
 * 清除所有场景配置缓存
 */
export function clearSceneConfigCache(): void {
  sceneConfigCache.clear();
  sceneConfigPendingRequests.clear();
}

/**
 * 清除指定场景的配置缓存
 */
export function clearSceneConfigCacheForScene(sceneKey: string, locale: string): void {
  const cacheKey = `${sceneKey}:${locale}`;
  sceneConfigCache.delete(cacheKey);
  sceneConfigPendingRequests.delete(cacheKey);
}

/**
 * 从 Supabase 读取场景配置（带缓存和请求去重）
 * 
 * 注意：此函数在两个服务中都需要使用，但实现略有不同（超时配置等）
 * 因此保留为可配置的函数，允许传入自定义的超时时间
 * 
 * 缓存机制：
 * - 使用内存缓存，TTL 为 30 分钟
 * - 使用 Promise 缓存实现请求去重，防止并发请求重复查询数据库
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

  // 构建缓存键
  const cacheKey = `${sceneKey}:${locale}`;
  const now = Date.now();

  // 1. 检查缓存是否有效
  const cached = sceneConfigCache.get(cacheKey);
  if (cached && now - cached.lastUpdated < SCENE_CONFIG_CACHE_TTL) {
    console.log("[SCENE-RUNNER] 使用缓存的场景配置:", { sceneKey, locale, cacheAge: `${now - cached.lastUpdated}ms` });
    return cached.config;
  }

  // 2. 检查是否有正在进行的请求（请求去重）
  const pendingRequest = sceneConfigPendingRequests.get(cacheKey);
  if (pendingRequest) {
    console.log("[SCENE-RUNNER] 等待正在进行的场景配置请求:", { sceneKey, locale });
    return pendingRequest;
  }

  // 3. 创建新的请求 Promise
  const fetchPromise = (async (): Promise<SceneConfig | null> => {
    try {
      return await fetchSceneConfigFromDb(sceneKey, locale, supabaseUrl, supabaseServiceKey, timeoutMs);
    } finally {
      // 请求完成后清除 pending 状态
      sceneConfigPendingRequests.delete(cacheKey);
    }
  })();

  // 4. 将 Promise 存入 pending 映射（用于请求去重）
  sceneConfigPendingRequests.set(cacheKey, fetchPromise);

  // 5. 等待请求完成并更新缓存
  try {
    const result = await fetchPromise;
    if (result) {
      // 只有成功获取到配置才更新缓存
      sceneConfigCache.set(cacheKey, {
        config: result,
        lastUpdated: now,
      });
    }
    return result;
  } catch (error) {
    // 请求失败时不更新缓存，直接抛出错误
    throw error;
  }
}

/**
 * 从数据库实际获取场景配置（内部函数）
 */
async function fetchSceneConfigFromDb(
  sceneKey: string,
  locale: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
  timeoutMs: number
): Promise<SceneConfig | null> {
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
      const errorDetails = {
        status: res.status, 
        statusText: res.statusText,
        errorText: errorText.substring(0, 200),
        duration: `${duration}ms`,
        timeoutMs,
        sceneKey,
        locale
      };
      
      // 如果是 404，说明场景不存在
      if (res.status === 404) {
        console.warn("[SCENE-RUNNER] 场景配置不存在 (404):", errorDetails);
        return null;
      }
      
      // 其他 HTTP 错误（500, 401, 403 等）应该抛出错误
      const errorMsg = `Supabase API 请求失败 (${res.status} ${res.statusText}): ${sceneKey} (${locale})。错误详情: ${errorText.substring(0, 200)}`;
      console.error("[SCENE-RUNNER] 场景配置请求失败:", errorDetails);
      throw new Error(errorMsg);
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

    // 强制只使用中文 prompt（忽略 locale 参数）
    // 原因：批量任务处理时，数据库中可能只有中文 prompt，其他语言的 prompt 可能不存在
    // 为了避免 scene_not_found 错误，统一使用中文 prompt
    let prompt = sceneConfig.system_prompt_zh;
    let selectedLang = "zh";
    
    // 如果中文 prompt 不存在或为空，记录警告
    if (!prompt || prompt.trim() === "") {
      console.warn("[SCENE-RUNNER] 中文 prompt 不存在或为空，使用空字符串:", { sceneKey, locale });
      prompt = "";
    }
    
    console.log("[SCENE-RUNNER] 使用中文 prompt (locale:", locale, "lang:", lang, ", 强制使用中文)");

    const finalPrompt = prompt || "";
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
    
    const isFetchFailed = error instanceof Error && (
      error.message === "fetch failed" ||
      error.message.includes("fetch failed") ||
      error.cause instanceof Error
    );
    
    if (isTimeout) {
      const errorMsg = `读取场景配置超时 (${timeoutMs}ms): ${sceneKey} (${locale})`;
      console.error(`[SCENE-RUNNER] ${errorMsg}`, { sceneKey, locale, timeoutMs });
      throw new Error(errorMsg);
    } else if (isFetchFailed) {
      const errorMsg = `无法连接到 Supabase 读取场景配置: ${sceneKey} (${locale})。请检查 SUPABASE_URL 和网络连接。原始错误: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[SCENE-RUNNER] 场景配置读取网络错误:", { 
        error: error instanceof Error ? error.message : String(error),
        errorCause: error instanceof Error && error.cause ? String(error.cause) : undefined,
        sceneKey,
        locale,
        timeoutMs,
        supabaseUrl: supabaseUrl ? supabaseUrl.substring(0, 50) + "..." : "未配置"
      });
      throw new Error(errorMsg);
    } else {
      const errorMsg = `读取场景配置失败: ${sceneKey} (${locale})。错误: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[SCENE-RUNNER] 场景配置读取失败:", { 
        error: error instanceof Error ? error.message : String(error),
        sceneKey,
        locale,
        timeoutMs
      });
      throw new Error(errorMsg);
    }
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
    serviceConfig?: any; // 使用 any 避免 local-ai-service 无法解析 ServiceConfig
    aiProvider?: "openai" | "openrouter" | "gemini";
    ollamaBaseUrl?: string;
    temperature?: number;
  }
): Promise<{ text: string; tokens?: { prompt?: number; completion?: number; total?: number } }> {
  const { model, messages, responseFormat, serviceConfig, aiProvider = "openai", ollamaBaseUrl, temperature = 0.4 } = params;

  // 处理 Gemini provider
  if (aiProvider === "gemini") {
    if (!serviceConfig) {
      throw new Error("ServiceConfig is required for Gemini provider");
    }
    
    // 动态导入 Gemini 客户端（避免 local-ai-service 无法解析）
    let callGeminiChat: any = null;
    try {
      const geminiClientModule = await import("./geminiClient.js");
      callGeminiChat = geminiClientModule.callGeminiChat;
    } catch (error) {
      throw new Error(`Failed to load Gemini client: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log("[SCENE-RUNNER] 调用 Gemini API:", {
      provider: "gemini",
      model,
      messageCount: messages.length,
      hasResponseFormat: !!responseFormat,
      responseFormat,
      temperature,
    });
    
    const result = await callGeminiChat(serviceConfig, model, messages, temperature, responseFormat);
    
    console.log("[SCENE-RUNNER] Gemini API 调用成功:", {
      model,
      hasAnswer: !!result.text,
      tokens: result.tokens,
      usedResponseFormat: !!responseFormat,
    });
    
    return result;
  }

  if (providerKind === "openai") {
    // OpenAI/OpenRouter 调用
    if (!serviceConfig) {
      throw new Error("ServiceConfig is required for OpenAI provider");
    }
    
    // 动态导入 OpenAI 客户端（避免 local-ai-service 无法解析）
    if (!getOpenAIClient) {
      try {
        const openaiClientModule = await import("./openaiClient.js");
        getOpenAIClient = openaiClientModule.getOpenAIClient;
      } catch (error) {
        throw new Error(`Failed to load OpenAI client: ${error instanceof Error ? error.message : String(error)}`);
      }
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
    
    let rawText = completion.choices?.[0]?.message?.content?.trim() || "";
    
    // ✅ 修复：清理 OpenAI 返回的 JSON 响应（可能包含 Markdown 代码块）
    if (responseFormat?.type === "json_object") {
      const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlockMatch) {
        rawText = codeBlockMatch[1].trim();
        console.debug("[SCENE-RUNNER] OpenAI 返回了 Markdown 包裹的 JSON，已提取");
      }
    }
    
    console.log("[SCENE-RUNNER] OpenAI API 调用成功:", {
      model,
      hasAnswer: !!rawText,
      inputTokens,
      outputTokens,
      totalTokens,
      usedResponseFormat: !!responseFormat,
    });
    
    return {
      text: rawText,
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
        ...(responseFormat && { response_format: responseFormat }),
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Ollama Chat API 调用失败: ${error}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    
    let rawAnswer = data.choices?.[0]?.message?.content?.trim() || "";
    
    // ✅ 修复：清理 Ollama 返回的 JSON 响应（可能包含 Markdown 代码块）
    if (responseFormat?.type === "json_object") {
      const codeBlockMatch = rawAnswer.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlockMatch) {
        rawAnswer = codeBlockMatch[1].trim();
        console.debug("[SCENE-RUNNER] Ollama 返回了 Markdown 包裹的 JSON，已提取");
      }
    }
    
    console.log("[SCENE-RUNNER] Ollama API 调用成功:", {
      model,
      answerLength: rawAnswer.length,
      answerPreview: rawAnswer.substring(0, 200) + "...",
    });
    
    return {
      text: rawAnswer,
      tokens: undefined, // Ollama 不返回 tokens 信息
    };
  }
}

/**
 * 清理 JSON 字符串（移除 BOM、代码块、尾随逗号等）
 */
function cleanJsonStringLocal(input: string): string {
  if (!input) return input;
  let s = input.trim();
  s = s.replace(/^[\uFEFF\u200B]+/, ''); // 去掉 BOM/零宽空格
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim(); // 去掉代码块
  s = s.replace(/,\s*([}\]])/g, '$1'); // 去掉尾随逗号
  return s;
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
  
  // 2. 清理 JSON 字符串（移除尾随逗号等）
  jsonText = cleanJsonStringLocal(jsonText);
  
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
  
  let sceneConfig: SceneConfig | null = null;
  try {
    sceneConfig = await getSceneConfig(
      sceneKey, 
      locale, 
      config,
      { timeoutMs: sceneConfigTimeoutMs }
    );
  } catch (error) {
    // 如果 getSceneConfig 抛出错误（网络错误等），直接重新抛出
    throw error;
  }

  // 如果场景配置不存在（返回 null），说明场景在数据库中不存在或未启用
  if (!sceneConfig) {
    throw new Error(`Scene not found: ${sceneKey} (${locale})。请检查场景是否存在于数据库且 enabled=true`);
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

