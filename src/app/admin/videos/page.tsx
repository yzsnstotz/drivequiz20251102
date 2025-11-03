"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { useLanguage } from "@/contexts/LanguageContext";

type Video = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  thumbnail: string | null;
  category: "basic" | "advanced";
  displayOrder: number;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: Video[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; errorCode?: string; message?: string };

export default function VideosPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Video[]>([]);
  const [pagination, setPagination] = useState<ListResponse["pagination"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [category, setCategory] = useState<"basic" | "advanced">("basic");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/api/admin/videos");
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "加载失败");
      }
      const ok = res as ApiOk<ListResponse>;
      setItems(ok.data.items || []);
      setPagination(ok.data.pagination || null);
    } catch (e: any) {
      setError(e?.message || "加载失败");
      setItems([]);
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
      if (editingVideo) {
        const res = await apiClient.put(`/api/admin/videos/${editingVideo.id}`, {
          title,
          description,
          url,
          thumbnail,
          category,
          displayOrder,
          status,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "保存失败");
        }
      } else {
        const res = await apiClient.post("/api/admin/videos", {
          title,
          description,
          url,
          thumbnail,
          category,
          displayOrder,
          status,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "创建失败");
        }
      }
      setShowCreateForm(false);
      setEditingVideo(null);
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
    setDescription("");
    setUrl("");
    setThumbnail("");
    setCategory("basic");
    setDisplayOrder(0);
    setStatus("active");
  };

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
    setTitle(video.title);
    setDescription(video.description || "");
    setUrl(video.url);
    setThumbnail(video.thumbnail || "");
    setCategory(video.category);
    setDisplayOrder(video.displayOrder);
    setStatus(video.status);
    setShowCreateForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("common.confirm") + ": " + t("common.delete") + "?")) return;
    try {
      const res = await apiClient.delete(`/api/admin/videos/${id}`);
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "删除失败");
      }
      loadData();
    } catch (e: any) {
      alert(e?.message || "删除失败");
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
        <h2 className="text-lg font-semibold">{t("videos.title")}</h2>
        <button
          onClick={() => {
            setEditingVideo(null);
            resetForm();
            setShowCreateForm(!showCreateForm);
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          {showCreateForm ? t("common.cancel") : t("videos.create")}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>
      )}

      {showCreateForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("videos.titleField")} *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("videos.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("videos.url")} *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("videos.thumbnail")}</label>
            <input
              type="url"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("videos.category")} *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as "basic" | "advanced")}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="basic">{t("videos.categoryBasic")}</option>
              <option value="advanced">{t("videos.categoryAdvanced")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("videos.order")}</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
              min={0}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("videos.status")}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="active">{t("merchants.active")}</option>
              <option value="inactive">{t("merchants.inactive")}</option>
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
                setShowCreateForm(false);
                setEditingVideo(null);
                resetForm();
              }}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("videos.titleField")}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("videos.category")}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("videos.order")}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("videos.status")}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">{item.title}</td>
                <td className="px-4 py-2">
                  {item.category === "basic" ? t("videos.categoryBasic") : t("videos.categoryAdvanced")}
                </td>
                <td className="px-4 py-2">{item.displayOrder}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      item.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.status === "active" ? t("merchants.active") : t("merchants.inactive")}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="text-center py-8 text-gray-500">{t("videos.list")} 为空</div>
        )}
      </div>
    </div>
  );
}

