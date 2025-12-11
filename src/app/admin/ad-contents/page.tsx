"use client";

import React, { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { useLanguage } from "@/contexts/LanguageContext";
import MultilangInput from "@/components/admin/MultilangInput";
import { getMultilangContent } from "@/lib/multilangUtils";
import type { MultilangContent } from "@/types/multilang";

type AdContent = {
  id: number;
  slotKey: string;
  title: MultilangContent;
  description: MultilangContent | null;
  imageUrl: string | null;
  linkUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: number | null;
  weight: number | null;
  status: "draft" | "active" | "paused" | "archived";
  createdAt: string | null;
  updatedAt: string | null;
};

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; errorCode?: string; message?: string };

const DEFAULT_SLOT = "home_banner";

export default function AdContentsPage() {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdContent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdContent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState<{ zh?: string; en?: string; ja?: string }>({});
  const [description, setDescription] = useState<{ zh?: string; en?: string; ja?: string }>({});
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState<number | string>(0);
  const [weight, setWeight] = useState<number | string>(1);
  const [status, setStatus] = useState<AdContent["status"]>("active");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditing(null);
    setTitle({});
    setDescription({});
    setImageUrl("");
    setLinkUrl("");
    setStartDate("");
    setEndDate("");
    setPriority(0);
    setWeight(1);
    setStatus("active");
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/admin/ad-contents?slotKey=${DEFAULT_SLOT}`);
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "加载失败");
      }
      const ok = res as ApiOk<{ items: AdContent[] }>;
      setItems(ok.data.items || []);
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

  const handleEdit = (item: AdContent) => {
    setEditing(item);
    setShowCreate(true);
    setTitle(typeof item.title === "string" ? { zh: item.title, en: "", ja: "" } : (item.title || {}));
    setDescription(
      item.description
        ? (typeof item.description === "string" ? { zh: item.description, en: "", ja: "" } : item.description)
        : {}
    );
    setImageUrl(item.imageUrl || "");
    setLinkUrl(item.linkUrl || "");
    setStartDate(item.startDate ? item.startDate.slice(0, 10) : "");
    setEndDate(item.endDate ? item.endDate.slice(0, 10) : "");
    setPriority(item.priority ?? 0);
    setWeight(item.weight ?? 1);
    setStatus(item.status);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        slotKey: DEFAULT_SLOT,
        title,
        description,
        imageUrl,
        linkUrl,
        startDate: startDate || null,
        endDate: endDate || null,
        priority: Number(priority) || 0,
        weight: Number(weight) || 1,
        status,
      };

      const res = editing
        ? await apiClient.put("/api/admin/ad-contents", { id: editing.id, ...payload })
        : await apiClient.post("/api/admin/ad-contents", payload);

      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "保存失败");
      }

      resetForm();
      setShowCreate(false);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除该广告吗？")) return;
    try {
      const res = await apiClient.delete(`/api/admin/ad-contents?id=${id}`);
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "删除失败");
      }
      if (editing?.id === id) {
        resetForm();
        setShowCreate(false);
      }
      await loadData();
    } catch (err: any) {
      alert(err?.message || "删除失败");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">首页 Banner 广告内容管理</h2>
        <button
          onClick={() => {
            if (!showCreate) {
              resetForm();
              setShowCreate(true);
            } else {
              setShowCreate(false);
              resetForm();
            }
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          {showCreate ? "收起表单" : "新增广告"}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      {loading ? (
        <div className="text-center py-8">{t("common.loading")}</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">标题</th>
                <th className="px-4 py-2 text-left text-sm font-medium">图片</th>
                <th className="px-4 py-2 text-left text-sm font-medium">链接</th>
                <th className="px-4 py-2 text-left text-sm font-medium">优先级</th>
                <th className="px-4 py-2 text-left text-sm font-medium">权重</th>
                <th className="px-4 py-2 text-left text-sm font-medium">生效期</th>
                <th className="px-4 py-2 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-2 text-left text-sm font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">{getMultilangContent(item.title, language) || "—"}</td>
                  <td className="px-4 py-2">
                    {item.imageUrl ? (
                      <a href={item.imageUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        查看
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {item.linkUrl ? (
                      <a href={item.linkUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        跳转链接
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">{item.priority ?? 0}</td>
                  <td className="px-4 py-2">{item.weight ?? 1}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {item.startDate ? item.startDate.slice(0, 10) : "—"} ~ {item.endDate ? item.endDate.slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        item.status === "active"
                          ? "bg-green-100 text-green-800"
                          : item.status === "paused"
                          ? "bg-yellow-100 text-yellow-800"
                          : item.status === "draft"
                          ? "bg-gray-100 text-gray-700"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 space-x-3">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800">
                      {t("common.edit")}
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800">
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="text-center py-8 text-gray-500">暂无广告内容</div>}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <h3 className="text-lg font-semibold">{editing ? "编辑广告" : "新增广告"}</h3>
          <div>
            <MultilangInput
              label="标题"
              value={title}
              onChange={setTitle}
              placeholder="请输入标题"
              required
            />
          </div>
          <div>
            <MultilangInput
              label="描述（可选）"
              value={description}
              onChange={setDescription}
              placeholder="请输入描述"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">图片 URL</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
                placeholder="https://example.com/banner.webp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">跳转链接</label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
                placeholder="https://example.com/landing"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">优先级（大在前）</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">权重（随机展示概率）</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AdContent["status"])}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="active">active</option>
                <option value="draft">draft</option>
                <option value="paused">paused</option>
                <option value="archived">archived</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
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
                resetForm();
                setShowCreate(false);
              }}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

