"useclient";

import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Car,
  Shield,
  Map,
} from "lucide-react";
import QuestionPage from "./QuestionPage";

interface QuestionSet {
  id: string;
  title: string;
  description: string;
  totalQuestions: number;
  progress: number;
}

interface Category {
  id: string;
  title: string;
  icon: React.ReactNode;
  questionSets: QuestionSet[];
}

const categories: Category[] = [
  {
    id: "lecture",
    title: "学科讲习",
    icon: <BookOpen className="h-6 w-6 text-blue-600" />,
    questionSets: [
      {
        id: "lecture-1",
        title: "學科講習-1",
        description: "第一部分学科讲习题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "lecture-2",
        title: "學科講習-2",
        description: "第二部分学科讲习题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "lecture-3",
        title: "學科講習-3",
        description: "第三部分学科讲习题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "lecture-4",
        title: "學科講習-4",
        description: "第四部分学科讲习题目",
        totalQuestions: 50,
        progress: 0,
      },
    ],
  },
  {
    id: "provisional",
    title: "仮免",
    icon: <Car className="h-6 w-6 text-green-600" />,
    questionSets: [
      {
        id: "provisional-1",
        title: "仮免-1",
        description: "第一部分仮免题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "provisional-2",
        title: "仮免-2",
        description: "第二部分仮免题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "provisional-3",
        title: "仮免-3",
        description: "第三部分仮免题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "provisional-4",
        title: "仮免-4",
        description: "第四部分仮免题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "provisional-5",
        title: "仮免-5",
        description: "第五部分仮免题目",
        totalQuestions: 50,
        progress: 0,
      },
    ],
  },
  {
    id: "license",
    title: "免许",
    icon: <Shield className="h-6 w-6 text-orange-600" />,
    questionSets: [
      {
        id: "license-1",
        title: "免许-1",
        description: "第一部分免许题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "license-2",
        title: "免许-2",
        description: "第二部分免许题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "license-3",
        title: "免许-3",
        description: "第三部分免许题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "license-4",
        title: "免许-4",
        description: "第四部分免许题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "license-5",
        title: "免许-5",
        description: "第五部分免许题目",
        totalQuestions: 50,
        progress: 0,
      },
      {
        id: "license-6",
        title: "免许-6",
        description: "第六部分免许题目",
        totalQuestions: 50,
        progress: 0,
      },
    ],
  },
];

