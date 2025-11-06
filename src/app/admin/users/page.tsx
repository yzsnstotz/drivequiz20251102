// ============================================================
// 文件路径: src/app/admin/users/page.tsx
// 功能: 用户管理页面（查询 / 排序 / 分页展示）
// 依赖: src/lib/apiClient.ts（统一鉴权与错误处理）
// 规范: 后端响应 { ok: true, data, pagination }；字段 camelCase；时间 ISO8601（UTC）
// 路由: GET /api/admin/users?email&code&page&limit&sortBy&order
// 允许的排序键: activatedAt | email | code
// ============================================================

"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import apiClient from "@/lib/apiClient";
import { useRouter, useSearchParams } from "next/navigation";
import { getIPGeolocation, isPrivateIP, type IPGeolocationInfo } from "@/lib/ipGeolocation";

// ---- 类型定义（与后端契约保持一致） ----
type SortKey = "createdAt" | "email" | "lastLoginAt";
type SortOrder = "asc" | "desc";

type Row = {
  id: number;
  userid: string | null; // 添加userid字段
  email: string;
  name: string | null;
  phone: string | null;
  status: "active" | "inactive" | "suspended" | "pending" | null;
  createdAt: string | null; // ISO8601
  updatedAt: string | null; // ISO8601
  lastLoginAt: string | null; // ISO8601
  activationCode: string | null;
  codeStatus: "enabled" | "disabled" | "expired" | "suspended" | null;
  codeExpiresAt: string | null; // ISO8601
  ipAddress: string | null;
  userAgent: string | null;
  clientType: string | null;
};

type BehaviorRecord = {
  ip?: string | null;
  userAgent?: string | null;
  clientType?: string | null;
  createdAt: string;
};

