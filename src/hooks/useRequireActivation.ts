"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActivation } from "@/contexts/ActivationContext";
import { useAppSession } from "@/contexts/SessionContext";

/**
 * AI 功能专用激活 Guard：
 * - 仅对 AI_PROTECTED_PREFIXES 下的路由生效（当前为 /ai）。
 * - 未登录：不处理（交由 middleware / AuthGuard）。
 * - 已登录且未激活：跳转到 /activation，并带上来源路由。
 * - /activation 路由本身跳过，避免循环。
 */
const AI_PROTECTED_PREFIXES = ["/ai"] as const;

export function useRequireActivation() {
  const { status: sessionStatus, loading: sessionLoading } = useAppSession();
  const { status: activationStatus, loading: activationLoading } = useActivation();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 跳过激活页自身，避免死循环
    if (!pathname || pathname.startsWith("/activation")) return;

    // 等待会话和激活状态加载完成
    if (sessionLoading || activationLoading) return;
    if (sessionStatus !== "authenticated") return;

    // 仅对 AI 路由启用激活校验
    const isAiProtectedPath = AI_PROTECTED_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );
    if (!isAiProtectedPath) return;

    const isActivated = activationStatus?.valid === true;
    if (isActivated) return;

    const search =
      typeof window !== "undefined" ? window.location.search || "" : "";
    const from = `${pathname}${search}`;
    router.replace(`/activation?from=${encodeURIComponent(from)}`);
  }, [activationLoading, activationStatus?.valid, pathname, router, sessionLoading, sessionStatus]);
}
