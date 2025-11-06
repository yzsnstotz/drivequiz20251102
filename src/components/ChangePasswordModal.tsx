"use client";

import React, { useState } from "react";
import { ApiError, apiPost } from "@/lib/apiClient";

type ChangePasswordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function ChangePasswordModal({
  isOpen,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const [oldToken, setOldToken] = useState("");
  const [newToken, setNewToken] = useState("");
  const [confirmToken, setConfirmToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 验证输入
    if (!oldToken || oldToken.trim().length === 0) {
      setError("请输入当前口令");
      return;
    }

    if (!newToken || newToken.trim().length === 0) {
      setError("请输入新口令");
      return;
    }

    if (newToken.trim().length < 8) {
      setError("新口令至少需要 8 个字符");
      return;
    }

    if (newToken !== confirmToken) {
      setError("两次输入的新口令不一致");
      return;
    }

    if (oldToken === newToken) {
      setError("新口令不能与当前口令相同");
      return;
    }

    setLoading(true);
    try {
      const result = await apiPost<{
        id: number;
        username: string;
        token: string;
        isActive: boolean;
        message: string;
      }>("/api/admin/admins/me/change-password", {
        oldToken: oldToken.trim(),
        newToken: newToken.trim(),
      });

      // 更新 localStorage 中的 token
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ADMIN_TOKEN", result.token);
      }

      // 显示成功消息
      alert(
        `口令修改成功！\n\n新口令: ${result.token}\n\n请妥善保存新口令，这是唯一一次显示。`
      );

      // 清空表单
      setOldToken("");
      setNewToken("");
      setConfirmToken("");
      setError(null);

      // 关闭模态框
      onClose();

      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`${e.errorCode}: ${e.message}`);
      } else {
        setError(e instanceof Error ? e.message : "修改失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setOldToken("");
      setNewToken("");
      setConfirmToken("");
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">修改登录口令</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              当前口令 *
            </label>
            <input
              type="password"
              value={oldToken}
              onChange={(e) => setOldToken(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="请输入当前登录口令"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新口令 *
            </label>
            <input
              type="password"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              required
              minLength={8}
              disabled={loading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="至少 8 个字符"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              确认新口令 *
            </label>
            <input
              type="password"
              value={confirmToken}
              onChange={(e) => setConfirmToken(e.target.value)}
              required
              minLength={8}
              disabled={loading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="请再次输入新口令"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-blue-500 text-white text-sm font-medium px-4 py-2 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "修改中..." : "确认修改"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-md border border-gray-300 text-sm px-4 py-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

