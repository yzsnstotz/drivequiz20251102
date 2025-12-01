"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useLanguage } from "@/lib/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppSession } from "@/contexts/SessionContext";

function PhoneInputContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const { data: session, update } = useAppSession();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 检查是否已登录
    if (!session?.user) {
      router.push("/login");
      return;
    }

    // 检查是否已有电话号码
    if ((session.user as any)?.phone) {
      router.push("/");
      return;
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t("auth.phone.error"));
      }

      // 更新session
      await update();

      // 跳转到主页
      router.push("/");
    } catch (err: any) {
      console.error("Phone save error:", err);
      setError(err.message || t("auth.phone.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {t("auth.phone.title")}
            </h1>
            <p className="text-gray-600">{t("auth.phone.subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("auth.phone.input")}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("auth.phone.placeholder")}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none transition-colors"
                required
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || !phone}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? t("common.loading") : t("auth.phone.submit")}
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
              >
                {t("auth.phone.skip")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function PhoneInputPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>}>
      <PhoneInputContent />
    </Suspense>
  );
}

