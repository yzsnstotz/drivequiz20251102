"use client";

import React, { useState, useEffect } from "react";
import { Key, CheckCircle, XCircle, ExternalLink, Calendar, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ActivationStatus {
  valid: boolean;
  reason?: string;
  activationCode?: string;
  activatedAt?: string;
  expiresAt?: string | null;
  status?: string;
}

export default function ActivationStatusCard() {
  const router = useRouter();
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/activation/status", {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const result = await response.json();
          if (result.ok && result.data) {
            setStatus(result.data);
          } else {
            setStatus({ valid: false, reason: "无法获取激活状态" });
          }
        } else {
          setStatus({ valid: false, reason: "无法获取激活状态" });
        }
      } catch (error) {
        console.error("[ActivationStatusCard] Check status error:", error);
        setStatus({ valid: false, reason: "检查激活状态失败" });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, []);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "未知";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "未知";
    }
  };

  const handleActivate = () => {
    // 跳转到激活页面
    router.push("/activation");
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center space-x-4">
        <div className="flex-shrink-0">
          <Key className="h-6 w-6 text-gray-400 animate-pulse" />
        </div>
        <div className="flex-grow">
          <h3 className="font-medium text-gray-900">激活码状态</h3>
          <p className="text-gray-500 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  if (status.valid) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-shrink-0">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-grow">
            <h3 className="font-medium text-gray-900">激活码状态</h3>
            <p className="text-green-600 text-sm font-medium">已激活</p>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          {status.activatedAt && (
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-grow">
                <p className="text-sm text-gray-600">激活时间</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(status.activatedAt)}
                </p>
              </div>
            </div>
          )}

          {status.expiresAt && (
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-grow">
                <p className="text-sm text-gray-600">到期时间</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(status.expiresAt)}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start space-x-3">
            <ExternalLink className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-grow">
              <p className="text-sm text-gray-600">使用规则</p>
              <Link
                href="/activation/rules"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                查看激活码使用规则
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center space-x-4 mb-4">
        <div className="flex-shrink-0">
          <XCircle className="h-6 w-6 text-red-600" />
        </div>
        <div className="flex-grow">
          <h3 className="font-medium text-gray-900">激活码状态</h3>
          <p className="text-red-600 text-sm font-medium">未激活</p>
          {status.reason && (
            <p className="text-gray-500 text-xs mt-1">{status.reason}</p>
          )}
        </div>
      </div>

      <button
        onClick={handleActivate}
        className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        前往激活
      </button>
    </div>
  );
}

