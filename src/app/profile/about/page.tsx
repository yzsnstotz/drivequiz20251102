'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Info, XSquare, Trash2, AlertTriangle } from 'lucide-react';
import { getLocalPackageVersion } from '@/lib/questionsLoader';
import { getFormattedVersion } from '@/lib/version';
import { useLanguage } from '@/lib/i18n';
import { clearAllCache } from '@/lib/clearCache';

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
              onClick={() => router.back()}
              className="mr-4 p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="返回"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            {/* 标题 */}
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white" suppressHydrationWarning>
              {t('profile.about') || '关于'}
            </h1>
          </div>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6 pb-20">
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm">
          <div className="flex items-center space-x-3 mb-6">
            <Info className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-ios-dark-text" suppressHydrationWarning>
              {t('profile.about') || '关于'}
            </h1>
          </div>

          <div className="space-y-6">
            {/* 题库版本号 */}
            <div className="border-b border-gray-200 dark:border-ios-dark-border pb-4">
              <h2 className="text-sm font-medium text-gray-500 dark:text-ios-dark-text-secondary mb-2" suppressHydrationWarning>
                {t('profile.questionBankVersion') || '题库版本号'}
              </h2>
              <p className="text-lg font-semibold text-gray-900 dark:text-ios-dark-text" suppressHydrationWarning>
                {pkgVersion || (t('profile.questionBankVersionUnknown') || '未知')}
              </p>
            </div>

            {/* 软件版本号 */}
            <div className="border-b border-gray-200 dark:border-ios-dark-border pb-4">
              <h2 className="text-sm font-medium text-gray-500 dark:text-ios-dark-text-secondary mb-2" suppressHydrationWarning>
                {t('profile.appVersion') || '软件版本号'}
              </h2>
              <p className="text-lg font-semibold text-gray-900 dark:text-ios-dark-text" suppressHydrationWarning>
                {appVersion || (t('profile.appVersionUnknown') || '未知')}
              </p>
            </div>

            {/* 测试用功能（慎用） */}
            <div className="pt-4">
              <div className="flex items-center space-x-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                <h2 className="text-sm font-medium text-orange-600 dark:text-orange-500" suppressHydrationWarning>
                  {t('profile.testingFeatures') || '测试用功能（慎用）'}
                </h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-ios-dark-text-secondary mb-4" suppressHydrationWarning>
                {t('profile.testingFeaturesDesc') || '以下功能仅用于测试，使用后可能导致数据丢失，请谨慎操作！'}
              </p>
              
              <div className="space-y-3">
                {/* 清除激活 */}
                <button
                  onClick={() => {
                    if (confirm(t('profile.clearActivationConfirm'))) {
                      if (typeof window !== 'undefined') {
                        // 清除旧的激活状态
                        localStorage.removeItem('drive-quiz-activated');
                        localStorage.removeItem('drive-quiz-email');
                        // 清除新的激活相关存储
                        localStorage.removeItem('USER_TOKEN');
                        // 清除cookie中的USER_TOKEN
                        document.cookie = 'USER_TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                        // 清除其他可能的激活相关存储
                        localStorage.removeItem('activation-status');
                        // 注意：不清除登录记忆，允许快速重新登录
                        alert(t('profile.clearActivationSuccess'));
                        window.location.reload();
                      }
                    }
                  }}
                  className="w-full bg-white dark:bg-ios-dark-bg-tertiary border border-red-300 dark:border-red-800 rounded-xl p-4 flex items-center space-x-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <XSquare className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div className="flex-grow text-left">
                    <h3 className="font-medium text-red-600 dark:text-red-400" suppressHydrationWarning>
                      {t('profile.clearActivation') || '清除激活'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-ios-dark-text-secondary mt-1" suppressHydrationWarning>
                      {t('profile.clearActivationDesc') || '清除当前激活状态，需要重新激活'}
                    </p>
                  </div>
                </button>

                {/* 清除缓存 */}
                <button
                  onClick={() => {
                    if (confirm(t('profile.clearCacheConfirm'))) {
                      try {
                        clearAllCache();
                        alert(t('profile.clearCacheSuccess'));
                        window.location.reload();
                      } catch (error) {
                        console.error('[AboutPage] 清除缓存失败:', error);
                        alert('清除缓存失败，请查看控制台');
                      }
                    }
                  }}
                  className="w-full bg-white dark:bg-ios-dark-bg-tertiary border border-orange-300 dark:border-orange-800 rounded-xl p-4 flex items-center space-x-3 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                >
                  <Trash2 className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <div className="flex-grow text-left">
                    <h3 className="font-medium text-orange-600 dark:text-orange-400" suppressHydrationWarning>
                      {t('profile.clearCache') || '清除缓存'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-ios-dark-text-secondary mt-1" suppressHydrationWarning>
                      {t('profile.clearCacheDesc') || '清除所有缓存和本地数据（用于测试）'}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

