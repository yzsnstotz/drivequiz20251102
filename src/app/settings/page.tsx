"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient.front";
import { useLanguage } from "@/lib/i18n";
import Header from "@/components/common/Header";
import { Settings, Globe, Shield, Bell, Save, Check, X, Moon, Sun } from "lucide-react";

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
  const { language, setLanguage: setLanguageContext } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
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

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // 更新语言设置
      const response = await apiFetch<ProfileData>("/api/profile", {
        method: "PUT",
        body: {
          language: formData.language,
          metadata: formData.metadata,
        },
      });

      if (response.ok) {
        // 更新本地语言上下文
        if (formData.language !== language) {
          setLanguageContext(formData.language as "ja" | "zh" | "en");
        }
        
        setProfile(response.data);
        setSuccess("设置已保存");
        
        // 3秒后清除成功消息
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      } else {
        throw new Error("保存失败");
      }
    } catch (err) {
      console.error("保存设置失败:", err);
      setError(err instanceof Error ? err.message : "保存设置失败，请稍后重试");
      
      // 5秒后清除错误消息
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setFormData({ ...formData, language: newLanguage });
  };

  const handlePrivacyChange = (key: string, value: boolean) => {
    setFormData({
      ...formData,
      metadata: {
        ...formData.metadata,
        privacy: {
          ...formData.metadata?.privacy,
          [key]: value,
        },
      },
    });
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setFormData({
      ...formData,
      metadata: {
        ...formData.metadata,
        notifications: {
          ...formData.metadata?.notifications,
          [key]: value,
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="设置" showAIButton={false} />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
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
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
            <Check className="h-5 w-5 text-green-600" />
            <span className="text-green-800">{success}</span>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <X className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* 语言设置 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">语言设置</h2>
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
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    formData.language === lang.value
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="text-2xl mb-2">{lang.flag}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{lang.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 主题设置 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
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
                <label className="text-sm font-medium text-gray-900 dark:text-white">暗色模式</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">切换暗色/亮色主题</p>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDarkMode ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 隐私偏好 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.metadata?.privacy?.shareData ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.metadata?.privacy?.analytics ? "bg-blue-600" : "bg-gray-200"
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.metadata?.notifications?.email ? "bg-blue-600" : "bg-gray-200"
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.metadata?.notifications?.push ? "bg-blue-600" : "bg-gray-200"
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

        {/* 保存按钮 */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Save className="h-5 w-5" />
            <span>{saving ? "保存中..." : "保存设置"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

