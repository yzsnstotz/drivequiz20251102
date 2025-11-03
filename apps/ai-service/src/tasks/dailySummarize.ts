// apps/ai-service/src/tasks/dailySummarize.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 功能：汇总昨日问答日志 → 聚合指标/来源/缺口/安全观察 → 生成Markdown摘要 → 写入缓存（幂等按 dateUtc 覆盖）。
 */

import { getOpenAIClient } from "../lib/openaiClient.js";
import { getRagContext } from "../lib/rag.js";
import { cacheSet } from "../lib/cache.js";
import { checkSafety } from "../lib/safety.js";
import type { ServiceConfig } from "../index.js";

/** 任务入参（由上层 Scheduler/Runner 注入） */
export interface DailySummarizeInput {
  /** 统计日期（UTC），不传则取昨天 */
  dateUtc?: string; // YYYY-MM-DD
  /** 拉取日志的函数（由调用方注入，便于不同环境对接） */
  fetchLogs: (fromIso: string, toIso: string) => Promise<AskLogRecord[]>;
  /** 可选：限制最大处理条数，默认 1000 */
  maxRecords?: number;
}

/** 统一问答日志记录结构（由调用方在 fetchLogs 中做适配） */
export interface AskLogRecord {
  id: string;
  userId: string | null;
  question: string;
  answer?: string;
  locale?: string;
  createdAt: string; // ISO8601 (UTC)
  sources?: Array<{ title: string; url: string; score?: number }>;
  safetyFlag?: "ok" | "needs_human" | "blocked";
  model?: string;
  meta?: Record<string, unknown>;
}

/** 任务输出（缓存与返回体均使用该结构） */
export interface DailySummary {
  dateUtc: string;
  totals: {
    questions: number;
    answered: number;
    blocked: number;
    needsHuman: number;
    locales: Record<string, number>;
  };
  topQuestions: Array<{
    question: string;
    count: number;
    locales: string[];
  }>;
  topSources: Array<{
    url: string;
    title: string;
    hits: number;
    avgScore?: number;
  }>;
  gaps: string[];
  safetyNotes: string[];
  publish: {
    markdown: string; // 面向前端/后台展示的摘要文本（已脱敏）
    model?: string;
    tokens?: { input?: number; output?: number };
  };
}

