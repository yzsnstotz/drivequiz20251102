"use client";

import { ReactNode } from "react";
import { AppSessionProvider } from "@/contexts/SessionContext";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider
 * ✅ 修复：彻底移除 NextAuth 的 SessionProvider，只使用我们自己的 AppSessionProvider
 * ✅ 修复：避免 NextAuth 的 SessionProvider 导致多次请求 /api/auth/session
 */
export default function AuthProvider({ children }: AuthProviderProps) {
  return <AppSessionProvider>{children}</AppSessionProvider>;
}

