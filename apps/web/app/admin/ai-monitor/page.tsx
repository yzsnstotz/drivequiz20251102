// apps/web/app/admin/ai-monitor/page.tsx
/**
 * 管理后台 · AI 运行监控（每日摘要预览）
 * - 仅服务端取数（携带 Service Token），前端纯展示
 * - 统一错误提示与占位渲染，避免页面崩溃
 * - 与 AI-Service `/v1/admin/daily-summary` 数据结构对齐（支持向后兼容旧版 VM）
 */

import "server-only";
import React from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// === 环境变量（命名遵循《🛠️ 研发规范 v1.0》） ===
const SUMMARY_ENDPOINT =
  process.env.AI_SERVICE_SUMMARY_URL /* e.g. https://ai.example.com/v1/admin/daily-summary */ || "";
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || "";

// === 与 AI-Service 保持一致的服务端数据结构（SummaryDoc） ===
type SummaryDoc = {
  date: string; // YYYY-MM-DD (UTC)
  range: "day" | "week" | "month";
  generatedAt: string; // ISO8601
  version: "v1";
  sections: {
    faq: Array<{
      question: string;
      answer: string;
      count: number;
      sources: Array<{ title: string; url: string; score?: number }>;
    }>;
    topSources: Array<{ title: string; url: string; hits: number }>;
    safety: { okCount: number; needsHuman: number; blocked: number };
    gaps: string[];
  };
  meta?: Record<string, unknown>;
};

// === 旧版页面使用的 VM（本地映射，尽量不改 UI 组件） ===
type DailySummaryVM = {
  dateUtc: string;
  totals: {
    questions: number;
    answered: number;
    blocked: number;
    needsHuman: number;
    locales: Record<string, number>; // 目前无数据，保留空对象以兼容旧 UI
  };
  topQuestions: Array<{ question: string; count: number }>;
  topSources: Array<{ url: string; title: string; hits: number; avgScore?: number }>;
  gaps: string[];
  safetyNotes: string[];
  publish: {
    markdown: string;
    model?: string;
    tokens?: { input?: number; output?: number };
  };
};

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; errorCode: string; message: string; details?: unknown };
type ApiResp<T> = ApiOk<T> | ApiErr;

// === 工具 ===
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toYyyyMmDdUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function isYyyyMmDd(s?: string): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function yesterdayUTC(date?: string): string {
  if (date && isYyyyMmDd(date)) return date;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const y = new Date(todayUtc.getTime() - 24 * 3600 * 1000);
  return toYyyyMmDdUTC(y);
}

/** 将服务端 SummaryDoc → 本页旧版 VM，最大程度兼容既有 UI */
function mapToVM(doc: SummaryDoc): DailySummaryVM {
  const safety = doc.sections?.safety ?? { okCount: 0, needsHuman: 0, blocked: 0 };
  const questionsTotal = Math.max(
    0,
    (safety.okCount || 0) + (safety.needsHuman || 0) + (safety.blocked || 0),
  );
  const answered = safety.okCount || 0;

  const topQuestions = Array.isArray(doc.sections?.faq)
    ? doc.sections.faq
        .slice()
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .map((q) => ({ question: q.question, count: q.count }))
    : [];

  const topSources =
    (doc.sections?.topSources || []).map((s) => ({
      url: s.url,
      title: s.title,
      hits: s.hits,
      // avgScore 当前不在 v1 中，保留占位
      avgScore: undefined,
    })) ?? [];

  // 发布稿（若任务层写入 meta.publish）
  const publishMeta = (doc.meta as any)?.publish;
  const publish = {
    markdown: (publishMeta?.markdown as string) || "",
    model: publishMeta?.model as string | undefined,
    tokens: publishMeta?.tokens as { input?: number; output?: number } | undefined,
  };

  // 安全备注（可来自 meta.safetyNotes）
  const safetyNotes: string[] = Array.isArray((doc.meta as any)?.safetyNotes)
    ? ((doc.meta as any).safetyNotes as string[])
    : [];

  return {
    dateUtc: doc.date,
    totals: {
      questions: questionsTotal,
      answered,
      blocked: safety.blocked || 0,
      needsHuman: safety.needsHuman || 0,
      locales: {}, // v1 暂无语言分布，保持空对象以兼容旧 UI
    },
    topQuestions,
    topSources,
    gaps: Array.isArray(doc.sections?.gaps) ? doc.sections.gaps : [],
    safetyNotes,
    publish,
  };
}

