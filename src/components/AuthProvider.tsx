"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { AppSessionProvider } from "@/contexts/SessionContext";

interface AuthProviderProps {
  children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider
      // 关闭定时轮询与窗口聚焦刷新，避免重复调用 /api/auth/session
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      <AppSessionProvider>{children}</AppSessionProvider>
    </SessionProvider>
  );
}

