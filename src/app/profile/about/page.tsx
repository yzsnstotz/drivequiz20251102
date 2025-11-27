'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Info } from 'lucide-react';
import { getLocalPackageVersion } from '@/lib/questionsLoader';
import { getFormattedVersion } from '@/lib/version';
import { useLanguage } from '@/lib/i18n';

export default function AboutPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [pkgVersion, setPkgVersion] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    // 读取题库版本号
    try {
      const v = getLocalPackageVersion();
      setPkgVersion(v);
    } catch {
      setPkgVersion(null);
    }

    // 读取软件版本号
    try {
      const v = getFormattedVersion();
      setAppVersion(v);
    } catch {
      setAppVersion('');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* 自定义顶部栏 */}
      <header className="sticky top-0 z-50 bg-white dark:bg-ios-dark-bg-secondary border-b border-gray-200 dark:border-ios-dark-border shadow-sm dark:shadow-ios-dark-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16">
            {/* 返回按钮 */}
            <button
              onClick={() => router.push('/settings')}
              className="mr-4 p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="返回设置"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            {/* 标题 */}
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('profile.about') || '关于'}
            </h1>
          </div>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6 pb-20">
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm">
          <div className="flex items-center space-x-3 mb-6">
            <Info className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-ios-dark-text">
              {t('profile.about') || '关于'}
            </h1>
          </div>

          <div className="space-y-6">
            {/* 题库版本号 */}
            <div className="border-b border-gray-200 dark:border-ios-dark-border pb-4">
              <h2 className="text-sm font-medium text-gray-500 dark:text-ios-dark-text-secondary mb-2">
                {t('profile.questionBankVersion') || '题库版本号'}
              </h2>
              <p className="text-lg font-semibold text-gray-900 dark:text-ios-dark-text">
                {pkgVersion || (t('profile.questionBankVersionUnknown') || '未知')}
              </p>
            </div>

            {/* 软件版本号 */}
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-ios-dark-text-secondary mb-2">
                {t('profile.appVersion') || '软件版本号'}
              </h2>
              <p className="text-lg font-semibold text-gray-900 dark:text-ios-dark-text">
                {appVersion || (t('profile.appVersionUnknown') || '未知')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

