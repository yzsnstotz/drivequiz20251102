'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, getTranslation } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  languageReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'user-language';

// ✅ 修复：同步获取客户端语言，避免闪现zh
function getClientLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'zh'; // SSR 环境返回默认值
  }

  // 1）优先读取本地存储的用户选择
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
  if (saved && ['zh', 'en', 'ja'].includes(saved)) {
    return saved;
  }

  // 2）没有保存则根据浏览器语言猜测
  const browserLang = navigator.language || navigator.languages?.[0] || 'zh';
  if (browserLang.startsWith('ja')) {
    return 'ja';
  }
  if (browserLang.startsWith('en')) {
    return 'en';
  }

  // 3）兜底：中文
  return 'zh';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // ✅ 修复：SSR和客户端hydration时都使用'zh'作为初始值，避免hydration错误
  // 然后在客户端挂载后立即更新为用户选择的语言
  const [language, setLanguageState] = useState<Language>('zh');
  const [mounted, setMounted] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);

  // 客户端挂载后立即更新为用户选择的语言
  useEffect(() => {
    setMounted(true);
    // 立即从localStorage读取用户选择的语言
    const clientLanguage = getClientLanguage();
    setLanguageState(clientLanguage);
    setLanguageReady(true);
  }, []);

  // ✅ 修复：确保语言切换时同步写入 localStorage
  const updateLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  }, []);

  // 使用 useMemo 确保 t 函数在语言变化时更新
  const t = React.useMemo(() => {
    return (key: string): string => {
      return getTranslation(key, language);
    };
  }, [language]);

  // ✅ 日志：开发环境记录语言初始化
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[lang-trace] LanguageProvider mounted', {
        initialLanguage: language,
        languageReady,
      });
    }
  }, [language, languageReady]);

  const value: LanguageContextType = {
    language,
    setLanguage: updateLanguage,
    t,
    languageReady,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

