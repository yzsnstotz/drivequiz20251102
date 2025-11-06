"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ApiError, apiGet, apiPut } from "@/lib/apiClient";
import Link from "next/link";
import { PERMISSION_CATEGORIES, PERMISSION_LABELS, type PermissionCategory } from "@/lib/adminPermissions";

type Admin = {
  id: number;
  username: string;
  token: string;
  isActive: boolean;
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
};

export default function AdminEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [checkingPermission, setCheckingPermission] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  // 检查权限：只有默认管理员才能访问
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const currentAdmin = await apiGet<{
          id: number;
          username: string;
          isActive: boolean;
          isDefaultAdmin: boolean;
        }>("/api/admin/me");

        if (!mounted) return;

        if (currentAdmin.isDefaultAdmin) {
          setHasPermission(true);
        } else {
          // 非默认管理员，重定向到首页
          router.replace("/admin");
        }
      } catch (e) {
        if (!mounted) return;
        console.error("Failed to check permission:", e);
        // 权限检查失败，重定向到首页
        router.replace("/admin");
      } finally {
        if (mounted) {
          setCheckingPermission(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);

  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // 加载管理员信息
  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError("无效的 ID");
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<Admin>(`/api/admin/admins/${id}`);
        if (!mounted) return;

        setAdmin(data);
        setUsername(data.username);
        setToken(data.token); // 显示部分token（前8位）
        setIsActive(data.isActive);
        setSelectedPermissions(data.permissions || []);
      } catch (e) {
        if (!mounted) return;
        if (e instanceof ApiError) {
          setError(`${e.errorCode}: ${e.message}`);
        } else {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(id)) {
      setError("无效的 ID");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, any> = {};
      if (username !== admin?.username) payload.username = username;
      if (token && token !== admin?.token) payload.token = token;
      if (isActive !== admin?.isActive) payload.isActive = isActive;
      // 权限数组需要深度比较
      const currentPerms = (admin?.permissions || []).sort().join(',');
      const newPerms = selectedPermissions.sort().join(',');
      if (currentPerms !== newPerms) {
        payload.permissions = selectedPermissions;
      }

      if (Object.keys(payload).length === 0) {
        setSaving(false);
        setError("请至少修改一个字段后再保存。");
        return;
      }

      const result = await apiPut<Admin>(`/api/admin/admins/${id}`, payload);
      
      // 如果更新了token，显示新token（仅一次）
      if (payload.token && (result as any).token) {
        const fullToken = (result as any).token;
        if (fullToken && fullToken !== admin?.token) {
          alert(`Token已更新！\n\n新Token: ${fullToken}\n\n请保存此Token。`);
        }
      }

      router.push("/admin/admins");
    } catch (e: any) {
      if (e instanceof ApiError) {
        setError(`${e.errorCode}: ${e.message}`);
      } else {
        setError(e?.message || "保存失败");
      }
    } finally {
      setSaving(false);
    }
  }

  // 权限检查中
  if (checkingPermission) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-gray-500">检查权限中...</div>
      </div>
    );
  }

  // 无权限
  if (!hasPermission) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          无权限：只有默认管理员才能访问此页面
        </div>
        <Link
          href="/admin"
          className="inline-block text-blue-600 hover:underline text-sm"
        >
          ← 返回首页
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-gray-500">加载中...</div>
      </div>
    );
  }

  if (error && !admin) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
        <Link
          href="/admin/admins"
          className="inline-block text-blue-600 hover:underline text-sm"
        >
          ← 返回列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">编辑管理员 #{id}</h2>
        <Link
          href="/admin/admins"
          className="text-sm text-blue-600 hover:underline"
        >
          ← 返回列表
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            用户名 *
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={50}
            pattern="[a-zA-Z0-9_-]+"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="3-50个字符，仅支持字母、数字、下划线、连字符"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Token（留空则不更新）
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            placeholder="至少8个字符，留空则不更新Token"
          />
          <p className="mt-1 text-xs text-gray-500">
            当前Token: {admin?.token || "—"}
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="text-sm text-gray-700">启用</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            权限类别 *
          </label>
          <div className="space-y-2 border border-gray-300 rounded-md p-3 max-h-64 overflow-y-auto">
            {Object.entries(PERMISSION_CATEGORIES)
              .filter(([key]) => key !== 'ADMINS') // 排除管理员管理权限（只有超级管理员）
              .map(([key, value]) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPermissions([...selectedPermissions, value]);
                      } else {
                        setSelectedPermissions(selectedPermissions.filter(p => p !== value));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">
                    {PERMISSION_LABELS[value as PermissionCategory]}
                  </span>
                </label>
              ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            选择此管理员可以访问的管理页面。超级管理员自动拥有所有权限。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
              saving
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-black"
            }`}
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <Link
            href="/admin/admins"
            className="rounded-md border border-gray-300 text-sm px-4 py-2 hover:bg-gray-100"
          >
            取消
          </Link>
        </div>
      </form>

      {admin && (
        <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
          <div>创建时间: {new Date(admin.createdAt).toLocaleString()}</div>
          <div>更新时间: {new Date(admin.updatedAt).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

