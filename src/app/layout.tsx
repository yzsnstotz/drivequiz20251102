import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNavigation from "./BottomNavigation";

// 获取 basePath，确保 favicon 路径正确
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: "ZALEM - 驾照考试学习平台",
  description: "一个帮助您准备驾照考试的学习平台",
  icons: {
    icon: [
      { url: `${basePath}/favicon.png`, sizes: 'any' },
      { url: `${basePath}/icon.png`, sizes: 'any' },
    ],
    shortcut: `${basePath}/favicon.png`,
    apple: `${basePath}/favicon.png`,
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
              <AIActivationProvider>
                <AuthGuard>
                  {children}
                  <BottomNavigation />
                </AuthGuard>
              </AIActivationProvider>
            </AuthProvider>
          </LanguageProvider>
        </DarkModeProvider>
      </body>
    </html>
  );
}
