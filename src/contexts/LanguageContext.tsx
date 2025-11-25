'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, getTranslation } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'user-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  // 初始状态总是使用默认值，避免 SSR/CSR 不匹配
  const [language, setLanguageState] = useState<Language>('zh');
  const [mounted, setMounted] = useState(false);

  // 客户端挂载后从 localStorage 读取语言设置
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
      if (saved && ['zh', 'en', 'ja'].includes(saved)) {
        setLanguageState(saved);
      } else {
        // 如果没有保存的语言，尝试从浏览器语言检测
        const browserLang = navigator.language || navigator.languages?.[0] || 'zh';
        if (browserLang.startsWith('ja')) {
          setLanguageState('ja');
        } else if (browserLang.startsWith('en')) {
          setLanguageState('en');
        } else {
          setLanguageState('zh');
        }
      }
    }
  }, []);

  const setLanguage = React.useCallback((lang: Language) => {
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

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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

