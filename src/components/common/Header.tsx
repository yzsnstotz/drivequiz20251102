"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import AIButton from "./AIButton";
import { getFormattedVersion } from "@/lib/version";

interface HeaderProps {
  title?: string;
  showAIButton?: boolean;
  aiContext?: "license" | "vehicle" | "service" | "general";
}

/**
 * 顶部导航栏组件
 */
export default function Header({ title, showAIButton = true, aiContext = "general" }: HeaderProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-ios-dark-bg-secondary border-b border-gray-200 dark:border-ios-dark-border shadow-sm dark:shadow-ios-dark-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xl font-bold text-blue-600 dark:text-blue-500">
              {title || "ZALEM"}
            </Link>
            <span className="text-[9px] text-gray-400 font-mono hidden sm:inline">
              {getFormattedVersion()}
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/license"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                pathname?.startsWith("/license")
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:text-blue-600"
              }`}
            >
              驾照
            </Link>
            <Link
              href="/vehicles"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                pathname?.startsWith("/vehicles")
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:text-blue-600"
              }`}
            >
              车辆
            </Link>
            <Link
              href="/services"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                pathname?.startsWith("/services")
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:text-blue-600"
              }`}
            >
              服务
            </Link>
            <Link
              href="/profile"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                pathname?.startsWith("/profile")
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:text-blue-600"
              }`}
            >
              我的
            </Link>
          </nav>

          {/* AI Button & Mobile Menu */}
          <div className="flex items-center space-x-4">
            {showAIButton && <AIButton context={aiContext} />}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-blue-600"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-2">
              <Link
                href="/license"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname?.startsWith("/license")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                驾照
              </Link>
              <Link
                href="/vehicles"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname?.startsWith("/vehicles")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                车辆
              </Link>
              <Link
                href="/services"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname?.startsWith("/services")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                服务
              </Link>
              <Link
                href="/profile"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname?.startsWith("/profile")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                我的
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

