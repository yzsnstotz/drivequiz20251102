"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { Language } from "@/lib/i18n";

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

type NavItemKey = {
  key: string;
  href: string;
  match: (pathname: string) => boolean;
  requireDefaultAdmin?: boolean;
  permission?: string;
};

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  requireDefaultAdmin: boolean;
  permission?: string; // 权限类别
};

const ALL_NAV_ITEM_KEYS: NavItemKey[] = [
  { key: "nav.activationCodes", href: "/admin/activation-codes", match: (p: string) => p.startsWith("/admin/activation-codes"), permission: "activation_codes" },
  { key: "nav.users", href: "/admin/users", match: (p: string) => p.startsWith("/admin/users"), permission: "users" },
  { key: "nav.questions", href: "/admin/questions", match: (p: string) => p.startsWith("/admin/questions"), permission: "questions" },
  { key: "nav.admins", href: "/admin/admins", match: (p: string) => p.startsWith("/admin/admins"), requireDefaultAdmin: true, permission: "admins" },
  { key: "nav.operationLogs", href: "/admin/operation-logs", match: (p: string) => p.startsWith("/admin/operation-logs"), permission: "operation_logs" },
  { key: "nav.stats", href: "/admin/stats", match: (p: string) => p.startsWith("/admin/stats"), permission: "stats" },
  { key: "nav.tasks", href: "/admin/tasks", match: (p: string) => p.startsWith("/admin/tasks"), permission: "tasks" },
  { key: "nav.merchants", href: "/admin/merchants", match: (p: string) => p.startsWith("/admin/merchants"), permission: "merchants" },
  { key: "nav.videos", href: "/admin/videos", match: (p: string) => p.startsWith("/admin/videos"), permission: "videos" },
  { key: "nav.contactAndTerms", href: "/admin/contact-and-terms", match: (p: string) => p.startsWith("/admin/contact-and-terms"), permission: "contact_and_terms" },
  { key: "nav.ai", href: "/admin/ai", match: (p: string) => p.startsWith("/admin/ai"), permission: "ai" },
] as const;

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const [checked, setChecked] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isDefaultAdmin, setIsDefaultAdmin] = useState<boolean | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<string[] | null>(null);
  
  // 将导航项转换为带翻译的 NavItem（使用useMemo，依赖language确保实时更新）
  const ALL_NAV_ITEMS: NavItem[] = useMemo(() => {
    return ALL_NAV_ITEM_KEYS.map(item => ({
      label: t(item.key),
      href: item.href,
      match: item.match,
      requireDefaultAdmin: item.requireDefaultAdmin ?? false,
      permission: item.permission,
    }));
  }, [t, language]); // 依赖language确保语言切换时立即更新

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
            setAdminPermissions(data.data.permissions || []);
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

  // 根据权限过滤导航项（依赖ALL_NAV_ITEMS，确保语言切换时更新）
  const NAV_ITEMS = useMemo(() => {
    if (isDefaultAdmin === null) {
      // 权限检查中，暂时不显示需要默认管理员权限的项
      return ALL_NAV_ITEMS.filter((item) => !item.requireDefaultAdmin);
    }
    if (isDefaultAdmin) {
      // 超级管理员，显示所有项
      return ALL_NAV_ITEMS;
    } else {
      // 普通管理员，根据权限过滤
      return ALL_NAV_ITEMS.filter((item) => {
        // 隐藏需要超级管理员权限的项
        if (item.requireDefaultAdmin) {
          return false;
        }
        // 检查权限类别
        if (item.permission && adminPermissions) {
          return adminPermissions.includes(item.permission);
        }
        // 如果没有定义权限，默认显示（向后兼容）
        return true;
      });
    }
  }, [isDefaultAdmin, ALL_NAV_ITEMS, adminPermissions]);

  // 计算导航高亮
  const activeHref = useMemo(() => {
    // 如果访问 /admin，默认高亮统计页面
    if (pathname === "/admin") {
      return "/admin/stats";
    }
    return NAV_ITEMS.find((n) => n.match(pathname))?.href ?? "/admin/stats";
  }, [pathname, NAV_ITEMS]);

  // 在未完成校验前不渲染主体，避免无 Token 的闪屏
  if (!checked) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 text-gray-500">
        <div className="text-sm">{t('common.loading')}</div>
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
          <span className="text-base font-semibold tracking-tight">{t('header.title')}</span>
          <span className="text-[10px] text-gray-400 hidden sm:inline">UTC · vNext</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 hidden lg:inline">
            {new Date().toISOString()}
          </span>
          {/* 语言切换器 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              className={`text-xs px-2 py-1 rounded transition-colors ${
                language === 'zh' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setLanguage('zh')}
              title="中文"
            >
              中
            </button>
            <button
              className={`text-xs px-2 py-1 rounded transition-colors ${
                language === 'en' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setLanguage('en')}
              title="English"
            >
              EN
            </button>
            <button
              className={`text-xs px-2 py-1 rounded transition-colors ${
                language === 'ja' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setLanguage('ja')}
              title="日本語"
            >
              日
            </button>
          </div>
          <button
            className="text-xs sm:text-sm px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 touch-manipulation transition-colors"
            onClick={() => setShowChangePassword(true)}
          >
            {t('header.changePassword')}
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
            {t('header.logout')}
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
            <div className="flex flex-wrap gap-2 pb-2">
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </LanguageProvider>
  );
}
