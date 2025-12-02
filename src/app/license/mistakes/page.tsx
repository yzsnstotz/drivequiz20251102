"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/common/Header";
import AdSlot from "@/components/common/AdSlot";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

// 这里应该从localStorage或API加载错题
// 暂时使用示例数据
export default function LicenseMistakesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从localStorage加载错题
    try {
      const saved = localStorage.getItem("mistakes");
      if (saved) {
        setMistakes(JSON.parse(saved));
      }
    } catch (err) {
      console.error("加载错题失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="错题本" showAIButton={false} />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="错题本" showAIButton={false} />
      
      {/* 广告位 */}
      <div className="container mx-auto px-4 py-4">
        <AdSlot position="license_mistakes" />
      </div>

      <div className="container mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          返回
        </button>

        {mistakes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600 mb-4">暂无错题</p>
            <Link
              href="/license"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              开始学习
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {mistakes.map((mistake, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{mistake.content}</h3>
                {mistake.explanation && (
                  <p className="text-sm text-gray-600 mb-2">{mistake.explanation}</p>
                )}
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">错题</span>
                  {mistake.category && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {mistake.category}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

