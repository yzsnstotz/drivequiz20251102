"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

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

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // 默认行为：跳转到AI助手页面
      window.location.href = `/ai?context=${context}`;
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

