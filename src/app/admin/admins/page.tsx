"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiGet, apiDelete, apiPost } from "@/lib/apiClient";
import { PERMISSION_CATEGORIES, PERMISSION_LABELS, type PermissionCategory } from "@/lib/adminPermissions";

type Admin = {
  id: number;
  username: string;
  token: string;
  isActive: boolean;
  permissions?: string[]; // 权限类别数组
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: Admin[];
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
  username: string;
  isActive: "" | "true" | "false";
  sortBy: "createdAt" | "updatedAt" | "username";
  sortOrder: "asc" | "desc";
};

const DEFAULT_FILTERS: Filters = {
  page: 1,
  limit: 20,
  username: "",
  isActive: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

export default function AdminsPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [checkingPermission, setCheckingPermission] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  // 检查权限：只有默认管理员才能访问
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const currentAdmin = await apiGet<{
          id: number;
          username: string;
          isActive: boolean;
          isDefaultAdmin: boolean;
        }>("/api/admin/me");

        if (!mounted) return;

        if (currentAdmin.isDefaultAdmin) {
          setHasPermission(true);
        } else {
          // 非默认管理员，重定向到首页
          router.replace("/admin");
        }
      } catch (e) {
        if (!mounted) return;
        console.error("Failed to check permission:", e);
        // 权限检查失败，重定向到首页
        router.replace("/admin");
      } finally {
        if (mounted) {
          setCheckingPermission(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const [filters, setFilters] = useState<Filters>(() => {
    const q = (k: string, d = "") => (search?.get(k) ?? d);
    const n = (k: string, d: number) => {
      const v = Number(search?.get(k));
      return Number.isFinite(v) && v > 0 ? v : d;
    };
    return {
      page: n("page", DEFAULT_FILTERS.page),
      limit: n("limit", DEFAULT_FILTERS.limit),
      username: q("username", DEFAULT_FILTERS.username),
      isActive: (q("isActive", DEFAULT_FILTERS.isActive) as Filters["isActive"]) || "",
      sortBy: (q("sortBy", DEFAULT_FILTERS.sortBy) as Filters["sortBy"]) || "createdAt",
      sortOrder: (q("sortOrder", DEFAULT_FILTERS.sortOrder) as Filters["sortOrder"]) || "desc",
    };
  });

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Admin[]>([]);
  const [pagination, setPagination] = useState<ListResponse["pagination"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createPermissions, setCreatePermissions] = useState<string[]>([]);

  // 同步 filters 到 URL
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === undefined || v === null) return;
      params.set(k, String(v));
    });
    const qs = params.toString();
    const href = qs ? `/admin/admins?${qs}` : `/admin/admins`;
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
        if (filters.username) params.username = filters.username;
        if (filters.isActive) params.isActive = filters.isActive;

        const data = await apiGet<ListResponse>("/api/admin/admins", { query: params });
        if (!mounted) return;

        const payload = data as unknown as any;
        const items = (payload.items ?? payload) as Admin[];
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

  const handleDelete = async (id: number) => {
    if (!confirm(`确认删除（禁用）管理员 #${id} ?`)) return;
    try {
      await apiDelete<{ deleted: number }>(`/api/admin/admins/${id}`);
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

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username")?.toString() || "";
    const token = formData.get("token")?.toString() || "";
    const isActive = formData.get("isActive")?.toString() === "true";

    try {
      const payload: Record<string, any> = {
        username,
        isActive,
        permissions: createPermissions,
      };
      if (token) payload.token = token;

      const result = await apiPost<Admin>("/api/admin/admins", payload);
      
      // 显示完整token（仅在创建时显示一次）
      const fullToken = (result as any).token;
      if (fullToken) {
        alert(`管理员创建成功！\n\n用户名: ${username}\nToken: ${fullToken}\n\n请保存此Token，这是唯一一次显示。`);
      }

      setShowCreateForm(false);
      setCreatePermissions([]);
      setFilters((f) => ({ ...f }));
    } catch (e) {
      if (e instanceof ApiError) {
        setCreateError(`${e.errorCode}: ${e.message}`);
      } else {
        setCreateError(e instanceof Error ? e.message : "创建失败");
      }
    } finally {
      setCreating(false);
    }
  };

  const fmt = (v?: string | null) =>
    v ? new Date(v).toISOString().replace(".000Z", "Z").slice(0, 19).replace("T", " ") : "—";

  // 权限检查中
  if (checkingPermission) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="text-center py-8 text-gray-500 text-sm">检查权限中...</div>
      </div>
    );
  }

  // 无权限
  if (!hasPermission) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          无权限：只有默认管理员才能访问此页面
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 顶部操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <h2 className="text-base sm:text-lg font-semibold">Admins</h2>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center rounded-xl bg-blue-500 text-white text-sm font-medium px-4 py-2.5 sm:px-3 sm:py-2 hover:bg-blue-600 active:bg-blue-700 touch-manipulation transition-colors shadow-sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            + 创建管理员
          </button>
          <button
            className="rounded-md border border-gray-300 text-sm px-3 py-2 sm:py-1.5 hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            onClick={() => setFilters((f) => ({ ...f }))}
          >
            刷新
          </button>
        </div>
      </div>

      {/* 创建表单 */}
      {showCreateForm && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-medium mb-3">创建新管理员</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                用户名 *
              </label>
              <input
                type="text"
                name="username"
                required
                minLength={3}
                maxLength={50}
                pattern="[a-zA-Z0-9_-]+"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="3-50个字符，仅支持字母、数字、下划线、连字符"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Token（可选，留空将自动生成）
              </label>
              <input
                type="text"
                name="token"
                minLength={8}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="至少8个字符，留空将自动生成32位随机token"
              />
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isActive" defaultChecked value="true" />
                <span className="text-xs text-gray-700">启用</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                权限类别
              </label>
              <div className="space-y-2 border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                {Object.entries(PERMISSION_CATEGORIES)
                  .filter(([key]) => key !== 'ADMINS') // 排除管理员管理权限（只有超级管理员）
                  .map(([key, value]) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createPermissions.includes(value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCreatePermissions([...createPermissions, value]);
                          } else {
                            setCreatePermissions(createPermissions.filter(p => p !== value));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-700">
                        {PERMISSION_LABELS[value as PermissionCategory]}
                      </span>
                    </label>
                  ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                选择此管理员可以访问的管理页面。超级管理员自动拥有所有权限。
              </p>
            </div>
            {createError && (
              <div className="text-xs text-red-600">{createError}</div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center rounded-md bg-gray-900 text-white text-sm px-3 py-1.5 hover:bg-black disabled:opacity-50"
              >
                {creating ? "创建中..." : "创建"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateError(null);
                  setCreatePermissions([]);
                }}
                className="rounded-md border border-gray-300 text-sm px-3 py-1.5 hover:bg-gray-100"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 筛选表单 */}
      <form onSubmit={onSearchSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">用户名</label>
          <input
            type="text"
            value={filters.username}
            onChange={(e) => setFilters((f) => ({ ...f, username: e.target.value, page: 1 }))}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            placeholder="搜索用户名..."
          />
        </div>
        <div className="w-[120px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">状态</label>
          <select
            value={filters.isActive}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                isActive: e.target.value as Filters["isActive"],
                page: 1,
              }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">全部</option>
            <option value="true">启用</option>
            <option value="false">禁用</option>
          </select>
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
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">用户名</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">Token</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">状态</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">创建时间</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-xs">{item.id}</td>
                    <td className="py-2 px-3 text-xs font-medium">{item.username}</td>
                    <td className="py-2 px-3 text-xs font-mono text-gray-600">{item.token}</td>
                    <td className="py-2 px-3 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {item.isActive ? "启用" : "禁用"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-600">{fmt(item.createdAt)}</td>
                    <td className="py-2 px-3 text-xs">
                      <Link
                        href={`/admin/admins/${item.id}`}
                        className="text-blue-600 hover:underline mr-2"
                      >
                        编辑
                      </Link>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:underline"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
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
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {item.isActive ? "启用" : "禁用"}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">用户名</div>
                  <div className="text-sm font-medium">{item.username}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Token</div>
                  <div className="font-mono text-xs break-all text-gray-600">{item.token}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">创建时间</div>
                  <div className="text-xs text-gray-600">{fmt(item.createdAt)}</div>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <Link
                    href={`/admin/admins/${item.id}`}
                    className="flex-1 text-center rounded-xl bg-blue-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-blue-600 active:bg-blue-700 touch-manipulation transition-colors shadow-sm"
                  >
                    编辑
                  </Link>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex-1 text-center rounded-xl bg-red-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-600 active:bg-red-700 touch-manipulation transition-colors shadow-sm"
                  >
                    删除
                  </button>
                </div>
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

