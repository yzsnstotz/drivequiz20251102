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
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t("study.selectMode")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSelect("study")}
          className={`p-4 rounded-xl border-2 ios-button transition-all duration-200 text-left ${
            selectedMode === "study"
              ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-500/20 text-blue-900 dark:text-blue-200 shadow-ios-sm dark:shadow-ios-dark-sm"
              : "border-gray-200 dark:border-ios-dark-border bg-white dark:bg-ios-dark-bg-secondary text-gray-700 dark:text-white active:border-gray-300 dark:active:border-ios-dark-border active:scale-[0.98]"
          }`}
        >
          <div className="font-medium">{t("study.mode.study")}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t("study.mode.studyDesc")}
          </div>
        </button>
        <button
          onClick={() => onSelect("exam")}
          className={`p-4 rounded-xl border-2 ios-button transition-all duration-200 text-left ${
            selectedMode === "exam"
              ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-500/20 text-blue-900 dark:text-blue-200 shadow-ios-sm dark:shadow-ios-dark-sm"
              : "border-gray-200 dark:border-ios-dark-border bg-white dark:bg-ios-dark-bg-secondary text-gray-700 dark:text-white active:border-gray-300 dark:active:border-ios-dark-border active:scale-[0.98]"
          }`}
        >
          <div className="font-medium">{t("study.mode.exam")}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t("study.mode.examDesc")}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {examQuestionCount} {t("exam.questions")}
          </div>
        </button>
      </div>
    </div>
  );
}

