"use client";

import { createContext, useContext, useMemo, ReactNode, Component, ErrorInfo, ReactElement } from "react";
import { useSession, SessionContextValue } from "next-auth/react";

type AppSessionContextValue = SessionContextValue;

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

/**
 * Session Error Boundary
 * 捕获 Session 相关的错误，防止整个应用崩溃
 */
class SessionErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactElement },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactElement }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误日志
    console.error("[SessionContext] Error caught by boundary:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      // 如果有自定义 fallback，使用它；否则返回 null（不渲染任何内容）
      if (this.props.fallback) {
        return this.props.fallback;
      }
      // 默认：返回 null，让应用继续运行（session 错误不应该阻止应用）
      return null;
    }

    return this.props.children;
  }
}

/**
 * App Session Provider
 * 全局只允许这里调用 useSession()，其他地方通过 useAppSession() 复用结果
 * ✅ 新增：添加错误边界，防止 Session 错误导致整个应用崩溃
 */
export function AppSessionProvider({ children }: { children: ReactNode }) {
  const sessionValue = useSession(); // ✅ 只有这里调用 useSession

  const value = useMemo(() => sessionValue, [sessionValue.data, sessionValue.status]);

  return (
    <SessionErrorBoundary>
      <AppSessionContext.Provider value={value}>
        {children}
      </AppSessionContext.Provider>
    </SessionErrorBoundary>
  );
}

/**
 * 使用 App Session 的 Hook
 * 替代直接使用 useSession()，确保所有组件共享同一个 session 实例
 */
export function useAppSession() {
  const ctx = useContext(AppSessionContext);
  if (!ctx) {
    throw new Error("useAppSession must be used within <AppSessionProvider>");
  }
  return ctx;
}

