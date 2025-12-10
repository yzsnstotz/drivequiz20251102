"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useLanguage } from "@/lib/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, MessageCircle, FileText, Handshake, ShoppingCart, User, X, ArrowLeft } from "lucide-react";
import OAuthButton from "./components/OAuthButton";
import QRCodeLogin from "./components/QRCodeLogin";
import { getLoginMemory, saveLoginMemory, clearLoginMemory } from "@/lib/loginMemory";
import { getMultilangContent } from "@/lib/multilangUtils";
import { useAppSession } from "@/contexts/SessionContext";

interface ContactInfo {
  type: 'business' | 'purchase';
  wechat: string | null;
  email: string | null;
}

interface TermsOfService {
  title: any; // MultilangContent
  content: any; // MultilangContent
  version?: string;
}

function LoginPageContent() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, loading } = useAppSession();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<"redirect" | "qrcode" | null>(null);
  const [contactInfo, setContactInfo] = useState<ContactInfo[]>([]);
  const [termsOfService, setTermsOfService] = useState<TermsOfService | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [loginMemory, setLoginMemory] = useState<{ provider: string; email?: string } | null>(null);
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);
  const errorCode = searchParams?.get("error") || "";
  const bind = searchParams?.get("bind") || "";
  const boundEmail = searchParams?.get("email") || "";

  useEffect(() => {
    if (status === "authenticated") {
      if (typeof window !== "undefined" && errorCode) {
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url.toString());
      }
      router.replace("/");
    }
  }, [status, errorCode, router]);

  useEffect(() => {
    // 加载联系信息
    fetch("/api/contact-info")
      .then((res) => res.json())
      .then((result) => {
        if (result.ok && result.data?.items) {
          setContactInfo(result.data.items);
        }
      })
      .catch((err) => console.error("Failed to load contact info:", err));

    // 加载服务条款
    fetch("/api/terms-of-service")
      .then((res) => res.json())
      .then((result) => {
        if (result.ok && result.data) {
          setTermsOfService(result.data);
        }
      })
      .catch((err) => console.error("Failed to load terms of service:", err));

    // 检查登录记忆
    const memory = getLoginMemory();
    if (memory) {
      setLoginMemory(memory);
    }
  }, []);

  function LoadingFallbackInner() {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">{t("common.loading")}</div>
      </div>
    );
  }

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert(t('activation.copySuccess'));
      });
    } else {
      // 兼容旧浏览器
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert(t('activation.copySuccess'));
    }
  };

  const businessInfo = contactInfo.find(item => item.type === 'business');
  const purchaseInfo = contactInfo.find(item => item.type === 'purchase');

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
    // 保存选择的provider到登录记忆（即使没有email）
    saveLoginMemory(providerId);
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

  const handleRedirectLogin = async (provider: string, email?: string) => {
    try {
      // 保存登录记忆
      saveLoginMemory(provider, email);
      await signIn(provider, {
        callbackUrl: "/",
        redirect: true,
      });
    } catch (error) {
      console.error("Login error:", error);
      alert(t("auth.login.error"));
    }
  };

  const handleQuickLogin = async () => {
    if (loginMemory) {
      await handleRedirectLogin(loginMemory.provider, loginMemory.email);
    }
  };

  const handleSwitchAccount = () => {
    clearLoginMemory();
    setLoginMemory(null);
    setShowSwitchAccount(false);
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

  const ErrorCard = () => {
    const errorMessageMap: Record<string, string> = {
      Configuration: "OAuth 配置错误，请检查环境变量或联系管理员。",
      OAuthSignin: "第三方登录失败，请稍后重试。",
      OAuthCallback: "登录回调出现问题，请稍后重试。",
      AccessDenied: "拒绝访问，请确认授权信息。",
    };
    const errorMessage =
      errorMessageMap[errorCode] || "登录过程中出现错误，请稍后重试或联系管理员。";
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
            {bind === "line_success" && (
              <div className="p-3 rounded-xl bg-green-50 text-green-700 text-sm">
                {boundEmail
                  ? `你的 LINE 账号已成功绑定到 ${boundEmail}，请再次点击「LINE 登录」完成登录。`
                  : "你的 LINE 账号已成功绑定，请再次点击「LINE 登录」完成登录。"}
              </div>
            )}
            {bind === "twitter_success" && (
              <div className="p-3 rounded-xl bg-green-50 text-green-700 text-sm">
                {boundEmail
                  ? `你的 Twitter 账号已成功绑定到 ${boundEmail}，请再次点击「Twitter 登录」完成登录。`
                  : "你的 Twitter 账号已成功绑定，请再次点击「Twitter 登录」完成登录。"}
              </div>
            )}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-2">{t("auth.login.error")}</h1>
              <p className="text-gray-600">{errorMessage}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  router.push("/login");
                }}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
              >
                返回登录页面
              </button>
              <button
                onClick={() => router.push("/")}
                className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Suspense fallback={<LoadingFallbackInner />}>
    {status === "unauthenticated" && errorCode ? (
      <ErrorCard />
    ) : (loading || status === "loading") ? (
      <LoadingFallbackInner />
    ) : (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4">
      <div className="w-full max-w-md mx-auto mb-3">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          aria-label="返回首页"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">{t("common.back")}</span>
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
            {/* Logo */}
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                {!logoError ? (
                  <Image
                    src="/logo.png"
                    alt="ZALEM Logo"
                    fill
                    sizes="96px"
                    className="object-contain"
                    priority
                    onError={() => {
                      setLogoError(true);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">Z</span>
                    </div>
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {t("auth.login.title")}
              </h1>
              <p className="text-gray-600">{t("auth.login.subtitle")}</p>
            </div>

          {!selectedProvider ? (
            // 选择提供商
            <div className="space-y-3">
              {/* 快速登录 */}
              {loginMemory && !showSwitchAccount && (
                <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">
                        {loginMemory.email ? `${t('auth.login.quickLogin')} (${loginMemory.email})` : t('auth.login.quickLogin')}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowSwitchAccount(true)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {t('auth.login.switchAccount')}
                    </button>
                  </div>
                  <button
                    onClick={handleQuickLogin}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <span>{t('auth.login.quickLoginWith').replace('{provider}', providers.find(p => p.id === loginMemory.provider)?.name || loginMemory.provider)}</span>
                  </button>
                </div>
              )}

              {/* 切换账号模式或没有登录记忆时显示所有提供商 */}
              {(showSwitchAccount || !loginMemory) && (
                <>
                  {showSwitchAccount && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                      <span className="text-sm text-gray-600">{t('auth.login.selectOtherAccount')}</span>
                      <button
                        onClick={handleSwitchAccount}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {providers.map((provider) => (
                    <OAuthButton
                      key={provider.id}
                      provider={provider.id}
                      name={provider.name}
                      onClick={() => {
                        handleProviderSelect(provider.id);
                        setShowSwitchAccount(false);
                      }}
                    />
                  ))}
                </>
              )}
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

      {/* 底栏 - 联系信息和服务条款 */}
      <div className="w-full max-w-md mx-auto mt-6 pb-4">
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-4 text-sm">
          {/* 联系信息 */}
          {(businessInfo || purchaseInfo) && (
            <div className="space-y-4">
              {businessInfo && (businessInfo.wechat || businessInfo.email) && (
                <div>
                  <div className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Handshake className="h-4 w-4 text-blue-600" />
                    {t('activation.businessContact')}
                  </div>
                  {businessInfo.wechat && (
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <MessageCircle className="h-4 w-4 text-gray-500" />
                      <span
                        className="text-blue-600 underline cursor-pointer select-all"
                        onClick={() => copyToClipboard(businessInfo.wechat!)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          copyToClipboard(businessInfo.wechat!);
                        }}
                      >
                        {businessInfo.wechat}
                      </span>
                      <span className="text-xs text-gray-500">{t('auth.login.clickToCopy')}</span>
                    </div>
                  )}
                  {businessInfo.email && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span
                        className="text-blue-600 underline cursor-pointer select-all"
                        onClick={() => copyToClipboard(businessInfo.email!)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          copyToClipboard(businessInfo.email!);
                        }}
                      >
                        {businessInfo.email}
                      </span>
                      <span className="text-xs text-gray-500">{t('auth.login.clickToCopy')}</span>
                    </div>
                  )}
                </div>
              )}

              {purchaseInfo && (purchaseInfo.wechat || purchaseInfo.email) && (
                <div>
                  <div className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-green-600" />
                    {t('activation.purchaseContact')}
                  </div>
                  {purchaseInfo.wechat && (
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <MessageCircle className="h-4 w-4 text-gray-500" />
                      <span
                        className="text-blue-600 underline cursor-pointer select-all"
                        onClick={() => copyToClipboard(purchaseInfo.wechat!)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          copyToClipboard(purchaseInfo.wechat!);
                        }}
                      >
                        {purchaseInfo.wechat}
                      </span>
                      <span className="text-xs text-gray-500">{t('auth.login.clickToCopy')}</span>
                    </div>
                  )}
                  {purchaseInfo.email && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span
                        className="text-blue-600 underline cursor-pointer select-all"
                        onClick={() => copyToClipboard(purchaseInfo.email!)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          copyToClipboard(purchaseInfo.email!);
                        }}
                      >
                        {purchaseInfo.email}
                      </span>
                      <span className="text-xs text-gray-500">{t('auth.login.clickToCopy')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 服务条款 */}
          {termsOfService && termsOfService.title && (
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowTerms(true)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <FileText className="h-4 w-4" />
                {t('activation.termsOfService')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 服务条款弹窗 */}
      {showTerms && termsOfService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{getMultilangContent(termsOfService.title, language)}</h3>
              <button
                onClick={() => setShowTerms(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {getMultilangContent(termsOfService.content, language)}
            </div>
            {termsOfService.version && (
              <div className="mt-4 text-xs text-gray-500">
                {t('activation.version')}{termsOfService.version}
              </div>
            )}
            <button
              onClick={() => setShowTerms(false)}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('activation.close')}
            </button>
          </div>
        </div>
      )}
    </div>
    )}
    </Suspense>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600">加载中…</div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
