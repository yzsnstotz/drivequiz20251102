"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n";
import { getExamQuestionCount } from "@/lib/questionFilter";

interface ModeSelectorProps {
  licenseType: string;
  stage: "provisional" | "regular";
  selectedMode: "study" | "exam" | null;
  onSelect: (mode: "study" | "exam") => void;
}

export default function ModeSelector({
  licenseType,
  stage,
  selectedMode,
  onSelect,
}: ModeSelectorProps) {
  const { t } = useLanguage();
  const examQuestionCount = getExamQuestionCount(licenseType, stage);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">
        {t("study.selectMode")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSelect("study")}
          className={`p-4 rounded-lg border-2 transition-colors text-left ${
            selectedMode === "study"
              ? "border-blue-500 bg-blue-50 text-blue-900"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
          }`}
        >
          <div className="font-medium">{t("study.mode.study")}</div>
          <div className="text-sm text-gray-600 mt-1">
            {t("study.mode.studyDesc")}
          </div>
        </button>
        <button
          onClick={() => onSelect("exam")}
          className={`p-4 rounded-lg border-2 transition-colors text-left ${
            selectedMode === "exam"
              ? "border-blue-500 bg-blue-50 text-blue-900"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
          }`}
        >
          <div className="font-medium">{t("study.mode.exam")}</div>
          <div className="text-sm text-gray-600 mt-1">
            {t("study.mode.examDesc")}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {examQuestionCount} {t("exam.questions")}
          </div>
        </button>
      </div>
    </div>
  );
}

