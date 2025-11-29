'use client';

import React, { useState, useEffect } from 'react';
import { User, XSquare, Settings, Edit2, Trophy, BookOpen, Star, Info, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import { useSession } from 'next-auth/react';
import ActivationStatusCard from '@/components/ActivationStatusCard';

type MenuItem = {
  id: string;
  icon: React.ReactElement;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  isDanger?: boolean;
};

function ProfilePage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const [nickname, setNickname] = useState('User');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [accountInfoExpanded, setAccountInfoExpanded] = useState(true);
  const [studyExpanded, setStudyExpanded] = useState(true);

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


  // 学习分组菜单项
  const studyItems: MenuItem[] = [
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
      id: 'mistakes',
      icon: <XSquare className="h-6 w-6 text-red-600" />,
      title: t('profile.mistakes'),
      description: t('profile.mistakesDesc'),
      href: '/mistakes'
    },
  ];

  // 其他菜单项
  const otherMenuItems: MenuItem[] = [
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

  // 获取登录邮箱（优先使用session，其次使用localStorage）
  const getLoginEmail = () => {
    if (session?.user?.email) {
      return session.user.email;
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem('drive-quiz-email');
    }
    return null;
  };

  const loginEmail = getLoginEmail();

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

      {/* 账号信息分组（可折叠） */}
      <div className="mb-6">
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl shadow-ios-sm dark:shadow-ios-dark-sm overflow-hidden">
          <button
            onClick={() => setAccountInfoExpanded(!accountInfoExpanded)}
            className="w-full p-4 flex items-center justify-between ios-button active:bg-gray-50 dark:active:bg-ios-dark-bg-tertiary"
          >
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <div className="text-left">
                <h3 className="font-medium text-gray-900 dark:text-white">{t('profile.accountInfo')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.accountInfoDesc')}</p>
              </div>
            </div>
            {accountInfoExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            )}
          </button>
          
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
            accountInfoExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <div className="px-4 pb-4 space-y-4 border-t dark:border-ios-dark-border">
              {/* 登录信息 */}
              <div className="pt-4">
                <div className="flex items-center space-x-3 mb-2">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('profile.loginInfo')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {loginEmail || t('profile.notLoggedIn')}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 激活码状态 */}
              <div>
                <ActivationStatusCard />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 学习分组（可折叠） */}
      <div className="mb-6">
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl shadow-ios-sm dark:shadow-ios-dark-sm overflow-hidden">
          <button
            onClick={() => setStudyExpanded(!studyExpanded)}
            className="w-full p-4 flex items-center justify-between ios-button active:bg-gray-50 dark:active:bg-ios-dark-bg-tertiary"
          >
            <div className="flex items-center space-x-3">
              <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <div className="text-left">
                <h3 className="font-medium text-gray-900 dark:text-white">{t('profile.study')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.studyDesc')}</p>
              </div>
            </div>
            {studyExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            )}
          </button>
          
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
            studyExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <div className="px-4 pb-4 space-y-2 border-t dark:border-ios-dark-border">
              {studyItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href!}
                  className="block"
                >
                  <div className={`p-3 rounded-lg flex items-center space-x-3 cursor-pointer ios-button active:shadow-ios dark:active:shadow-ios-dark active:scale-[0.98] ${
                    item.isDanger ? 'active:bg-red-50 dark:active:bg-red-900/20' : 'active:bg-gray-50 dark:active:bg-ios-dark-bg-tertiary'
                  }`}>
                    <div className="flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-grow">
                      <h3 className={`text-sm font-medium ${
                        item.isDanger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-ios-dark-text'
                      }`}>{item.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-ios-dark-text-secondary">{item.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 其他功能菜单区域 */}
      <div className="space-y-4 mb-6">
        {otherMenuItems.map((item) => {
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
