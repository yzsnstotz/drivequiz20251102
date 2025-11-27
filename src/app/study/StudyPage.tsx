"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, Edit } from "lucide-react";
import LicenseTypeSelector from "./components/LicenseTypeSelector";
import StageSelector from "./components/StageSelector";
import ModeSelector from "./components/ModeSelector";
import { useLanguage } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getLicenseTypeLabel } from "@/lib/licenseTypeLabels";

export default function StudyPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedLicenseType, setSelectedLicenseType] = useState<string | null>(
    null
  );
  const [selectedStage, setSelectedStage] = useState<
    "provisional" | "regular" | null
  >(null);
  const [selectedMode, setSelectedMode] = useState<"study" | "exam" | null>(
    null
  );
  const [savedLicenseType, setSavedLicenseType] = useState<string | null>(null);
  const [savedStage, setSavedStage] = useState<"provisional" | "regular" | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // 加载用户已保存的选择
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/user/license-preference", {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const result = await response.json();
          if (result.ok && result.data) {
            const { licenseType, stage } = result.data;
            if (licenseType && stage) {
              setSavedLicenseType(licenseType);
              setSavedStage(stage as "provisional" | "regular");
              setSelectedLicenseType(licenseType);
              setSelectedStage(stage as "provisional" | "regular");
              setStep(3); // 直接显示模式选择
            }
          }
        }
      } catch (error) {
        console.error("[StudyPage] Load preferences error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUserPreferences();
  }, [session]);

  const handleLicenseTypeSelect = (licenseType: string) => {
    setSelectedLicenseType(licenseType);
    setStep(2);
  };

  const handleStageSelect = async (stage: "provisional" | "regular") => {
    setSelectedStage(stage);
    
    // 如果用户已登录，保存选择
    if (session?.user?.id && selectedLicenseType) {
      try {
        await fetch("/api/user/license-preference", {
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
        setSavedLicenseType(selectedLicenseType);
        setSavedStage(stage);
      } catch (error) {
        console.error("[StudyPage] Save preference error:", error);
      }
    }
    
    setStep(3);
  };

  const handleModeSelect = (mode: "study" | "exam") => {
    setSelectedMode(mode);
    // 导航到对应的模式页面
    if (selectedLicenseType && selectedStage) {
      const params = new URLSearchParams({
        licenseType: selectedLicenseType,
        stage: selectedStage,
        mode,
      });
      // study 模式对应 /study/learn，exam 模式对应 /study/exam
      const routePath = mode === "study" ? "/study/learn" : "/study/exam";
      router.push(`${routePath}?${params.toString()}`);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      router.push("/");
    } else if (step === 2) {
      setStep(1);
      setSelectedLicenseType(null);
    } else if (step === 3) {
      setStep(2);
      setSelectedStage(null);
      setSelectedMode(null);
    }
  };

  const handleAdjustSelection = () => {
    setStep(1);
    setSelectedLicenseType(null);
    setSelectedStage(null);
    setSelectedMode(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 pb-20">
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
          <p className="text-gray-600">加载中...</p>
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
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("study.title")}
          </h1>
          <p className="text-gray-600">{t("study.subtitle")}</p>
        </div>
      </div>

      {/* 显示当前选择 */}
      {savedLicenseType && savedStage && step === 3 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">当前选择</p>
              <p className="text-base font-medium text-gray-900">
                {getLicenseTypeLabel(savedLicenseType, language)} ·{" "}
                {savedStage === "provisional"
                  ? t("study.stage.provisional")
                  : t("study.stage.regular")}
              </p>
            </div>
            <button
              onClick={handleAdjustSelection}
              className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Edit className="h-4 w-4" />
              <span>调整</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm">
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

        {step === 3 &&
          selectedLicenseType &&
          selectedStage &&
          (selectedStage === "provisional" || selectedStage === "regular") && (
            <ModeSelector
              licenseType={selectedLicenseType}
              stage={selectedStage}
              selectedMode={selectedMode}
              onSelect={handleModeSelect}
            />
          )}
      </div>
    </div>
  );
}
