"use client";

import { useLanguage } from "@/lib/i18n";

export type StatusBadgeVariant = "info" | "success" | "warn" | "error";

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  text?: {
    ja?: string;
    zh?: string;
    en?: string;
    default?: string;
  };
  children?: React.ReactNode;
  className?: string;
}

/**
 * 统一状态徽章组件
 * 语义色：info/success/warn/error；多语言文本
 */
export default function StatusBadge({ variant, text, children, className = "" }: StatusBadgeProps) {
  const { t } = useLanguage();

  const variantStyles = {
    info: "bg-blue-100 text-blue-800 border-blue-200",
    success: "bg-green-100 text-green-800 border-green-200",
    warn: "bg-yellow-100 text-yellow-800 border-yellow-200",
    error: "bg-red-100 text-red-800 border-red-200",
  };

  const displayText = text ? t(text) : children;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]} ${className}`}
    >
      {displayText}
    </span>
  );
}

