"use client";

import React, { useState, useEffect } from "react";
import { Edit } from "lucide-react";
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
  // 使用 sessionStorage 来持久化标记，防止组件重新挂载时重新加载
  const PREFERENCES_LOADED_KEY = 'study_preferences_loaded';
  
  // 加载用户已保存的选择（不依赖语言，使用固定的key，只加载一次）
  useEffect(() => {
    // 如果已经加载过（检查 sessionStorage），不再重新加载
    if (typeof window !== 'undefined' && sessionStorage.getItem(PREFERENCES_LOADED_KEY) === 'true') {
      // 如果已经加载过，从 sessionStorage 恢复状态
      const savedLicenseType = sessionStorage.getItem('study_saved_license_type');
      const savedStage = sessionStorage.getItem('study_saved_stage') as "provisional" | "regular" | null;
      
      if (savedLicenseType && savedStage) {
        setSavedLicenseType(savedLicenseType);
        setSavedStage(savedStage);
        setSelectedLicenseType(savedLicenseType);
        setSelectedStage(savedStage);
        setStep(3);
        setLoading(false);
      }
      return;
    }

    const loadUserPreferences = async () => {
      if (!session?.user?.id) {
        setLoading(false);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(PREFERENCES_LOADED_KEY, 'true');
        }
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
              
              // 保存到 sessionStorage
              if (typeof window !== 'undefined') {
                sessionStorage.setItem(PREFERENCES_LOADED_KEY, 'true');
                sessionStorage.setItem('study_saved_license_type', licenseType);
                sessionStorage.setItem('study_saved_stage', stage);
              }
            }
          }
        }
      } catch (error) {
        console.error("[StudyPage] Load preferences error:", error);
      } finally {
        setLoading(false);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(PREFERENCES_LOADED_KEY, 'true');
        }
      }
    };

    loadUserPreferences();
  }, [session]); // 只依赖session，不依赖preferencesLoaded

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
        
        // 同时保存到 sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('study_saved_license_type', selectedLicenseType);
          sessionStorage.setItem('study_saved_stage', stage);
        }
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-ios-sm text-center">
          <div className="relative inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 mx-auto" style={{ animation: 'spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 bg-blue-600 dark:bg-blue-400 rounded-full animate-ios-pulse"></div>
            </div>
          </div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      <div className="mb-6 flex items-center space-x-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-ios-dark-text">
            {t("study.title")}
          </h1>
          <p className="text-gray-600 dark:text-ios-dark-text-secondary">{t("study.subtitle")}</p>
        </div>
      </div>

      {/* 显示当前选择 */}
      {savedLicenseType && savedStage && step === 3 && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4 shadow-ios-sm dark:shadow-ios-dark-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-ios-dark-text-secondary mb-1">{t('study.currentSelection')}</p>
              <p className="text-base font-medium text-gray-900 dark:text-ios-dark-text">
                {getLicenseTypeLabel(savedLicenseType, language)} ·{" "}
                {savedStage === "provisional"
                  ? t("study.stage.provisional")
                  : t("study.stage.regular")}
              </p>
            </div>
            <button
              onClick={handleAdjustSelection}
              className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 dark:text-blue-400 rounded-xl ios-button active:text-blue-700 dark:active:text-blue-300 active:bg-blue-100 dark:active:bg-blue-500/20 active:scale-95"
            >
              <Edit className="h-4 w-4" />
              <span>{t('study.adjust')}</span>
            </button>
          </div>
        </div>
      )}

        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm">
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
