"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";

type AdmissionDoc = {
  fileId: string;
  bucket: string;
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
};

type VerificationDetail = {
  id: string;
  userId: string | null;
  fullName: string | null;
  nationality: string | null;
  email: string | null;
  phoneNumber: string | null;
  channelSource: string | null;
  schoolName: string | null;
  studyPeriodFrom: string | null;
  studyPeriodTo: string | null;
  admissionDocs: AdmissionDoc[];
  status: "pending" | "approved" | "rejected" | "expired";
  reviewNote: string | null;
  reviewerId: string | null;
  reviewedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const STATUS_LABEL: Record<VerificationDetail["status"], string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  expired: "已过期",
};

export default function AdminStudentVerificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [data, setData] = useState<VerificationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [approveValidUntil, setApproveValidUntil] = useState<string>("");
  const [approveValidFrom, setApproveValidFrom] = useState<string>("");
  const [rejectNote, setRejectNote] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get(`/api/admin/student/verifications/${id}`);
        if (!res.ok) {
          throw new Error((res as any)?.message || "加载失败");
        }
        const detail = (res as any).data as VerificationDetail;
        if (mounted) setData(detail);
      } catch (e: any) {
        if (mounted) setError(e?.message || "加载失败");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">学生申请详情</h1>
          <p className="text-sm text-gray-600">ID: {id || "-"}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          返回
        </button>
      </div>

      {loading && <div className="text-gray-600">加载中...</div>}
      {error && <div className="text-red-600">加载失败：{error}</div>}

      {!loading && !error && data && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
            <div className="text-sm text-gray-500">状态</div>
            <div className="text-lg font-semibold text-gray-900">{STATUS_LABEL[data.status] ?? data.status}</div>
            {data.validUntil && <div className="text-sm text-gray-600">有效期至：{data.validUntil.replace("T", " ").replace("Z", "")}</div>}
            {data.reviewNote && <div className="text-sm text-gray-700">审核备注：{data.reviewNote}</div>}
            {data.status === "pending" && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-900">审核通过</div>
                  <label className="block text-xs text-gray-600">
                    生效时间（可选）
                    <input
                      type="datetime-local"
                      value={approveValidFrom}
                      onChange={(e) => setApproveValidFrom(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-gray-600">
                    失效时间（必填）
                    <input
                      type="datetime-local"
                      value={approveValidUntil}
                      onChange={(e) => setApproveValidUntil(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    disabled={actionLoading}
                    onClick={async () => {
                      if (!approveValidUntil) {
                        setActionMessage("请填写失效时间");
                        return;
                      }
                      try {
                        setActionLoading(true);
                        setActionMessage(null);
                        const body: any = { validUntil: new Date(approveValidUntil).toISOString() };
                        if (approveValidFrom) body.validFrom = new Date(approveValidFrom).toISOString();
                        const res = await apiClient.post(`/api/admin/student/verifications/${id}/approve`, body);
                        if (!res.ok) throw new Error((res as any)?.message || "操作失败");
                        setActionMessage("审核通过成功");
                        // 重新拉取详情
                        const detailRes = await apiClient.get(`/api/admin/student/verifications/${id}`);
                        if (detailRes.ok) setData((detailRes as any).data as VerificationDetail);
                      } catch (e: any) {
                        setActionMessage(e?.message || "操作失败");
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    className="inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {actionLoading ? "处理中..." : "确认通过"}
                  </button>
                </div>

                <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-900">审核驳回</div>
                  <label className="block text-xs text-gray-600">
                    驳回原因（必填）
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      placeholder="请输入驳回原因"
                    />
                  </label>
                  <button
                    disabled={actionLoading}
                    onClick={async () => {
                      if (!rejectNote.trim()) {
                        setActionMessage("请填写驳回原因");
                        return;
                      }
                      try {
                        setActionLoading(true);
                        setActionMessage(null);
                        const res = await apiClient.post(`/api/admin/student/verifications/${id}/reject`, {
                          reviewNote: rejectNote.trim(),
                        });
                        if (!res.ok) throw new Error((res as any)?.message || "操作失败");
                        setActionMessage("已驳回");
                        const detailRes = await apiClient.get(`/api/admin/student/verifications/${id}`);
                        if (detailRes.ok) setData((detailRes as any).data as VerificationDetail);
                      } catch (e: any) {
                        setActionMessage(e?.message || "操作失败");
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {actionLoading ? "处理中..." : "确认驳回"}
                  </button>
                </div>
              </div>
            )}
            {actionMessage && <div className="text-sm text-blue-700 mt-2">{actionMessage}</div>}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Info label="姓名" value={data.fullName} />
            <Info label="邮箱" value={data.email} />
            <Info label="电话" value={data.phoneNumber} />
            <Info label="国籍" value={data.nationality} />
            <Info label="学校" value={data.schoolName} />
            <Info label="渠道来源" value={data.channelSource} />
            <Info label="学习开始" value={data.studyPeriodFrom} />
            <Info label="学习结束" value={data.studyPeriodTo} />
            <Info label="创建时间" value={data.createdAt ? data.createdAt.replace("T", " ").replace("Z", "") : null} />
            <Info label="更新时间" value={data.updatedAt ? data.updatedAt.replace("T", " ").replace("Z", "") : null} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <div className="text-base font-semibold text-gray-900">证明材料</div>
            {(!data.admissionDocs || data.admissionDocs.length === 0) && (
              <div className="text-sm text-gray-600">暂无上传文件</div>
            )}
            {data.admissionDocs?.length > 0 && (
              <ul className="space-y-2">
                {data.admissionDocs.map((doc, idx) => (
                  <li key={doc.fileId || idx} className="flex flex-col md:flex-row md:items-center md:justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900">{doc.name || doc.fileId}</div>
                      <div className="text-xs text-gray-600 break-all">{doc.url}</div>
                      <div className="text-xs text-gray-600">MIME: {doc.mimeType || "-"}</div>
                      {typeof doc.size === "number" && <div className="text-xs text-gray-600">大小: {(doc.size / 1024).toFixed(1)} KB</div>}
                    </div>
                    {doc.url && (
                      <div className="mt-2 md:mt-0">
                        <Link
                          href={doc.url}
                          target="_blank"
                          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          查看
                        </Link>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-sm text-gray-900">{value || "-"}</div>
    </div>
  );
}
