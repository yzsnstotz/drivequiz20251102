"use client";

import React, { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { useLanguage } from "@/contexts/LanguageContext";

type ContactInfo = {
  id: number;
  type: "business" | "purchase";
  wechat: string | null;
  email: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; errorCode?: string; message?: string };

export default function ContactInfoPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContactInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContactInfo | null>(null);
  const [type, setType] = useState<"business" | "purchase">("business");
  const [wechat, setWechat] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/api/admin/contact-info");
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "加载失败");
      }
      const ok = res as ApiOk<{ items: ContactInfo[] }>;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const res = await apiClient.put(`/api/admin/contact-info/${editing.id}`, {
          wechat,
          email,
          status,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "保存失败");
        }
      } else {
        const res = await apiClient.post("/api/admin/contact-info", {
          type,
          wechat,
          email,
          status,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "创建失败");
        }
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      loadData();
    } catch (e: any) {
      alert(e?.message || "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setType("business");
    setWechat("");
    setEmail("");
    setStatus("active");
  };

  const handleEdit = (item: ContactInfo) => {
    setEditing(item);
    setType(item.type);
    setWechat(item.wechat || "");
    setEmail(item.email || "");
    setStatus(item.status);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("common.confirm") + ": " + t("common.delete") + "?")) return;
    try {
      const res = await apiClient.delete(`/api/admin/contact-info/${id}`);
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

  const businessInfo = items.find(item => item.type === "business");
  const purchaseInfo = items.find(item => item.type === "purchase");

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">联系信息管理</h2>
        {!showForm && (
          <button
            onClick={() => {
              setEditing(null);
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {t("common.create")}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">类型 *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "business" | "purchase")}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={!!editing}
              required
            >
              <option value="business">商务合作</option>
              <option value="purchase">激活码购买</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">微信账号</label>
            <input
              type="text"
              value={wechat}
              onChange={(e) => setWechat(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">邮箱地址</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                setEditing(null);
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
        <div className="p-4 space-y-6">
          <div>
            <h3 className="font-medium mb-2">商务合作</h3>
            {businessInfo ? (
              <div className="space-y-2">
                <div>微信：{businessInfo.wechat || "未设置"}</div>
                <div>邮箱：{businessInfo.email || "未设置"}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleEdit(businessInfo)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(businessInfo.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">未设置</div>
            )}
          </div>
          <div>
            <h3 className="font-medium mb-2">激活码购买</h3>
            {purchaseInfo ? (
              <div className="space-y-2">
                <div>微信：{purchaseInfo.wechat || "未设置"}</div>
                <div>邮箱：{purchaseInfo.email || "未设置"}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleEdit(purchaseInfo)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(purchaseInfo.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">未设置</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

