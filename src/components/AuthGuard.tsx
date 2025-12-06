"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppSession } from "@/contexts/SessionContext";

/**
 * 客户端认证守卫组件
 * 只在初次登录时检查用户是否完成驾照选择，如果未完成则重定向到选择页面
 * 之后不再自动检查，避免强制用户重复选择
 */
const LICENSE_PREFERENCE_CHECKED_KEY = 'license_preference_checked';
const LICENSE_PREFERENCE_SKIPPED_KEY = 'license_preference_skipped';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useAppSession();
  const router = useRouter();
  const pathname = usePathname();
  const hasCheckedRef = useRef(false);
  const lastCheckTimeRef = useRef<number>(0);
  const MIN_CHECK_INTERVAL = 5 * 60 * 1000; // 最小检查间隔：5 分钟

  useEffect(() => {
    console.log("[AuthGuard] status =", status, "pathname =", pathname);
    try {
      console.log("[AuthGuard] session =", session);
    } catch {}
    // 排除 admin 路由，admin 路由使用独立的认证系统
    if ((pathname?.startsWith('/admin/') ?? false)) {
      return;
    }

    // 排除选择页面本身
    if (pathname === "/study/select") {
      return;
    }

    // 等待 session 加载完成
    if (status === "loading") {
      return;
    }

    // 由下方 isPublic 检查决定是否需要登录

    const PUBLIC_PATHS = ["/login", "/login/bind-email", "/login/error"];
    const isPublic = PUBLIC_PATHS.includes(pathname ?? "");

    if (!isPublic && status === "unauthenticated") {
      console.log("[AuthGuard] redirect to /login");
      router.replace("/login");
      return;
    }

    if (status === "authenticated" && (session as any)?.needsEmailBinding && pathname !== "/login/bind-email") {
      console.log("[AuthGuard] redirect to /login/bind-email");
      router.replace("/login/bind-email");
      return;
    }

    // 如果已登录，只在初次登录时检查一次
    if (status === "authenticated" && session?.user?.id) {
      // 如果已经检查过，不再重复检查
      if (hasCheckedRef.current) {
        return;
      }

      // 检查 localStorage 标记，如果已经检查过或用户已跳过，不再检查
      if (typeof window !== 'undefined') {
        const hasChecked = localStorage.getItem(LICENSE_PREFERENCE_CHECKED_KEY) === 'true';
        const hasSkipped = localStorage.getItem(LICENSE_PREFERENCE_SKIPPED_KEY) === 'true';
        
        if (hasChecked || hasSkipped) {
          hasCheckedRef.current = true;
          return;
        }
      }

      // 检查最小间隔，避免频繁检查
      const now = Date.now();
      if (now - lastCheckTimeRef.current < MIN_CHECK_INTERVAL) {
        // 距离上次检查不足 5 分钟，跳过
        hasCheckedRef.current = true;
        return;
      }
      lastCheckTimeRef.current = now;

      // 标记为已检查，避免重复检查
      hasCheckedRef.current = true;

      // 检查用户是否完成驾照选择（只在初次登录时）
      const checkLicensePreference = async () => {
        try {
          const response = await fetch("/api/user/license-preference", {
            method: "GET",
            credentials: "include",
          });

          if (response.ok) {
            const result = await response.json();
            if (result.ok && result.data) {
              const { licenseType, stage } = result.data;
              // 如果用户已经有偏好，标记为已检查，不再重复检查
              if (licenseType && stage) {
                if (typeof window !== 'undefined') {
                  localStorage.setItem(LICENSE_PREFERENCE_CHECKED_KEY, 'true');
                }
                return;
              }
            }
            
            // 如果没有偏好，且用户未跳过，才进行重定向（只在初次登录时）
            if (typeof window !== 'undefined') {
              const hasSkipped = localStorage.getItem(LICENSE_PREFERENCE_SKIPPED_KEY) === 'true';
              if (!hasSkipped) {
                const selectUrl = new URL("/study/select", window.location.origin);
                selectUrl.searchParams.set("callbackUrl", pathname ?? "/");
                router.push(selectUrl.toString());
              }
            }
          }
        } catch (error) {
          console.error("[AuthGuard] Check license preference error:", error);
          // 如果检查失败，允许继续访问（避免阻塞）
        }
      };

      checkLicensePreference();
    }
  }, [session, status]); // 移除 router 和 pathname 依赖，避免路径变化时重复检查

  // 排除 admin 路由，admin 路由使用独立的认证系统
  if ((pathname?.startsWith('/admin/') ?? false)) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
