"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiDelete, apiGet } from "@/lib/apiClient";

type ActivationCode = {
  id: number;
  code: string;
  status: "enabled" | "disabled" | "suspended" | "expired";
  usageLimit: number;
  usedCount: number;
  createdAt?: string; // ISO
  enabledAt?: string | null; // ISO
  expiresAt?: string | null; // ISO
  notes?: string | null;
};

type ListResponse = {
  items: ActivationCode[];
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type SortBy =
  | "createdAt"
  | "enabledAt"
  | "expiresAt"
  | "usedCount"
  | "usageLimit"
  | "status";

type SortOrder = "asc" | "desc";

type Filters = {
  page: number;
  limit: number;
  status: "" | "enabled" | "disabled" | "suspended" | "expired";
  code: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  sortBy: SortBy;
  sortOrder: SortOrder;
};

const DEFAULT_FILTERS: Filters = {
  page: 1,
  limit: 20,
  status: "",
  code: "",
  start: "",
  end: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

export default function ActivationCodesPage() {
  const router = useRouter();
  const search = useSearchParams();

  // 从 URL 初始化筛选（便于分享链接 / 刷新保留状态）
  const [filters, setFilters] = useState<Filters>(() => {
    const q = (k: string, d = "") => (search?.get(k) ?? d);
    const n = (k: string, d: number) => {
      const v = Number(search?.get(k));
      return Number.isFinite(v) && v > 0 ? v : d;
    };
    const sortByQ = (q("sortBy", DEFAULT_FILTERS.sortBy) as SortBy) || "createdAt";
    const sortOrderQ = (q("sortOrder", DEFAULT_FILTERS.sortOrder) as SortOrder) || "desc";
    const statusQ = (q("status", DEFAULT_FILTERS.status) as Filters["status"]) || "";
    return {
      page: n("page", DEFAULT_FILTERS.page),
      limit: n("limit", DEFAULT_FILTERS.limit),
      status: statusQ,
      code: q("code", DEFAULT_FILTERS.code),
      start: q("start", DEFAULT_FILTERS.start),
      end: q("end", DEFAULT_FILTERS.end),
      sortBy: sortByQ,
      sortOrder: sortOrderQ,
    };
  });

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ActivationCode[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 同步 filters 到 URL（浅刷新）
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === undefined || v === null) return;
      params.set(k, String(v));
    });
    const qs = params.toString();
    const href = qs ? `/admin/activation-codes?${qs}` : `/admin/activation-codes`;
    // 仅替换，不触发新的页面装载
    window.history.replaceState(null, "", href);
  }, [filters]);

  // 拉取列表
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<ListResponse>("/api/admin/activation-codes", {
          query: {
            page: filters.page,
            limit: filters.limit,
            status: filters.status || undefined,
            code: filters.code || undefined,
            start: filters.start || undefined,
            end: filters.end || undefined,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
          },
        });
        if (!mounted) return;
        // apiGet 返回的是 data 字段（已在 apiClient 解包）
        const payload = data as unknown as any;
        const items = (payload.items ?? payload) as ActivationCode[];
        setItems(items);
        const pg: Pagination | undefined = payload.pagination;
        setPagination(pg || null);
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
    // 提交时回到第一页
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

  const changeSort = (key: SortBy) => {
    setFilters((f) => ({
      ...f,
      sortBy: key,
      sortOrder: f.sortBy === key ? (f.sortOrder === "asc" ? "desc" : "asc") : "desc",
      page: 1,
    }));
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`确认删除激活码 #${id} ?`)) return;
    try {
      await apiDelete<unknown, { id: number }>("/api/admin/activation-codes", {
        id,
      });
      // 删除后刷新当前页
      setFilters((f) => ({ ...f }));
    } catch (e) {
      if (e instanceof ApiError) {
        alert(`删除失败：${e.errorCode} - ${e.message}`);
      } else {
        alert("删除失败：未知错误");
      }
    }
  };

  // 状态徽标
  const StatusBadge: React.FC<{ s: ActivationCode["status"] }> = ({ s }) => {
    const map: Record<ActivationCode["status"], string> = {
      enabled: "bg-emerald-100 text-emerald-800",
      disabled: "bg-gray-200 text-gray-800",
      suspended: "bg-amber-100 text-amber-800",
      expired: "bg-rose-100 text-rose-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s]}`}>
        {s}
      </span>
    );
  };

  // 列头（可排序）
  const SortHeader: React.FC<{ k: SortBy; label: string }> = ({ k, label }) => {
    const active = filters.sortBy === k;
    return (
      <button
        type="button"
        onClick={() => changeSort(k)}
        className="inline-flex items-center gap-1"
        title="点击切换排序"
      >
        <span>{label}</span>
        <span className="text-[10px] text-gray-400">
          {active ? (filters.sortOrder === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  };

  // 时间格式
  const fmt = (v?: string | null) =>
    v ? new Date(v).toISOString().replace(".000Z", "Z") : "—";

  return (
    <div className="space-y-4">
      {/* 顶部操作区 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activation Codes</h2>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/activation-codes/new"
            className="inline-flex items-center rounded-md bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-black"
          >
            + 批量生成
          </Link>
          <button
            className="rounded-md border border-gray-300 text-sm px-3 py-1.5 hover:bg-gray-100"
            onClick={() => setFilters((f) => ({ ...f }))}
          >
            刷新
          </button>
        </div>
      </div>

      {/* 检索表单 */}
      <form
        onSubmit={onSearchSubmit}
        className="bg-white border border-gray-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-6 gap-3"
      >
        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">状态</label>
          <select
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value as Filters["status"] }))
            }
          >
            <option value="">全部</option>
            <option value="enabled">enabled</option>
            <option value="disabled">disabled</option>
            <option value="suspended">suspended</option>
            <option value="expired">expired</option>
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">激活码</label>
          <input
            placeholder="按 code 精确或前缀"
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.code}
            onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))}
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">到期开始</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.start}
            onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">到期结束</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.end}
            onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">排序字段</label>
          <select
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.sortBy}
            onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as SortBy }))}
          >
            <option value="createdAt">createdAt</option>
            <option value="enabledAt">enabledAt</option>
            <option value="expiresAt">expiresAt</option>
            <option value="usedCount">usedCount</option>
            <option value="usageLimit">usageLimit</option>
            <option value="status">status</option>
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">排序方向</label>
          <select
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={filters.sortOrder}
            onChange={(e) =>
              setFilters((f) => ({ ...f, sortOrder: e.target.value as SortOrder }))
            }
          >
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
        </div>

        <div className="md:col-span-6 flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-black"
          >
            查询
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-300 text-sm px-3 py-1.5 hover:bg-gray-100"
            onClick={onReset}
          >
            重置
          </button>
        </div>
      </form>

      {/* 错误提示 */}
      {error && (
        <div className="border border-rose-200 bg-rose-50 text-rose-800 text-sm rounded-md px-3 py-2">
          {error}{" "}
          {error.includes("未授权") && (
            <Link href="/admin/login" className="underline underline-offset-4">
              去登录
            </Link>
          )}
        </div>
      )}

      {/* 列表区域 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 w-20">ID</th>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">
                <SortHeader k="status" label="Status" />
              </th>
              <th className="text-left px-3 py-2">
                <SortHeader k="usageLimit" label="UsageLimit" />
              </th>
              <th className="text-left px-3 py-2">
                <SortHeader k="usedCount" label="UsedCount" />
              </th>
              <th className="text-left px-3 py-2">
                <SortHeader k="enabledAt" label="EnabledAt" />
              </th>
              <th className="text-left px-3 py-2">
                <SortHeader k="expiresAt" label="ExpiresAt" />
              </th>
              <th className="text-left px-3 py-2">
                <SortHeader k="createdAt" label="CreatedAt" />
              </th>
              <th className="text-left px-3 py-2 w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                  正在加载…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={9}>
                  暂无数据
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">{it.id}</td>
                  <td className="px-3 py-2 font-mono">{it.code}</td>
                  <td className="px-3 py-2">
                    <StatusBadge s={it.status} />
                  </td>
                  <td className="px-3 py-2">{it.usageLimit}</td>
                  <td className="px-3 py-2">{it.usedCount}</td>
                  <td className="px-3 py-2">{fmt(it.enabledAt)}</td>
                  <td className="px-3 py-2">{fmt(it.expiresAt)}</td>
                  <td className="px-3 py-2">{fmt(it.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/activation-codes/${it.id}`}
                        className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
                        title="编辑"
                      >
                        编辑
                      </Link>
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="px-2 py-1 rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50"
                        title="删除"
                      >
                        删除
                      </button>
                    </div>
                    {it.notes ? (
                      <div className="text-xs text-gray-400 mt-1 line-clamp-1">{it.notes}</div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页器 */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-500">
          {pagination
            ? `第 ${pagination.page}/${pagination.pages} 页 · 共 ${pagination.total} 条`
            : "—"}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
            onClick={() => changePage(1)}
            disabled={!pagination || filters.page <= 1}
          >
            « 首页
          </button>
          <button
            className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
            onClick={() => changePage(filters.page - 1)}
            disabled={!pagination || filters.page <= 1}
          >
            ‹ 上一页
          </button>
          <span className="px-2">{filters.page}</span>
          <button
            className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
            onClick={() => changePage(filters.page + 1)}
            disabled={!pagination || (pagination && filters.page >= pagination.pages)}
          >
            下一页 ›
          </button>
          <button
            className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
            onClick={() => changePage(pagination ? pagination.pages : filters.page)}
            disabled={!pagination || (pagination && filters.page >= pagination.pages)}
          >
            末页 »
          </button>

          <select
            className="ml-2 border border-gray-300 rounded-md px-2 py-1"
            value={filters.limit}
            onChange={(e) => setFilters((f) => ({ ...f, page: 1, limit: Number(e.target.value) }))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                每页 {n}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
