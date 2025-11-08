"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPut } from "@/lib/apiClient.front";
import { saveLanguage, detectLanguage, type Language } from "@/lib/i18n";
import Header from "@/components/common/Header";

const languages: { code: Language; name: string; nativeName: string }[] = [
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "en", name: "English", nativeName: "English" },
];

export default function LanguagePage() {
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState<Language>(detectLanguage());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // 保存到本地存储
      saveLanguage(selectedLang);

      // 尝试保存到用户资料（如果已登录）
      try {
        await apiPut("/api/profile", { language: selectedLang });
      } catch (err) {
        // 如果未登录，忽略错误
        console.log("[Language] User not logged in, skipping profile update");
      }

      // 跳转到首页
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存语言设置失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="选择语言" showAIButton={false} />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">选择您的语言</h1>
          <p className="text-gray-600 mb-6">请选择您希望使用的语言</p>

          <div className="space-y-3 mb-6">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={`w-full p-4 rounded-lg border-2 transition-colors ${
                  selectedLang === lang.code
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">{lang.nativeName}</div>
                    <div className="text-sm text-gray-600">{lang.name}</div>
                  </div>
                  {selectedLang === lang.code && (
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "保存中..." : "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}

