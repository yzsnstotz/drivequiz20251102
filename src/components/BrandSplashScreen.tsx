"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n";

interface BrandSplashScreenProps {
  onClose: () => void;
}

export default function BrandSplashScreen({ onClose }: BrandSplashScreenProps) {
  const { language } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 3秒后自动关闭（延长1秒）
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  // 获取文案（根据语言）
  const getSplashText = () => {
    switch (language) {
      case 'zh':
        return '开启你的学车之旅';
      case 'en':
        return 'Start your driving journey';
      case 'ja':
        return 'あなたの運転学習の旅を始めましょう';
      default:
        return '开启你的学车之旅';
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-black flex items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center justify-center space-y-6 px-6 animate-scale-in">
        {/* Logo */}
        <div className="relative w-32 h-32 md:w-40 md:h-40">
          {!logoError ? (
            <Image
              src="/logo.png"
              alt="ZALEM Logo"
              fill
              sizes="(max-width: 768px) 128px, 160px"
              className="object-contain"
              priority
              onError={() => {
                setLogoError(true);
              }}
            />
          ) : (
            // Logo加载失败时的占位符 - 使用SVG绘制简单的logo样式
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-blue-600 dark:bg-blue-500 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-16 h-16 md:w-20 md:h-20 text-white"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* 方向盘轮廓 */}
                  <circle
                    cx="50"
                    cy="50"
                    r="35"
                    stroke="white"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray="180 180"
                    strokeDashoffset="90"
                  />
                  {/* 方向盘辐条 */}
                  <line
                    x1="50"
                    y1="15"
                    x2="50"
                    y2="45"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  {/* 对勾 */}
                  <path
                    d="M 35 50 L 50 65 L 75 40"
                    stroke="white"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* 品牌名称 */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
          ZALEM
        </h1>

        {/* 文案 */}
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 text-center max-w-md">
          {getSplashText()}
        </p>
      </div>
    </div>
  );
}

