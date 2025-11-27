"use client";

import { useEffect } from "react";

export default function DarkModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // 初始化暗色模式
    const darkMode = localStorage.getItem("darkMode") === "true";
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // 监听localStorage变化（跨标签页同步）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "darkMode") {
        const newDarkMode = e.newValue === "true";
        if (newDarkMode) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // 监听自定义事件（同标签页内切换）
    // 注意：事件触发时，DOM和localStorage已经更新，这里只需要同步状态
    const handleDarkModeToggle = () => {
      // 事件触发时，toggleDarkMode已经更新了DOM和localStorage
      // 这里不需要再次切换，只需要确保状态同步
      const currentDarkMode = document.documentElement.classList.contains("dark");
      const storedDarkMode = localStorage.getItem("darkMode") === "true";
      
      // 如果状态不一致，同步到localStorage（虽然不应该发生）
      if (currentDarkMode !== storedDarkMode) {
        localStorage.setItem("darkMode", currentDarkMode.toString());
      }
    };

    window.addEventListener("darkModeToggle", handleDarkModeToggle);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("darkModeToggle", handleDarkModeToggle);
    };
  }, []);

  return <>{children}</>;
}

