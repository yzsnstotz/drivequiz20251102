"use client";

import React, { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import Link from "next/link";
import { useAppSession } from "@/contexts/SessionContext";

function LoginErrorContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status, loading } = useAppSession();
  const error = searchParams?.get("error") ?? null;

  useEffect(() => {
    if (status === "authenticated") {
      if (typeof window !== "undefined" && error) {
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url.toString());
      }
      router.replace("/");
    } else if (status === "unauthenticated" && !error) {
      router.replace("/login");
    }
  }, [status]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">{t("common.loading")}</div>
      </div>
    );
  }

  const errorMessageMap: Record<string, string> = {
    Configuration: "OAuth 配置错误，请检查环境变量或联系管理员。",
    OAuthSignin: "第三方登录失败，请稍后重试。",
    OAuthCallback: "登录回调出现问题，请稍后重试。",
    AccessDenied: "拒绝访问，请确认授权信息。",
  };
  const errorMessage =
    (error && errorMessageMap[error]) ||
    "登录过程中出现错误，请稍后重试或联系管理员。";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">{t("auth.login.error")}</h1>
            <p className="text-gray-600">{errorMessage}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push("/login")}
              className="block w-full px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium text-center"
            >
              返回登录页面
            </button>
            <button
              onClick={() => router.push("/")}
              className="block w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium text-center"
            >
              返回首页
            </button>
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
