"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import {
  Book,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  XSquare,
  FileText,
  Car,
  Home,
  User,
  Bot,
  Search,
  UtensilsCrossed,
  Truck,
  Swords,
  Globe,
  Star,
  LogIn,
  LogOut,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import MerchantAdCarousel from "@/components/MerchantAdCarousel";
import SplashScreenAd from "@/components/SplashScreenAd";
import PopupAd from "@/components/PopupAd";
import { useLanguage, type Language } from "@/lib/i18n";
import Link from "next/link";
import { getFormattedVersion } from "@/lib/version";
import { useAIActivation } from "@/components/AIActivationProvider";
import { useRouter } from "next/navigation";

const welcomeData = [
  {
    id: 0,
    title: "平台介绍",
    description: "",
    imageUrl:
      "https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/intro.webp",
    link: "https://zalem-app.gitbook.io/info/intro",
  },
  {
    id: 1,
    title: "“大乱斗”挑战赛火热开启中",
    description: "",
    imageUrl:
      "https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/royalbattlecompetition.webp",
    link: "https://zalem-app.gitbook.io/info/event/royalbattle",
  },
  {
    id: 2,
    title: "新！志愿者招募计划开启！",
    description: "",
    imageUrl:
      "https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/volunteerreruitmentevent.webp",
    link: "https://zalem-app.gitbook.io/info/event/volunteer-recruit",
  },
  {
    id: 3,
    title: "新！商家入驻计划开启！",
    description: "",
    imageUrl:
      "https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/merchantrecruitevent.webp",
    link: "https://zalem-app.gitbook.io/info/event/merchant-recruit",
  },
];

type AdSlotConfig = {
  slotKey: string;
  title: string;
  description: string | null;
};