function StudyPage() {
  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<Category[]>([]);

  useEffect(() => {
    // 从统一的questions.json动态加载题目集
    const loadQuestionSets = async () => {
      try {
        // 优先从统一的questions.json读取
        try {
          const unifiedResponse = await import(`../../data/questions/zh/questions.json`);
          const allQuestions = unifiedResponse.questions || unifiedResponse.default?.questions || [];
          
          // 按category分组统计题目
          const categoryMap = new Map<string, QuestionSet[]>();
          
          allQuestions.forEach((q: any) => {
            const category = q.category || "其他";
            if (!categoryMap.has(category)) {
              categoryMap.set(category, []);
            }
            
            // 检查是否已存在该题目集
            const existingSet = categoryMap.get(category)!.find(s => s.title === category);
            if (!existingSet) {
              categoryMap.get(category)!.push({
                id: category.toLowerCase().replace(/\s+/g, '-'),
                title: category,
                description: `${category} 题目`,
                totalQuestions: 0,
                progress: 0,
              });
            }
          });
          
          // 统计每个category的题目数
          categoryMap.forEach((sets, category) => {
            const count = allQuestions.filter((q: any) => q.category === category).length;
            sets.forEach(set => {
              set.totalQuestions = count;
            });
          });
          
          // 按category分组，构建动态分类
          const categoryGroups = new Map<string, QuestionSet[]>();
          categoryMap.forEach((sets, category) => {
            // 提取category前缀（如"學科講習-1" -> "學科講習"）
            const prefix = category.split('-')[0];
            if (!categoryGroups.has(prefix)) {
              categoryGroups.set(prefix, []);
            }
            categoryGroups.get(prefix)!.push(...sets);
          });
          
          // 构建动态分类列表
          const newCategories: Category[] = [];
          categoryGroups.forEach((sets, prefix) => {
            // 根据prefix确定图标和标题
            let icon: React.ReactNode;
            let title: string;
            
            if (prefix.includes('學科講習') || prefix.includes('学科讲习')) {
              icon = <BookOpen className="h-6 w-6 text-blue-600" />;
              title = '学科讲习';
            } else if (prefix.includes('仮免') || prefix.includes('假免')) {
              icon = <Car className="h-6 w-6 text-green-600" />;
              title = '仮免';
            } else if (prefix.includes('免许') || prefix.includes('免許')) {
              icon = <Shield className="h-6 w-6 text-orange-600" />;
              title = '免许';
            } else {
              icon = <BookOpen className="h-6 w-6 text-gray-600" />;
              title = prefix;
            }
            
            newCategories.push({
              id: prefix.toLowerCase().replace(/\s+/g, '-'),
              title,
              icon,
              questionSets: sets.sort((a, b) => a.title.localeCompare(b.title)),
            });
          });
          
          setDynamicCategories(newCategories);
          
          // 初始化题目集数据，从localStorage读取进度
          const initializedSets = newCategories.flatMap(category =>
            category.questionSets.map(set => {
              const savedProgress = localStorage.getItem(`progress_${set.title}`);
              if (savedProgress) {
                const progress = JSON.parse(savedProgress);
                return {
                  ...set,
                  progress: progress.answeredQuestions?.length || 0
                };
              }
              return set;
            })
          );
          setQuestionSets(initializedSets);
        } catch (unifiedError) {
          // 如果统一的questions.json不存在，使用静态分类（兼容旧逻辑）
          const initializedSets = categories.flatMap((category) =>
            category.questionSets.map((set) => {
              const savedProgress = localStorage.getItem(`progress_${set.title}`);
              if (savedProgress) {
                const progress = JSON.parse(savedProgress);
                return {
                  ...set,
                  progress: progress.answeredQuestions?.length || 0,
                };
              }
              return set;
            }),
          );
          setQuestionSets(initializedSets);
          setDynamicCategories(categories);
        }
      } catch (error) {
        console.error('加载题目集失败:', error);
        // 出错时使用静态分类
        const initializedSets = categories.flatMap((category) =>
          category.questionSets.map((set) => {
            const savedProgress = localStorage.getItem(`progress_${set.title}`);
            if (savedProgress) {
              const progress = JSON.parse(savedProgress);
              return {
                ...set,
                progress: progress.answeredQuestions?.length || 0,
              };
            }
            return set;
          }),
        );
        setQuestionSets(initializedSets);
        setDynamicCategories(categories);
      }
    };
    
    loadQuestionSets();
  }, []);

  if (selectedSet) {
    return (
      <div className="pb-20">
        <QuestionPage
          questionSet={selectedSet}
          onBack={() => setSelectedSet(null)}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">学习</h1>
        <p className="text-gray-600">选择你想要学习的内容</p>
      </div>

      <div className="space-y-8">
        {(dynamicCategories.length > 0 ? dynamicCategories : categories).map((category) => {
          const categoryQuestionSets = questionSets.filter((set) =>
            category.questionSets.some(
              (categorySet) => categorySet.id === set.id || categorySet.title === set.title,
            ),
          );

          if (categoryQuestionSets.length === 0) return null;

          return (
            <div
              key={category.id}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center space-x-3 mb-4">
                {category.icon}
                <h2 className="text-xl font-bold text-gray-900">
                  {category.title}
                </h2>
              </div>

              <div className="grid gap-4">
                {categoryQuestionSets.map((set) => {
                  const savedProgress = localStorage.getItem(
                    `progress_${set.title}`,
                  );
                  const progress = savedProgress
                    ? JSON.parse(savedProgress)
                    : {
                        answeredQuestions: [],
                        totalQuestions: set.totalQuestions,
                      };
                  const progressPercentage =
                    Math.round(
                      (progress.answeredQuestions?.length /
                        progress.totalQuestions) *
                        100,
                    ) || 0;

                  return (
                    <button
                      key={set.id}
                      onClick={() => setSelectedSet(set)}
                      className="bg-gray-50 rounded-xl p-4 text-left hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {set.title}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {set.description}
                          </p>
                        </div>
                        <span className="text-blue-600 text-sm font-medium">
                          {progressPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StudyPage;
