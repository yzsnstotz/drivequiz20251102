"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/apiClient";

type VerificationItem = {
  id: string;
  fullName: string | null;
  email: string | null;
  status: "pending" | "approved" | "rejected" | "expired";
  schoolName: string | null;
  channelSource: string | null;
  createdAt: string | null;
  validUntil: string | null;
  reviewNote?: string | null;
};

const STATUS_LABEL: Record<VerificationItem["status"], string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  expired: "已过期",
};

export default function AdminStudentVerificationsPage() {
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get("/api/admin/student/verifications");
        if (!res.ok) {
          throw new Error((res as any)?.message || "加载失败");
        }
        const data = (res as any).data;
        if (mounted) {
          setItems(data?.items || []);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "加载失败");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">学生申请审核</h1>
          <p className="text-sm text-gray-600 mt-1">查看并进入学生申请审核详情</p>
        </div>
      </div>

      {loading && <div className="text-gray-600">加载中...</div>}
      {error && <div className="text-red-600">加载失败：{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">申请人</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">邮箱</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">学校/来源</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">状态</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">驳回原因</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">有效期</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-600" colSpan={7}>
                    暂无数据
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{item.fullName || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.email || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="space-y-1">
                      <div>{item.schoolName || "-"}</div>
                      <div className="text-xs text-gray-500">渠道：{item.channelSource || "-"}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{STATUS_LABEL[item.status] ?? item.status}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.status === "rejected" ? item.reviewNote || "-" : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.createdAt ? item.createdAt.replace("T", " ").replace("Z", "") : "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.validUntil ? item.validUntil.replace("T", " ").replace("Z", "") : "-"}</td>
                  <td className="px-4 py-3 text-sm text-blue-600">
                    <Link href={`/admin/student/verifications/${item.id}`} className="hover:underline">
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
