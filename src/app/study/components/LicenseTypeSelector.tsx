"use client";

import React from "react";
import { LICENSE_TYPE_TAGS } from "@/lib/quizTags";
import { getLicenseTypeLabel } from "@/lib/licenseTypeLabels";
import { useLanguage } from "@/lib/i18n";

interface LicenseTypeSelectorProps {
  selectedLicenseType: string | null;
  onSelect: (licenseType: string) => void;
}

export default function LicenseTypeSelector({
  selectedLicenseType,
  onSelect,
}: LicenseTypeSelectorProps) {
  const { language, t } = useLanguage();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">
        {t("study.selectLicenseType")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {LICENSE_TYPE_TAGS.map((licenseType) => {
          const isSelected = selectedLicenseType === licenseType;
          const label = getLicenseTypeLabel(licenseType, language);

          return (
            <button
              key={licenseType}
              onClick={() => onSelect(licenseType)}
              className={`p-4 rounded-lg border-2 transition-colors text-left ${
                isSelected
                  ? "border-blue-500 bg-blue-50 text-blue-900"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">{label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

