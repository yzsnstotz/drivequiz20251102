'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';
import Header from '@/components/common/Header';

interface ExamHistory {
  id: string;
  title?: string;
  licenseType?: string;
  stage?: string;
  score: number;
  totalQuestions?: number;
  total?: number;
  date: string;
  timeSpent: number; // in seconds
  wrongQuestions?: Array<{
    question: any;
    userAnswer: string | string[];
    correctAnswer: string | string[] | boolean;
    questionIndex: number;
  }>;
}

export default function ExamHistoryPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [examHistory, setExamHistory] = useState<ExamHistory[]>([]);

  useEffect(() => {
    // 加载考试历史
    const savedExamHistory = localStorage.getItem('examHistory');
    if (savedExamHistory) {
      setExamHistory(JSON.parse(savedExamHistory));
    }
  }, []);

  const getExamTitle = (exam: ExamHistory): string => {
    if (exam.title) return exam.title;
    if (exam.licenseType && exam.stage) {
      const stageText = exam.stage === 'provisional' 
        ? t('study.stage.provisional') 
        : t('study.stage.regular');
      return `${exam.licenseType} - ${stageText}`;
    }
    return t('exam.title');
  };

  const handleViewDetail = (examId: string) => {
    router.push(`/profile/exam-history/${examId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Header title={t('profile.examHistory')} />
      
      <div className="container mx-auto px-4 py-6 pb-20">
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm">
          {examHistory.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">{t('profile.noExamHistory')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {examHistory.slice().reverse().map((exam, index) => {
                const total = exam.totalQuestions || exam.total || 0;
                const wrongCount = exam.wrongQuestions?.length || 0;
                
                return (
                  <div 
                    key={exam.id || index} 
                    className="border-b border-gray-100 dark:border-ios-dark-border pb-4 last:border-b-0"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white text-lg mb-1">
                          {getExamTitle(exam)}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{exam.date}</p>
                        {exam.timeSpent > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('exam.timeLeft')}: {Math.floor(exam.timeSpent / 60)}{t('exam.minutes')}{exam.timeSpent % 60}秒
                          </p>
                        )}
                        {wrongCount > 0 && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {t('mistakes.title')}: {wrongCount}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-2xl text-blue-600 dark:text-blue-400">
                          {total > 0 ? Math.round((exam.score / total) * 100) : 0}%
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {exam.score}/{total}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewDetail(exam.id)}
                      className="mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
                    >
                      <span>{t('mistakes.detail')}</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

