"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  type ExplanationConsistencyItem,
  type ExplanationConsistencyEntry,
} from "@/types/questionProcessing";

type ApiResponse = {
  items: ExplanationConsistencyItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    from: string;
    to: string;
    scene: string | null;
  };
};

const OPERATIONS = [
  { value: "", label: "全部" },
  { value: "translate", label: "translate" },
  { value: "polish", label: "polish" },
  { value: "fill_missing", label: "fill_missing" },
  { value: "category_tags", label: "category_tags" },
  { value: "full_pipeline", label: "full_pipeline" },
];

function renderStatus(status?: string) {
  if (status === "inconsistent") return <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs">不一致</span>;
  if (status === "consistent") return <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs">一致</span>;
  return <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">未知</span>;
}

function renderTruth(val?: string) {
  if (val === "true") return "正确";
  if (val === "false") return "错误";
  return "未知";
}

function flattenLocale(consistency: ExplanationConsistencyEntry[]): string {
  const locales = consistency.map((c) => c.locale).filter(Boolean) as string[];
  return locales.join(", ");
}

export default function ExplanationConsistencyPage() {
  const [items, setItems] = useState<ExplanationConsistencyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [scene, setScene] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(0);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (scene) params.set("scene", scene);

      const res = await apiFetch<ApiResponse>(
        `/api/admin/question-processing/explanation-consistency?${params.toString()}`,
      );
      setItems(res.data.items || []);
      setHasMore(res.data.pagination.hasMore);
      setTotal(res.data.pagination.total);
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, scene]);

  const onApplyFilter = () => {
    setPage(1);
    fetchList();
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">解析一致性异常</h1>
      <p className="text-gray-600 mb-4">仅展示 explanationConsistency.status 为 inconsistent 的任务项</p>

      {/* 过滤器 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-700 mb-1">开始日期 (from)</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">结束日期 (to)</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">操作类型</label>
            <select
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              className="w-full border rounded px-2 py-1"
            >
              {OPERATIONS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onApplyFilter}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={loading}
            >
              应用筛选
            </button>
            <button
              onClick={() => { setFrom(""); setTo(""); setScene(""); setPage(1); }}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              disabled={loading}
            >
              重置
            </button>
          </div>
          <div className="text-right text-sm text-gray-500">
            共 {total} 条
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <span className="font-semibold">异常列表</span>
          {loading && <span className="text-sm text-gray-500">加载中...</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">任务ID</th>
                <th className="px-4 py-2 text-left">题目ID</th>
                <th className="px-4 py-2 text-left">操作</th>
                <th className="px-4 py-2 text-left">目标语言</th>
                <th className="px-4 py-2 text-left">完成时间</th>
                <th className="px-4 py-2 text-left">locale</th>
                <th className="px-4 py-2 text-left">期望</th>
                <th className="px-4 py-2 text-left">AI 判定</th>
                <th className="px-4 py-2 text-left">状态</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-4 text-center text-gray-500">暂无数据</td>
                </tr>
              )}
              {items.map((item) => {
                const c = item.explanationConsistency?.[0];
                return (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-2 text-blue-600 hover:text-blue-800">
                      <a href={`/admin/question-processing/tasks/${item.taskId}`} target="_blank" rel="noreferrer">
                        {item.taskId}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-blue-600 hover:text-blue-800">
                      <a href={`/admin/questions/${item.questionId}`} target="_blank" rel="noreferrer">
                        {item.questionId}
                      </a>
                    </td>
                    <td className="px-4 py-2">{item.operation}</td>
                    <td className="px-4 py-2">{item.targetLang || "-"}</td>
                    <td className="px-4 py-2">{item.finishedAt ? new Date(item.finishedAt).toLocaleString("zh-CN") : "-"}</td>
                    <td className="px-4 py-2">{flattenLocale(item.explanationConsistency)}</td>
                    <td className="px-4 py-2">{renderTruth(c?.expected)}</td>
                    <td className="px-4 py-2">{renderTruth(c?.inferred)}</td>
                    <td className="px-4 py-2">{renderStatus(c?.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="flex justify-between items-center p-4 border-t">
          <div className="text-sm text-gray-600">
            第 {page} 页，每页 {pageSize} 条
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={loading || page <= 1}
              className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || !hasMore}
              className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
