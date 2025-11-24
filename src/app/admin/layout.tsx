"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { Language } from "@/lib/i18n";
import { getFormattedVersion } from "@/lib/version";

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
  group?: string; // 分组标识
};

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  requireDefaultAdmin: boolean;
  permission?: string; // 权限类别
  group?: string; // 分组标识
};

type NavGroup = {
  key: string;
  label: string;
  items: NavItem[];
};

const ALL_NAV_ITEM_KEYS: NavItemKey[] = [
  // 用户管理分组
  { key: "nav.users", href: "/admin/users", match: (p: string) => p.startsWith("/admin/users"), permission: "users", group: "users" },
  { key: "nav.activationCodes", href: "/admin/activation-codes", match: (p: string) => p.startsWith("/admin/activation-codes"), permission: "activation_codes", group: "users" },
  { key: "nav.tasks", href: "/admin/tasks", match: (p: string) => p.startsWith("/admin/tasks"), permission: "tasks", group: "users" },
  // 题库管理分组
  { key: "nav.questions", href: "/admin/questions", match: (p: string) => p === "/admin/questions" || (p.startsWith("/admin/questions/") && !p.startsWith("/admin/question-processing") && !p.startsWith("/admin/polish-reviews")), permission: "questions", group: "questions" },
  { key: "nav.questionProcessing", href: "/admin/question-processing", match: (p: string) => p.startsWith("/admin/question-processing") && !p.startsWith("/admin/question-processing/error-dashboard"), permission: "questions", group: "questions" },
  { key: "nav.questionProcessingErrorStats", href: "/admin/question-processing/error-dashboard", match: (p: string) => p.startsWith("/admin/question-processing/error-dashboard"), permission: "questions", group: "questions" },
  { key: "nav.polishReviews", href: "/admin/polish-reviews", match: (p: string) => p.startsWith("/admin/polish-reviews"), permission: "questions", group: "questions" },
  // 商户与广告分组
  { key: "nav.merchants", href: "/admin/merchants", match: (p: string) => p.startsWith("/admin/merchants"), permission: "merchants", group: "merchant" },
  { key: "nav.merchantCategories", href: "/admin/merchant-categories", match: (p: string) => p.startsWith("/admin/merchant-categories"), permission: "merchants", group: "merchant" },
  { key: "nav.adSlots", href: "/admin/ad-slots", match: (p: string) => p.startsWith("/admin/ad-slots"), permission: "merchants", group: "merchant" },
  { key: "nav.videos", href: "/admin/videos", match: (p: string) => p.startsWith("/admin/videos"), permission: "videos", group: "merchant" },
  { key: "nav.contactAndTerms", href: "/admin/contact-and-terms", match: (p: string) => p.startsWith("/admin/contact-and-terms"), permission: "contact_and_terms", group: "merchant" },
  // AI管理分组
  { key: "nav.aiMonitor", href: "/admin/ai/monitor", match: (p: string) => p.startsWith("/admin/ai/monitor"), permission: "ai_monitor", group: "ai" },
  { key: "nav.aiLogs", href: "/admin/ai/logs", match: (p: string) => p.startsWith("/admin/ai/logs"), permission: "ai_logs", group: "ai" },
  { key: "nav.aiFilters", href: "/admin/ai/filters", match: (p: string) => p.startsWith("/admin/ai/filters"), permission: "ai_filters", group: "ai" },
  { key: "nav.aiConfig", href: "/admin/ai/config", match: (p: string) => p.startsWith("/admin/ai/config"), permission: "ai_config", group: "ai" },
  { key: "nav.aiScenes", href: "/admin/ai/scenes", match: (p: string) => p.startsWith("/admin/ai/scenes"), permission: "ai_config", group: "ai" },
  { key: "nav.aiRag", href: "/admin/ai/rag", match: (p: string) => p.startsWith("/admin/ai/rag") && !p.startsWith("/admin/ai/rag/list"), permission: "ai_rag", group: "ai" },
  { key: "nav.aiRagList", href: "/admin/ai/rag/list", match: (p: string) => p.startsWith("/admin/ai/rag/list"), permission: "ai_rag_list", group: "ai" },
  // 系统管理分组
  { key: "nav.operationLogs", href: "/admin/operation-logs", match: (p: string) => p.startsWith("/admin/operation-logs"), permission: "operation_logs", group: "system" },
  { key: "nav.stats", href: "/admin/stats", match: (p: string) => p.startsWith("/admin/stats"), permission: "stats", group: "system" },
  { key: "nav.admins", href: "/admin/admins", match: (p: string) => p.startsWith("/admin/admins"), requireDefaultAdmin: true, permission: "admins", group: "system" },
] as const;

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const [checked, setChecked] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isDefaultAdmin, setIsDefaultAdmin] = useState<boolean | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<string[] | null>(null);
  // 菜单分组展开/收起状态（默认全部收起）
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  // 移动端菜单开关状态
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // 将导航项转换为带翻译的 NavItem（使用useMemo，依赖language确保实时更新）
  const ALL_NAV_ITEMS: NavItem[] = useMemo(() => {
    return ALL_NAV_ITEM_KEYS.map(item => ({
      label: t(item.key),
      href: item.href,
      match: item.match,
      requireDefaultAdmin: item.requireDefaultAdmin ?? false,
      permission: item.permission,
      group: item.group,
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
    let filteredItems: NavItem[];
    if (isDefaultAdmin === null) {
      // 权限检查中，暂时不显示需要默认管理员权限的项
      filteredItems = ALL_NAV_ITEMS.filter((item) => !item.requireDefaultAdmin);
    } else if (isDefaultAdmin) {
      // 超级管理员，显示所有项
      filteredItems = ALL_NAV_ITEMS;
    } else {
      // 普通管理员，根据权限过滤
      filteredItems = ALL_NAV_ITEMS.filter((item) => {
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
    return filteredItems;
  }, [isDefaultAdmin, ALL_NAV_ITEMS, adminPermissions]);

  // 将导航项按分组组织
  const NAV_GROUPS = useMemo(() => {
    const groups: NavGroup[] = [];
    const standaloneItems: NavItem[] = [];
    
    // 定义分组顺序和标签
    const groupOrder = [
      { key: "users", labelKey: "nav.group.users" },
      { key: "questions", labelKey: "nav.group.questions" },
      { key: "merchant", labelKey: "nav.group.merchant" },
      { key: "ai", labelKey: "nav.group.ai" },
      { key: "system", labelKey: "nav.group.system" },
    ];
    
    // 按分组组织
    groupOrder.forEach(({ key, labelKey }) => {
      const items = NAV_ITEMS.filter(item => item.group === key);
      if (items.length > 0) {
        groups.push({
          key,
          label: t(labelKey),
          items,
        });
      }
    });
    
    // 收集独立菜单项（没有分组的）
    standaloneItems.push(...NAV_ITEMS.filter(item => !item.group));
    
    return { groups, standaloneItems };
  }, [NAV_ITEMS, t, language]);

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
          {/* 移动端汉堡菜单按钮 */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <span className="text-base font-semibold tracking-tight">{t('header.title')}</span>
          <span className="text-[9px] text-gray-400 hidden sm:inline font-mono">
            {getFormattedVersion()}
          </span>
        </div>
        <div className="flex items-center gap-2">
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
          <nav className="p-3 space-y-4">
            {/* 分组菜单 */}
            {NAV_GROUPS.groups.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              return (
                <div key={group.key} className="space-y-1">
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedGroups);
                      if (isExpanded) {
                        newExpanded.delete(group.key);
                      } else {
                        newExpanded.add(group.key);
                      }
                      setExpandedGroups(newExpanded);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                  >
                    <span>{group.label}</span>
                    <span className="text-xs">{isExpanded ? "−" : "+"}</span>
                  </button>
                  {isExpanded && group.items.map((item) => {
                    const active = item.href === activeHref;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          "block rounded-xl px-3 py-2.5 text-sm transition-colors ml-2",
                          active
                            ? "bg-blue-500 text-white shadow-sm"
                            : "text-gray-700 hover:bg-gray-100/50",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
            {/* 独立菜单项 */}
            {NAV_GROUPS.standaloneItems.length > 0 && (
              <div className="space-y-1">
                {NAV_GROUPS.standaloneItems.map((item) => {
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
              </div>
            )}
          </nav>
        </aside>

        {/* 移动端侧边栏菜单（汉堡菜单） */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="fixed left-0 top-14 bottom-0 w-64 bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <nav className="p-3 space-y-4">
                {/* 分组菜单 */}
                {NAV_GROUPS.groups.map((group) => {
                  const isExpanded = expandedGroups.has(group.key);
                  return (
                    <div key={group.key} className="space-y-1">
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedGroups);
                          if (isExpanded) {
                            newExpanded.delete(group.key);
                          } else {
                            newExpanded.add(group.key);
                          }
                          setExpandedGroups(newExpanded);
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                      >
                        <span>{group.label}</span>
                        <span className="text-xs">{isExpanded ? "−" : "+"}</span>
                      </button>
                      {isExpanded && group.items.map((item) => {
                        const active = item.href === activeHref;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={[
                              "block rounded-xl px-3 py-2.5 text-sm transition-colors ml-2",
                              active
                                ? "bg-blue-500 text-white shadow-sm"
                                : "text-gray-700 hover:bg-gray-100/50",
                            ].join(" ")}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
                {/* 独立菜单项 */}
                {NAV_GROUPS.standaloneItems.length > 0 && (
                  <div className="space-y-1">
                    {NAV_GROUPS.standaloneItems.map((item) => {
                      const active = item.href === activeHref;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
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
                  </div>
                )}
              </nav>
            </div>
          </div>
        )}

        {/* 主体内容 */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] max-w-full overflow-x-hidden">

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
