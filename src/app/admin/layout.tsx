"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ChangePasswordModal from "@/components/ChangePasswordModal";

/**
 * 读取本地 ADMIN_TOKEN（仅浏览器有效）
 */
function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("ADMIN_TOKEN");
  } catch {
    return null;
  }
}

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  requireDefaultAdmin?: boolean;
};

const ALL_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    match: (p) => p === "/admin",
  },
  {
    label: "Activation Codes",
    href: "/admin/activation-codes",
    match: (p) => p.startsWith("/admin/activation-codes"),
  },
  {
    label: "Users",
    href: "/admin/users",
    match: (p) => p.startsWith("/admin/users"),
  },
  {
    label: "Questions",
    href: "/admin/questions",
    match: (p) => p.startsWith("/admin/questions"),
  },
  {
    label: "Admins",
    href: "/admin/admins",
    match: (p) => p.startsWith("/admin/admins"),
    requireDefaultAdmin: true, // 只有默认管理员可见
  },
  {
    label: "Operation Logs",
    href: "/admin/operation-logs",
    match: (p) => p.startsWith("/admin/operation-logs"),
  },
  {
    label: "Stats",
    href: "/admin/stats",
    match: (p) => p.startsWith("/admin/stats"),
  },
  {
    label: "Tasks",
    href: "/admin/tasks",
    match: (p) => p.startsWith("/admin/tasks"),
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isDefaultAdmin, setIsDefaultAdmin] = useState<boolean | null>(null);

  // 检查当前管理员是否为默认管理员
  useEffect(() => {
    if (pathname === "/admin/login") return;

    let mounted = true;
    (async () => {
      try {
        const token = getAdminToken();
        if (!token) return;

        const response = await fetch("/api/admin/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!mounted) return;

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.data) {
            setIsDefaultAdmin(data.data.isDefaultAdmin === true);
          }
        }
      } catch (e) {
        console.error("Failed to check admin type:", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  // 排除登录页面：登录页面不需要 AdminLayout 的检查
  const isLoginPage = pathname === "/admin/login";

  // 客户端守卫：无 Token 则跳登录（但排除登录页面本身）
  useEffect(() => {
    // 登录页面直接通过，不检查 token
    if (pathname === "/admin/login") {
      setChecked(true);
      return;
    }

    const token = getAdminToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setChecked(true);
  }, [router, pathname]);

  // 根据权限过滤导航项
  const NAV_ITEMS = useMemo(() => {
    if (isDefaultAdmin === null) {
      // 权限检查中，暂时不显示需要默认管理员权限的项
      return ALL_NAV_ITEMS.filter((item) => !item.requireDefaultAdmin);
    }
    if (isDefaultAdmin) {
      // 默认管理员，显示所有项
      return ALL_NAV_ITEMS;
    } else {
      // 非默认管理员，隐藏需要默认管理员权限的项
      return ALL_NAV_ITEMS.filter((item) => !item.requireDefaultAdmin);
    }
  }, [isDefaultAdmin]);

  // 计算导航高亮
  const activeHref = useMemo(() => {
    return NAV_ITEMS.find((n) => n.match(pathname))?.href ?? "/admin";
  }, [pathname, NAV_ITEMS]);

  // 在未完成校验前不渲染主体，避免无 Token 的闪屏
  if (!checked) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 text-gray-500">
        <div className="text-sm">Checking admin session…</div>
      </div>
    );
  }

  // 登录页面：只渲染子组件，不显示 AdminLayout 的导航和布局
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 md:bg-gray-100">
      {/* 顶部条 */}
      <header className="sticky top-0 z-20 h-14 bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold tracking-tight">ZALEM Admin</span>
          <span className="text-[10px] text-gray-400 hidden sm:inline">UTC · vNext</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 hidden lg:inline">
            {new Date().toISOString()}
          </span>
          <button
            className="text-xs sm:text-sm px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 touch-manipulation transition-colors"
            onClick={() => setShowChangePassword(true)}
          >
            修改密码
          </button>
          <button
            className="text-xs sm:text-sm px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 touch-manipulation transition-colors"
            onClick={() => {
              try {
                window.localStorage.removeItem("ADMIN_TOKEN");
              } catch {}
              router.replace("/admin/login");
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex">
        {/* 侧边栏 */}
        <aside className="hidden md:block w-60 shrink-0 bg-white/80 backdrop-blur-md border-r border-gray-200/50 min-h-[calc(100vh-3.5rem)]">
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "block rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-blue-500 text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-100/50",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* 主体内容 */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] max-w-full overflow-x-hidden">
          {/* 移动端导航 */}
          <div className="md:hidden px-4 pt-3 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {NAV_ITEMS.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium touch-manipulation transition-colors",
                      active
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-gray-700 bg-white shadow-sm hover:bg-gray-50 active:bg-gray-100",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* iOS风格内容容器 */}
          <div className="px-4 pb-4 md:px-6 md:pb-6">
            <div className="bg-white rounded-2xl shadow-sm md:shadow-md">
              <div className="p-4 md:p-6">{children}</div>
            </div>
          </div>
        </main>
      </div>
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}
