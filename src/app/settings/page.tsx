"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient.front";
import { useLanguage } from "@/lib/i18n";
import Header from "@/components/common/Header";
import { Settings, Globe, Shield, Bell, Check, X, Moon, Sun } from "lucide-react";

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

export default function SettingsPage() {
  const router = useRouter();
  const { language, setLanguage: setLanguageContext, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // 初始化暗色模式状态
  useEffect(() => {
    const darkMode = localStorage.getItem('darkMode') === 'true' || 
                     document.documentElement.classList.contains('dark');
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);
  
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

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
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
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // 自动保存设置
  const autoSave = useCallback(async (dataToSave: ProfileData) => {
    try {
      setSaving(true);
      setError(null);

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
        setSuccess("设置已保存");
        
        // 2秒后清除成功消息
        setTimeout(() => {
          setSuccess(null);
        }, 2000);
      } else {
        throw new Error("保存失败");
      }
    } catch (err) {
      console.error("保存设置失败:", err);
      setError(err instanceof Error ? err.message : "保存设置失败，请稍后重试");
      
      // 3秒后清除错误消息
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setSaving(false);
    }
  }, [language, setLanguageContext]);

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
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <Header title="设置" showAIButton={false} />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="relative inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-500 mx-auto" style={{ animation: 'spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 bg-blue-600 dark:bg-blue-500 rounded-full animate-ios-pulse"></div>
            </div>
          </div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="设置" showAIButton={false} />
      
      <div className="container mx-auto px-4 py-6">
        {/* 成功/错误提示 */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-lg flex items-center space-x-2">
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-green-800 dark:text-green-300">{success}</span>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-lg flex items-center space-x-2">
            <X className="h-5 w-5 text-red-600 dark:text-red-400" />
            <span className="text-red-800 dark:text-red-300">{error}</span>
          </div>
        )}

        {/* 语言设置 */}
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl shadow-ios-sm dark:shadow-ios-dark-sm p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-ios-dark-text">语言设置</h2>
          </div>
          
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择语言</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "ja", label: "日本語", flag: "🇯🇵" },
                { value: "zh", label: "中文", flag: "🇨🇳" },
                { value: "en", label: "English", flag: "🇺🇸" },
              ].map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => handleLanguageChange(lang.value)}
                  className={`p-4 rounded-xl border-2 ios-button transition-all duration-200 ${
                    formData.language === lang.value
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400 shadow-ios-sm"
                      : "border-gray-200 dark:border-gray-700 active:border-gray-300 dark:active:border-gray-600 active:scale-[0.98]"
                  }`}
                >
                  <div className="text-2xl mb-2">{lang.flag}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-ios-dark-text">{lang.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 主题设置 */}
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl shadow-ios-sm dark:shadow-ios-dark-sm p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            {isDarkMode ? (
              <Moon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            ) : (
              <Sun className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            )}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">主题设置</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-ios-dark-text">暗色模式</label>
                <p className="text-xs text-gray-500 dark:text-ios-dark-text-secondary mt-1">切换暗色/亮色主题</p>
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
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl shadow-ios-sm dark:shadow-ios-dark-sm p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">隐私偏好</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">共享数据用于改进</label>
                <p className="text-xs text-gray-500 mt-1">允许我们使用匿名数据改进服务</p>
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
                <label className="text-sm font-medium text-gray-900">分析数据</label>
                <p className="text-xs text-gray-500 mt-1">允许收集使用情况分析数据</p>
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
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl shadow-ios-sm dark:shadow-ios-dark-sm p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">通知偏好</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">邮件通知</label>
                <p className="text-xs text-gray-500 mt-1">接收重要更新和提醒邮件</p>
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
                <label className="text-sm font-medium text-gray-900">推送通知</label>
                <p className="text-xs text-gray-500 mt-1">接收浏览器推送通知</p>
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
        {saving && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-lg flex items-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400"></div>
            <span className="text-blue-800 dark:text-blue-300">保存中...</span>
          </div>
        )}
      </div>
    </div>
  );
}

