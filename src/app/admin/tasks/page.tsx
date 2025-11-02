// ============================================================
// 文件路径: src/app/admin/tasks/page.tsx
// 功能: 运维任务页面 - 过期清扫任务（dry-run / execute）
// 依赖: src/lib/apiClient.ts（统一鉴权与错误处理）
// 接口: POST /api/admin/tasks/sweep-expired
//       - Dry-run:  POST /api/admin/tasks/sweep-expired?mode=dry
//       - Execute:  POST /api/admin/tasks/sweep-expired
// 期望响应: { ok: true, data: { affected?:number, updated?:number, count?:number, checked?:number, total?:number, runAt?:ISO } }
// 说明: 对不同字段名做容错映射；时间统一显示 ISO8601（UTC）
// ============================================================

"use client";

import { useState } from "react";
import apiClient from "@/lib/apiClient";

type ApiOk = { ok: true; data: any };
type ApiErr = { ok: false; errorCode?: string; message?: string };

type Result = {
  affected: number; // 受影响数量（dry-run/execute）
  checked: number | null; // 扫描/检查的总量（可选）
  runAt: string; // 执行时间（ISO8601）
  raw: any; // 原始返回数据（调试展示）
};

function normalizeResult(data: any): Result {
  const affected =
    (typeof data?.affected === "number" && data.affected) ||
    (typeof data?.updated === "number" && data.updated) ||
    (typeof data?.count === "number" && data.count) ||
    0;

  const checked =
    (typeof data?.checked === "number" && data.checked) ||
    (typeof data?.total === "number" && data.total) ||
    (typeof data?.scanned === "number" && data.scanned) ||
    null;

  const runAt: string =
    (typeof data?.runAt === "string" && data.runAt) ||
    (typeof data?.executedAt === "string" && data.executedAt) ||
    (typeof data?.timestamp === "string" && data.timestamp) ||
    (typeof data?.now === "string" && data.now) ||
    new Date().toISOString();

  return { affected, checked, runAt, raw: data };
}

export default function AdminTasksPage() {
  const [loading, setLoading] = useState<"dry" | "exec" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dryResult, setDryResult] = useState<Result | null>(null);
  const [execResult, setExecResult] = useState<Result | null>(null);

  async function runDry() {
    setLoading("dry");
    setError(null);
    try {
      const res = await apiClient.post("/api/admin/tasks/sweep-expired?mode=dry", {});
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "Dry-run 失败");
      }
      const ok = res as ApiOk;
      setDryResult(normalizeResult(ok.data));
    } catch (e: any) {
      setError(e?.message || "Dry-run 失败");
      setDryResult(null);
    } finally {
      setLoading(null);
    }
  }

  async function runExecute() {
    if (!confirm("确认执行过期清扫任务？该操作将实际更新数据。")) return;
    setLoading("exec");
    setError(null);
    try {
      const res = await apiClient.post("/api/admin/tasks/sweep-expired", {});
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "执行失败");
      }
      const ok = res as ApiOk;
      setExecResult(normalizeResult(ok.data));
    } catch (e: any) {
      setError(e?.message || "执行失败");
      setExecResult(null);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">系统任务</h1>
        <button
          className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
          onClick={() => {
            setError(null);
            setDryResult(null);
            setExecResult(null);
          }}
        >
          清空结果
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 任务卡片：sweep-expired */}
      <div className="rounded-lg border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-base font-medium">清理已过期激活码状态（sweep-expired）</div>
            <div className="text-xs text-gray-500">
              每日 00:00 UTC 扫描 <code>activation_codes</code>，将已过期的记录状态更新为
              <code>expired</code>。
            </div>
          </div>
          <a
            className="text-xs text-blue-600 underline"
            href="https://vercel.com/docs/cron-jobs"
            target="_blank"
            rel="noreferrer"
          >
            配置为 Cron
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            onClick={runDry}
            disabled={loading !== null}
            title="仅模拟，返回将被影响的数量，不写入数据库"
          >
            {loading === "dry" ? "Dry-run 中…" : "Dry-run"}
          </button>
          <button
            className="rounded-md bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
            onClick={runExecute}
            disabled={loading !== null}
            title="执行并写入数据库"
          >
            {loading === "exec" ? "执行中…" : "Execute"}
          </button>
        </div>

        {/* 结果区域 */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md border p-4">
            <div className="mb-2 font-medium">Dry-run 结果</div>
            {dryResult ? (
              <ResultBlock result={dryResult} kind="dry" />
            ) : (
              <div className="text-sm text-gray-500">尚无结果</div>
            )}
          </div>

          <div className="rounded-md border p-4">
            <div className="mb-2 font-medium">Execute 结果</div>
            {execResult ? (
              <ResultBlock result={execResult} kind="exec" />
            ) : (
              <div className="text-sm text-gray-500">尚无结果</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultBlock({ result, kind }: { result: Result; kind: "dry" | "exec" }) {
  const title =
    kind === "dry" ? "将受影响数量 (affected)" : "实际更新数量 (affected/updated)";
  const checkedLabel = "扫描总量 (checked/total/scanned)";
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-600">{title}</span>
        <span className="tabular-nums font-semibold">{result.affected}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-600">{checkedLabel}</span>
        <span className="tabular-nums">
          {result.checked !== null ? result.checked : "-"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-600">执行时间 (UTC)</span>
        <span className="tabular-nums">{result.runAt}</span>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-gray-500">原始返回数据</summary>
        <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
{JSON.stringify(result.raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}