type UserBehaviorRecord = {
  id: number;
  behaviorType: string;
  ipAddress: string | null;
  userAgent: string | null;
  clientType: string | null;
  metadata: any | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

type ApiOk = { ok: true; data: Row[]; pagination?: Pagination };
type ApiErr = { ok: false; errorCode?: string; message?: string };

const SORT_KEYS: SortKey[] = ["createdAt", "email", "lastLoginAt"];
const ORDERS: SortOrder[] = ["desc", "asc"];

function buildQuery(params: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  return sp.toString();
}

export default function AdminUsersPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // URL 参数作为初始状态（便于刷新/分享）
  const [email, setEmail] = useState<string>(sp.get("email") ?? "");
  const [code, setCode] = useState<string>(sp.get("code") ?? "");
  const [sortBy, setSortBy] = useState<SortKey>(
    (sp.get("sortBy") as SortKey) || "createdAt"
  );
  const [order, setOrder] = useState<SortOrder>(
    (sp.get("order") as SortOrder) || "desc"
  );
  const [page, setPage] = useState<number>(Number(sp.get("page") || 1));
  const [limit] = useState<number>(Number(sp.get("limit") || 20)); // 固定 20，可按需改为可选

  const [loading, setLoading] = useState<boolean>(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Pagination | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 状态编辑相关状态
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<Row["codeStatus"]>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // IP地理位置信息缓存
  const [ipGeolocations, setIPGeolocations] = useState<Map<string, IPGeolocationInfo>>(new Map());
  
  // 历史记录弹窗状态
  const [showHistoryModal, setShowHistoryModal] = useState<{
    userId: number;
    type: "ip" | "userAgent";
    email: string;
  } | null>(null);
  const [historyRecords, setHistoryRecords] = useState<BehaviorRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // 用户行为弹窗状态（点击用户ID时显示）
  const [showBehaviorModal, setShowBehaviorModal] = useState<{
    userId: number;
    userid: string | null;
    email: string;
  } | null>(null);
  const [behaviorRecords, setBehaviorRecords] = useState<UserBehaviorRecord[]>([]);
  const [loadingBehaviors, setLoadingBehaviors] = useState<boolean>(false);
  const [behaviorHasMore, setBehaviorHasMore] = useState<boolean>(false);
  const [behaviorOffset, setBehaviorOffset] = useState<number>(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 触发加载
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = buildQuery({ email, code, page, limit, sortBy, order });
        const res = await apiClient.get(`/api/admin/users?${qs}`);
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "加载失败");
        }
        const ok = res as unknown as ApiOk;
        if (!mounted) return;
        setRows(ok.data || []);
        // Transform API pagination (may have different structure) to our Pagination type
        const pagination = ok.pagination as any;
        if (pagination) {
          setMeta({
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages ?? pagination.pages ?? 0,
            hasPrev: pagination.hasPrev ?? (pagination.page > 1),
            hasNext: pagination.hasNext ?? (pagination.page < (pagination.totalPages ?? pagination.pages ?? 1)),
          });
        } else {
          setMeta(null);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "加载失败");
        setRows([]);
        setMeta(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [email, code, page, limit, sortBy, order]);

  // 加载IP地理位置信息
  useEffect(() => {
    if (rows.length === 0) return;

    async function loadGeolocations() {
      const uniqueIPs = Array.from(
        new Set(rows.map((r) => r.ipAddress).filter((ip): ip is string => !!ip && ip !== "-" && ip !== "unknown"))
      );

      if (uniqueIPs.length === 0) return;

      const geolocations = new Map<string, IPGeolocationInfo>();

      // 批量加载地理位置信息（带延迟避免请求过快）
      for (const ip of uniqueIPs) {
        try {
          // 内网IP不查询地理位置
          if (isPrivateIP(ip)) {
            geolocations.set(ip, {
              displayName: "内网地址",
              rawIP: ip,
            });
          } else {
            const info = await getIPGeolocation(ip);
            if (info) {
              geolocations.set(ip, info);
            }
            // 添加小延迟避免请求过快（后端API已有限流，这里添加小延迟即可）
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`[Users] Failed to load geolocation for IP ${ip}:`, error);
        }
      }

      setIPGeolocations((prev) => {
        const merged = new Map(prev);
        geolocations.forEach((value, key) => merged.set(key, value));
        return merged;
      });
    }

    loadGeolocations();
  }, [rows]);

  // 同步 URL（无刷新导航）
  useEffect(() => {
    const qs = buildQuery({ email, code, page, limit, sortBy, order });
    router.replace(`/admin/users?${qs}`);
  }, [email, code, page, limit, sortBy, order, router]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1); // 新搜索回到第一页
  }

  function toggleOrder() {
    setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  function onChangeSort(next: SortKey) {
    setSortBy(next);
    setPage(1);
  }

  function goPrev() {
    if (meta?.hasPrev) setPage((p) => Math.max(1, p - 1));
  }

  function goNext() {
    if (meta?.hasNext) setPage((p) => p + 1);
  }

  const totalLabel = useMemo(() => {
    if (!meta) return "";
    return `共 ${meta.total} 条 / 第 ${meta.page}/${meta.totalPages} 页`;
    // 时间展示要求 ISO8601，表格中将直接展示 ISO 字符串
  }, [meta]);

  // 通过激活码代码查找激活码ID（精确匹配）
  async function findCodeIdByCode(code: string): Promise<number | null> {
    try {
      // 使用专门的API端点通过代码精确查找激活码
      const res = await apiClient.get<{ id: number; code: string; status: string }>(
        `/api/admin/activation-codes/by-code/${encodeURIComponent(code)}`
      );
      if (res.ok === false) return null;
      const data = (res as any).data;
      // 确保ID是数字类型
      const id = data?.id ? Number(data.id) : null;
      return id && !isNaN(id) ? id : null;
    } catch {
      return null;
    }
  }

  // 打开状态编辑对话框
  function openEditStatus(code: string, currentStatus: Row["codeStatus"]) {
    setEditingCode(code);
    setEditingStatus(currentStatus || "enabled");
    setEditError(null);
  }

  // 关闭状态编辑对话框
  function closeEditStatus() {
    setEditingCode(null);
    setEditingStatus(null);
    setEditError(null);
  }

  // 保存状态更改
  async function saveStatusChange() {
    if (!editingCode || !editingStatus) return;

    setSaving(true);
    setEditError(null);

    try {
      // 1. 通过激活码代码查找ID
      const codeId = await findCodeIdByCode(editingCode);
      if (!codeId) {
        setEditError("找不到激活码");
        setSaving(false);
        return;
      }

      // 2. 调用编辑API更新状态
      const res = await apiClient.put(`/api/admin/activation-codes/${codeId}`, {
        status: editingStatus,
      });

      if (res.ok === false) {
        const err = res as ApiErr;
        setEditError(err.message || "保存失败");
        setSaving(false);
        return;
      }

      // 3. 更新本地状态
      setRows((prevRows) =>
        prevRows.map((row) =>
          row.activationCode === editingCode
            ? { ...row, codeStatus: editingStatus }
            : row
        )
      );

      // 4. 关闭对话框
      closeEditStatus();
    } catch (e: any) {
      setEditError(e?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  // 状态选项
  const statusOptions: Array<{ value: Row["codeStatus"]; label: string }> = [
    { value: "enabled", label: "已启用 (enabled)" },
    { value: "disabled", label: "未启用 (disabled)" },
    { value: "suspended", label: "已挂起 (suspended)" },
    { value: "expired", label: "已过期 (expired)" },
  ];

  // 加载用户历史记录
  async function loadUserHistory(userId: number, type: "ip" | "userAgent") {
    setLoadingHistory(true);
    try {
      const res = await apiClient.get(
        `/api/admin/users/${userId}/behaviors?type=${type}&limit=10`
      );
      if (res.ok && (res as any).data) {
        setHistoryRecords((res as any).data.records || []);
      } else {
        setHistoryRecords([]);
      }
    } catch (e: any) {
      console.error("Failed to load history:", e);
      setHistoryRecords([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  // 打开历史记录弹窗
  function openHistoryModal(userId: number, type: "ip" | "userAgent", email: string) {
    setShowHistoryModal({ userId, type, email });
    loadUserHistory(userId, type);
  }

  // 关闭历史记录弹窗
  function closeHistoryModal() {
    setShowHistoryModal(null);
    setHistoryRecords([]);
  }

  // 打开用户行为弹窗（点击用户ID时）
  function openBehaviorModal(userId: number, userid: string | null, email: string) {
    setShowBehaviorModal({ userId, userid, email });
    setBehaviorRecords([]);
    setBehaviorOffset(0);
    setBehaviorHasMore(false);
    loadUserBehaviors(userId, 0, true);
  }

  // 关闭用户行为弹窗
  function closeBehaviorModal() {
    setShowBehaviorModal(null);
    setBehaviorRecords([]);
    setBehaviorOffset(0);
    setBehaviorHasMore(false);
  }

  // 加载用户行为记录（支持分页和无限滚动）
  const loadUserBehaviors = useCallback(async (userId: number, offset: number = 0, reset: boolean = false) => {
    if (loadingBehaviors) return;
    
    setLoadingBehaviors(true);
    try {
      const res = await apiClient.get(
        `/api/admin/users/${userId}/behaviors?limit=10&offset=${offset}`
      );
      if (res.ok && (res as any).data) {
        const data = (res as any).data;
        const newRecords = data.records || [];
        
        if (reset) {
          setBehaviorRecords(newRecords);
        } else {
          setBehaviorRecords((prev) => [...prev, ...newRecords]);
        }
        
        setBehaviorOffset(offset + newRecords.length);
        setBehaviorHasMore(data.pagination?.hasMore ?? false);
      } else {
        if (!reset) {
          // 如果不是重置，保留现有数据
          return;
        }
        setBehaviorRecords([]);
        setBehaviorHasMore(false);
      }
    } catch (e: any) {
      console.error("Failed to load behaviors:", e);
      if (reset) {
        setBehaviorRecords([]);
        setBehaviorHasMore(false);
      }
    } finally {
      setLoadingBehaviors(false);
    }
  }, [loadingBehaviors]);

  // 加载更多行为记录（无限滚动）
  const loadMoreBehaviors = useCallback(() => {
    if (!showBehaviorModal || loadingBehaviors || !behaviorHasMore) return;
    loadUserBehaviors(showBehaviorModal.userId, behaviorOffset, false);
  }, [showBehaviorModal, loadingBehaviors, behaviorHasMore, behaviorOffset, loadUserBehaviors]);

  // 行为类型中文映射
  const behaviorTypeLabels: Record<string, string> = {
    login: "登录",
    logout: "登出",
    start_quiz: "开始答题",
    complete_quiz: "完成答题",
    pause_quiz: "暂停答题",
    resume_quiz: "继续答题",
    view_page: "查看页面",
    ai_chat: "AI聊天",
    other: "其他",
  };

  // 无限滚动：监听滚动到底部自动加载
  useEffect(() => {
    if (!showBehaviorModal || !behaviorHasMore || loadingBehaviors) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && behaviorHasMore && !loadingBehaviors && showBehaviorModal) {
          loadMoreBehaviors();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [showBehaviorModal, behaviorHasMore, loadingBehaviors, loadMoreBehaviors]);

  return (
    <div className="mx-auto w-full max-w-full p-0">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <h1 className="text-lg sm:text-xl font-semibold">用户管理</h1>
        <button
          className="rounded-md border px-3 py-2 sm:py-1 text-sm hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
          onClick={() => {
            setEmail("");
            setCode("");
            setSortBy("createdAt");
            setOrder("desc");
            setPage(1);
          }}
        >
          重置
        </button>
      </div>

      {/* 搜索与排序栏 */}
      <form
        onSubmit={onSearch}
        className="mb-4 grid grid-cols-1 gap-3 rounded-2xl shadow-sm bg-white p-4 md:shadow-md md:grid-cols-4"
      >
        <div className="md:col-span-1">
          <label className="mb-1 block text-sm text-gray-600">邮箱（模糊）</label>
          <input
            type="text"
            className="w-full rounded-md border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>

        <div className="md:col-span-1">
          <label className="mb-1 block text-sm text-gray-600">激活码（模糊）</label>
          <input
            type="text"
            className="w-full rounded-md border px-3 py-2"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC123"
          />
        </div>

        <div className="md:col-span-1">
          <label className="mb-1 block text-sm text-gray-600">排序字段</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={sortBy}
            onChange={(e) => onChangeSort(e.target.value as SortKey)}
          >
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="mb-1 block text-sm text-gray-600">排序方向</label>
          <div className="flex items-center gap-2">
            <select
              className="w-full rounded-md border px-3 py-2"
              value={order}
              onChange={(e) => setOrder(e.target.value as SortOrder)}
            >
              {ORDERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
              onClick={toggleOrder}
              title="切换 ASC/DESC"
            >
              切换
            </button>
          </div>
        </div>

        <div className="md:col-span-4">
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-500 text-white px-4 py-2.5 sm:py-2 text-sm font-medium disabled:opacity-50 hover:bg-blue-600 active:bg-blue-700 touch-manipulation transition-colors shadow-sm"
            disabled={loading}
          >
            {loading ? "查询中…" : "查询"}
          </button>
        </div>
      </form>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 统计与分页 */}
      <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
        <div>{totalLabel}</div>
        <div className="space-x-2">
          <button
            className="rounded-md border px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
            onClick={goPrev}
            disabled={!meta?.hasPrev || loading}
          >
            上一页
          </button>
          <button
            className="rounded-md border px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
            onClick={goNext}
            disabled={!meta?.hasNext || loading}
          >
            下一页
          </button>
        </div>
      </div>

      {/* 数据表 - 桌面端 */}
      <div className="hidden md:block overflow-x-auto rounded-md border border-gray-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-4 py-2">用户ID</th>
              <th className="px-4 py-2">邮箱</th>
              <th className="px-4 py-2">激活码</th>
              <th className="px-4 py-2">注册时间 (UTC)</th>
              <th className="px-4 py-2">最后登录 (UTC)</th>
              <th className="px-4 py-2">激活码状态</th>
              <th className="px-4 py-2">激活码到期 (UTC)</th>
              <th className="px-4 py-2">IP</th>
              <th className="px-4 py-2">User-Agent</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-3" colSpan={10}>
                  加载中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={10}>
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">
                    <button
                      onClick={() => openBehaviorModal(r.id, r.userid, r.email)}
                      className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      title="点击查看用户行为记录"
                    >
                      {r.userid ?? r.id}
                    </button>
                  </td>
                  <td className="px-4 py-2">{r.email}</td>
                  <td className="px-4 py-2 font-mono">{r.activationCode ?? "-"}</td>
                  <td className="px-4 py-2">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</td>
                  <td className="px-4 py-2">{r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : "-"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        r.codeStatus === "enabled"
                          ? "bg-green-100 text-green-800"
                          : r.codeStatus === "expired"
                          ? "bg-red-100 text-red-800"
                          : r.codeStatus === "suspended"
                          ? "bg-amber-100 text-amber-800"
                          : r.codeStatus === "disabled"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-gray-50 text-gray-500"
                      }`}
                    >
                      {r.codeStatus ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-2">{r.codeExpiresAt ?? "-"}</td>
                  <td className="px-4 py-2">
                    {r.ipAddress && r.ipAddress !== "-" ? (
                      <button
                        onClick={() => openHistoryModal(r.id, "ip", r.email)}
                        className="inline-flex items-center text-sm cursor-pointer text-blue-600 hover:text-blue-800 hover:underline"
                        title="点击查看历史IP记录"
                      >
                        {(() => {
                          const geolocation = ipGeolocations.get(r.ipAddress!);
                          if (geolocation) {
                            return (
                              <span className="inline-flex items-center gap-1">
                                <span className="font-medium">{geolocation.displayName}</span>
                              </span>
                            );
                          } else if (isPrivateIP(r.ipAddress)) {
                            return (
                              <span className="inline-flex items-center gap-1">
                                <span className="text-gray-500">内网地址</span>
                              </span>
                            );
                          } else {
                            return (
                              <span className="inline-flex items-center gap-1">
                                <span className="text-gray-400 text-xs">查询中...</span>
                              </span>
                            );
                          }
                        })()}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {r.userAgent && r.userAgent !== "-" ? (
                      <button
                        onClick={() => openHistoryModal(r.id, "userAgent", r.email)}
                        className="text-sm cursor-pointer text-blue-600 hover:text-blue-800 hover:underline line-clamp-2 block max-w-[340px] text-left"
                        title="点击查看历史设备记录"
                      >
                        {r.userAgent}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {r.activationCode ? (
                      <button
                        onClick={() => openEditStatus(r.activationCode!, r.codeStatus)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
                        title="编辑激活码状态"
                      >
                        编辑状态
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 移动端卡片 */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">加载中…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => openBehaviorModal(r.id, r.userid, r.email)}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  title="点击查看用户行为记录"
                >
                  用户ID: {r.userid ?? r.id}
                </button>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    r.codeStatus === "enabled"
                      ? "bg-green-100 text-green-800"
                      : r.codeStatus === "expired"
                      ? "bg-red-100 text-red-800"
                      : r.codeStatus === "suspended"
                      ? "bg-amber-100 text-amber-800"
                      : r.codeStatus === "disabled"
                      ? "bg-gray-100 text-gray-800"
                      : "bg-gray-50 text-gray-500"
                  }`}
                >
                  {r.codeStatus ?? "-"}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">邮箱</div>
                <div className="text-sm font-medium break-all">{r.email}</div>
              </div>
              {r.activationCode && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">激活码</div>
                  <div className="font-mono text-sm break-all">{r.activationCode}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">注册:</span> {r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-"}
                </div>
                <div>
                  <span className="text-gray-500">登录:</span> {r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-"}
                </div>
              </div>
              {r.ipAddress && r.ipAddress !== "-" && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">IP地址</div>
                  <button
                    onClick={() => openHistoryModal(r.id, "ip", r.email)}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
                  >
                    {(() => {
                      const geolocation = ipGeolocations.get(r.ipAddress!);
                      if (geolocation) {
                        // 显示IP地址和国家名称
                        const countryText = geolocation.country ? ` · ${geolocation.country}` : "";
                        return (
                          <span className="font-medium">
                            {r.ipAddress}{countryText}
                          </span>
                        );
                      } else if (isPrivateIP(r.ipAddress)) {
                        return <span className="text-gray-500">{r.ipAddress} · 内网地址</span>;
                      } else {
                        return <span className="text-gray-400">{r.ipAddress} · 查询中...</span>;
                      }
                    })()}
                  </button>
                </div>
              )}
              {r.userAgent && r.userAgent !== "-" && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">设备</div>
                  <button
                    onClick={() => openHistoryModal(r.id, "userAgent", r.email)}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left break-all"
                  >
                    {r.userAgent}
                  </button>
                </div>
              )}
              {r.activationCode && (
                <button
                  onClick={() => openEditStatus(r.activationCode!, r.codeStatus)}
                  className="w-full rounded-xl bg-blue-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-blue-600 active:bg-blue-700 touch-manipulation transition-colors shadow-sm"
                >
                  编辑状态
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* 底部分页 */}
      <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 text-sm text-gray-600">
        <div className="text-xs sm:text-sm">{totalLabel}</div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            className="flex-1 sm:flex-none rounded-md border px-3 py-2 sm:py-1 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 touch-manipulation text-xs sm:text-sm"
            onClick={goPrev}
            disabled={!meta?.hasPrev || loading}
          >
            上一页
          </button>
          <button
            className="flex-1 sm:flex-none rounded-md border px-3 py-2 sm:py-1 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 touch-manipulation text-xs sm:text-sm"
            onClick={goNext}
            disabled={!meta?.hasNext || loading}
          >
            下一页
          </button>
        </div>
      </div>

      {/* 状态编辑模态框 */}
      {editingCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">编辑激活码状态</h2>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                激活码
              </label>
              <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm">
                {editingCode}
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                状态
              </label>
              <select
                value={editingStatus || "enabled"}
                onChange={(e) =>
                  setEditingStatus(e.target.value as Row["codeStatus"])
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                disabled={saving}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value ?? ""} value={opt.value ?? ""}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {editError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {editError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={closeEditStatus}
                disabled={saving}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={saveStatusChange}
                disabled={saving || !editingStatus}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录弹窗 */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {showHistoryModal.type === "ip" ? "IP 历史记录" : "设备历史记录"} - {showHistoryModal.email}
              </h2>
              <button
                onClick={closeHistoryModal}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
            {loadingHistory ? (
              <div className="text-center py-8 text-gray-500">加载中…</div>
            ) : historyRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-400">暂无记录</div>
            ) : (
              <div className="space-y-2">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      {showHistoryModal.type === "ip" ? (
                        <>
                          <th className="px-4 py-2 text-left">IP地址</th>
                          <th className="px-4 py-2 text-left">设备</th>
                          <th className="px-4 py-2 text-left">客户端类型</th>
                          <th className="px-4 py-2 text-left">登录时间</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-2 text-left">User-Agent</th>
                          <th className="px-4 py-2 text-left">IP地址</th>
                          <th className="px-4 py-2 text-left">客户端类型</th>
                          <th className="px-4 py-2 text-left">登录时间</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.map((record, index) => (
                      <tr key={index} className="border-t">
                        {showHistoryModal.type === "ip" ? (
                          <>
                            <td className="px-4 py-2 font-mono">{record.ip ?? "-"}</td>
                            <td className="px-4 py-2 text-xs max-w-xs truncate" title={record.userAgent ?? ""}>
                              {record.userAgent ?? "-"}
                            </td>
                            <td className="px-4 py-2">{record.clientType ?? "-"}</td>
                            <td className="px-4 py-2">{new Date(record.createdAt).toLocaleString()}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2 text-xs max-w-md truncate" title={record.userAgent ?? ""}>
                              {record.userAgent ?? "-"}
                            </td>
                            <td className="px-4 py-2 font-mono">{record.ip ?? "-"}</td>
                            <td className="px-4 py-2">{record.clientType ?? "-"}</td>
                            <td className="px-4 py-2">{new Date(record.createdAt).toLocaleString()}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 用户行为弹窗（点击用户ID时显示） */}
      {showBehaviorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg max-h-[80vh] flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">用户行为记录</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {showBehaviorModal.userid && `用户ID: ${showBehaviorModal.userid}`} | 邮箱: {showBehaviorModal.email}
                </p>
              </div>
              <button
                onClick={closeBehaviorModal}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingBehaviors && behaviorRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">加载中…</div>
              ) : behaviorRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-400">暂无行为记录</div>
              ) : (
                <div className="space-y-2">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">行为类型</th>
                        <th className="px-4 py-2 text-left">IP地址</th>
                        <th className="px-4 py-2 text-left">客户端类型</th>
                        <th className="px-4 py-2 text-left">User-Agent</th>
                        <th className="px-4 py-2 text-left">时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {behaviorRecords.map((record) => (
                        <tr key={record.id} className="border-t">
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                              {behaviorTypeLabels[record.behaviorType] || record.behaviorType}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">
                            {record.ipAddress ?? "-"}
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {record.clientType ?? "-"}
                          </td>
                          <td className="px-4 py-2 text-xs max-w-xs truncate" title={record.userAgent ?? ""}>
                            {record.userAgent ?? "-"}
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {new Date(record.createdAt).toLocaleString('zh-CN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* 无限滚动触发器 */}
                  {behaviorHasMore && (
                    <div className="mt-4 text-center">
                      {loadingBehaviors ? (
                        <div className="text-sm text-gray-500 py-4">加载中…</div>
                      ) : (
                        <button
                          onClick={loadMoreBehaviors}
                          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 active:bg-gray-100"
                        >
                          加载更多
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* 滚动到底部自动加载触发器 */}
                  {behaviorHasMore && (
                    <div ref={loadMoreRef} className="h-4" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
