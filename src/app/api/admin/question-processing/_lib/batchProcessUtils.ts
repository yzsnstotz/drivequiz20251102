/**
 * 批量处理工具函数库
 * 从 question-processor 提取的逻辑，用于内部调用
 */

import { aiDb } from "@/lib/aiDb";

export interface TranslateResult {
  content: string;
  options?: string[];
  explanation?: string;
}

export interface CategoryAndTagsResult {
  category?: string | null;
  stage_tag?: "both" | "provisional" | "regular" | null;
  topic_tags?: string[] | null;
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
}

/**
 * 获取场景配置（prompt和输出格式）
 */
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
 * 内部调用 /api/ai/ask（通过内部 HTTP 调用）
 * 在 Vercel 环境中，使用相对路径进行内部调用
 */
async function callAiAskInternal(params: {
  question: string;
  locale?: string;
  scene?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  adminToken?: string; // 管理员 token，用于跳过配额限制
}, retries: number = 3): Promise<{ answer: string }> {
  // 在 Vercel 环境中，使用绝对 URL
  // 优先使用 VERCEL_URL（Vercel 自动提供），否则使用 NEXT_PUBLIC_APP_URL
  let baseUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL;
  
  // 如果是在 Vercel 环境中，构建完整 URL
  if (baseUrl) {
    if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    }
  } else {
    // 本地开发环境，使用 localhost
    baseUrl = "http://localhost:3000";
  }

  const apiUrl = `${baseUrl}/api/ai/ask`;

  // 内部调用（使用 fetch），带重试机制
  // 设置总体超时时间（根据场景调整）
  // 对于批量处理，需要更长的超时时间，因为可能涉及多个操作
  const isBatchProcessing = process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'production';
  const overallTimeout = isBatchProcessing ? 250000 : 55000; // 批量处理：250秒，单次调用：55秒
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 检查是否已经超过总体超时时间
      const elapsed = Date.now() - startTime;
      if (elapsed > overallTimeout) {
        throw new Error(`AI API call timeout: exceeded ${overallTimeout}ms total time`);
      }
      
      // 为每次请求设置超时（根据场景调整）
      // 批量处理场景需要更长的超时时间，因为AI可能需要更长时间处理
      const singleRequestTimeout = isBatchProcessing ? 120000 : 30000; // 批量处理：120秒，单次调用：30秒
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), singleRequestTimeout);
      
      // 构建请求头，如果有管理员 token 则添加 Authorization header
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (params.adminToken) {
        headers["Authorization"] = `Bearer ${params.adminToken}`;
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          question: params.question,
          locale: params.locale || "zh-CN",
          scene: params.scene,
          sourceLanguage: params.sourceLanguage,
          targetLanguage: params.targetLanguage,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = null;
        try {
          errorData = errorText ? JSON.parse(errorText) : null;
        } catch {
          // 忽略JSON解析错误
        }
        
        // 如果是429错误（Too Many Requests），进行重试
        if (response.status === 429 && attempt < retries) {
          // 检查剩余时间是否足够重试
          const elapsed = Date.now() - startTime;
          const remainingTime = overallTimeout - elapsed;
          const delay = Math.min(Math.pow(2, attempt) * 1000, remainingTime - 5000); // 指数退避，但不超过剩余时间
          
          if (delay < 1000) {
            // 如果剩余时间不足1秒，直接失败
            throw new Error(`AI API call timeout: insufficient time for retry (remaining: ${remainingTime}ms)`);
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(`AI API call failed: ${response.status} ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();

      if (!data.ok) {
        // 如果是429错误，进行重试
        if ((data.errorCode === "PROVIDER_ERROR" && data.message?.includes("429")) || 
            data.message?.includes("429") || 
            data.message?.includes("Too Many Requests")) {
          if (attempt < retries) {
            // 检查剩余时间是否足够重试
            const elapsed = Date.now() - startTime;
            const remainingTime = overallTimeout - elapsed;
            const delay = Math.min(Math.pow(2, attempt) * 1000, remainingTime - 5000);
            
            if (delay < 1000) {
              throw new Error(`AI API call timeout: insufficient time for retry (remaining: ${remainingTime}ms)`);
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        throw new Error(data.message || "AI call failed");
      }

      return { answer: data.data.answer };
    } catch (error: any) {
      // 如果是最后一次尝试，抛出错误
      if (attempt === retries) {
        throw error;
      }
      
      // 如果是网络错误或429错误，等待后重试
      if (error.message?.includes("429") || error.message?.includes("rate limit") || error.message?.includes("Too Many Requests") || error.name === "AbortError") {
        // 检查剩余时间是否足够重试
        const elapsed = Date.now() - startTime;
        const remainingTime = overallTimeout - elapsed;
        const delay = Math.min(Math.pow(2, attempt) * 1000, remainingTime - 5000);
        
        if (delay < 1000 || attempt === retries) {
          throw error; // 如果剩余时间不足或已经是最后一次尝试，直接抛出错误
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 其他错误直接抛出
      throw error;
    }
  }
  
  throw new Error("AI API call failed after retries");
}

/**
 * 翻译并润色（带详细信息）
 */
export async function translateWithPolish(params: {
  source: { content: string; options?: string[]; explanation?: string };
  from: string;
  to: string;
  adminToken?: string; // 管理员 token，用于跳过配额限制
  returnDetail?: boolean; // 是否返回详细信息
}): Promise<TranslateResult | { result: TranslateResult; detail: SubtaskDetail }> {
  const { source, from, to, adminToken, returnDetail } = params;
  const questionText = [
    `Content: ${source.content}`,
    source.options && source.options.length ? `Options:\n- ${source.options.join("\n- ")}` : ``,
    source.explanation ? `Explanation: ${source.explanation}` : ``,
  ]
    .filter(Boolean)
    .join("\n");

  const sceneKey = "question_translation";
  let sceneConfig: { prompt: string; outputFormat: string | null; sceneName: string } | null = null;
  
  if (returnDetail) {
    sceneConfig = await getSceneConfig(sceneKey, to);
  }

  const data = await callAiAskInternal({
    question: questionText,
    locale: to,
    scene: sceneKey,
    sourceLanguage: from,
    targetLanguage: to,
    adminToken,
  });

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
      // 如果修复后仍然失败，记录完整响应用于调试
      console.error(`[translateWithPolish] Failed to parse AI response. Full response length: ${data.answer.length}`);
      console.error(`[translateWithPolish] Response preview: ${data.answer.substring(0, 500)}`);
      throw new Error("AI translation response missing JSON body");
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
}): Promise<TranslateResult> {
  const { text, locale } = params;
  const input = [
    `Language: ${locale}`,
    `Content: ${text.content}`,
    text.options && text.options.length ? `Options:\n- ${text.options.join("\n- ")}` : ``,
    text.explanation ? `Explanation: ${text.explanation}` : ``,
  ]
    .filter(Boolean)
    .join("\n");

  const data = await callAiAskInternal({
    question: input,
    locale: locale,
    scene: "question_polish",
    adminToken: params.adminToken,
  });

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
  
  return {
    content: contentStr,
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : undefined,
    explanation: parsed.explanation ? String(parsed.explanation) : undefined,
  };
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
}): Promise<CategoryAndTagsResult> {
  const { content, options, explanation, locale = "zh-CN" } = params;

  const input = [
    `Content: ${content}`,
    options && options.length ? `Options:\n- ${options.join("\n- ")}` : ``,
    explanation ? `Explanation: ${explanation}` : ``,
  ]
    .filter(Boolean)
    .join("\n");

  const data = await callAiAskInternal({
    question: input,
    locale: locale,
    scene: "question_category_tags",
    adminToken: params.adminToken,
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

  return {
    category: parsed.category ? String(parsed.category) : null,
    stage_tag: parsed.stage_tag && ["both", "provisional", "regular"].includes(parsed.stage_tag)
      ? parsed.stage_tag
      : null,
    topic_tags: Array.isArray(parsed.topic_tags)
      ? parsed.topic_tags.map((s: any) => String(s)).filter(Boolean)
      : null,
  };
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
}): Promise<TranslateResult> {
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

  const data = await callAiAskInternal({
    question: input,
    locale: locale,
    scene: "question_fill_missing",
    adminToken: params.adminToken,
  });

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

  return {
    content: String(parsed.content ?? content ?? "").trim(),
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : options || undefined,
    explanation: parsed.explanation ? String(parsed.explanation) : explanation || undefined,
  };
}

