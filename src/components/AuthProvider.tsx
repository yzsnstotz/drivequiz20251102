"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider
      refetchInterval={5 * 60} // 5 分钟刷新一次（减少频繁刷新）
      refetchOnWindowFocus={false} // 窗口聚焦时不刷新（避免不必要的请求）
      refetchOnMount={false} // 组件挂载时不刷新（避免重复请求）
    >
      {children}
    </SessionProvider>
  );
}

