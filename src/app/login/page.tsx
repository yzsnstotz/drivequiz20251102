"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useLanguage } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import OAuthButton from "./components/OAuthButton";
import QRCodeLogin from "./components/QRCodeLogin";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<"redirect" | "qrcode" | null>(null);

  const providers = [
    // { id: "wechat", name: t("auth.login.withWeChat") }, // 暂时隐藏
    { id: "line", name: t("auth.login.withLINE") },
    { id: "google", name: t("auth.login.withGoogle") },
    // { id: "facebook", name: t("auth.login.withFacebook") }, // 暂时隐藏
    { id: "twitter", name: t("auth.login.withTwitter") },
  ];

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    setLoginMethod(null);
  };

  const handleLoginMethodSelect = (method: "redirect" | "qrcode") => {
    if (method === "redirect") {
      // 跳转授权登录 - 直接调用，不设置状态，避免触发重新渲染
      handleRedirectLogin(selectedProvider!);
    } else {
      // qrcode 方法由 QRCodeLogin 组件处理
      setLoginMethod(method);
    }
  };

  const handleRedirectLogin = async (provider: string) => {
    try {
      await signIn(provider, {
        callbackUrl: "/",
        redirect: true,
      });
    } catch (error) {
      console.error("Login error:", error);
      alert(t("auth.login.error"));
    }
  };

  const handleBack = () => {
    if (loginMethod) {
      setLoginMethod(null);
    } else if (selectedProvider) {
      setSelectedProvider(null);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {t("auth.login.title")}
            </h1>
            <p className="text-gray-600">{t("auth.login.subtitle")}</p>
          </div>

          {!selectedProvider ? (
            // 选择提供商
            <div className="space-y-3">
              {providers.map((provider) => (
                <OAuthButton
                  key={provider.id}
                  provider={provider.id}
                  name={provider.name}
                  onClick={() => handleProviderSelect(provider.id)}
                />
              ))}
            </div>
          ) : !loginMethod ? (
            // 选择登录方式
            <div className="space-y-4">
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900 mb-4"
              >
                ← {t("common.back")}
              </button>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleLoginMethodSelect("redirect")}
                  className="w-full px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
                >
                  {t("auth.login.redirect")}
                </button>
                
                {selectedProvider === "line" && (
                  <button
                    onClick={() => handleLoginMethodSelect("qrcode")}
                    className="w-full px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium"
                  >
                    {t("auth.login.qrCode")}
                  </button>
                )}
              </div>
            </div>
          ) : loginMethod === "qrcode" ? (
            // 二维码登录（只对支持二维码的 provider 显示）
            <div className="space-y-4">
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900 mb-4"
              >
                ← {t("common.back")}
              </button>
              
              {selectedProvider === "line" && (
                <QRCodeLogin provider={selectedProvider} />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

