"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import LicenseTypeSelector from "../components/LicenseTypeSelector";
import StageSelector from "../components/StageSelector";
import { useLanguage } from "@/lib/i18n";
import { useSession } from "next-auth/react";

export default function LicenseSelectPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLicenseType, setSelectedLicenseType] = useState<string | null>(
    null
  );
  const [selectedStage, setSelectedStage] = useState<
    "provisional" | "regular" | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const handleLicenseTypeSelect = (licenseType: string) => {
    setSelectedLicenseType(licenseType);
    setStep(2);
  };

  const handleStageSelect = async (stage: "provisional" | "regular") => {
    setSelectedStage(stage);
    setLoading(true);
    setError(null);

    try {
      if (!selectedLicenseType) {
        setError("请先选择驾照类型");
        setLoading(false);
        return;
      }

      // 保存到服务器
      const response = await fetch("/api/user/license-preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          licenseType: selectedLicenseType,
          stage,
        }),
      });

      const result = await response.json();
      if (result.ok) {
        // 保存成功，跳转到回调URL或首页
        router.push(callbackUrl);
      } else {
        setError(result.message || "保存失败，请稍后重试");
      }
    } catch (err) {
      console.error("[LicenseSelectPage] Save error:", err);
      setError("保存失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      // 如果用户未登录，跳转到登录页面
      if (!session) {
        router.push("/login");
      } else {
        router.push("/");
      }
    } else if (step === 2) {
      setStep(1);
      setSelectedStage(null);
    }
  };

  // 如果未登录，显示提示
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-6 pb-20">
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
          <p className="text-gray-600 mb-4">请先登录</p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            前往登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      <div className="mb-6 flex items-center space-x-4">
        <button
          onClick={handleBack}
          className="text-gray-600 hover:text-gray-900"
          disabled={loading}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("study.title")}
          </h1>
          <p className="text-gray-600">
            {step === 1
              ? t("study.selectLicenseType")
              : t("study.selectStage")}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 1 && (
          <LicenseTypeSelector
            selectedLicenseType={selectedLicenseType}
            onSelect={handleLicenseTypeSelect}
          />
        )}

        {step === 2 && selectedLicenseType && (
          <StageSelector
            selectedStage={selectedStage}
            onSelect={handleStageSelect}
          />
        )}

        {loading && (
          <div className="mt-4 text-center text-gray-600">保存中...</div>
        )}
      </div>
    </div>
  );
}