async function fetchSummary(date?: string): Promise<{ data: DailySummaryVM | null; error?: string }> {
  if (!SUMMARY_ENDPOINT || !AI_SERVICE_TOKEN) {
    return { data: null, error: "未配置 AI_SERVICE_SUMMARY_URL / AI_SERVICE_TOKEN。" };
  }
  const d = yesterdayUTC(date);
  const url = `${SUMMARY_ENDPOINT.replace(/\/$/, "")}?date=${encodeURIComponent(d)}&range=day`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${AI_SERVICE_TOKEN}`,
        "content-type": "application/json",
      },
      cache: "no-store",
    });

    // 非 2xx → 统一错误
    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        /* noop */
      }
      return {
        data: null,
        error: `AI-Service 响应异常（${res.status}）${
          body && typeof body === "object" ? `：${JSON.stringify(body).slice(0, 300)}` : ""
        }`,
      };
    }

    const json = (await res.json()) as ApiResp<SummaryDoc>;
    if (!("ok" in json)) {
      return { data: null, error: "AI-Service 返回体不符合协议。" };
    }
    if (!json.ok) {
      return { data: null, error: `${json.errorCode}: ${json.message}` };
    }
    // 服务端数据 → VM
    return { data: mapToVM(json.data) };
  } catch {
    return { data: null, error: "无法连接 AI-Service 或响应无效。" };
  }
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function Table<T>({
  columns,
  rows,
  empty,
}: {
  columns: Array<{ key: keyof T | string; title: string; width?: string }>;
  rows: T[];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)} className="px-3 py-2 text-left font-medium" style={{ width: c.width }}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-gray-400" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t">
                {columns.map((c) => (
                  <td key={String(c.key)} className="px-3 py-2 align-top">
                    {/* 动态索引渲染（受控使用） */}
                    {/* @ts-expect-error dynamic key access for generic table */}
                    {r[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <pre className="rounded-2xl border bg-gray-50 p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed text-sm">
      {text || "（无摘要内容）"}
    </pre>
  );
}

// === 页面 ===
export default async function Page({
  searchParams,
}: {
  searchParams: { date?: string; refresh?: string };
}) {
  const dateParam = typeof searchParams?.date === "string" ? searchParams.date : undefined;
  const date = isYyyyMmDd(dateParam) ? dateParam : undefined;

  const { data, error } = await fetchSummary(date);

  // 语言占比：v1 暂无，保持空数组以兼容 UI 占位展示
  const topLocales: Array<[string, number]> = [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">AI 运行监控 · 每日摘要</h1>
        <form>
          <div className="flex items-center gap-2">
            <input
              name="date"
              type="date"
              defaultValue={yesterdayUTC(date)}
              className="rounded-xl border px-3 py-1.5 text-sm"
            />
            <button className="rounded-xl bg-black px-3 py-1.5 text-white text-sm" type="submit">
              加载指定日期
            </button>
          </div>
        </form>
      </div>

      {!SUMMARY_ENDPOINT || !AI_SERVICE_TOKEN ? (
        <div className="rounded-2xl border p-4 bg-amber-50 text-amber-800">
          未配置环境变量 <code>AI_SERVICE_SUMMARY_URL</code> / <code>AI_SERVICE_TOKEN</code>，当前显示占位页。
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border p-4 bg-red-50 text-red-700">获取摘要失败：{error}</div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="统计日期（UTC）" value={data?.dateUtc ?? "—"} />
        <Metric label="问题总数" value={data?.totals.questions ?? 0} />
        <Metric label="已回答" value={data?.totals.answered ?? 0} />
        <Metric
          label="安全拦截 / 需人工"
          value={`${data?.totals.blocked ?? 0} / ${data?.totals.needsHuman ?? 0}`}
          sub="blocked / needs_human"
        />
      </div>

      <div className="rounded-2xl border p-4 bg-white">
        <div className="mb-2 text-sm text-gray-500">语言占比（Top）</div>
        {topLocales.length === 0 ? (
          <div className="text-gray-400 text-sm">（无数据）</div>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {topLocales.map(([k, v]) => (
              <li key={k} className="rounded-xl border px-3 py-2 text-sm bg-gray-50">
                <span className="font-medium">{k}</span>
                <span className="ml-2 text-gray-500">{v}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">高频问题（Top 10）</h2>
          <Table
            columns={[
              { key: "question", title: "问题" },
              { key: "count", title: "次数", width: "80px" },
            ]}
            rows={(data?.topQuestions ?? []).slice(0, 10)}
            empty="（无高频问题）"
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">来源质量（Top 10）</h2>
          <Table
            columns={[
              { key: "title", title: "来源" },
              { key: "hits", title: "命中", width: "80px" },
              { key: "avgScore", title: "均分", width: "80px" },
            ]}
            rows={(data?.topSources ?? [])
              .slice(0, 10)
              .map((s) => ({
                ...s,
                title: (
                  <a
                    href={s.url}
                    className="text-blue-600 underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {s.title}
                  </a>
                ),
              })) as any}
            empty="（无来源数据）"
          />
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">知识缺口（候选）</h2>
        {(data?.gaps?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border p-4 bg-white text-gray-400 text-sm">（无高频缺口）</div>
        ) : (
          <ul className="rounded-2xl border p-4 bg-white list-decimal list-inside space-y-1 text-sm">
            {data!.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">安全观察</h2>
        {(data?.safetyNotes?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border p-4 bg-white text-gray-400 text-sm">（无异常）</div>
        ) : (
          <ul className="rounded-2xl border p-4 bg-white list-disc space-y-1 text-sm pl-5">
            {data!.safetyNotes.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">发布稿（Markdown 预览）</h2>
        <div className="rounded-2xl border p-4 bg-white">
          <CodeBlock text={data?.publish.markdown ?? ""} />
          <div className="mt-2 text-xs text-gray-500">
            模型：{data?.publish.model ?? "—"} ｜ Tokens：in {data?.publish.tokens?.input ?? 0} / out{" "}
            {data?.publish.tokens?.output ?? 0}
          </div>
        </div>
      </section>

      <div className="text-xs text-gray-400">
        如需实时刷新，可在地址栏追加 <code>&refresh=1</code>（已禁用缓存）。
      </div>
    </div>
  );
}
