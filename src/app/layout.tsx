import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import BottomNavigation from "./BottomNavigation";

export const metadata: Metadata = {
  title: "ZALEM - 驾照考试学习平台",
  description: "一个帮助您准备驾照考试的学习平台",
};

import ActivationProvider from "../components/ActivationProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="pb-20">
        <ActivationProvider>
          {children}
          <BottomNavigation />
        </ActivationProvider>
      </body>
    </html>
  );
}
