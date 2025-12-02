"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import Link from "next/link";

function LoginErrorContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = () => {
    switch (error) {
      case "Configuration":
        return "OAuth配置错误，请检查环境变量设置";
      case "AccessDenied":
        return "访问被拒绝，请重试";
      case "Verification":
        return "验证失败，请重试";
      case "Default":
      case null:
      case "":
        return "登录过程中发生错误，请稍后重试";
      default:
        // 兜底：展示 error code，方便调试
        return `登录过程中发生错误（错误代码：${error}）`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">
              {t("auth.login.error")}
            </h1>
            <p className="text-gray-600">{getErrorMessage()}</p>
          </div>

          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium text-center"
            >
              返回登录页面
            </Link>
            <Link
              href="/"
              className="block w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium text-center"
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">{t('common.loading')}</div>
    </div>
  );
}

export default function LoginErrorPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginErrorContent />
    </Suspense>
  );
}

