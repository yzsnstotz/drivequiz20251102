"use client";

import AIPage from "@/components/AIPage";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAIActivation } from "@/components/AIActivationProvider";

/**
 * AI 助手页面路由
 * 使用 B 版本的 AIPage 组件
 */
export default function AIPageRoute() {
  const router = useRouter();
  const { isActivated, showActivationModal } = useAIActivation();
  
  useEffect(() => {
    if (!isActivated) {
      showActivationModal();
    }
  }, [isActivated, showActivationModal]);
  
  return (
    <AIPage onBack={() => router.back()} />
  );
}
