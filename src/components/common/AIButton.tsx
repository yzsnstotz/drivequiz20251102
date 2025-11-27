"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAIActivation } from "@/components/AIActivationProvider";
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
  const { isActivated } = useAIActivation();
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // 检查激活状态
      if (isActivated) {
        // 已激活，跳转到AI助手页面
        router.push(`/ai?context=${context}`);
      } else {
        // 未激活，跳转到激活页面
        router.push('/activation');
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`ai-button flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${className}`}
      aria-label="AI助手"
    >
      <MessageCircle className="h-5 w-5" />
      <span>AI助手</span>
    </button>
  );
}