export default function HomePage() {
  const { language, setLanguage, t } = useLanguage();
  const { data: session, status } = useSession();
  const { isActivated } = useAIActivation();
  const router = useRouter();
  const [savedLicensePreference, setSavedLicensePreference] = useState<{ licenseType: string; stage: string } | null>(null);
  const [totalProgress, setTotalProgress] = useState(0);
  const [currentWelcomeIndex, setCurrentWelcomeIndex] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const welcomeScrollRef = useRef<HTMLDivElement>(null);
  const [adSlots, setAdSlots] = useState<AdSlotConfig[]>([]);
  const [showSplash, setShowSplash] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [splashDuration, setSplashDuration] = useState(3);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  useEffect(() => {
    // 加载广告栏配置
    const loadAdSlots = async () => {
      try {
        const res = await fetch("/api/ad-slots");
        if (res.ok) {
          const data = await res.json();
          if (data.ok) {
            const items = data.data.items || [];
            setAdSlots(items);
            
            // 检查启动页广告 - 只在首次访问时显示
            const checkSplashAd = async () => {
              // 检查是否已经显示过启动页广告
              const hasShownSplash = localStorage.getItem("splash_ad_shown");
              if (hasShownSplash === "true") {
                return false; // 已显示过，不需要检查弹窗
              }

              const splashConfig = items.find((item: AdSlotConfig & { splashDuration?: number }) => item.slotKey === "splash_screen");
              if (splashConfig) {
                if (splashConfig.splashDuration) {
                  setSplashDuration(splashConfig.splashDuration);
                }
                try {
                  const res = await fetch("/api/merchant-ads?adSlot=splash_screen");
                  if (res.ok) {
                    const data = await res.json();
                    if (data.ok && data.data.items && data.data.items.length > 0) {
                      setShowSplash(true);
                      // 标记为已显示
                      localStorage.setItem("splash_ad_shown", "true");
                      return true; // 有启动页广告，不需要检查弹窗
                    }
                  } else {
                    console.error("[广告加载] 启动页广告请求失败:", res.status);
                  }
                } catch (error) {
                  console.error("[广告加载] 检查启动页广告失败:", error);
                }
              }
              return false; // 没有启动页广告，需要检查弹窗
            };
            
            // 检查弹窗广告
            const checkPopupAd = async () => {
              const popupConfig = items.find((item: AdSlotConfig) => item.slotKey === "popup_ad");
              if (popupConfig) {
                try {
                  const res = await fetch("/api/merchant-ads?adSlot=popup_ad", {
                    method: "GET",
                    headers: {
                      "Content-Type": "application/json",
                    },
                  });
                  if (res.ok) {
                    const data = await res.json();
                    if (data.ok && data.data.items && data.data.items.length > 0) {
                      // 延迟显示弹窗
                      setTimeout(() => {
                        setShowPopup(true);
                      }, 500);
                    }
                  } else {
                    console.error("[广告加载] 弹窗广告请求失败:", res.status, res.statusText);
                  }
                } catch (error) {
                  // 静默处理错误，不显示给用户
                  if (process.env.NODE_ENV === "development") {
                    console.error("[广告加载] 检查弹窗广告失败:", error);
                  }
                }
              }
            };
            
            // 先检查启动页广告，如果没有再检查弹窗广告
            const hasSplash = await checkSplashAd();
            if (!hasSplash) {
              checkPopupAd();
            }
          } else {
            console.error("[广告加载] 广告栏配置响应格式错误:", data);
          }
        } else {
          console.error("[广告加载] 广告栏配置请求失败:", res.status);
        }
      } catch (error) {
        console.error("[广告加载] 加载广告栏配置失败:", error);
      }
    };
    loadAdSlots();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAutoScrolling) {
      interval = setInterval(() => {
        if (welcomeScrollRef.current) {
          welcomeScrollRef.current.scrollBy({ left: 300, behavior: "smooth" });
          // 检查是否滚动到最后，如果是则重置到开始位置
          setTimeout(() => {
            if (welcomeScrollRef.current) {
              const { scrollLeft, scrollWidth, clientWidth } =
                welcomeScrollRef.current;
              if (scrollLeft + clientWidth >= scrollWidth) {
                welcomeScrollRef.current.scrollTo({
                  left: 0,
                  behavior: "smooth",
                });
              }
            }
          }, 500);
        }
      }, 5000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isAutoScrolling]);

  const handleWelcomePrevious = () => {
    if (welcomeScrollRef.current) {
      welcomeScrollRef.current.scrollBy({ left: -300, behavior: "smooth" });
      setIsAutoScrolling(false);
    }
  };

  const handleWelcomeNext = () => {
    if (welcomeScrollRef.current) {
      welcomeScrollRef.current.scrollBy({ left: 300, behavior: "smooth" });
      setIsAutoScrolling(false);
    }
  };


  // 如果显示启动页广告，只渲染启动页广告
  if (showSplash) {
    return (
      <SplashScreenAd
        duration={splashDuration}
        onClose={() => {
          setShowSplash(false);
          // 启动页关闭后，检查是否需要显示弹窗
          const checkPopupAd = async () => {
            const popupConfig = adSlots.find((item: AdSlotConfig) => item.slotKey === "popup_ad");
            if (popupConfig) {
              try {
                const res = await fetch("/api/merchant-ads?adSlot=popup_ad");
                if (res.ok) {
                  const data = await res.json();
                  if (data.ok && data.data.items && data.data.items.length > 0) {
                    setTimeout(() => {
                      setShowPopup(true);
                    }, 500);
                  }
                }
              } catch (error) {
                console.error("检查弹窗广告失败:", error);
              }
            }
          };
          checkPopupAd();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 启动弹窗广告 */}
      {showPopup && (
        <PopupAd onClose={() => setShowPopup(false)} />
      )}
      {/* Navigation Bar */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Truck className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">ZALEM</span>
            <span className="text-[9px] text-gray-400 font-mono hidden sm:inline">
              {getFormattedVersion()}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {/* 登录/用户信息 */}
            {status === "loading" ? (
              <div className="px-3 py-1.5 text-gray-400">
                <span className="text-sm">{t('common.loading')}</span>
              </div>
            ) : session?.user ? (
              <div className="flex items-center space-x-2">
                <Link
                  href="/profile"
                  className="flex items-center space-x-1 px-3 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  aria-label={session.user.name || session.user.email || "用户"}
                >
                  <User className="h-5 w-5" />
                  <span className="text-sm font-medium hidden sm:inline">
                    {session.user.name || session.user.email || "用户"}
                  </span>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center space-x-1 px-3 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label={t('header.logout')}
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-sm font-medium hidden sm:inline">
                    {t('header.logout')}
                  </span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center space-x-1 px-3 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                aria-label={t('home.login')}
              >
                <LogIn className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:inline">
                  {t('home.login')}
                </span>
              </Link>
            )}
            {/* 语言切换按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center space-x-1 px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={t('home.changeLanguage')}
              >
                <Globe className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {language === 'zh' ? t('language.chinese') : language === 'en' ? t('language.english') : t('language.japanese')}
                </span>
              </button>
              {showLanguageMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowLanguageMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border z-20">
                    <button
                      onClick={() => {
                        setLanguage('zh');
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg ${
                        language === 'zh' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {t('language.chinese')}
                    </button>
                    <button
                      onClick={() => {
                        setLanguage('en');
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        language === 'en' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {t('language.english')}
                    </button>
                    <button
                      onClick={() => {
                        setLanguage('ja');
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 last:rounded-b-lg ${
                        language === 'ja' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {t('language.japanese')}
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowAI(true)}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
              aria-label={t('home.aiAssistant')}
            >
              <Bot className="h-6 w-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-2 py-4">
        {/* Welcome Section */}
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {t('home.welcome')}
            </h2>
            <p className="text-gray-600 text-sm mt-1">{t('home.subtitle')}</p>
          </div>
          <div className="relative">
            <div
              ref={welcomeScrollRef}
              className="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {welcomeData.map((item) => (
                <div
                  key={item.id}
                  className="flex-none w-[300px] cursor-pointer"
                  onClick={() => window.open(item.link, "_blank")}
                >
                  <div className="relative h-40 rounded-xl overflow-hidden">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 300px"
                      className="object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <h3 className="text-white font-bold mb-1">
                        {item.title}
                      </h3>
                      <p className="text-white/90 text-sm">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleWelcomePrevious}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2 backdrop-blur-sm transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <button
              onClick={handleWelcomeNext}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2 backdrop-blur-sm transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Main Features */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => {
              if (savedLicensePreference) {
                // 如果有保存的选择，直接跳转到学习页面（默认学习模式）
                const params = new URLSearchParams({
                  licenseType: savedLicensePreference.licenseType,
                  stage: savedLicensePreference.stage,
                  mode: 'study',
                });
                window.location.href = `/study/learn?${params.toString()}`;
              } else {
                // 如果没有保存的选择，跳转到选择页面
                window.location.href = '/study';
              }
            }}
            className="bg-white rounded-2xl p-4 text-center shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Book className="h-6 w-6 text-blue-600" />
            </div>
            <div className="h-5 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                {t('home.study')}
              </span>
            </div>
          </button>

          <a
            href="/exam"
            className="bg-white rounded-2xl p-4 text-center shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
            <div className="h-5 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                {t('home.exam')}
              </span>
            </div>
          </a>

          <a
            href="/mistakes"
            className="bg-white rounded-2xl p-4 text-center shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <XSquare className="h-6 w-6 text-red-600" />
            </div>
            <div className="h-5 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                {t('home.mistakes')}
              </span>
            </div>
          </a>

          <a
            href="/royalbattle"
            className="bg-white rounded-2xl p-4 text-center shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Swords className="h-6 w-6 text-purple-600" />
            </div>
            <div className="h-5 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                {t('home.royalbattle')}
              </span>
            </div>
          </a>
        </div>

        {/* Favorites Section */}
        <div className="mb-6">
          <a
            href="/favorites"
            className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow flex items-center space-x-4"
          >
            <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
              <Star className="h-6 w-6 text-yellow-600 fill-current" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">
                {t('profile.favorites')}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {t('profile.favoritesDesc')}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </a>
        </div>

        {/* AI 助手入口 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-4 mb-6 shadow-md">
          <button
            onClick={() => {
              if (isActivated) {
                router.push('/ai');
              } else {
                router.push('/activation');
              }
            }}
            className="w-full flex items-center justify-between text-white hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Bot className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold">{t('home.aiAssistant')}</h3>
                <p className="text-sm text-white/90">{t('home.aiDescription')} <span className="text-white/70">by Zalem</span></p>
              </div>
            </div>
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* 动态加载广告栏 - 只显示首页banner广告位，排除启动页和弹窗广告 */}
        {adSlots
          .filter((slot) => 
            slot.slotKey === "home_first_column" || 
            slot.slotKey === "home_second_column"
          )
          .map((slot) => (
            <MerchantAdCarousel
              key={slot.slotKey}
              adSlot={slot.slotKey}
              title={slot.title}
              description={slot.description || undefined}
            />
          ))}
      </main>
    </div>
  );
}
