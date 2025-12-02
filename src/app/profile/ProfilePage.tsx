'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { User, XSquare, Settings, Edit2, Trophy, BookOpen, Star, Info, ChevronDown, ChevronUp, Mail, Globe, Shield, Bell, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import { useAppSession } from '@/contexts/SessionContext';
import { apiFetch } from '@/lib/apiClient.front';
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

interface ProfileData {
  language: string;
  goals?: string[];
  level?: string;
  metadata?: {
    privacy?: {
      shareData?: boolean;
      analytics?: boolean;
    };
    notifications?: {
      email?: boolean;
      push?: boolean;
    };
  };
}

function ProfilePage() {
  const { t, language, setLanguage: setLanguageContext } = useLanguage();
  const { data: session } = useAppSession();
  const [nickname, setNickname] = useState('User');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [accountInfoExpanded, setAccountInfoExpanded] = useState(false);
  const [studyExpanded, setStudyExpanded] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  
  // 设置相关state
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  
  // 表单状态
  const [formData, setFormData] = useState<ProfileData>({
    language: language,
    metadata: {
      privacy: {
        shareData: false,
        analytics: true,
      },
      notifications: {
        email: false,
        push: true,
      },
    },
  });

  useEffect(() => {
    // 从 localStorage 加载用户昵称
    const savedNickname = localStorage.getItem('user_nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
    
    // 初始化暗色模式状态
    const darkMode = localStorage.getItem('darkMode') === 'true' || 
                     document.documentElement.classList.contains('dark');
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
    
    // 获取登录邮箱（只在客户端执行，避免 SSR/CSR 不匹配）
    const getEmail = () => {
      if (session?.user?.email) {
        return session.user.email;
      }
      return localStorage.getItem('drive-quiz-email');
    };
    setLoginEmail(getEmail());
    
    // 加载设置
    loadProfile();
  }, [session]);
  
  // 加载设置
  const loadProfile = useCallback(async () => {
    try {
      setSettingsLoading(true);
      setSettingsError(null);
      
      const response = await apiFetch<ProfileData>("/api/profile");
      
      // 如果返回错误（如401），静默处理，使用默认值
      if (!response.ok) {
        console.warn("加载设置失败（可能未登录）:", response);
        setFormData({
          language: language,
          metadata: {
            privacy: {
              shareData: false,
              analytics: true,
            },
            notifications: {
              email: false,
              push: true,
            },
          },
        });
        return;
      }
      
      if (response.data) {
        setProfile(response.data);
        setFormData({
          language: response.data.language || language,
          goals: response.data.goals,
          level: response.data.level,
          metadata: {
            privacy: {
              shareData: response.data.metadata?.privacy?.shareData ?? false,
              analytics: response.data.metadata?.privacy?.analytics ?? true,
            },
            notifications: {
              email: response.data.metadata?.notifications?.email ?? false,
              push: response.data.metadata?.notifications?.push ?? true,
            },
          },
        });
      }
    } catch (err) {
      console.error("加载设置失败:", err);
      // 如果加载失败，使用默认值
      setFormData({
        language: language,
        metadata: {
          privacy: {
            shareData: false,
            analytics: true,
          },
          notifications: {
            email: false,
            push: true,
          },
        },
      });
    } finally {
      setSettingsLoading(false);
    }
  }, [language]);
  
  // 自动保存设置
  const autoSave = useCallback(async (dataToSave: ProfileData) => {
    try {
      setSettingsSaving(true);
      setSettingsError(null);

      // 获取当前的暗色模式状态（从 localStorage）
      const currentDarkMode = localStorage.getItem('darkMode') === 'true';

      // 更新语言设置和暗色模式设置
      const response = await apiFetch<ProfileData>("/api/profile", {
        method: "PUT",
        body: {
          language: dataToSave.language,
          metadata: {
            ...dataToSave.metadata,
            darkMode: currentDarkMode, // 保存暗色模式状态
          },
        },
      });

      if (response.ok) {
        // 更新本地语言上下文（但不触发重新加载）
        if (dataToSave.language !== language) {
          setLanguageContext(dataToSave.language as "ja" | "zh" | "en");
        }
        
        setProfile(response.data);
        setSettingsSuccess(t('settings.saved'));
        
        // 2秒后清除成功消息
        setTimeout(() => {
          setSettingsSuccess(null);
        }, 2000);
      } else {
        throw new Error("保存失败");
      }
    } catch (err) {
      console.error("保存设置失败:", err);
      setSettingsError(err instanceof Error ? err.message : "保存设置失败，请稍后重试");
      
      // 3秒后清除错误消息
      setTimeout(() => {
        setSettingsError(null);
      }, 3000);
    } finally {
      setSettingsSaving(false);
    }
  }, [language, setLanguageContext, t]);
  
  // 切换暗色模式
  const toggleDarkMode = async () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    // 更新DOM和localStorage
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    // 触发自定义事件，通知其他组件（DarkModeProvider会监听但不会重复切换）
    window.dispatchEvent(new Event('darkModeToggle'));
    
    // 自动保存暗色模式设置
    await autoSave(formData);
  };

  const handleLanguageChange = async (newLanguage: string) => {
    const newFormData = { ...formData, language: newLanguage };
    setFormData(newFormData);
    await autoSave(newFormData);
  };

  const handlePrivacyChange = async (key: string, value: boolean) => {
    const newFormData = {
      ...formData,
      metadata: {
        ...formData.metadata,
        privacy: {
          ...formData.metadata?.privacy,
          [key]: value,
        },
      },
    };
    setFormData(newFormData);
    await autoSave(newFormData);
  };

  const handleNotificationChange = async (key: string, value: boolean) => {
    const newFormData = {
      ...formData,
      metadata: {
        ...formData.metadata,
        notifications: {
          ...formData.metadata?.notifications,
          [key]: value,
        },
      },
    };
    setFormData(newFormData);
    await autoSave(newFormData);
  };

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

  // 其他菜单项（设置已移到分组中）
  const otherMenuItems: MenuItem[] = [
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

      {/* 设置分组（可折叠） */}
      <div className="mb-6">
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl shadow-ios-sm dark:shadow-ios-dark-sm overflow-hidden">
          <button
            onClick={() => setSettingsExpanded(!settingsExpanded)}
            className="w-full p-4 flex items-center justify-between ios-button active:bg-gray-50 dark:active:bg-ios-dark-bg-tertiary"
          >
            <div className="flex items-center space-x-3">
              <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <div className="text-left">
                <h3 className="font-medium text-gray-900 dark:text-white">{t('profile.settings')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.settingsDesc')}</p>
              </div>
            </div>
            {settingsExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            )}
          </button>
          
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
            settingsExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <div className="px-4 pb-4 space-y-4 border-t dark:border-ios-dark-border">
              {/* 成功/错误提示 */}
              {settingsSuccess && (
                <div className="pt-4 p-3 bg-green-50 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-lg text-sm text-green-800 dark:text-green-300">
                  {settingsSuccess}
                </div>
              )}
              
              {settingsError && (
                <div className="pt-4 p-3 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-800 dark:text-red-300">
                  {settingsError}
                </div>
              )}

              {/* 语言设置 */}
              <div className="pt-4">
                <div className="flex items-center space-x-3 mb-4">
                  <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-base font-semibold text-gray-900 dark:text-ios-dark-text">{t('settings.language')}</h4>
                </div>
                
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.language.select')}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "ja", label: t('settings.language.japanese'), flag: "🇯🇵" },
                      { value: "zh", label: t('settings.language.chinese'), flag: "🇨🇳" },
                      { value: "en", label: t('settings.language.english'), flag: "🇺🇸" },
                    ].map((lang) => (
                      <button
                        key={lang.value}
                        onClick={() => handleLanguageChange(lang.value)}
                        className={`p-3 rounded-xl border-2 ios-button transition-all duration-200 ${
                          formData.language === lang.value
                            ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400 shadow-ios-sm"
                            : "border-gray-200 dark:border-gray-700 active:border-gray-300 dark:active:border-gray-600 active:scale-[0.98]"
                        }`}
                      >
                        <div className="text-xl mb-1">{lang.flag}</div>
                        <div className="text-xs font-medium text-gray-900 dark:text-ios-dark-text">{lang.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 主题设置 */}
              <div className="pt-4 border-t dark:border-ios-dark-border">
                <div className="flex items-center space-x-3 mb-4">
                  {isDarkMode ? (
                    <Moon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Sun className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  )}
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white">{t('settings.theme')}</h4>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-900 dark:text-ios-dark-text">{t('settings.theme.darkMode')}</label>
                      <p className="text-xs text-gray-500 dark:text-ios-dark-text-secondary mt-1">{t('settings.theme.darkModeDesc')}</p>
                    </div>
                    <button
                      onClick={toggleDarkMode}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ios-switch transition-all duration-200 ${
                        isDarkMode ? "bg-blue-600 dark:bg-blue-500" : "bg-gray-300 dark:bg-ios-dark-bg-tertiary"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white ios-switch-thumb shadow-ios-sm ${
                          isDarkMode ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* 隐私偏好 */}
              <div className="pt-4 border-t dark:border-ios-dark-border">
                <div className="flex items-center space-x-3 mb-4">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white">{t('settings.privacy')}</h4>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-900 dark:text-ios-dark-text">{t('settings.privacy.shareData')}</label>
                      <p className="text-xs text-gray-500 dark:text-ios-dark-text-secondary mt-1">{t('settings.privacy.shareDataDesc')}</p>
                    </div>
                    <button
                      onClick={() => handlePrivacyChange("shareData", !formData.metadata?.privacy?.shareData)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ios-switch transition-all duration-200 ${
                        formData.metadata?.privacy?.shareData ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white ios-switch-thumb shadow-ios-sm ${
                          formData.metadata?.privacy?.shareData ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-900 dark:text-ios-dark-text">{t('settings.privacy.analytics')}</label>
                      <p className="text-xs text-gray-500 dark:text-ios-dark-text-secondary mt-1">{t('settings.privacy.analyticsDesc')}</p>
                    </div>
                    <button
                      onClick={() => handlePrivacyChange("analytics", !formData.metadata?.privacy?.analytics)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ios-switch transition-all duration-200 ${
                        formData.metadata?.privacy?.analytics ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.metadata?.privacy?.analytics ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* 通知偏好 */}
              <div className="pt-4 border-t dark:border-ios-dark-border">
                <div className="flex items-center space-x-3 mb-4">
                  <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white">{t('settings.notifications')}</h4>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-900 dark:text-ios-dark-text">{t('settings.notifications.email')}</label>
                      <p className="text-xs text-gray-500 dark:text-ios-dark-text-secondary mt-1">{t('settings.notifications.emailDesc')}</p>
                    </div>
                    <button
                      onClick={() => handleNotificationChange("email", !formData.metadata?.notifications?.email)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ios-switch transition-all duration-200 ${
                        formData.metadata?.notifications?.email ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.metadata?.notifications?.email ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-900 dark:text-ios-dark-text">{t('settings.notifications.push')}</label>
                      <p className="text-xs text-gray-500 dark:text-ios-dark-text-secondary mt-1">{t('settings.notifications.pushDesc')}</p>
                    </div>
                    <button
                      onClick={() => handleNotificationChange("push", !formData.metadata?.notifications?.push)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ios-switch transition-all duration-200 ${
                        formData.metadata?.notifications?.push ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.metadata?.notifications?.push ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* 保存状态提示 */}
              {settingsSaving && (
                <div className="pt-4 p-3 bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-lg flex items-center space-x-2 text-sm text-blue-800 dark:text-blue-300">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400"></div>
                  <span>{t('settings.saving')}</span>
                </div>
              )}
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
