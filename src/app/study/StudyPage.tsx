"use client";

import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import LicenseTypeSelector from "./components/LicenseTypeSelector";
import StageSelector from "./components/StageSelector";
import ModeSelector from "./components/ModeSelector";
import { useLanguage } from "@/lib/i18n";
import { useRouter } from "next/navigation";

export default function StudyPage() {
  const { t } = useLanguage();
  const router = useRouter();
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

  const handleLicenseTypeSelect = (licenseType: string) => {
    setSelectedLicenseType(licenseType);
    setStep(2);
  };

  const handleStageSelect = (stage: "provisional" | "regular") => {
    setSelectedStage(stage);
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

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      <div className="mb-6 flex items-center space-x-4">
        <button
          onClick={handleBack}
          className="text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("study.title")}
          </h1>
          <p className="text-gray-600">{t("study.subtitle")}</p>
        </div>
      </div>

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
