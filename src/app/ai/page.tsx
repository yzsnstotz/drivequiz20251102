"use client";

import AIPage from "@/components/AIPage";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActivation } from "@/contexts/ActivationContext";

/**
 * AI 助手页面路由
 * 使用 B 版本的 AIPage 组件
 */
export default function AIPageRoute() {
  const router = useRouter();
  const { status, loading } = useActivation();
  const isActivated = !!status?.valid;
  
  useEffect(() => {
    if (!loading && !isActivated) {
      router.replace("/activation");
    }
  }, [loading, isActivated, router]);
  
  if (loading) {
    return <div>Loading AI Helper...</div>;
  }

  if (!isActivated) {
    return <div>Redirecting to activation...</div>;
  }

  return <AIPage onBack={() => router.back()} />;
}
