"use client";

import React, { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { useLanguage } from "@/contexts/LanguageContext";
import MultilangInput from "@/components/admin/MultilangInput";
import { getMultilangContent } from "@/lib/multilangUtils";
import type { MultilangContent } from "@/types/multilang";

type MerchantCategory = {
  id: number;
  name: MultilangContent;
  displayOrder: number;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; errorCode?: string; message?: string };

export default function MerchantCategoriesPage() {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MerchantCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MerchantCategory | null>(null);
  const [name, setName] = useState<{ zh?: string; en?: string; ja?: string }>({});
  const [displayOrder, setDisplayOrder] = useState(0);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/api/admin/merchant-categories");
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "加载失败");
      }
      const ok = res as ApiOk<{ items: MerchantCategory[] }>;
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
        const res = await apiClient.put(`/api/admin/merchant-categories/${editing.id}`, {
          name,
          displayOrder,
          status,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "保存失败");
        }
      } else {
        const res = await apiClient.post("/api/admin/merchant-categories", {
          name,
          displayOrder,
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
    setName({});
    setDisplayOrder(0);
    setStatus("active");
  };

  const handleEdit = (item: MerchantCategory) => {
    setEditing(item);
    // 处理多语言内容：如果是字符串，转换为对象；如果是对象，直接使用
    setName(typeof item.name === "string" ? { zh: item.name, en: "", ja: "" } : (item.name || {}));
    setDisplayOrder(item.displayOrder);
    setStatus(item.status);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("common.confirm") + ": " + t("common.delete") + "?")) return;
    try {
      const res = await apiClient.delete(`/api/admin/merchant-categories/${id}`);
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
        <h2 className="text-lg font-semibold">商户类型管理</h2>
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
            <MultilangInput
              label="类型名称"
              value={name}
              onChange={setName}
              placeholder="请输入类型名称"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">显示顺序</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
              min={0}
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
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">类型名称</th>
              <th className="px-4 py-2 text-left text-sm font-medium">显示顺序</th>
              <th className="px-4 py-2 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">{getMultilangContent(item.name, language)}</td>
                <td className="px-4 py-2">{item.displayOrder}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      item.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.status === "active" ? "启用" : "禁用"}
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
          <div className="text-center py-8 text-gray-500">暂无类型</div>
        )}
      </div>
    </div>
  );
}

