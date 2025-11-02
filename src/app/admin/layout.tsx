"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
};

const NAV_ITEMS: NavItem[] = [
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
    label: "Admins",
    href: "/admin/admins",
    match: (p) => p.startsWith("/admin/admins"),
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

  // 计算导航高亮
  const activeHref = useMemo(() => {
    return NAV_ITEMS.find((n) => n.match(pathname))?.href ?? "/admin";
  }, [pathname]);

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
    <div className="min-h-screen bg-gray-50">
      {/* 顶部条 */}
      <header className="sticky top-0 z-20 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold tracking-tight">ZALEM Admin</span>
          <span className="text-xs text-gray-400">UTC · vNext</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:inline">
            {new Date().toISOString()}
          </span>
          <button
            className="text-xs px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
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
        <aside className="hidden md:block w-60 shrink-0 bg-white border-r border-gray-200 min-h-[calc(100vh-3.5rem)]">
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "block rounded-md px-3 py-2 text-sm",
                    active
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* 主体内容 */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] p-4">
          {/* 面包屑 / 顶部导航（移动端） */}
          <div className="md:hidden mb-3">
            <div className="flex gap-2 overflow-x-auto">
              {NAV_ITEMS.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "whitespace-nowrap rounded-full px-3 py-1 text-xs border",
                      active
                        ? "bg-gray-900 text-white border-gray-900"
                        : "text-gray-700 border-gray-300",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-4">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
