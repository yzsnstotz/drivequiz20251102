'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';
import Header from '@/components/common/Header';

interface ExamHistory {
  id: string;
  title: string;
  score: number;
  totalQuestions: number;
  date: string;
  timeSpent: number; // in seconds
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
              {examHistory.slice().reverse().map((exam, index) => (
                <div key={exam.id || index} className="border-b border-gray-100 dark:border-ios-dark-border pb-4 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white text-lg mb-1">{exam.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{exam.date}</p>
                      {exam.timeSpent > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          用时: {Math.floor(exam.timeSpent / 60)}分{exam.timeSpent % 60}秒
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-bold text-2xl text-blue-600 dark:text-blue-400">
                        {Math.round((exam.score / exam.totalQuestions) * 100)}%
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {exam.score}/{exam.totalQuestions}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

