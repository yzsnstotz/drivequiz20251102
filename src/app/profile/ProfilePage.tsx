'use client';

import React, { useState, useEffect } from 'react';
import { User, XSquare, Settings, Edit2, Trophy, BookOpen, Star, Info, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import ActivationStatusCard from '@/components/ActivationStatusCard';
import { clearAllCache } from '@/lib/clearCache';

function ProfilePage() {
  const { t } = useLanguage();
  const [nickname, setNickname] = useState('User');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    // 从 localStorage 加载用户昵称
    const savedNickname = localStorage.getItem('user_nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  const handleEditClick = () => {
    setEditValue(nickname);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editValue.trim()) {
      setNickname(editValue.trim());
      localStorage.setItem('user_nickname', editValue.trim());
    }
    setIsEditing(false);
  };

  const handleClearActivation = () => {
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
  };

  const handleClearCache = () => {
    if (confirm(t('profile.clearCacheConfirm'))) {
      try {
        clearAllCache();
        alert(t('profile.clearCacheSuccess'));
        window.location.reload();
      } catch (error) {
        console.error('[ProfilePage] 清除缓存失败:', error);
        alert('清除缓存失败，请查看控制台');
      }
    }
  };

  const menuItems = [
    {
      id: 'mistakes',
      icon: <XSquare className="h-6 w-6 text-red-60" />,
      title: t('profile.mistakes'),
      description: t('profile.mistakesDesc'),
      href: '/mistakes'
    },
    {
      id: 'favorites',
      icon: <Star className="h-6 w-6 text-yellow-600 fill-current" />,
      title: t('profile.favorites'),
      description: t('profile.favoritesDesc'),
      href: '/favorites'
    },
    {
      id: 'exam-history',
      icon: <Trophy className="h-6 w-6 text-yellow-600" />,
      title: t('profile.examHistory'),
      description: t('profile.examHistoryDesc'),
      href: '/profile/exam-history'
    },
    {
      id: 'practice-history',
      icon: <BookOpen className="h-6 w-6 text-blue-600" />,
      title: t('profile.practiceHistory'),
      description: t('profile.practiceHistoryDesc'),
      href: '/profile/practice-history'
    },
    {
      id: 'clear-activation',
      icon: <XSquare className="h-6 w-6 text-red-600" />,
      title: t('profile.clearActivation'),
      description: t('profile.clearActivationDesc'),
      onClick: handleClearActivation,
      isDanger: true
    },
    {
      id: 'clear-cache',
      icon: <Trash2 className="h-6 w-6 text-orange-600" />,
      title: t('profile.clearCache'),
      description: t('profile.clearCacheDesc'),
      onClick: handleClearCache,
      isDanger: true
    },
    {
      id: 'settings',
      icon: <Settings className="h-6 w-6 text-gray-600" />,
      title: t('profile.settings'),
      description: t('profile.settingsDesc'),
      href: '/settings'
    },
    {
      id: 'about',
      icon: <Info className="h-6 w-6 text-blue-600" />,
      title: t('profile.about'),
      description: t('profile.aboutDesc') || '查看版本信息',
      href: '/profile/about'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      {/* 用户信息区域 */}
      <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm mb-6">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <User className="h-12 w-12 text-gray-40" />
          </div>
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onBlur={handleSave}
                onKeyPress={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
          ) : (
            <div 
              onClick={handleEditClick}
              className="flex items-center space-x-2 cursor-pointer group"
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {nickname}
              </h2>
              <Edit2 className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </div>
          )}
        </div>
      </div>

      {/* 激活码状态 */}
      <div className="mb-6">
        <ActivationStatusCard />
      </div>

      {/* 功能菜单区域 */}
      <div className="space-y-4 mb-6">
        {menuItems.map((item) => {
          // 如果有 href，使用 Link 组件
          if (item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="block"
              >
                <div className={`bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-4 shadow-ios-sm dark:shadow-ios-dark-sm flex items-center space-x-4 cursor-pointer ios-button active:shadow-ios dark:active:shadow-ios-dark active:scale-[0.98] ${
                  item.isDanger ? 'active:bg-red-50 dark:active:bg-red-900/20' : 'active:bg-gray-50 dark:active:bg-ios-dark-bg-tertiary'
                }`}>
                  <div className="flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-grow">
                    <h3 className={`font-medium ${
                      item.isDanger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-ios-dark-text'
                    }`}>{item.title}</h3>
                    <p className="text-gray-500 dark:text-ios-dark-text-secondary text-sm">{item.description}</p>
                  </div>
                </div>
              </Link>
            );
          }
          
          // 如果没有 href，使用 div 并执行 onClick
          return (
            <div
              key={item.id}
              onClick={() => {
                if (item.onClick) {
                  item.onClick();
                }
              }}
              className="block"
            >
              <div className={`bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-4 shadow-ios-sm dark:shadow-ios-dark-sm flex items-center space-x-4 cursor-pointer ios-button active:shadow-ios dark:active:shadow-ios-dark active:scale-[0.98] ${
                item.isDanger ? 'active:bg-red-50 dark:active:bg-red-900/20' : 'active:bg-gray-50 dark:active:bg-ios-dark-bg-tertiary'
              }`}>
                <div className="flex-shrink-0">
                  {item.icon}
                </div>
                <div className="flex-grow">
                  <h3 className={`font-medium ${
                    item.isDanger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                  }`}>{item.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{item.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

export default ProfilePage;
