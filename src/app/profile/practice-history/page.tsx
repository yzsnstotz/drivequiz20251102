'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';
import Header from '@/components/common/Header';
import { getQuestionContent } from '@/lib/questionUtils';

interface PracticeHistory {
  id: string;
  questionId: number;
  content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
  type: string;
  correct: boolean;
  date: string;
  from: string; // 'exam' or 'study'
}

export default function PracticeHistoryPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistory[]>([]);

  useEffect(() => {
    // 加载做题历史（最近50题）
    const savedPracticeHistory = localStorage.getItem('practiceHistory');
    if (savedPracticeHistory) {
      const allHistory = JSON.parse(savedPracticeHistory);
      // 只保留最近50题
      const recentHistory = allHistory.slice(-50);
      setPracticeHistory(recentHistory);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Header title={t('profile.practiceHistoryTitle')} showNavigation={false} />
      
      <div className="container mx-auto px-4 py-6 pb-20">
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm">
          {practiceHistory.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">{t('profile.noPracticeHistory')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {practiceHistory.slice().reverse().map((item, index) => (
                <div key={item.id || index} className="border-b border-gray-100 dark:border-ios-dark-border pb-4 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <p className="text-sm text-gray-900 dark:text-white line-clamp-2 mb-2">
                        {typeof item.content === 'string' 
                          ? item.content 
                          : getQuestionContent(item.content, language) || ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.date}</p>
                    </div>
                    <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        item.correct ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                      }`}>
                        {item.correct ? t('profile.correct') : t('profile.incorrect')}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.from === 'exam' ? t('profile.fromExam') : t('profile.fromStudy')}
                      </span>
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

