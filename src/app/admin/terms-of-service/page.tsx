"use client";

import React, { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { useLanguage } from "@/contexts/LanguageContext";

type TermsOfService = {
  id: number;
  title: string;
  content: string;
  version: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; errorCode?: string; message?: string };

export default function TermsOfServicePage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<TermsOfService | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [version, setVersion] = useState("1.0");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/api/admin/terms-of-service");
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "加载失败");
      }
      const ok = res as ApiOk<TermsOfService>;
      setTerms(ok.data.id ? ok.data : null);
    } catch (e: any) {
      setError(e?.message || "加载失败");
      setTerms(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (terms) {
        const res = await apiClient.put("/api/admin/terms-of-service", {
          id: terms.id,
          title,
          content,
          version,
          status,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "保存失败");
        }
      } else {
        const res = await apiClient.post("/api/admin/terms-of-service", {
          title,
          content,
          version,
          status,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "创建失败");
        }
      }
      setShowForm(false);
      resetForm();
      loadData();
    } catch (e: any) {
      alert(e?.message || "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setVersion("1.0");
    setStatus("active");
  };

  const handleEdit = () => {
    if (terms) {
      setTitle(terms.title);
      setContent(terms.content);
      setVersion(terms.version || "1.0");
      setStatus(terms.status);
      setShowForm(true);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">服务条款管理</h2>
        {!showForm && (
          <button
            onClick={() => {
              if (terms) {
                handleEdit();
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {terms ? t("common.edit") : t("common.create")}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">内容 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={10}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">版本</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="active">启用</option>
              <option value="inactive">禁用</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? t("common.loading") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {terms && !showForm && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-medium mb-2">{terms.title}</h3>
          <div className="text-sm text-gray-700 whitespace-pre-wrap mb-4">{terms.content}</div>
          <div className="text-xs text-gray-500">版本：{terms.version}</div>
        </div>
      )}
    </div>
  );
}

