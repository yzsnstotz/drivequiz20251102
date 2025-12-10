"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface AIButtonProps {
  context?: "license" | "vehicle" | "service" | "general";
  className?: string;
  onClick?: () => void;
}

/**
 * AI助手按钮组件
 * 点击后打开AI助手对话框
 */
export default function AIButton({ context = "general", className = "", onClick }: AIButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // 统一入口：一律跳转 /ai，由内部逻辑决定是否去激活
      router.push(`/ai?context=${context}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`ai-button ios-button flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl shadow-ios-sm active:shadow-ios ${className}`}
      aria-label="AI助手"
    >
      <MessageCircle className="h-5 w-5" />
      <span>AI助手</span>
    </button>
  );
}

