'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, X, Clock, Trophy } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';
import Header from '@/components/common/Header';
import QuestionImage from '@/components/common/QuestionImage';
import { isValidImageUrl } from '@/lib/imageUtils';
import { getQuestionContent, getQuestionOptions } from '@/lib/questionUtils';
import { Question } from '@/lib/questionsLoader';

interface WrongQuestion {
  question: Question;
  userAnswer: string | string[];
  correctAnswer: string | string[] | boolean;
  questionIndex: number;
}

interface ExamHistoryItem {
  id: string;
  licenseType?: string;
  stage?: string;
  score: number;
  total: number;
  passed: boolean;
  date: string;
  timeSpent: number;
  wrongQuestions?: WrongQuestion[];
}

export default function ExamDetailPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;
  const [exam, setExam] = useState<ExamHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 加载考试历史
    const savedExamHistory = localStorage.getItem('examHistory');
    if (savedExamHistory) {
      const examHistory: ExamHistoryItem[] = JSON.parse(savedExamHistory);
      const foundExam = examHistory.find(e => e.id === examId);
      if (foundExam) {
        setExam(foundExam);
      }
    }
    setLoading(false);
  }, [examId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  const formatAnswer = (answer: string | string[] | boolean): string => {
    if (typeof answer === 'boolean') {
      return answer ? t('exam.true') : t('exam.false');
    }
    if (Array.isArray(answer)) {
      return answer.join(', ');
    }
    return answer;
  };

  const getExamTitle = (exam: ExamHistoryItem): string => {
    if (exam.licenseType && exam.stage) {
      const stageText = exam.stage === 'provisional' 
        ? t('study.stage.provisional') 
        : t('study.stage.regular');
      return `${exam.licenseType} - ${stageText}`;
    }
    return t('exam.title');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <Header title={t('profile.examHistory')} showNavigation={false} />
        <div className="container mx-auto px-4 py-6 pb-20">
          <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm">
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400" suppressHydrationWarning>{t('common.loading')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <Header title={t('profile.examHistory')} showNavigation={false} />
        <div className="container mx-auto px-4 py-6 pb-20">
          <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm">
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">{t('common.error')}</p>
              <button
                onClick={() => router.back()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('common.back')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentLang = language as 'zh' | 'en' | 'ja';
  const wrongQuestions = exam.wrongQuestions || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Header title={t('profile.examHistory')} showNavigation={false} />
      
      <div className="container mx-auto px-4 py-6 pb-20">
        {/* 考试基本信息 */}
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">
              {getExamTitle(exam)}
            </h2>
            <div className="flex items-center space-x-2">
              <Trophy className={`h-6 w-6 ${exam.passed ? 'text-yellow-500' : 'text-gray-400'}`} />
              <span className={`text-lg font-semibold ${exam.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {exam.passed ? t('exam.passed') : t('exam.failed')}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('exam.score')}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {exam.score}/{exam.total}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('exam.accuracy')}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Math.round((exam.score / exam.total) * 100)}%
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t dark:border-ios-dark-border">
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="h-4 w-4" />
              <span>{t('exam.timeLeft')}: {formatTime(exam.timeSpent)}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{exam.date}</p>
            {wrongQuestions.length > 0 && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t('mistakes.title')}: {wrongQuestions.length}
              </p>
            )}
          </div>
        </div>

        {/* 错题列表 */}
        {wrongQuestions.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-ios-dark-text">
              {t('mistakes.title')} ({wrongQuestions.length})
            </h3>
            {wrongQuestions.map((wrongQ, index) => {
              const question = wrongQ.question;
              const contentText = getQuestionContent(question.content as any, currentLang) || '';
              const options = question.options 
                ? getQuestionOptions(question.options as any, currentLang)
                : [];

              return (
                <div
                  key={index}
                  className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm"
                >
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {t('question.current')} {wrongQ.questionIndex + 1}
                      </span>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        {t('question.incorrect')}
                      </span>
                    </div>
                    <p className="text-gray-900 dark:text-ios-dark-text text-lg mb-4">
                      {contentText}
                    </p>
                    {isValidImageUrl(question.image) && (
                      <QuestionImage
                        src={question.image!}
                        alt={t('question.image')}
                        width={800}
                        height={600}
                      />
                    )}
                  </div>

                  {/* 选项 */}
                  {question.type === 'truefalse' ? (
                    <div className="space-y-2 mb-4">
                      {['true', 'false'].map((option) => {
                        const isUserAnswer = wrongQ.userAnswer === option;
                        const isCorrect = (question.correctAnswer === 'true' && option === 'true') ||
                                         (question.correctAnswer === 'false' && option === 'false');
                        
                        return (
                          <div
                            key={option}
                            className={`p-3 rounded-lg border-2 ${
                              isCorrect
                                ? 'bg-green-50 dark:bg-green-900/30 border-green-500 dark:border-green-400'
                                : isUserAnswer
                                ? 'bg-red-50 dark:bg-red-900/30 border-red-500 dark:border-red-400'
                                : 'bg-gray-50 dark:bg-ios-dark-bg-tertiary border-transparent'
                            }`}
                          >
                            <span className="font-medium">
                              {option === 'true' ? t('exam.true') : t('exam.false')}
                              {isCorrect && ' ✓'}
                              {isUserAnswer && !isCorrect && ' ✗'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {options.map((option, optIndex) => {
                        const optionLabel = String.fromCharCode(65 + optIndex);
                        const isUserAnswer = Array.isArray(wrongQ.userAnswer)
                          ? wrongQ.userAnswer.includes(optionLabel)
                          : wrongQ.userAnswer === optionLabel;
                        const isCorrect = Array.isArray(question.correctAnswer)
                          ? question.correctAnswer.includes(optionLabel)
                          : question.correctAnswer === optionLabel;
                        
                        return (
                          <div
                            key={optIndex}
                            className={`p-3 rounded-lg border-2 ${
                              isCorrect
                                ? 'bg-green-50 dark:bg-green-900/30 border-green-500 dark:border-green-400'
                                : isUserAnswer
                                ? 'bg-red-50 dark:bg-red-900/30 border-red-500 dark:border-red-400'
                                : 'bg-gray-50 dark:bg-ios-dark-bg-tertiary border-transparent'
                            }`}
                          >
                            <span className="font-medium">{optionLabel}: </span>
                            {option}
                            {isCorrect && ' ✓'}
                            {isUserAnswer && !isCorrect && ' ✗'}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 答案对比 */}
                  <div className="mt-4 pt-4 border-t dark:border-ios-dark-border space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {t('question.correctAnswer')}:{' '}
                      </span>
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        {formatAnswer(question.correctAnswer)}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {t('question.yourAnswer')}:{' '}
                      </span>
                      <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                        {formatAnswer(wrongQ.userAnswer)}
                      </span>
                    </div>
                    {question.explanation && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('mistakes.explanation')}:
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {getQuestionContent(question.explanation as any, currentLang) || ''}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-ios-sm dark:shadow-ios-dark-sm">
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                {t('mistakes.empty')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

