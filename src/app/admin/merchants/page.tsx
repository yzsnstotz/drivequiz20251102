"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { useLanguage } from "@/contexts/LanguageContext";
import MultilangInput from "@/components/admin/MultilangInput";
import { getMultilangContent } from "@/lib/multilangUtils";
import type { MultilangContent } from "@/types/multilang";

type Merchant = {
  id: number;
  name: MultilangContent;
  description: MultilangContent | null;
  address: MultilangContent | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  category: string | null;
  status: "active" | "inactive";
  adStartDate: string | null;
  adEndDate: string | null;
  adSlot: string | null;
  createdAt: string;
  updatedAt: string;
};

type MerchantCategory = {
  id: number;
  name: MultilangContent;
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
  const { t, language } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<MerchantCategory[]>([]);
  const [pagination, setPagination] = useState<ListResponse["pagination"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [name, setName] = useState<{ zh?: string; en?: string; ja?: string }>({});
  const [description, setDescription] = useState<{ zh?: string; en?: string; ja?: string }>({});
  const [address, setAddress] = useState<{ zh?: string; en?: string; ja?: string }>({});
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [adStartDate, setAdStartDate] = useState("");
  const [adEndDate, setAdEndDate] = useState("");
  const [adSlot, setAdSlot] = useState("");
  const [saving, setSaving] = useState(false);

  // 广告位选项
  const adSlotOptions = [
    { value: "", label: "无广告" },
    { value: "home_first_column", label: "首页第一栏" },
    { value: "home_second_column", label: "首页第二栏" },
    { value: "splash_screen", label: "启动页广告" },
    { value: "popup_ad", label: "启动弹窗广告" },
  ];

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
      // 排序：有广告的商家排在最前面
      const sortedItems = (ok.data.items || []).sort((a, b) => {
        const aHasAd = a.adStartDate && a.adEndDate;
        const bHasAd = b.adStartDate && b.adEndDate;
        if (aHasAd && !bHasAd) return -1;
        if (!aHasAd && bHasAd) return 1;
        // 如果都有广告，按开始时间倒序（最新的在前）
        if (aHasAd && bHasAd) {
          return new Date(b.adStartDate!).getTime() - new Date(a.adStartDate!).getTime();
        }
        // 都没有广告，按创建时间倒序
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setItems(sortedItems);
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
    
    // 处理广告位：空字符串表示"无广告"，转换为 null
    const normalizedAdSlot = (adSlot && adSlot.trim() !== "") ? adSlot : null;
    
    // 验证广告位：如果设置了广告时间，则必须选择广告位
    if ((adStartDate || adEndDate) && !normalizedAdSlot) {
      alert("设置广告时间后，请选择广告位");
      return;
    }
    
    // 验证广告位：如果选择了广告位，则必须设置广告时间
    if (normalizedAdSlot && (!adStartDate || !adEndDate)) {
      alert("选择广告位后，必须设置广告开始时间和结束时间");
      return;
    }
    
    // 如果选择"无广告"，确保清空广告相关字段
    const finalAdSlot = normalizedAdSlot;
    const finalAdStartDate = finalAdSlot ? (adStartDate || null) : null;
    const finalAdEndDate = finalAdSlot ? (adEndDate || null) : null;
    
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
          adStartDate: finalAdStartDate,
          adEndDate: finalAdEndDate,
          adSlot: finalAdSlot,
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
          adStartDate: finalAdStartDate,
          adEndDate: finalAdEndDate,
          adSlot: finalAdSlot,
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
    setName({});
    setDescription({});
    setAddress({});
    setPhone("");
    setEmail("");
    setImageUrl("");
    setCategory("");
    setStatus("active");
    setAdStartDate("");
    setAdEndDate("");
    setAdSlot("");
  };

  const handleEdit = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    // 处理多语言内容：如果是字符串，转换为对象；如果是对象，直接使用
    setName(typeof merchant.name === "string" ? { zh: merchant.name, en: "", ja: "" } : (merchant.name || {}));
    setDescription(
      merchant.description 
        ? (typeof merchant.description === "string" ? { zh: merchant.description, en: "", ja: "" } : merchant.description)
        : {}
    );
    setAddress(
      merchant.address 
        ? (typeof merchant.address === "string" ? { zh: merchant.address, en: "", ja: "" } : merchant.address)
        : {}
    );
    setPhone(merchant.phone || "");
    setEmail(merchant.email || "");
    setImageUrl(merchant.imageUrl || "");
    setCategory(merchant.category || "");
    setStatus(merchant.status);
    // 将ISO日期时间转换为datetime-local格式 (YYYY-MM-DDTHH:mm)
    setAdStartDate(merchant.adStartDate ? merchant.adStartDate.slice(0, 16) : "");
    setAdEndDate(merchant.adEndDate ? merchant.adEndDate.slice(0, 16) : "");
    setAdSlot(merchant.adSlot || "");
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
            <MultilangInput
              label={t("merchants.name")}
              value={name}
              onChange={setName}
              placeholder="请输入商户名称"
              required
            />
          </div>
          <div>
            <MultilangInput
              label={t("merchants.description")}
              value={description}
              onChange={setDescription}
              placeholder="请输入商户描述"
              multiline
              rows={3}
            />
          </div>
          <div>
            <MultilangInput
              label={t("merchants.address")}
              value={address}
              onChange={setAddress}
              placeholder="请输入商户地址"
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
              {categories.map((cat) => {
                // 显示当前语言的内容
                const categoryDisplayName = getMultilangContent(cat.name, language);
                // value 使用中文名称（因为后端期望字符串，且 category 字段存储的是中文名称）
                const categoryValue = getMultilangContent(cat.name, 'zh');
                return (
                  <option key={cat.id} value={categoryValue}>
                    {categoryDisplayName}
                  </option>
                );
              })}
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
          <div className="border-t pt-4 mt-4 bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold mb-3 text-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              广告设置
            </h3>
            <p className="text-xs text-gray-600 mb-3">设置广告时间后，商家将出现在首页对应的广告位中</p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-700">广告位</label>
              <select
                value={adSlot}
                onChange={(e) => {
                  setAdSlot(e.target.value);
                  // 如果选择"无广告"，清空广告时间
                  if (!e.target.value) {
                    setAdStartDate("");
                    setAdEndDate("");
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {adSlotOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">选择广告在首页显示的位置，选择&quot;无广告&quot;则不显示广告</p>
            </div>
            {adSlot && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">广告开始时间 *</label>
                  <input
                    type="datetime-local"
                    value={adStartDate}
                    onChange={(e) => setAdStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required={!!adSlot}
                  />
                  <p className="text-xs text-gray-500 mt-1">广告开始显示的时间</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">广告结束时间 *</label>
                  <input
                    type="datetime-local"
                    value={adEndDate}
                    onChange={(e) => setAdEndDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required={!!adSlot}
                  />
                  <p className="text-xs text-gray-500 mt-1">广告停止显示的时间</p>
                </div>
              </div>
            )}
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
              <th className="px-4 py-2 text-left text-sm font-medium">广告状态</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={getMultilangContent(item.name, language)} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded"></div>
                  )}
                </td>
                <td className="px-4 py-2">{getMultilangContent(item.name, language)}</td>
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
                  {item.adStartDate && item.adEndDate ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          广告中
                        </span>
                        {item.adSlot && (
                          <span className="text-xs text-gray-600 font-medium">
                            {adSlotOptions.find(opt => opt.value === item.adSlot)?.label || item.adSlot}
                          </span>
                        )}
                      </div>
                      {/* 广告进度条 */}
                      {(() => {
                        if (!item.adStartDate || !item.adEndDate) return null;
                        const now = new Date().getTime();
                        const start = new Date(item.adStartDate).getTime();
                        const end = new Date(item.adEndDate).getTime();
                        const total = end - start;
                        const elapsed = now - start;
                        const progress = Math.max(0, Math.min(100, (elapsed / total) * 100));
                        const remaining = 100 - progress;
                        // 计算剩余板块数（总共10个板块）
                        const totalBlocks = 10;
                        const remainingBlocks = Math.ceil((remaining / 100) * totalBlocks);
                        const filledBlocks = totalBlocks - remainingBlocks;
                        
                        return (
                          <div className="flex gap-0.5 mt-1">
                            {Array.from({ length: totalBlocks }).map((_, i) => (
                              <div
                                key={i}
                                className={`h-2 w-2 rounded ${
                                  i < filledBlocks
                                    ? progress < 30
                                      ? "bg-green-500"
                                      : progress < 70
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                    : "bg-gray-200"
                                }`}
                                title={`进度: ${progress.toFixed(1)}%`}
                              />
                            ))}
                          </div>
                        );
                      })()}
                      <div className="text-xs text-gray-500">
                        <div>开始: {item.adStartDate ? new Date(item.adStartDate).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                        <div>结束: {item.adEndDate ? new Date(item.adEndDate).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                      </div>
                    </div>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500">
                      无广告
                    </span>
                  )}
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

    </div>
  );
}

