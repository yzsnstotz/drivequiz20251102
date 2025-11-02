"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/apiClient";

type Stats = {
  total: number;
  byStatus: {
    enabled: number;
    disabled: number;
    suspended: number;
    expired: number;
  };
  usage: {
    used: number;
    unused: number;
    rate: number;
  };
  generatedAt?: string;
};

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; errorCode?: string; message?: string };

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get("/api/admin/activation-codes/stats");
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "加载失败");
        }
        const ok = res as ApiOk<Stats>;
        setStats(ok.data);
      } catch (e: any) {
        setError(e?.message || "加载失败");
        setStats(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-md border border-gray-200 bg-white p-4">加载中…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          错误：{error}
        </div>
      </div>
    );
  }

  // 确保数据结构完整，防止运行时错误
  const statsData: Stats = stats
    ? {
        total: stats.total ?? 0,
        byStatus: {
          enabled: stats.byStatus?.enabled ?? 0,
          disabled: stats.byStatus?.disabled ?? 0,
          suspended: stats.byStatus?.suspended ?? 0,
          expired: stats.byStatus?.expired ?? 0,
        },
        usage: {
          used: stats.usage?.used ?? 0,
          unused: stats.usage?.unused ?? 0,
          rate: stats.usage?.rate ?? 0,
        },
        generatedAt: stats.generatedAt,
      }
    : {
        total: 0,
        byStatus: { enabled: 0, disabled: 0, suspended: 0, expired: 0 },
        usage: { used: 0, unused: 0, rate: 0 },
      };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">激活码管理概览</p>
      </div>

      {/* 快速统计卡片 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Link
          href="/admin/activation-codes"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-500">激活码总数</div>
          <div className="mt-1 text-2xl font-semibold">{statsData.total}</div>
        </Link>

        <Link
          href="/admin/activation-codes?status=enabled"
          className="rounded-lg border border-green-200 bg-green-50 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-600">已启用</div>
          <div className="mt-1 text-2xl font-semibold text-green-700">
            {statsData.byStatus.enabled}
          </div>
        </Link>

        <Link
          href="/admin/activation-codes?status=expired"
          className="rounded-lg border border-red-200 bg-red-50 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-600">已过期</div>
          <div className="mt-1 text-2xl font-semibold text-red-700">
            {statsData.byStatus.expired}
          </div>
        </Link>

        <Link
          href="/admin/stats"
          className="rounded-lg border border-blue-200 bg-blue-50 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-sm text-gray-600">使用率</div>
          <div className="mt-1 text-2xl font-semibold text-blue-700">
            {toPct(statsData.usage.rate)}
          </div>
        </Link>
      </div>

      {/* 状态分布 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">状态分布</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <div className="text-sm text-gray-500">已启用</div>
            <div className="mt-1 text-xl font-semibold">{statsData.byStatus.enabled}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">未启用</div>
            <div className="mt-1 text-xl font-semibold">{statsData.byStatus.disabled}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">挂起</div>
            <div className="mt-1 text-xl font-semibold">{statsData.byStatus.suspended}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">已过期</div>
            <div className="mt-1 text-xl font-semibold">{statsData.byStatus.expired}</div>
          </div>
        </div>
      </div>

      {/* 使用情况 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">使用情况</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">已使用</div>
            <div className="mt-1 text-xl font-semibold">{statsData.usage.used}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">未使用</div>
            <div className="mt-1 text-xl font-semibold">{statsData.usage.unused}</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm text-gray-500 mb-2">使用率</div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${statsData.usage.rate * 100}%` }}
            ></div>
          </div>
          <div className="mt-1 text-sm text-gray-600">{toPct(statsData.usage.rate)}</div>
        </div>
      </div>

      {/* 快速操作 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">快速操作</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/activation-codes/new"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 text-center"
          >
            生成激活码
          </Link>
          <Link
            href="/admin/activation-codes"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 text-center"
          >
            查看激活码列表
          </Link>
          <Link
            href="/admin/users"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 text-center"
          >
            查看用户
          </Link>
          <Link
            href="/admin/stats"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 text-center"
          >
            详细统计
          </Link>
          <Link
            href="/admin/tasks"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 text-center"
          >
            任务管理
          </Link>
        </div>
      </div>
    </div>
  );
}

