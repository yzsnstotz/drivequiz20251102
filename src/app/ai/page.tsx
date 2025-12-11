"use client";

import AIPage from "@/components/AIPage";
import { useRouter } from "next/navigation";
import { useActivation } from "@/contexts/ActivationContext";
import { useAppSession } from "@/contexts/SessionContext";
import { useRequireActivation } from "@/hooks/useRequireActivation";

/**
 * AI 助手页面路由
 * 使用 B 版本的 AIPage 组件
 */
export default function AIPageRoute() {
  const router = useRouter();
  const { status, loading } = useActivation();
  const { status: sessionStatus, isAuthenticatedStrict } = useAppSession();
  useRequireActivation();

  const isAuthenticated = isAuthenticatedStrict;
  const isActivated = isAuthenticated && !!status?.valid;
  
  if (sessionStatus === "loading") {
    return <div>Loading AI Helper...</div>;
  }

  if (!isAuthenticated) {
    // 未登录：交由 AuthGuard / middleware 处理，不在此处跳转激活
    return null;
  }

  if (loading) {
    return <div>Loading AI Helper...</div>;
  }

  if (!isActivated) {
    return <div>Redirecting to activation...</div>;
  }

  return <AIPage onBack={() => router.back()} />;
}
