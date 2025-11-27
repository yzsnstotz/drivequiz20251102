"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * 客户端认证守卫组件
 * 检查用户是否完成驾照选择，如果未完成则重定向到选择页面
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 等待 session 加载完成
    if (status === "loading") {
      return;
    }

    // 如果未登录，middleware 会处理重定向
    if (status === "unauthenticated") {
      return;
    }

    // 如果已登录，检查是否完成驾照选择
    if (status === "authenticated" && session?.user?.id) {
      // 排除选择页面本身
      if (pathname === "/study/select") {
        return;
      }

      // 检查用户是否完成驾照选择
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
              // 如果未完成驾照选择，跳转到选择页面
              if (!licenseType || !stage) {
                const selectUrl = new URL("/study/select", window.location.origin);
                selectUrl.searchParams.set("callbackUrl", pathname);
                router.push(selectUrl.toString());
              }
            } else {
              // 如果没有数据，说明未完成选择
              const selectUrl = new URL("/study/select", window.location.origin);
              selectUrl.searchParams.set("callbackUrl", pathname);
              router.push(selectUrl.toString());
            }
          }
        } catch (error) {
          console.error("[AuthGuard] Check license preference error:", error);
          // 如果检查失败，允许继续访问（避免阻塞）
        }
      };

      checkLicensePreference();
    }
  }, [session, status, router, pathname]);

  return <>{children}</>;
}

