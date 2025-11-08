"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/common/Header";
import AdSlot from "@/components/common/AdSlot";
import AIButton from "@/components/common/AIButton";
import { BookOpen, Car, Shield, Globe, Award, RefreshCw } from "lucide-react";

type LicenseType = "provisional" | "full" | "foreign" | "second" | "renewal";

interface LicenseCategory {
  id: LicenseType;
  title: string;
  titleJa: string;
  description: string;
  icon: React.ReactNode;
  questionSets: QuestionSet[];
}

interface QuestionSet {
  id: string;
  title: string;
  description: string;
  totalQuestions: number;
  licenseType: LicenseType;
}

const licenseCategories: LicenseCategory[] = [
  {
    id: "provisional",
    title: "仮免许",
    titleJa: "仮免許",
    description: "临时驾照学习",
    icon: <Car className="h-6 w-6 text-green-600" />,
    questionSets: [
      { id: "provisional-1", title: "仮免-1", description: "第一部分仮免题目", totalQuestions: 50, licenseType: "provisional" },
      { id: "provisional-2", title: "仮免-2", description: "第二部分仮免题目", totalQuestions: 50, licenseType: "provisional" },
      { id: "provisional-3", title: "仮免-3", description: "第三部分仮免题目", totalQuestions: 50, licenseType: "provisional" },
      { id: "provisional-4", title: "仮免-4", description: "第四部分仮免题目", totalQuestions: 50, licenseType: "provisional" },
      { id: "provisional-5", title: "仮免-5", description: "第五部分仮免题目", totalQuestions: 50, licenseType: "provisional" },
    ],
  },
  {
    id: "full",
    title: "本免许",
    titleJa: "本免許",
    description: "正式驾照学习",
    icon: <Shield className="h-6 w-6 text-orange-600" />,
    questionSets: [
      { id: "license-1", title: "免许-1", description: "第一部分免许题目", totalQuestions: 50, licenseType: "full" },
      { id: "license-2", title: "免许-2", description: "第二部分免许题目", totalQuestions: 50, licenseType: "full" },
      { id: "license-3", title: "免许-3", description: "第三部分免许题目", totalQuestions: 50, licenseType: "full" },
      { id: "license-4", title: "免许-4", description: "第四部分免许题目", totalQuestions: 50, licenseType: "full" },
      { id: "license-5", title: "免许-5", description: "第五部分免许题目", totalQuestions: 50, licenseType: "full" },
      { id: "license-6", title: "免许-6", description: "第六部分免许题目", totalQuestions: 50, licenseType: "full" },
    ],
  },
  {
    id: "foreign",
    title: "外国切替",
    titleJa: "外国切替",
    description: "外国驾照切换",
    icon: <Globe className="h-6 w-6 text-blue-600" />,
    questionSets: [
      { id: "foreign-1", title: "外国切替-1", description: "第一部分外国切替题目", totalQuestions: 50, licenseType: "foreign" },
      { id: "foreign-2", title: "外国切替-2", description: "第二部分外国切替题目", totalQuestions: 50, licenseType: "foreign" },
    ],
  },
  {
    id: "second",
    title: "二種免许",
    titleJa: "二種免許",
    description: "二种驾照学习",
    icon: <Award className="h-6 w-6 text-purple-600" />,
    questionSets: [
      { id: "second-1", title: "二種-1", description: "第一部分二種题目", totalQuestions: 50, licenseType: "second" },
      { id: "second-2", title: "二種-2", description: "第二部分二種题目", totalQuestions: 50, licenseType: "second" },
    ],
  },
  {
    id: "renewal",
    title: "再取得",
    titleJa: "再取得",
    description: "重新取得驾照",
    icon: <RefreshCw className="h-6 w-6 text-red-600" />,
    questionSets: [
      { id: "renewal-1", title: "再取得-1", description: "第一部分再取得题目", totalQuestions: 50, licenseType: "renewal" },
      { id: "renewal-2", title: "再取得-2", description: "第二部分再取得题目", totalQuestions: 50, licenseType: "renewal" },
    ],
  },
];

export default function LicensePage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<LicenseType | null>(null);

  const handleStudy = (questionSet: QuestionSet) => {
    router.push(`/license/study/${questionSet.id}?type=${questionSet.licenseType}`);
  };

  const handleExam = (questionSet: QuestionSet) => {
    router.push(`/license/exam/${questionSet.id}?type=${questionSet.licenseType}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="驾照学习" showAIButton={false} aiContext="license" />
      
      {/* 广告位 - 紧凑布局 */}
      <div className="container mx-auto px-4 py-2">
        <AdSlot position="license_top" />
      </div>

      <div className="container mx-auto px-4 py-3">
        {!selectedCategory ? (
          /* 分类导航 - 只在未选择时显示 */
          <div className="mb-3">
            <h2 className="text-xl font-bold text-gray-900 mb-3">选择驾照类型</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {licenseCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-left ios-card active:scale-95"
                >
                  <div className="flex flex-col items-center space-y-2">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-50">
                      {category.icon}
                    </div>
                    <div className="text-center">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight">{category.title}</h3>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{category.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* 题目集列表 - 选中后只显示该类型的专区 */
          <div className="mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50">
                  {licenseCategories.find((c) => c.id === selectedCategory)?.icon}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {licenseCategories.find((c) => c.id === selectedCategory)?.title}
                  </h2>
                  <p className="text-xs text-gray-600">
                    {licenseCategories.find((c) => c.id === selectedCategory)?.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                切换类型
              </button>
            </div>

            {/* 快捷功能 - 固定在题目集列表上方 */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Link
                href="/license/mistakes"
                className="bg-white rounded-xl shadow-sm p-3 hover:shadow-md transition-all ios-card active:scale-95"
              >
                <h3 className="text-sm font-semibold text-gray-900 mb-1">错题本</h3>
                <p className="text-xs text-gray-600">查看和复习错题</p>
              </Link>
              <Link
                href="/exam"
                className="bg-white rounded-xl shadow-sm p-3 hover:shadow-md transition-all ios-card active:scale-95"
              >
                <h3 className="text-sm font-semibold text-gray-900 mb-1">模拟考试</h3>
                <p className="text-xs text-gray-600">进行模拟考试练习</p>
              </Link>
              <div className="bg-white rounded-xl shadow-sm p-3 ios-card">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">AI学习助手</h3>
                <p className="text-xs text-gray-600 mb-2">智能问答和学习建议</p>
                <AIButton context="license" className="w-full text-xs" />
              </div>
            </div>

            {/* 题目集列表 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {licenseCategories
                .find((c) => c.id === selectedCategory)
                ?.questionSets.map((set) => (
                  <div
                    key={set.id}
                    className="bg-white rounded-xl shadow-sm p-3 hover:shadow-md transition-all ios-card"
                  >
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{set.title}</h3>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{set.description}</p>
                    <p className="text-xs text-gray-500 mb-3">题目: {set.totalQuestions}</p>
                    <div className="flex space-x-1.5">
                      <button
                        onClick={() => handleStudy(set)}
                        className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium active:scale-95"
                      >
                        学习
                      </button>
                      <button
                        onClick={() => handleExam(set)}
                        className="flex-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-xs font-medium active:scale-95"
                      >
                        考试
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 预留信息栏位置 */}
        <div className="mt-3">
          {/* 这里可以添加其他信息栏，如：学习进度、推荐内容、统计信息等 */}
        </div>
      </div>
    </div>
  );
}


