import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNavigation from "./BottomNavigation";

export const metadata: Metadata = {
  title: "ZALEM - 驾照考试学习平台",
  description: "一个帮助您准备驾照考试的学习平台",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import ActivationProvider from "../components/ActivationProvider";
import AuthProvider from "../components/AuthProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="pb-20">
        <LanguageProvider>
          <AuthProvider>
            <ActivationProvider>
              {children}
              <BottomNavigation />
            </ActivationProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
