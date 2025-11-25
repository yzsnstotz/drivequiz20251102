"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n";

interface StageSelectorProps {
  selectedStage: "provisional" | "regular" | null;
  onSelect: (stage: "provisional" | "regular") => void;
}

export default function StageSelector({
  selectedStage,
  onSelect,
}: StageSelectorProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">
        {t("study.selectStage")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSelect("provisional")}
          className={`p-4 rounded-lg border-2 transition-colors text-left ${
            selectedStage === "provisional"
              ? "border-blue-500 bg-blue-50 text-blue-900"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
          }`}
        >
          <div className="font-medium">{t("study.stage.provisional")}</div>
        </button>
        <button
          onClick={() => onSelect("regular")}
          className={`p-4 rounded-lg border-2 transition-colors text-left ${
            selectedStage === "regular"
              ? "border-blue-500 bg-blue-50 text-blue-900"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
          }`}
        >
          <div className="font-medium">{t("study.stage.regular")}</div>
        </button>
      </div>
    </div>
  );
}

