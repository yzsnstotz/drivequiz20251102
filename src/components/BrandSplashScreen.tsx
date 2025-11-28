"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n";

interface BrandSplashScreenProps {
  onClose: () => void;
}

export default function BrandSplashScreen({ onClose }: BrandSplashScreenProps) {
  const { language, t } = useLanguage();
  const [mounted, setMounted] = useState(false);

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
    return t('home.subtitle');
  };

  if (!mounted) {
    return null;
  }

  // 获取品牌名称（根据语言）
  const getBrandName = () => {
    switch (language) {
      case 'ja':
        return 'ザレム.アプリ';
      default:
        return 'ZALEM.APP';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-black flex items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center justify-center space-y-6 px-6 animate-scale-in">
        {/* Logo */}
        <div className="relative w-32 h-32 md:w-40 md:h-40">
          <Image
            src="/logo.png"
            alt="ZALEM Logo"
            fill
            sizes="(max-width: 768px) 128px, 160px"
            className="object-contain"
            priority
          />
        </div>

        {/* 品牌名称 */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight text-center">
          {getBrandName()}
        </h1>

        {/* 文案 */}
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 text-center max-w-md">
          {getSplashText()}
        </p>
      </div>
    </div>
  );
}

