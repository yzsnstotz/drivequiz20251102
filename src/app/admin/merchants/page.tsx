"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";

type Merchant = {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  category: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type MerchantCategory = {
  id: number;
  name: string;
  displayOrder: number;
  status: "active" | "inactive";
};

type ListResponse = {
  items: Merchant[];
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

export default function MerchantsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<MerchantCategory[]>([]);
  const [pagination, setPagination] = useState<ListResponse["pagination"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 加载商户列表
      const res = await apiClient.get("/api/admin/merchants");
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "加载失败");
      }
      const ok = res as ApiOk<ListResponse>;
      setItems(ok.data.items || []);
      setPagination(ok.data.pagination || null);

      // 加载商户类型
      const categoryRes = await apiClient.get("/api/admin/merchant-categories");
      if (categoryRes.ok) {
        const categoryOk = categoryRes as ApiOk<{ items: MerchantCategory[] }>;
        setCategories(categoryOk.data.items || []);
      }
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
      if (editingMerchant) {
        const res = await apiClient.put(`/api/admin/merchants/${editingMerchant.id}`, {
          name,
          description,
          address,
          phone,
          email,
          imageUrl,
          category,
          status,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "保存失败");
        }
      } else {
        const res = await apiClient.post("/api/admin/merchants", {
          name,
          description,
          address,
          phone,
          email,
          imageUrl,
          category,
          status,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "创建失败");
        }
      }
      setShowCreateForm(false);
      setEditingMerchant(null);
      resetForm();
      loadData();
    } catch (e: any) {
      alert(e?.message || "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setAddress("");
    setPhone("");
    setEmail("");
    setImageUrl("");
    setCategory("");
    setStatus("active");
  };

  const handleEdit = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setName(merchant.name);
    setDescription(merchant.description || "");
    setAddress(merchant.address || "");
    setPhone(merchant.phone || "");
    setEmail(merchant.email || "");
    setImageUrl(merchant.imageUrl || "");
    setCategory(merchant.category || "");
    setStatus(merchant.status);
    setShowCreateForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("common.confirm") + ": " + t("common.delete") + "?")) return;
    try {
      const res = await apiClient.delete(`/api/admin/merchants/${id}`);
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
        <h2 className="text-lg font-semibold">{t("merchants.title")}</h2>
        <button
          onClick={() => {
            setEditingMerchant(null);
            resetForm();
            setShowCreateForm(!showCreateForm);
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          {showCreateForm ? t("common.cancel") : t("merchants.create")}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>
      )}

      {showCreateForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("merchants.name")} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("merchants.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("merchants.address")}</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("merchants.phone")}</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("merchants.email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">图片URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">商户类型</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">无类型</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("merchants.status")}</label>
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
                setEditingMerchant(null);
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
              <th className="px-4 py-2 text-left text-sm font-medium">图片</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("merchants.name")}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">类型</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("merchants.phone")}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("merchants.email")}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("merchants.status")}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded"></div>
                  )}
                </td>
                <td className="px-4 py-2">{item.name}</td>
                <td className="px-4 py-2">{item.category || "—"}</td>
                <td className="px-4 py-2">{item.phone || "—"}</td>
                <td className="px-4 py-2">{item.email || "—"}</td>
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
          <div className="text-center py-8 text-gray-500">{t("merchants.list")} 为空</div>
        )}
      </div>

      {/* 商户类型管理 */}
      <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">商户类型管理</h3>
          <Link href="/admin/merchant-categories" className="text-blue-600 hover:text-blue-800">
            管理类型
          </Link>
        </div>
        <div className="space-y-2">
          {categories.length === 0 ? (
            <div className="text-gray-500 text-sm">暂无类型，请先创建类型</div>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>{cat.name}</span>
                <span className="text-xs text-gray-500">排序: {cat.displayOrder}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

