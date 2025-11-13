import fetch from "node-fetch";
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

function getAiServiceUrl(): string {
  const url = process.env.AI_SERVICE_URL || process.env.LOCAL_AI_SERVICE_URL;
  if (!url) throw new Error("Missing AI_SERVICE_URL/LOCAL_AI_SERVICE_URL");
  return url.replace(/\/+$/, "");
}

function getAiToken(): string | undefined {
  return process.env.AI_SERVICE_TOKEN || process.env.LOCAL_AI_SERVICE_TOKEN;
}

export async function askAi(body: AskBody): Promise<any> {
  const url = `${getAiServiceUrl()}/ask`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(getAiToken() ? { authorization: `Bearer ${getAiToken()}` } : {})
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`AI service non-JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok || !json?.ok) {
    throw new Error(`AI service error: ${res.status} ${text.slice(0, 200)}`);
  }
  return json.data;
}

export async function translateWithPolish(params: {
  source: { content: string; options?: string[]; explanation?: string };
  from: string;
  to: string;
}): Promise<TranslateResult> {
  const { source, from, to } = params;
  const systemPrompt = [
    `You are a professional exam item translator and editor.`,
    `Translate the driving-exam question into target language ${to} from ${from}.`,
    `If the source is ambiguous, polish it for clarity while preserving meaning.`,
    `Output strictly JSON with keys: content (string), options (string[] optional), explanation (string optional).`,
    `Do not include any commentary, only JSON.`
  ].join("\n");

  const questionText = [
    `Source language: ${from}`,
    `Target language: ${to}`,
    `Content: ${source.content}`,
    source.options && source.options.length ? `Options:\n- ${source.options.join("\n- ")}` : ``,
    source.explanation ? `Explanation: ${source.explanation}` : ``
  ].filter(Boolean).join("\n");

  const data = await askAi({
    question: `${systemPrompt}\n\n${questionText}`,
    lang: to
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
  const systemPrompt = [
    `You are an editor improving clarity and correctness of driving-exam questions in ${locale}.`,
    `Polish the text for clarity, fix grammar, keep original meaning.`,
    `Output strictly JSON with keys: content (string), options (string[] optional), explanation (string optional).`
  ].join("\n");

  const input = [
    `Language: ${locale}`,
    `Content: ${text.content}`,
    text.options && text.options.length ? `Options:\n- ${text.options.join("\n- ")}` : ``,
    text.explanation ? `Explanation: ${text.explanation}` : ``
  ].filter(Boolean).join("\n");

  const data = await askAi({
    question: `${systemPrompt}\n\n${input}`,
    lang: locale
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


