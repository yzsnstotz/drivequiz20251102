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

export default function ContactAndTermsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [contactItems, setContactItems] = useState<ContactInfo[]>([]);
  const [terms, setTerms] = useState<TermsOfService | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 联系信息表单
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactInfo | null>(null);
  const [contactType, setContactType] = useState<"business" | "purchase">("business");
  const [wechat, setWechat] = useState("");
  const [email, setEmail] = useState("");
  const [contactStatus, setContactStatus] = useState<"active" | "inactive">("active");
  const [savingContact, setSavingContact] = useState(false);
  
  // 服务条款表单
  const [showTermsForm, setShowTermsForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [version, setVersion] = useState("1.0");
  const [termsStatus, setTermsStatus] = useState<"active" | "inactive">("active");
  const [savingTerms, setSavingTerms] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 加载联系信息
      const contactRes = await apiClient.get("/api/admin/contact-info");
      if (contactRes.ok) {
        const ok = contactRes as ApiOk<{ items: ContactInfo[] }>;
        setContactItems(ok.data.items || []);
      }

      // 加载服务条款
      const termsRes = await apiClient.get("/api/admin/terms-of-service");
      if (termsRes.ok) {
        const ok = termsRes as ApiOk<TermsOfService>;
        setTerms(ok.data.id ? ok.data : null);
      }
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingContact(true);
    try {
      if (editingContact) {
        const res = await apiClient.put(`/api/admin/contact-info/${editingContact.id}`, {
          wechat,
          email,
          status: contactStatus,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "保存失败");
        }
      } else {
        const res = await apiClient.post("/api/admin/contact-info", {
          type: contactType,
          wechat,
          email,
          status: contactStatus,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "创建失败");
        }
      }
      setShowContactForm(false);
      setEditingContact(null);
      resetContactForm();
      loadData();
    } catch (e: any) {
      alert(e?.message || "操作失败");
    } finally {
      setSavingContact(false);
    }
  };

  const resetContactForm = () => {
    setContactType("business");
    setWechat("");
    setEmail("");
    setContactStatus("active");
  };

  const handleContactEdit = (item: ContactInfo) => {
    setEditingContact(item);
    setContactType(item.type);
    setWechat(item.wechat || "");
    setEmail(item.email || "");
    setContactStatus(item.status);
    setShowContactForm(true);
  };

  const handleContactDelete = async (id: number) => {
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

  const handleTermsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTerms(true);
    try {
      if (terms) {
        const res = await apiClient.put("/api/admin/terms-of-service", {
          id: terms.id,
          title,
          content,
          version,
          status: termsStatus,
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
          status: termsStatus,
        });
        if (!res.ok) {
          const err = res as ApiErr;
          throw new Error(err.message || "创建失败");
        }
      }
      setShowTermsForm(false);
      resetTermsForm();
      loadData();
    } catch (e: any) {
      alert(e?.message || "操作失败");
    } finally {
      setSavingTerms(false);
    }
  };

  const resetTermsForm = () => {
    setTitle("");
    setContent("");
    setVersion("1.0");
    setTermsStatus("active");
  };

  const handleTermsEdit = () => {
    if (terms) {
      setTitle(terms.title);
      setContent(terms.content);
      setVersion(terms.version || "1.0");
      setTermsStatus(terms.status);
      setShowTermsForm(true);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">{t("common.loading")}</div>
      </div>
    );
  }

  const businessInfo = contactItems.find(item => item.type === "business");
  const purchaseInfo = contactItems.find(item => item.type === "purchase");

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">联系信息与服务条款管理</h2>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>
      )}

      {/* 联系信息部分 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">联系信息</h3>
          {!showContactForm && (
            <button
              onClick={() => {
                setEditingContact(null);
                resetContactForm();
                setShowContactForm(true);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {t("common.create")}
            </button>
          )}
        </div>

        {showContactForm && (
          <form onSubmit={handleContactSubmit} className="mb-4 space-y-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-1">类型 *</label>
              <select
                value={contactType}
                onChange={(e) => setContactType(e.target.value as "business" | "purchase")}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={!!editingContact}
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
                value={contactStatus}
                onChange={(e) => setContactStatus(e.target.value as "active" | "inactive")}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingContact}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {savingContact ? t("common.loading") : t("common.save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowContactForm(false);
                  setEditingContact(null);
                  resetContactForm();
                }}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">商务合作</h4>
              {!businessInfo && !showContactForm && (
                <button
                  onClick={() => {
                    setEditingContact(null);
                    setContactType("business");
                    setWechat("");
                    setEmail("");
                    setContactStatus("active");
                    setShowContactForm(true);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {t("common.create")}
                </button>
              )}
            </div>
            {businessInfo ? (
              <div className="space-y-2 p-3 bg-gray-50 rounded">
                <div>微信：{businessInfo.wechat || "未设置"}</div>
                <div>邮箱：{businessInfo.email || "未设置"}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleContactEdit(businessInfo)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleContactDelete(businessInfo.id)}
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
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">激活码购买</h4>
              {!purchaseInfo && !showContactForm && (
                <button
                  onClick={() => {
                    setEditingContact(null);
                    setContactType("purchase");
                    setWechat("");
                    setEmail("");
                    setContactStatus("active");
                    setShowContactForm(true);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {t("common.create")}
                </button>
              )}
            </div>
            {purchaseInfo ? (
              <div className="space-y-2 p-3 bg-gray-50 rounded">
                <div>微信：{purchaseInfo.wechat || "未设置"}</div>
                <div>邮箱：{purchaseInfo.email || "未设置"}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleContactEdit(purchaseInfo)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleContactDelete(purchaseInfo.id)}
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

      {/* 服务条款部分 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">服务条款</h3>
          {!showTermsForm && (
            <button
              onClick={() => {
                if (terms) {
                  handleTermsEdit();
                } else {
                  resetTermsForm();
                  setShowTermsForm(true);
                }
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {terms ? t("common.edit") : t("common.create")}
            </button>
          )}
        </div>

        {showTermsForm && (
          <form onSubmit={handleTermsSubmit} className="mb-4 space-y-4 p-4 bg-gray-50 rounded-lg">
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
                value={termsStatus}
                onChange={(e) => setTermsStatus(e.target.value as "active" | "inactive")}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingTerms}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {savingTerms ? t("common.loading") : t("common.save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTermsForm(false);
                  resetTermsForm();
                }}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        )}

        {terms && !showTermsForm && (
          <div className="p-3 bg-gray-50 rounded">
            <h4 className="font-medium mb-2">{terms.title}</h4>
            <div className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{terms.content}</div>
            <div className="text-xs text-gray-500">版本：{terms.version}</div>
          </div>
        )}
      </div>
    </div>
  );
}

