import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNavigation from "./BottomNavigation";

export const metadata: Metadata = {
  title: "自動車学校の学生限定 · AI学習アシスタント無料開放",
  description: "日本の自動車学校に通う学生向けに、AI学習アシスタントを無料で提供しています。",
  openGraph: {
    title: "自動車学校の学生限定 · AI学習アシスタント無料開放",
    description: "日本の自動車学校に通う学生向けに、AI学習アシスタントを無料で提供しています。",
    locale: "ja_JP"
  },
  // Next.js 13+ App Router 会自动识别 src/app/icon.png 并生成 favicon
  // 这里添加备用配置以确保兼容性
  icons: {
    icon: [
      { url: '/favicon.png', sizes: 'any' },
      { url: '/icon.png', sizes: 'any' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import AuthProvider from "../components/AuthProvider";
import AuthGuard from "../components/AuthGuard";
import AIActivationProvider from "../components/AIActivationProvider";
import DarkModeProvider from "../components/DarkModeProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import SplashScreenManager from "../components/SplashScreenManager";
import { ActivationProvider } from "@/contexts/ActivationContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="pb-20 bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100">
        <DarkModeProvider>
          <LanguageProvider>
            <SplashScreenManager />
            <AuthProvider>
              <ActivationProvider>
                <AIActivationProvider>
                  <AuthGuard>
                    {children}
                    <BottomNavigation />
                  </AuthGuard>
                </AIActivationProvider>
              </ActivationProvider>
            </AuthProvider>
          </LanguageProvider>
        </DarkModeProvider>
      </body>
    </html>
  );
}
