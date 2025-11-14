import { z } from "zod";

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
 * 获取主站 API URL（用于调用 /api/ai/ask）
 * 优先使用环境变量，如果没有则尝试从 Vercel 环境变量获取
 */
function getMainAppUrl(): string {
  // 优先使用明确配置的主站 URL
  const url = process.env.MAIN_APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (!url) {
    throw new Error("Missing MAIN_APP_URL/NEXT_PUBLIC_APP_URL/VERCEL_URL. Please configure the main app URL for question-processor.");
  }
  
  // 如果 URL 不包含协议，添加 https://
  let fullUrl = url;
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = `https://${fullUrl}`;
  }
  
  return fullUrl.replace(/\/+$/, "");
}

/**
 * 调用主站的 /api/ai/ask 路由
 * 这样可以使用数据库中的 aiProvider 配置和场景配置
 */
export async function askAi(body: AskBody & { scene?: string; sourceLanguage?: string; targetLanguage?: string }): Promise<any> {
  const mainAppUrl = getMainAppUrl();
  const url = `${mainAppUrl}/api/ai/ask`;
  
  // 使用匿名请求（question-processor 作为内部服务）
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      question: body.question,
      locale: body.lang || "zh-CN",
      scene: body.scene, // 传递场景标识，使用数据库中的场景配置
      sourceLanguage: body.sourceLanguage, // 源语言（用于翻译场景）
      targetLanguage: body.targetLanguage, // 目标语言（用于翻译场景）
      // 不传递 userId，使用匿名模式
    })
  });
  
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Main app API returned non-JSON: ${text.slice(0, 200)}`);
  }
  
  if (!res.ok || !json?.ok) {
    throw new Error(`Main app API error: ${res.status} ${json?.message || text.slice(0, 200)}`);
  }
  
  // 主站 API 返回格式：{ ok: true, data: { answer: "...", ... } }
  return json.data || json;
}

export async function translateWithPolish(params: {
  source: { content: string; options?: string[]; explanation?: string };
  from: string;
  to: string;
}): Promise<TranslateResult> {
  const { source, from, to } = params;
  // 使用场景配置，场景配置中的 prompt 已经包含了翻译要求
  // 源语言和目标语言通过 sourceLanguage 和 targetLanguage 参数传递，会在系统 prompt 中动态替换
  // 这里只需要传递题目内容，场景配置会自动应用
  const questionText = [
    `Content: ${source.content}`,
    source.options && source.options.length ? `Options:\n- ${source.options.join("\n- ")}` : ``,
    source.explanation ? `Explanation: ${source.explanation}` : ``
  ].filter(Boolean).join("\n");

  const data = await askAi({
    question: questionText,
    lang: to,
    scene: "question_translation", // 使用翻译场景配置
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
  const input = [
    `Language: ${locale}`,
    `Content: ${text.content}`,
    text.options && text.options.length ? `Options:\n- ${text.options.join("\n- ")}` : ``,
    text.explanation ? `Explanation: ${text.explanation}` : ``
  ].filter(Boolean).join("\n");

  const data = await askAi({
    question: input,
    lang: locale,
    scene: "question_polish" // 使用润色场景配置
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
  category?: string | null;
  stage_tag?: "both" | "provisional" | "regular" | null;
  topic_tags?: string[] | null;
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

  const data = await askAi({
    question: input,
    lang: locale,
    scene: "question_category_tags" // 使用分类标签场景配置
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
      : null
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

  const data = await askAi({
    question: input,
    lang: locale,
    scene: "question_fill_missing" // 使用填漏场景配置
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


