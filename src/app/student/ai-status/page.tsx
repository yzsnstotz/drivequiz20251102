"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
  const tr = useCallback((key: string, params?: Record<string, string | number>) => {
    let text = t(key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return text;
  }, [t]);
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/verification", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      } else {
        setError(json.message || tr("student.status.loadFailed"));
      }
    } catch (e: any) {
      setError(e?.message || tr("student.status.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const renderBody = () => {
    if (!data || data.status === "none") {
      return (
        <div className="space-y-2">
          <p className="text-gray-700">{tr("student.status.none")}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => router.push("/student/ai-apply")}
          >
            {tr("student.status.applyNow")}
          </button>
        </div>
      );
    }

    if (data.status === "pending") {
      return (
        <div className="space-y-2">
          <p className="text-gray-700">{tr("student.status.pending")}</p>
          <p className="text-sm text-gray-600">{tr("student.status.fullName", { value: data.fullName || "-" })}</p>
          <p className="text-sm text-gray-600">{tr("student.status.schoolName", { value: data.schoolName || "-" })}</p>
          <p className="text-sm text-gray-600">
            {tr("student.status.studyPeriod", { from: data.studyPeriodFrom || "-", to: data.studyPeriodTo || "-" })}
          </p>
        </div>
      );
    }

    if (data.status === "approved") {
      return (
        <div className="space-y-2">
          <p className="text-green-700 font-semibold">{tr("student.status.approved")}</p>
          <p className="text-sm text-gray-600">{tr("student.status.fullName", { value: data.fullName || "-" })}</p>
          <p className="text-sm text-gray-600">{tr("student.status.schoolName", { value: data.schoolName || "-" })}</p>
          <p className="text-sm text-gray-600">
            {tr("student.status.studyPeriod", { from: data.studyPeriodFrom || "-", to: data.studyPeriodTo || "-" })}
          </p>
          <p className="text-sm text-gray-600">
            {tr("student.status.validPeriod", {
              from: data.validFrom ? new Date(data.validFrom).toLocaleDateString() : "-",
              to: data.validUntil ? new Date(data.validUntil).toLocaleDateString() : "-",
            })}
          </p>
        </div>
      );
    }

    if (data.status === "rejected") {
      return (
        <div className="space-y-2">
          <p className="text-red-700 font-semibold">{tr("student.status.rejected")}</p>
          <p className="text-sm text-gray-600">{tr("student.status.reason", { value: data.reviewNote || "-" })}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => router.push("/student/ai-apply")}
          >
            {tr("student.status.resubmit")}
          </button>
        </div>
      );
    }

    if (data.status === "expired") {
      return (
        <div className="space-y-2">
          <p className="text-yellow-700 font-semibold">{tr("student.status.expired")}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => router.push("/student/ai-apply")}
          >
            {tr("student.status.reapply")}
          </button>
        </div>
      );
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-4">{tr("student.status.title")}</h1>
      {loading && <div className="text-gray-600 mb-4">{tr("student.status.loading")}</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <div className="bg-white border rounded p-4 shadow-sm">{renderBody()}</div>
    </div>
  );
}
