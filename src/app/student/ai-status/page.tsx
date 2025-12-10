"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StatusResponse = {
  id: string | null;
  status: "none" | "pending" | "approved" | "rejected" | "expired";
  fullName?: string;
  schoolName?: string;
  studyPeriodFrom?: string | null;
  studyPeriodTo?: string | null;
  reviewNote?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
};

export default function StudentStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/verification", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      } else {
        setError(json.message || "加载失败");
      }
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const renderBody = () => {
    if (!data || data.status === "none") {
      return (
        <div className="space-y-2">
          <p className="text-gray-700">尚未提交学生免费 AI 激活申请。</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => router.push("/student/ai-apply")}
          >
            去申请
          </button>
        </div>
      );
    }

    if (data.status === "pending") {
      return (
        <div className="space-y-2">
          <p className="text-gray-700">申请已提交，正在审核中。</p>
          <p className="text-sm text-gray-600">姓名：{data.fullName || "-"}</p>
          <p className="text-sm text-gray-600">学校：{data.schoolName || "-"}</p>
          <p className="text-sm text-gray-600">
            学习周期：{data.studyPeriodFrom || "-"} ~ {data.studyPeriodTo || "-"}
          </p>
        </div>
      );
    }

    if (data.status === "approved") {
      return (
        <div className="space-y-2">
          <p className="text-green-700 font-semibold">已通过审核</p>
          <p className="text-sm text-gray-600">姓名：{data.fullName || "-"}</p>
          <p className="text-sm text-gray-600">学校：{data.schoolName || "-"}</p>
          <p className="text-sm text-gray-600">
            学习周期：{data.studyPeriodFrom || "-"} ~ {data.studyPeriodTo || "-"}
          </p>
          <p className="text-sm text-gray-600">
            权益有效期：{data.validFrom ? new Date(data.validFrom).toLocaleDateString() : "-"} ~{" "}
            {data.validUntil ? new Date(data.validUntil).toLocaleDateString() : "-"}
          </p>
        </div>
      );
    }

    if (data.status === "rejected") {
      return (
        <div className="space-y-2">
          <p className="text-red-700 font-semibold">未通过审核</p>
          <p className="text-sm text-gray-600">原因：{data.reviewNote || "-"}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => router.push("/student/ai-apply")}
          >
            修改信息后重新提交
          </button>
        </div>
      );
    }

    if (data.status === "expired") {
      return (
        <div className="space-y-2">
          <p className="text-yellow-700 font-semibold">权益已过期</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => router.push("/student/ai-apply")}
          >
            重新提交申请
          </button>
        </div>
      );
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-4">学生免费 AI 激活 - 状态</h1>
      {loading && <div className="text-gray-600 mb-4">加载中...</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <div className="bg-white border rounded p-4 shadow-sm">{renderBody()}</div>
    </div>
  );
}
