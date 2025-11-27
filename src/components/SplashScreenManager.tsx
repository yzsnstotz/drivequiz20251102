"use client";

import { useEffect, useState } from "react";
import BrandSplashScreen from "./BrandSplashScreen";

const SPLASH_STORAGE_KEY = "zalem_splash_last_shown";
const SPLASH_INTERVAL = 30 * 60 * 1000; // 30分钟（毫秒）

export default function SplashScreenManager() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // 检查是否应该显示启动画面
    const shouldShowSplash = () => {
      if (typeof window === "undefined") return false;

      const lastShown = localStorage.getItem(SPLASH_STORAGE_KEY);
      
      if (!lastShown) {
        // 首次访问，显示启动画面
        return true;
      }

      const lastShownTime = parseInt(lastShown, 10);
      const now = Date.now();
      const timeSinceLastShown = now - lastShownTime;

      // 如果距离上次显示超过30分钟，再次显示
      if (timeSinceLastShown > SPLASH_INTERVAL) {
        return true;
      }

      return false;
    };

    // 延迟显示，确保页面加载完成
    const timer = setTimeout(() => {
      if (shouldShowSplash()) {
        setShowSplash(true);
        // 记录显示时间
        localStorage.setItem(SPLASH_STORAGE_KEY, Date.now().toString());
      }
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

