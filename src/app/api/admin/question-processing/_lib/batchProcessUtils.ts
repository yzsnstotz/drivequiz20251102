/**
 * 批量处理工具函数库
 * 从 question-processor 提取的逻辑，用于内部调用
 */

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
 * 内部调用 /api/ai/ask（通过内部 HTTP 调用）
 * 在 Vercel 环境中，使用相对路径进行内部调用
 */
async function callAiAskInternal(params: {
  question: string;
  locale?: string;
  scene?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
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
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: params.question,
          locale: params.locale || "zh-CN",
          scene: params.scene,
          sourceLanguage: params.sourceLanguage,
          targetLanguage: params.targetLanguage,
        }),
      });

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
          const delay = Math.pow(2, attempt) * 1000; // 指数退避：2s, 4s, 8s
          console.log(`[callAiAskInternal] Rate limit hit (429), retrying in ${delay}ms (attempt ${attempt}/${retries})`);
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
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`[callAiAskInternal] Provider rate limit (429), retrying in ${delay}ms (attempt ${attempt}/${retries})`);
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
      if (error.message?.includes("429") || error.message?.includes("rate limit") || error.message?.includes("Too Many Requests")) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[callAiAskInternal] Error (${error.message}), retrying in ${delay}ms (attempt ${attempt}/${retries})`);
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
 * 翻译并润色
 */
export async function translateWithPolish(params: {
  source: { content: string; options?: string[]; explanation?: string };
  from: string;
  to: string;
}): Promise<TranslateResult> {
  const { source, from, to } = params;
  const questionText = [
    `Content: ${source.content}`,
    source.options && source.options.length ? `Options:\n- ${source.options.join("\n- ")}` : ``,
    source.explanation ? `Explanation: ${source.explanation}` : ``,
  ]
    .filter(Boolean)
    .join("\n");

  const data = await callAiAskInternal({
    question: questionText,
    locale: to,
    scene: "question_translation",
    sourceLanguage: from,
    targetLanguage: to,
  });

  // 解析 JSON 响应
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
    throw new Error("AI translation response missing JSON body");
  }
  return {
    content: String(parsed.content ?? "").trim(),
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : undefined,
    explanation: parsed.explanation ? String(parsed.explanation) : undefined,
  };
}

/**
 * 润色内容
 */
export async function polishContent(params: {
  text: { content: string; options?: string[]; explanation?: string };
  locale: string;
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
}): Promise<TranslateResult> {
  const { content, options, explanation, locale = "zh-CN" } = params;

  const input = [
    `Content: ${content || "[缺失]"}`,
    options && options.length ? `Options:\n- ${options.join("\n- ")}` : `Options: [缺失]`,
    explanation ? `Explanation: ${explanation}` : `Explanation: [缺失]`,
  ]
    .filter(Boolean)
    .join("\n");

  const data = await callAiAskInternal({
    question: input,
    locale: locale,
    scene: "question_fill_missing",
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
    options: Array.isArray(parsed.options) ? parsed.options.map((s: any) => String(s)) : options || undefined,
    explanation: parsed.explanation ? String(parsed.explanation) : explanation || undefined,
  };
}

