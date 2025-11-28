"use client";

import AIPage from "@/components/AIPage";
import { useRouter } from "next/navigation";

/**
 * AI 助手页面路由
 * 使用 B 版本的 AIPage 组件
 */
export default function AIPageRoute() {
  const router = useRouter();
  
  return (
    <AIPage onBack={() => router.back()} />
  );
}

