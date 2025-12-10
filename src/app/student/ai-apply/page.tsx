"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdmissionDoc = { fileId: string; url?: string; name: string };

type StatusResponse = {
  id: string | null;
  status: "none" | "pending" | "approved" | "rejected" | "expired";
  fullName?: string;
  nationality?: string;
  email?: string;
  phoneNumber?: string;
  channelSource?: string;
  schoolName?: string;
  studyPeriodFrom?: string | null;
  studyPeriodTo?: string | null;
  admissionDocs?: AdmissionDoc[];
  reviewNote?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
};

export default function StudentApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [nationality, setNationality] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [channelSource, setChannelSource] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [studyFrom, setStudyFrom] = useState("");
  const [studyTo, setStudyTo] = useState("");
  const [admissionDocs, setAdmissionDocs] = useState<AdmissionDoc[]>([]);

  const isReadOnly = status?.status === "approved";

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/verification", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        const data: StatusResponse = json.data;
        setStatus(data);
        if (data.status === "approved" && data.validUntil && new Date(data.validUntil).getTime() > Date.now()) {
          router.replace("/student/ai-status");
          return;
        }
        setFullName(data.fullName || "");
        setNationality(data.nationality || "");
        setEmail(data.email || "");
        setPhoneNumber(data.phoneNumber || "");
        setChannelSource(data.channelSource || "");
        setSchoolName(data.schoolName || "");
        setStudyFrom(data.studyPeriodFrom || "");
        setStudyTo(data.studyPeriodTo || "");
        setAdmissionDocs(data.admissionDocs || []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addDoc = () => {
    setAdmissionDocs((prev) => [...prev, { fileId: "", name: "" }]);
  };

  const updateDoc = (idx: number, key: keyof AdmissionDoc, value: string) => {
    setAdmissionDocs((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
  };

  const removeDoc = (idx: number) => {
    setAdmissionDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        fullName,
        nationality,
        email,
        phoneNumber,
        channelSource,
        schoolName,
        studyPeriodFrom: studyFrom || null,
        studyPeriodTo: studyTo || null,
        admissionDocs,
      };
      const res = await fetch("/api/student/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "提交失败");
      } else {
        setSuccess("申请已提交，正在审核");
        await fetchStatus();
        router.push("/student/ai-status");
      }
    } catch (e: any) {
      setError(e?.message || "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-4">学生免费 AI 激活申请</h1>
      <p className="text-gray-600 mb-6">提交在校学生信息以获取免费 AI 激活权益</p>

      {loading && <div className="text-gray-600 mb-4">加载中...</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-4">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">姓名</label>
          <input className="w-full border rounded px-3 py-2" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={isReadOnly || submitting} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">国籍</label>
            <input className="w-full border rounded px-3 py-2" value={nationality} onChange={(e) => setNationality(e.target.value)} required disabled={isReadOnly || submitting} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">学校名称</label>
            <input className="w-full border rounded px-3 py-2" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required disabled={isReadOnly || submitting} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input className="w-full border rounded px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isReadOnly || submitting} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">手机号码</label>
            <input className="w-full border rounded px-3 py-2" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required disabled={isReadOnly || submitting} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">渠道方式（如何知道本服务）</label>
          <input className="w-full border rounded px-3 py-2" value={channelSource} onChange={(e) => setChannelSource(e.target.value)} required disabled={isReadOnly || submitting} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">学习周期开始</label>
            <input className="w-full border rounded px-3 py-2" type="date" value={studyFrom} onChange={(e) => setStudyFrom(e.target.value)} disabled={isReadOnly || submitting} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">学习周期结束</label>
            <input className="w-full border rounded px-3 py-2" type="date" value={studyTo} onChange={(e) => setStudyTo(e.target.value)} disabled={isReadOnly || submitting} />
          </div>
        </div>

        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">入学/在校证明（至少1份）</span>
            {!isReadOnly && (
              <button type="button" onClick={addDoc} className="text-blue-600 hover:text-blue-800 text-sm">
                添加文件
              </button>
            )}
          </div>
          <div className="space-y-3">
            {admissionDocs.length === 0 && <div className="text-sm text-gray-500">暂无文件，至少添加一条</div>}
            {admissionDocs.map((doc, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <input
                  className="border rounded px-3 py-2"
                  placeholder="文件 ID"
                  value={doc.fileId}
                  onChange={(e) => updateDoc(idx, "fileId", e.target.value)}
                  disabled={isReadOnly || submitting}
                  required
                />
                <input
                  className="border rounded px-3 py-2"
                  placeholder="文件名"
                  value={doc.name}
                  onChange={(e) => updateDoc(idx, "name", e.target.value)}
                  disabled={isReadOnly || submitting}
                  required
                />
                <div className="flex gap-2">
                  <input
                    className="border rounded px-3 py-2 flex-1"
                    placeholder="文件链接（可选）"
                    value={doc.url || ""}
                    onChange={(e) => updateDoc(idx, "url", e.target.value)}
                    disabled={isReadOnly || submitting}
                  />
                  {!isReadOnly && (
                    <button type="button" className="text-red-600 hover:text-red-800 text-sm" onClick={() => removeDoc(idx)}>
                      删除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isReadOnly || submitting}
          >
            {submitting ? "提交中..." : "提交申请"}
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            onClick={() => router.push("/student/ai-status")}
          >
            查看状态
          </button>
        </div>
      </form>
    </div>
  );
}
