"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";

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

export default function HomePage() {
  const [showAI, setShowAI] = useState(false);
  const [totalProgress, setTotalProgress] = useState(0);
  const [currentWelcomeIndex, setCurrentWelcomeIndex] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const welcomeScrollRef = React.useRef<HTMLDivElement>(null);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Truck className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">ZALEM</span>
          </div>
          <button
            onClick={() => setShowAI(true)}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
          >
            <Bot className="h-6 w-6" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-2 py-4">
        {/* Welcome Section */}
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              欢迎来到 Zalem.app
            </h2>
            <p className="text-gray-600 text-sm mt-1">开启你的学车之旅</p>
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
          <a
            href="/study"
            className="bg-white rounded-2xl p-4 text-center shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Book className="h-6 w-6 text-blue-600" />
            </div>
            <div className="h-5 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                课程学习
              </span>
            </div>
          </a>

          <a
            href="/exam"
            className="bg-white rounded-2xl p-4 text-center shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
            <div className="h-5 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                模拟考试
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
                错题本
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
                大乱斗
              </span>
            </div>
          </a>
        </div>

        {/* 本免许学试 Videos */}
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">本免许学试</h2>
            <p className="text-gray-600 text-sm mt-1">精选视频教程</p>
          </div>
          <div className="flex overflow-x-auto space-x-4 pb-4">
            <div className="flex-none w-[280px]">
              <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden mb-2">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/VIDEO_ID_1"
                  title="本免许学试 - 视频 1"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <h3 className="font-medium text-gray-900">基础知识讲解</h3>
            </div>
            <div className="flex-none w-[280px]">
              <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden mb-2">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/VIDEO_ID_2"
                  title="本免许学试 - 视频 2"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <h3 className="font-medium text-gray-900">实战技巧分享</h3>
            </div>
          </div>
        </div>

        {/* 二种免许学试 Videos */}
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">二种免许学试</h2>
            <p className="text-gray-600 text-sm mt-1">进阶视频教程</p>
          </div>
          <div className="flex overflow-x-auto space-x-4 pb-4">
            <div className="flex-none w-[280px]">
              <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden mb-2">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/VIDEO_ID_3"
                  title="二种免许学试 - 视频 1"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <h3 className="font-medium text-gray-900">高级驾驶技巧</h3>
            </div>
            <div className="flex-none w-[280px]">
              <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden mb-2">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/VIDEO_ID_4"
                  title="二种免许学试 - 视频 2"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <h3 className="font-medium text-gray-900">考试要点解析</h3>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