/** 任务主函数（幂等：相同 dateUtc 多次执行，覆写同一缓存键） */
export async function runDailySummarize(
  config: ServiceConfig,
  input: DailySummarizeInput,
): Promise<{ ok: true; data: DailySummary } | { ok: false; errorCode: string; message: string }> {
  try {
    // 1) 计算统计区间（默认昨天 00:00:00 ~ 今天 00:00:00 UTC）
    const { sinceIso, untilIso, dateUtc } = getDateWindow(input.dateUtc);

    // 2) 拉取日志
    let raw: AskLogRecord[] = [];
    try {
      raw = await input.fetchLogs(sinceIso, untilIso);
    } catch (e) {
      return { ok: false, errorCode: "PROVIDER_ERROR", message: "Failed to fetch logs." };
    }
    const logs = normalizeArray(
      (input.maxRecords && input.maxRecords > 0 ? raw.slice(0, input.maxRecords) : raw) ?? [],
    );

    // 3) 快速聚合（频次、来源、语言、安全）
    const agg = aggregate(logs);

    // 4) 组装 RAG 上下文（高频问题 + 未命中/空答的样本）
    const topQuestionsText = agg.topQuestions.map((q) => q.question).slice(0, 20).join("\n");
    const emptyAnswersText = logs
      .filter((r) => !r.answer)
      .slice(0, 20)
      .map((r) => r.question)
      .join("\n");
    const queryText = [topQuestionsText, emptyAnswersText].filter(Boolean).join("\n");
    const ragContext = await getRagContext(queryText || "无数据", "zh", config);

    // 5) 生成摘要草案（让模型归纳常见问题、知识缺口与安全观察）
    const openai = getOpenAIClient(config);
    const model = resolveModel(config);
    const prompt = composePrompt(dateUtc, agg, ragContext);

    let summaryMd = "";
    let usedModel: string | undefined;
    let usageIn: number | undefined;
    let usageOut: number | undefined;

    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are ZALEM's product analyst. Produce concise, actionable, safe, and bilingual-friendly (CN primary, JP/EN ready) daily summaries for an AI Q&A module.",
          },
          { role: "user", content: prompt },
        ],
      });

      summaryMd = (completion.choices?.[0]?.message?.content || "").trim();
      usedModel = completion.model || model;
      // OpenAI SDK 4.x: usage.prompt_tokens / usage.completion_tokens
      const u: any = completion.usage || {};
      usageIn = typeof u.prompt_tokens === "number" ? u.prompt_tokens : undefined;
      usageOut = typeof u.completion_tokens === "number" ? u.completion_tokens : undefined;
    } catch (e) {
      return { ok: false, errorCode: "PROVIDER_ERROR", message: "OpenAI completion failed." };
    }

    // 6) 安全审查（摘要内容不得包含敏感数据或违规引导）
    const safety = await checkSafety(summaryMd);
    if (!safety.ok) {
      return { ok: false, errorCode: "FORBIDDEN", message: "Summary blocked by safety policy." };
    }

    // 7) 产出结构化结果
    const out: DailySummary = {
      dateUtc,
      totals: agg.totals,
      topQuestions: agg.topQuestions,
      topSources: agg.topSources,
      gaps: agg.gaps,
      safetyNotes: agg.safetyNotes,
      publish: {
        markdown: summaryMd,
        model: usedModel,
        tokens: { input: usageIn, output: usageOut },
      },
    };

    // 8) 写入缓存（幂等覆写）— 与路由约定保持一致：ai:summary:<YYYY-MM-DD>:<range>
    const cacheKey = `ai:summary:${dateUtc}:day`;
    try {
      await cacheSet(cacheKey, out, 7 * 24 * 3600);
    } catch (e) {
      return { ok: false, errorCode: "CACHE_ERROR", message: "Failed to write summary cache." };
    }

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Daily summarize failed." };
  }
}

/* ---------------- Internal helpers ---------------- */

