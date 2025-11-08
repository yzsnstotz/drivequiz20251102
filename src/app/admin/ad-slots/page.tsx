"use client";

import React, { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { useLanguage } from "@/contexts/LanguageContext";

type AdSlot = {
  id: number;
  slotKey: string;
  title: string;
  description: string | null;
  splashDuration: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; errorCode?: string; message?: string };

export default function AdSlotsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdSlot | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [splashDuration, setSplashDuration] = useState(3);
  const [isEnabled, setIsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/api/admin/ad-slots");
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "加载失败");
      }
      const ok = res as ApiOk<{ items: AdSlot[] }>;
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

  const handleEdit = (item: AdSlot) => {
    setEditing(item);
    setTitle(item.title);
    setDescription(item.description || "");
    setSplashDuration(item.splashDuration || 3);
    setIsEnabled(item.isEnabled);
  };

  const handleCancel = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setSplashDuration(3);
    setIsEnabled(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    try {
      const res = await apiClient.put("/api/admin/ad-slots", {
        slotKey: editing.slotKey,
        title,
        description,
        splashDuration: editing.slotKey === "splash_screen" ? splashDuration : undefined,
        isEnabled,
      });
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "保存失败");
      }
      handleCancel();
      loadData();
    } catch (e: any) {
      alert(e?.message || "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const handleInitialize = async () => {
    if (!confirm("确定要初始化广告位配置吗？如果广告位已存在，将不会重复创建。")) {
      return;
    }

    setInitializing(true);
    try {
      const res = await apiClient.post("/api/admin/ad-slots", {});
      if (!res.ok) {
        const err = res as ApiErr;
        throw new Error(err.message || "初始化失败");
      }
      const ok = res as ApiOk<{ results: Array<{ slotKey: string; action: string }> }>;
      const created = ok.data.results.filter((r) => r.action === "created");
      const exists = ok.data.results.filter((r) => r.action === "exists");
      
      let message = "";
      if (created.length > 0) {
        message += `已创建 ${created.length} 个广告位：${created.map((r) => r.slotKey).join(", ")}\n`;
      }
      if (exists.length > 0) {
        message += `${exists.length} 个广告位已存在：${exists.map((r) => r.slotKey).join(", ")}`;
      }
      
      alert(message || "初始化完成");
      loadData();
    } catch (e: any) {
      alert(e?.message || "初始化失败");
    } finally {
      setInitializing(false);
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
        <h2 className="text-lg font-semibold">广告栏管理</h2>
        <button
          onClick={handleInitialize}
          disabled={initializing}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
        >
          {initializing ? "初始化中..." : "初始化广告位"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">广告位标识</th>
              <th className="px-4 py-2 text-left text-sm font-medium">标题</th>
              <th className="px-4 py-2 text-left text-sm font-medium">描述</th>
              <th className="px-4 py-2 text-left text-sm font-medium">启动页持续时间（秒）</th>
              <th className="px-4 py-2 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">
                  <span className="text-sm font-mono text-gray-600">{item.slotKey}</span>
                </td>
                <td className="px-4 py-2">{item.title}</td>
                <td className="px-4 py-2">{item.description || "—"}</td>
                <td className="px-4 py-2">
                  {item.slotKey === "splash_screen" ? (
                    <span className="text-sm text-gray-700">{item.splashDuration || 3}</span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      item.isEnabled
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.isEnabled ? "启用" : "禁用"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {t("common.edit")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="text-center py-8 text-gray-500">暂无广告栏配置</div>
        )}
      </div>

      {editing && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <h3 className="text-lg font-semibold">编辑广告栏：{editing.slotKey}</h3>
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
            <label className="block text-sm font-medium mb-1">描述（小文案）</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="例如：精选商家推荐"
            />
          </div>
          {(editing.slotKey === "splash_screen" || editing.slotKey === "popup_ad") && (
            <div>
              <label className="block text-sm font-medium mb-1">
                {editing.slotKey === "splash_screen" ? "启动页持续时间（秒）" : "弹窗广告"}
              </label>
              {editing.slotKey === "splash_screen" ? (
                <>
                  <input
                    type="number"
                    value={splashDuration}
                    onChange={(e) => setSplashDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min={1}
                    max={10}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">启动页广告显示的持续时间（1-10秒）</p>
                </>
              ) : (
                <p className="text-sm text-gray-600">弹窗广告在用户首次访问首页时显示</p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">状态</label>
            <select
              value={isEnabled ? "enabled" : "disabled"}
              onChange={(e) => setIsEnabled(e.target.value === "enabled")}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="enabled">启用</option>
              <option value="disabled">禁用</option>
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
              onClick={handleCancel}
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

