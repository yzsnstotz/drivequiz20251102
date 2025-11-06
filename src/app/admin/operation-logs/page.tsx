"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, apiGet } from "@/lib/apiClient";

type OperationLog = {
  id: number;
  adminId: number;
  adminUsername: string;
  action: "create" | "update" | "delete";
  tableName: string;
  recordId: number | null;
  oldValue: any | null;
  newValue: any | null;
  description: string | null;
  createdAt: string;
};

type ListResponse = {
  items: OperationLog[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type Filters = {
  page: number;
  limit: number;
  adminUsername: string;
  tableName: string;
  action: "" | "create" | "update" | "delete";
  recordId: string;
  startDate: string;
  endDate: string;
  sortBy: "createdAt" | "id" | "adminId" | "tableName" | "action";
  sortOrder: "asc" | "desc";
};

const DEFAULT_FILTERS: Filters = {
  page: 1,
  limit: 20,
  adminUsername: "",
  tableName: "",
  action: "",
  recordId: "",
  startDate: "",
  endDate: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

export default function OperationLogsPage() {
  const search = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => {
    const q = (k: string, d = "") => (search?.get(k) ?? d);
    const n = (k: string, d: number) => {
      const v = Number(search?.get(k));
      return Number.isFinite(v) && v > 0 ? v : d;
    };
    return {
      page: n("page", DEFAULT_FILTERS.page),
      limit: n("limit", DEFAULT_FILTERS.limit),
      adminUsername: q("adminUsername", DEFAULT_FILTERS.adminUsername),
      tableName: q("tableName", DEFAULT_FILTERS.tableName),
      action: (q("action", DEFAULT_FILTERS.action) as Filters["action"]) || "",
      recordId: q("recordId", DEFAULT_FILTERS.recordId),
      startDate: q("startDate", DEFAULT_FILTERS.startDate),
      endDate: q("endDate", DEFAULT_FILTERS.endDate),
      sortBy: (q("sortBy", DEFAULT_FILTERS.sortBy) as Filters["sortBy"]) || "createdAt",
      sortOrder: (q("sortOrder", DEFAULT_FILTERS.sortOrder) as Filters["sortOrder"]) || "desc",
    };
  });

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OperationLog[]>([]);
  const [pagination, setPagination] = useState<ListResponse["pagination"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 同步 filters 到 URL
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === undefined || v === null) return;
      params.set(k, String(v));
    });
    const qs = params.toString();
    const href = qs ? `/admin/operation-logs?${qs}` : `/admin/operation-logs`;
    window.history.replaceState(null, "", href);
  }, [filters]);

  // 拉取列表
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, any> = {
          page: filters.page,
          limit: filters.limit,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        };
        if (filters.adminUsername) params.adminUsername = filters.adminUsername;
        if (filters.tableName) params.tableName = filters.tableName;
        if (filters.action) params.action = filters.action;
        if (filters.recordId) params.recordId = filters.recordId;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;

        const data = await apiGet<ListResponse>("/api/admin/operation-logs", { query: params });
        if (!mounted) return;

        const payload = data as unknown as any;
        const items = (payload.items ?? payload) as OperationLog[];
        setItems(items);
        setPagination(payload.pagination || null);
      } catch (e) {
        if (!mounted) return;
        if (e instanceof ApiError) {
          if (e.status === 401) {
            setError("未授权：请先登录管理口令");
          } else {
            setError(`${e.errorCode}: ${e.message}`);
          }
        } else {
          setError(e instanceof Error ? e.message : "未知错误");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [filters]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, page: 1 }));
  };

  const onReset = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  const changePage = (page: number) => {
    if (page < 1) return;
    if (pagination && page > pagination.pages) return;
    setFilters((f) => ({ ...f, page }));
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const fmt = (v?: string | null) =>
    v ? new Date(v).toISOString().replace(".000Z", "Z").slice(0, 19).replace("T", " ") : "—";

  const actionColors: Record<OperationLog["action"], string> = {
    create: "bg-emerald-100 text-emerald-800",
    update: "bg-blue-100 text-blue-800",
    delete: "bg-red-100 text-red-800",
  };

  const actionLabels: Record<OperationLog["action"], string> = {
    create: "创建",
    update: "更新",
    delete: "删除",
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 顶部操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <h2 className="text-base sm:text-lg font-semibold">Operation Logs</h2>
        <button
          className="rounded-md border border-gray-300 text-sm px-3 py-2 sm:py-1.5 hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
          onClick={() => setFilters((f) => ({ ...f }))}
        >
          刷新
        </button>
      </div>

      {/* 筛选表单 */}
      <form onSubmit={onSearchSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">管理员</label>
          <input
            type="text"
            value={filters.adminUsername}
            onChange={(e) =>
              setFilters((f) => ({ ...f, adminUsername: e.target.value, page: 1 }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            placeholder="搜索管理员..."
          />
        </div>
        <div className="w-[120px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">表名</label>
          <input
            type="text"
            value={filters.tableName}
            onChange={(e) =>
              setFilters((f) => ({ ...f, tableName: e.target.value, page: 1 }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            placeholder="表名..."
          />
        </div>
        <div className="w-[100px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">操作</label>
          <select
            value={filters.action}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                action: e.target.value as Filters["action"],
                page: 1,
              }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">全部</option>
            <option value="create">创建</option>
            <option value="update">更新</option>
            <option value="delete">删除</option>
          </select>
        </div>
        <div className="w-[100px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">记录ID</label>
          <input
            type="number"
            value={filters.recordId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, recordId: e.target.value, page: 1 }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            placeholder="ID..."
          />
        </div>
        <div className="w-[150px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">开始日期</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value, page: 1 }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="w-[150px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">结束日期</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value, page: 1 }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-black"
        >
          搜索
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-gray-300 text-sm px-3 py-1.5 hover:bg-gray-100"
        >
          重置
        </button>
      </form>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* 列表 - 桌面端 */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">暂无数据</div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">ID</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">时间</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">管理员</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">操作</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">表名</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">记录ID</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">描述</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-xs">{item.id}</td>
                      <td className="py-2 px-3 text-xs text-gray-600">{fmt(item.createdAt)}</td>
                      <td className="py-2 px-3 text-xs font-medium">{item.adminUsername}</td>
                      <td className="py-2 px-3 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColors[item.action]}`}
                        >
                          {actionLabels[item.action]}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs font-mono">{item.tableName}</td>
                      <td className="py-2 px-3 text-xs text-gray-600">
                        {item.recordId ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-600">
                        {item.description || "—"}
                      </td>
                      <td className="py-2 px-3 text-xs">
                        <button
                          onClick={() => toggleExpand(item.id)}
                          className="text-blue-600 hover:underline"
                        >
                          {expandedId === item.id ? "收起" : "详情"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === item.id && (
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <td colSpan={8} className="py-3 px-3 text-xs">
                          <div className="space-y-2">
                            {item.oldValue && (
                              <div>
                                <div className="font-medium text-gray-700 mb-1">旧值:</div>
                                <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                                  {JSON.stringify(item.oldValue, null, 2)}
                                </pre>
                              </div>
                            )}
                            {item.newValue && (
                              <div>
                                <div className="font-medium text-gray-700 mb-1">新值:</div>
                                <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                                  {JSON.stringify(item.newValue, null, 2)}
                                </pre>
                              </div>
                            )}
                            {!item.oldValue && !item.newValue && (
                              <div className="text-gray-500">无详细数据</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* 移动端卡片 */}
          <div className="md:hidden space-y-3">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">ID: {item.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColors[item.action]}`}
                  >
                    {actionLabels[item.action]}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">时间</div>
                  <div className="text-xs text-gray-600">{fmt(item.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">管理员</div>
                  <div className="text-sm font-medium">{item.adminUsername}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">表名:</span> {item.tableName}
                  </div>
                  <div>
                    <span className="text-gray-500">记录ID:</span> {item.recordId ?? "—"}
                  </div>
                </div>
                {item.description && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">描述</div>
                    <div className="text-xs text-gray-600">{item.description}</div>
                  </div>
                )}
                {(item.oldValue || item.newValue) && (
                  <div>
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="w-full rounded-xl bg-blue-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-blue-600 active:bg-blue-700 touch-manipulation transition-colors shadow-sm"
                    >
                      {expandedId === item.id ? "收起详情" : "查看详情"}
                    </button>
                    {expandedId === item.id && (
                      <div className="mt-2 space-y-2 pt-2 border-t border-gray-100">
                        {item.oldValue && (
                          <div>
                            <div className="text-xs font-medium text-gray-700 mb-1">旧值:</div>
                            <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                              {JSON.stringify(item.oldValue, null, 2)}
                            </pre>
                          </div>
                        )}
                        {item.newValue && (
                          <div>
                            <div className="text-xs font-medium text-gray-700 mb-1">新值:</div>
                            <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                              {JSON.stringify(item.newValue, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 分页 */}
          {pagination && pagination.pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 text-xs text-gray-600">
              <div className="text-xs sm:text-sm">
                共 {pagination.total} 条，第 {pagination.page} / {pagination.pages} 页
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => changePage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="flex-1 sm:flex-none px-3 py-2 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 active:bg-gray-200 touch-manipulation text-xs sm:text-sm"
                >
                  上一页
                </button>
                <button
                  onClick={() => changePage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="flex-1 sm:flex-none px-3 py-2 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 active:bg-gray-200 touch-manipulation text-xs sm:text-sm"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

