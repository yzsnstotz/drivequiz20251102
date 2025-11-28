"use client";

import { useEffect, useState } from "react";
import BrandSplashScreen from "./BrandSplashScreen";

export default function SplashScreenManager() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // 每次访问都显示启动画面
    // 延迟显示，确保页面加载完成
    const timer = setTimeout(() => {
      setShowSplash(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setShowSplash(false);
  };

  if (!showSplash) {
    return null;
  }

  return <BrandSplashScreen onClose={handleClose} />;
}

