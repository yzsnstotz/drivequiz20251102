"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { MAX_STUDENT_DOC_SIZE, STUDENT_DOC_BUCKET } from "@/constants/studentDocs";

type AdmissionDoc = {
  fileId: string;
  bucket: string;
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
};

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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [nationality, setNationality] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [channelSource, setChannelSource] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [studyFrom, setStudyFrom] = useState("");
  const [studyTo, setStudyTo] = useState("");
  const [admissionDocs, setAdmissionDocs] = useState<AdmissionDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isReadOnly = status?.status === "approved";

  const normalizeDoc = (doc: any): AdmissionDoc | null => {
    if (!doc) return null;
    const fileId = typeof doc.fileId === "string" ? doc.fileId : "";
    const bucket = typeof doc.bucket === "string" ? doc.bucket : STUDENT_DOC_BUCKET;
    const url = typeof doc.url === "string" ? doc.url : "";
    const name = typeof doc.name === "string" ? doc.name : "";
    const size = typeof doc.size === "number" ? doc.size : undefined;
    const mimeType = typeof doc.mimeType === "string" ? doc.mimeType : undefined;
    if (!fileId || !bucket || !url || !name) return null;
    return { fileId, bucket, url, name, size, mimeType };
  };

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
        const normalizedDocs =
          (data.admissionDocs || [])
            .map((d: any) => normalizeDoc(d))
            .filter((d): d is AdmissionDoc => !!d);
        setAdmissionDocs(normalizedDocs);
      } else {
        setError(json.message || tr("student.apply.loadFailed"));
      }
    } catch (e: any) {
      setError(e?.message || tr("student.apply.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerSelectFile = () => {
    fileInputRef.current?.click();
  };

  const uploadStudentDoc = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload/student-doc", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      throw new Error(json?.message || tr("student.apply.uploadFailed"));
    }
    return json.data as AdmissionDoc;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_STUDENT_DOC_SIZE) {
          setUploadError(tr("student.apply.fileTooLarge", { size: "5MB" }));
          continue;
        }
        const uploaded = await uploadStudentDoc(file);
        setAdmissionDocs((prev) => [
          ...prev,
          {
            fileId: uploaded.fileId,
            bucket: uploaded.bucket || STUDENT_DOC_BUCKET,
            url: uploaded.url,
            name: uploaded.name,
            size: uploaded.size,
            mimeType: uploaded.mimeType,
          },
        ]);
      }
    } catch (e: any) {
      setUploadError(e?.message || tr("student.apply.uploadFailed"));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeDoc = (idx: number) => {
    setAdmissionDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const submitDocs = admissionDocs
      .map((d) => normalizeDoc(d))
      .filter((d): d is AdmissionDoc => !!d);
    if (!submitDocs.length) {
      setError(tr("student.apply.docRequired"));
      return;
    }
    setSubmitting(true);
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
        admissionDocs: submitDocs,
      };
      const res = await fetch("/api/student/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || tr("student.apply.submitFailed"));
      } else {
        setSuccess(tr("student.apply.submitSuccess"));
        await fetchStatus();
        router.push("/student/ai-status");
      }
    } catch (e: any) {
      setError(e?.message || tr("student.apply.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-4">{tr("student.apply.title")}</h1>
      <p className="text-gray-600 mb-6">{tr("student.apply.subtitle")}</p>

      {loading && <div className="text-gray-600 mb-4">{tr("student.apply.loading")}</div>}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-4">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t("student.apply.fullName")}</label>
          <input className="w-full border rounded px-3 py-2" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={isReadOnly || submitting} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("student.apply.nationality")}</label>
            <input className="w-full border rounded px-3 py-2" value={nationality} onChange={(e) => setNationality(e.target.value)} required disabled={isReadOnly || submitting} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("student.apply.schoolName")}</label>
            <input className="w-full border rounded px-3 py-2" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required disabled={isReadOnly || submitting} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("student.apply.email")}</label>
            <input className="w-full border rounded px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isReadOnly || submitting} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("student.apply.phoneNumber")}</label>
            <input className="w-full border rounded px-3 py-2" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required disabled={isReadOnly || submitting} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("student.apply.channelSource")}</label>
          <input className="w-full border rounded px-3 py-2" value={channelSource} onChange={(e) => setChannelSource(e.target.value)} required disabled={isReadOnly || submitting} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("student.apply.studyFrom")}</label>
            <input className="w-full border rounded px-3 py-2" type="date" value={studyFrom} onChange={(e) => setStudyFrom(e.target.value)} disabled={isReadOnly || submitting} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("student.apply.studyTo")}</label>
            <input className="w-full border rounded px-3 py-2" type="date" value={studyTo} onChange={(e) => setStudyTo(e.target.value)} disabled={isReadOnly || submitting} />
          </div>
        </div>

        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{tr("student.apply.admissionDocs")}</span>
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={triggerSelectFile} className="text-blue-600 hover:text-blue-800 text-sm">
                  {tr("student.apply.addFile")}
                </button>
                <span className="text-xs text-gray-500">{tr("student.apply.sizeLimit", { size: "5MB" })}</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            multiple
          />
          {uploadError && <div className="text-sm text-red-600 mb-2">{uploadError}</div>}
          {uploading && <div className="text-sm text-gray-600 mb-2">{tr("student.apply.uploading")}</div>}
          <div className="space-y-3">
            {admissionDocs.length === 0 && <div className="text-sm text-gray-500">{tr("student.apply.noFile")}</div>}
            {admissionDocs.map((doc, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="border rounded px-3 py-2 text-sm bg-gray-50 dark:bg-transparent">
                  <div className="font-medium">{doc.name || tr("student.apply.fileNamePlaceholder")}</div>
                  <div className="text-gray-600 break-all">{doc.fileId}</div>
                </div>
                <div className="border rounded px-3 py-2 text-sm bg-gray-50 dark:bg-transparent">
                  {doc.url ? (
                    <a className="text-blue-600 underline break-all" href={doc.url} target="_blank" rel="noreferrer">
                      {doc.url}
                    </a>
                  ) : (
                    <span className="text-gray-600">{tr("student.apply.fileUrlPlaceholder")}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                    onClick={() => removeDoc(idx)}
                    disabled={isReadOnly || submitting || uploading}
                  >
                    {tr("student.apply.delete")}
                  </button>
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
            {submitting ? t("student.apply.submitting") : t("student.apply.submit")}
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            onClick={() => router.push("/student/ai-status")}
          >
            {t("student.apply.viewStatus")}
          </button>
        </div>
      </form>
    </div>
  );
}