function getDateWindow(dateUtc?: string) {
  // 输入为 UTC 日期（YYYY-MM-DD），否则计算“昨天”
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const base = dateUtc
    ? new Date(`${dateUtc}T00:00:00.000Z`)
    : new Date(todayUtc.getTime() - 24 * 3600 * 1000);
  const sinceIso = base.toISOString();
  const untilIso = new Date(base.getTime() + 24 * 3600 * 1000).toISOString();
  const d = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(
    base.getUTCDate(),
  ).padStart(2, "0")}`;
  return { sinceIso, untilIso, dateUtc: d };
}

function aggregate(logs: AskLogRecord[]) {
  const locales: Record<string, number> = {};
  const qCount: Record<string, { count: number; locales: Set<string> }> = {};
  const srcHit: Record<string, { title: string; hits: number; scoreSum: number; scoreCnt: number }> =
    {};
  let answered = 0;
  let blocked = 0;
  let needsHuman = 0;

  for (const r of logs) {
    const loc = (r.locale || "und").toLowerCase();
    locales[loc] = (locales[loc] || 0) + 1;

    const q = normalize(r.question);
    if (!qCount[q]) qCount[q] = { count: 0, locales: new Set<string>() };
    qCount[q].count++;
    qCount[q].locales.add(loc);

    if (r.answer) answered++;
    if (r.safetyFlag === "blocked") blocked++;
    if (r.safetyFlag === "needs_human") needsHuman++;

    for (const s of r.sources || []) {
      const key = s.url || s.title || "unknown";
      if (!srcHit[key]) srcHit[key] = { title: s.title || key, hits: 0, scoreSum: 0, scoreCnt: 0 };
      srcHit[key].hits++;
      if (typeof s.score === "number") {
        srcHit[key].scoreSum += s.score;
        srcHit[key].scoreCnt++;
      }
    }
  }

  const topQuestions = Object.entries(qCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 50)
    .map(([question, v]) => ({
      question,
      count: v.count,
      locales: Array.from(v.locales),
    }));

  const topSources = Object.entries(srcHit)
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, 50)
    .map(([url, v]) => ({
      url,
      title: v.title,
      hits: v.hits,
      avgScore: v.scoreCnt ? Number((v.scoreSum / v.scoreCnt).toFixed(3)) : undefined,
    }));

  // 简单识别知识缺口：高频但回答缺失的问题
  const emptySet = new Set(logs.filter((r) => !r.answer).map((r) => normalize(r.question)));
  const gaps = topQuestions.filter((q) => emptySet.has(q.question)).slice(0, 20).map((q) => q.question);

  // 安全观察：blocked/needsHuman 比例偏高
  const safetyNotes: string[] = [];
  const total = logs.length || 1;
  if (blocked / total > 0.05) safetyNotes.push("被拦截比例 > 5%，建议复核安全策略与提示文案。");
  if (needsHuman / total > 0.05) safetyNotes.push("需人工介入比例 > 5%，建议优化知识库或回答流程。");

  return {
    totals: {
      questions: logs.length,
      answered,
      blocked,
      needsHuman,
      locales,
    },
    topQuestions,
    topSources,
    gaps,
    safetyNotes,
  };
}

function resolveModel(config: ServiceConfig): string {
  // 支持多种命名以兼容不同版本配置
  const anyCfg = config as any;
  return (
    anyCfg.aiModel ||
    anyCfg.openaiModel ||
    anyCfg.models?.summary ||
    "gpt-4o-mini"
  );
}

function normalize(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function composePrompt(dateUtc: string, agg: ReturnType<typeof aggregate>, rag: string) {
  const localesTop = Object.entries(agg.totals.locales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");

  const topQ = agg.topQuestions
    .slice(0, 10)
    .map((q, i) => `${i + 1}. ${q.question} (x${q.count})`)
    .join("\n");

  const topS = agg.topSources
    .slice(0, 10)
    .map(
      (s, i) =>
        `${i + 1}. ${s.title} — ${s.url} (hits:${s.hits}${s.avgScore ? `,score:${s.avgScore}` : ""})`,
    )
    .join("\n");

  const gaps =
    agg.gaps.length > 0 ? agg.gaps.map((g, i) => `${i + 1}. ${g}`).join("\n") : "（无高频缺口）";
  const safety =
    agg.safetyNotes.length > 0 ? agg.safetyNotes.map((x) => `- ${x}`).join("\n") : "（无异常）";

  return [
    `日期（UTC）：${dateUtc}`,
    "",
    "输入材料：",
    "- 语言占比TOP5：" + localesTop,
    "- 高频问题TOP10：\n" + topQ,
    "- 来源TOP10：\n" + topS,
    "- 知识缺口（候选）：\n" + gaps,
    "- 安全观察：\n" + safety,
    "- RAG补充上下文（截断版）：\n" + (rag || "").slice(0, 3000),
    "",
    "请生成一段产品可发布的每日摘要（Markdown），包含：",
    "1) 今日概览（关键指标+趋势）",
    "2) 用户最关心的问题主题（归纳3-5条）",
    "3) 资料来源与质量观察（可执行建议）",
    "4) 知识缺口与补库建议（列清单）",
    "5) 安全与合规提示（如需）",
    "要求：简洁、可执行、避免敏感数据与人名、优先中文输出（便于日后多语言扩展）。",
  ].join("\n");
}

function normalizeArray<T>(arr: T[] | null | undefined): T[] {
  return Array.isArray(arr) ? arr : [];
}
