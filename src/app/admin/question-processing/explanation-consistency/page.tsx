"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
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

function normalizeExplanation(raw: any): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "string") return { zh: raw };
  if (typeof raw === "object") {
    const result: Record<string, string> = {};
    Object.entries(raw).forEach(([k, v]) => {
      if (typeof v === "string") result[k] = v;
    });
    return result;
  }
  return {};
}

function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("ADMIN_TOKEN");
  } catch {
    return null;
  }
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
  const [exporting, setExporting] = useState(false);

  const [editingItem, setEditingItem] = useState<ExplanationConsistencyItem | null>(null);
  const [explanationDraft, setExplanationDraft] = useState<Record<string, string>>({});
  const [questionLoading, setQuestionLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentLocales = useMemo(() => {
    const locales = new Set<string>(["zh", "ja", "en"]);
    if (editingItem?.explanationConsistency) {
      editingItem.explanationConsistency.forEach((c) => c.locale && locales.add(c.locale));
    }
    Object.keys(explanationDraft).forEach((k) => locales.add(k));
    return Array.from(locales);
  }, [editingItem?.explanationConsistency, explanationDraft]);

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

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "5000");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (scene) params.set("scene", scene);
      params.set("format", "csv");
      const token = getAdminToken();
      const res = await fetch(
        `/api/admin/question-processing/explanation-consistency?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `explanation_inconsistent_content_hash_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const openEdit = async (item: ExplanationConsistencyItem) => {
    setEditingItem(item);
    setQuestionLoading(true);
    setSaveError(null);
    try {
      const res = await apiFetch<any>(`/api/admin/questions/${item.questionId}`);
      const normalized = normalizeExplanation((res.data as any)?.explanation);
      setExplanationDraft(normalized);
    } catch (e: any) {
      setSaveError(e instanceof ApiError ? e.message : "加载题目失败");
    } finally {
      setQuestionLoading(false);
    }
  };

  const closeEdit = () => {
    setEditingItem(null);
    setExplanationDraft({});
    setSaveError(null);
  };

  const applySuggestedFix = (locale: string) => {
    if (!editingItem?.errorDetail?.suggestedFix) return;
    setExplanationDraft((prev) => ({
      ...prev,
      [locale]: editingItem.errorDetail.suggestedFix,
    }));
  };

  const saveExplanation = async () => {
    if (!editingItem) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch(`/api/admin/questions/${editingItem.questionId}/explanation`, {
        method: "PATCH",
        body: JSON.stringify({ explanation: explanationDraft }),
      });
      closeEdit();
      fetchList();
    } catch (e: any) {
      setSaveError(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">解析一致性异常</h1>
      <p className="text-gray-600 mb-4">仅展示 explanationConsistency.status 为 inconsistent 的任务项</p>

      {/* 过滤器 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
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
          <div className="flex items-center justify-end">
            <button
              onClick={handleExport}
              disabled={exporting || loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {exporting ? "导出中..." : "导出 content_hash"}
            </button>
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
                <th className="px-4 py-2 text-left">content_hash</th>
                <th className="px-4 py-2 text-left">操作</th>
                <th className="px-4 py-2 text-left">目标语言</th>
                <th className="px-4 py-2 text-left">完成时间</th>
                <th className="px-4 py-2 text-left">locale</th>
                <th className="px-4 py-2 text-left">期望</th>
                <th className="px-4 py-2 text-left">AI 判定</th>
                <th className="px-4 py-2 text-left">状态</th>
                <th className="px-4 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="px-4 py-4 text-center text-gray-500">暂无数据</td>
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
                    <td className="px-4 py-2 font-mono text-xs">{item.contentHash || "-"}</td>
                    <td className="px-4 py-2">{item.operation}</td>
                    <td className="px-4 py-2">{item.targetLang || "-"}</td>
                    <td className="px-4 py-2">{item.finishedAt ? new Date(item.finishedAt).toLocaleString("zh-CN") : "-"}</td>
                    <td className="px-4 py-2">{flattenLocale(item.explanationConsistency)}</td>
                    <td className="px-4 py-2">{renderTruth(c?.expected)}</td>
                    <td className="px-4 py-2">{renderTruth(c?.inferred)}</td>
                    <td className="px-4 py-2">{renderStatus(c?.status)}</td>
                    <td className="px-4 py-2">
                      <button
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        onClick={() => openEdit(item)}
                      >
                        编辑解析
                      </button>
                    </td>
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

      {/* 编辑解析 Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold">编辑解析</h3>
                <p className="text-sm text-gray-600">
                  题目ID: {editingItem.questionId} | content_hash: {editingItem.contentHash || "-"} | locale: {editingItem.explanationConsistency?.[0]?.locale || "-"}
                </p>
              </div>
              <button className="text-gray-500 hover:text-gray-800" onClick={closeEdit}>关闭</button>
            </div>
            {questionLoading ? (
              <div className="text-gray-600">加载中...</div>
            ) : (
              <>
                {saveError && <div className="text-red-600 mb-2 text-sm">{saveError}</div>}
                <div className="space-y-4">
                  {currentLocales.map((locale) => (
                    <div key={locale}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{locale} 解析</span>
                        {editingItem.errorDetail?.suggestedFix &&
                          editingItem.explanationConsistency?.some((c) => c.locale === locale) && (
                            <button
                              onClick={() => applySuggestedFix(locale)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              使用建议修复文案
                            </button>
                          )}
                      </div>
                      <textarea
                        className="w-full border rounded p-2 text-sm"
                        rows={4}
                        value={explanationDraft[locale] ?? ""}
                        onChange={(e) =>
                          setExplanationDraft((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                        placeholder="填写解析文本，可留空"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={closeEdit}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    disabled={saving}
                  >
                    取消
                  </button>
                  <button
                    onClick={saveExplanation}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    disabled={saving}
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
