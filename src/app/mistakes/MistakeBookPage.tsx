"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2, BookOpen, Car, Shield, CheckSquare, XSquare, Bot } from 'lucide-react';
import QuestionAIDialog from '@/components/QuestionAIDialog';
import QuestionImage from '@/components/common/QuestionImage';
import { getContentText } from '@/lib/questionContentUtils';
import { getQuestionContent, getQuestionOptions } from '@/lib/questionUtils';
import { useLanguage } from '@/lib/i18n';
import { loadUnifiedQuestionsPackage, Question as PackageQuestion } from '@/lib/questionsLoader';

interface Question {
  id: number;
  type: 'single' | 'multiple' | 'truefalse';
  content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
  image?: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string | { zh?: string; en?: string; ja?: string; [key: string]: string | undefined };
  hash?: string;
  fromExam?: boolean;
  fromStudy?: boolean;
  fromFavorites?: boolean;
  examId?: string;
  examTitle?: string;
  studySetId?: string;
  studySetTitle?: string;
  studyLicenseType?: string | null;
  studyStage?: string | null;
  examLicenseType?: string | null;
  examStage?: string | null;
}

function MistakeBookPage() {
  const { t, language } = useLanguage();
  const [mistakeQuestions, setMistakeQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [practiceSelected, setPracticeSelected] = useState<string | string[] | null>(null);
  const [practiceShowAnswer, setPracticeShowAnswer] = useState(false);

  useEffect(() => {
    void loadMistakeQuestions();
  }, []);

  const loadMistakeQuestions = async () => {
    const storedMistakes = typeof window !== 'undefined'
      ? localStorage.getItem('mistakeBook')
      : null;

    if (!storedMistakes) {
      setMistakeQuestions([]);
      return;
    }

    let rawMistakes: any[] = [];
    try {
      rawMistakes = JSON.parse(storedMistakes) || [];
      if (!Array.isArray(rawMistakes)) {
        rawMistakes = [];
      }
    } catch {
      setMistakeQuestions([]);
      return;
    }

    // 尝试从统一题库中重新匹配题目，确保使用多语言 content/options/explanation
    try {
      const pkg = await loadUnifiedQuestionsPackage();
      const allQuestions = (pkg?.questions || []) as PackageQuestion[];

      const byHash = new Map<string, PackageQuestion>();
      const byId = new Map<number, PackageQuestion>();
      allQuestions.forEach((q) => {
        if (q.hash) {
          byHash.set(q.hash, q);
        }
        if (typeof q.id === 'number') {
          byId.set(q.id, q);
        }
      });

      const merged: Question[] = rawMistakes.map((item: any) => {
        const storedHash: string | null =
          item.hash ||
          (typeof item.id === 'number' ? String(item.id) : null);

        const canonical =
          (storedHash && byHash.get(storedHash)) ||
          (typeof item.id === 'number' ? byId.get(item.id) : undefined);

        if (!canonical) {
          // 找不到题库中的题目时，保留原始数据作为回退
          return item as Question;
        }

        return {
          // 以题库中的结构为基础（包含多语言 content/options/explanation）
          id: canonical.id as number,
          type: canonical.type as any,
          content: canonical.content as any,
          image: (canonical as any).image,
          options: (canonical as any).options,
          correctAnswer: canonical.correctAnswer ?? (canonical as any).correct_answer ?? (canonical as any).correctAnswer,
          explanation: (canonical as any).explanation,
          hash: (canonical as any).hash,

          // 叠加错题来源信息（来源于 localStorage）
          fromExam: item.fromExam,
          fromStudy: item.fromStudy,
          fromFavorites: item.fromFavorites,
          examId: item.examId,
          examTitle: item.examTitle,
          studySetId: item.studySetId,
          studySetTitle: item.studySetTitle,
          studyLicenseType: item.studyLicenseType ?? item.examLicenseType ?? null,
          studyStage: item.studyStage ?? item.examStage ?? null,
          examLicenseType: item.examLicenseType ?? null,
          examStage: item.examStage ?? null,
        };
      });

      setMistakeQuestions(merged);
    } catch {
      // 如果题库加载失败，退回到原始本地数据（可能是单语言字符串）
      setMistakeQuestions(rawMistakes as Question[]);
    }
  };

  const removeMistakeQuestion = (questionId: number) => {
    const updatedMistakes = mistakeQuestions.filter(q => q.id !== questionId);
    setMistakeQuestions(updatedMistakes);
    localStorage.setItem('mistakeBook', JSON.stringify(updatedMistakes));
  };

 const clearAllMistakes = () => {
    setMistakeQuestions([]);
    localStorage.setItem('mistakeBook', '[]');
  };

  const getQuestionIcon = (question: Question) => {
    // 处理多语言content字段
    const contentText = getQuestionContent(question.content, language) || getContentText(question.content, 'zh') || '';
    
    if (question.fromExam) {
      return <CheckSquare className="h-5 w-5 text-purple-600" />;
    } else if (contentText.includes('学科') || contentText.includes('讲习')) {
      return <BookOpen className="h-5 w-5 text-blue-600" />;
    } else if (contentText.includes('仮免')) {
      return <Car className="h-5 w-5 text-green-600" />;
    } else {
      return <Shield className="h-5 w-5 text-orange-600" />;
    }
  };

  const getQuestionTypeText = (type: string) => {
    switch (type) {
      case 'single': return t('mistakes.type.single');
      case 'multiple': return t('mistakes.type.multiple');
      case 'truefalse': return t('mistakes.type.truefalse');
      default: return t('mistakes.type.question');
    }
  };

  const resetPracticeState = () => {
    setPracticeSelected(null);
    setPracticeShowAnswer(false);
  };

  const isPracticeCorrect = (question: Question, answer: string | string[] | null): boolean => {
    if (!answer) return false;

    const correct = question.correctAnswer;

    if (Array.isArray(correct)) {
      const ansArray = Array.isArray(answer) ? answer : [answer];
      return (
        ansArray.length === correct.length &&
        ansArray.every((a) => correct.includes(a))
      );
    }

    if (question.type === 'truefalse') {
      const correctValue =
        typeof correct === 'boolean' ? String(correct) : correct;
      const answerValue = Array.isArray(answer) ? String(answer[0]) : String(answer);
      return correctValue === answerValue;
    }

    const answerValue = Array.isArray(answer) ? String(answer[0]) : String(answer);
    return answerValue === String(correct);
  };

  const handlePracticeAnswer = (question: Question, optionLabel: string) => {
    if (question.type === 'multiple') {
      setPracticeSelected((prev) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        let next: string[];
        if (prevArray.includes(optionLabel)) {
          next = prevArray.filter((a) => a !== optionLabel);
        } else {
          next = [...prevArray, optionLabel];
        }

        // 多选：当选择数量与正确答案数量相同时，自动判题
        const correct = question.correctAnswer;
        if (Array.isArray(correct) && next.length === correct.length) {
          setPracticeShowAnswer(true);
        } else {
          setPracticeShowAnswer(false);
        }

        return next;
      });
    } else {
      setPracticeSelected(optionLabel);
      setPracticeShowAnswer(true);
    }
  };

  if (selectedQuestion) {
    const currentIndex = mistakeQuestions.findIndex(
      (q) => q.id === selectedQuestion.id
    );
    const hasPrev = currentIndex > 0;
    const hasNext =
      currentIndex >= 0 && currentIndex < mistakeQuestions.length - 1;

    const options =
      selectedQuestion.options && selectedQuestion.options.length > 0
        ? getQuestionOptions(selectedQuestion.options as any, language)
        : [];

    return (
      <div className="container mx-auto px-4 py-6 pb-24">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => setSelectedQuestion(null)}
            className="text-gray-600 hover:text-gray-900 dark:text-ios-dark-text-secondary dark:hover:text-ios-dark-text"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">
            {t('mistakes.detail')}
          </h1>
        </div>

        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {getQuestionTypeText(selectedQuestion.type)}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowAIDialog(true)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
                  aria-label={t('mistakes.openAI')}
                >
                  <Bot className="h-4 w-4" />
                  <span>{t('mistakes.aiAssistant')}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMistakeQuestion(selectedQuestion.id);
                    setSelectedQuestion(null); // 返回到错题列表页面
                  }}
                  className="flex items-center space-x-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm">{t('mistakes.remove')}</span>
                </button>
              </div>
            </div>
            
            <p className="text-gray-900 dark:text-ios-dark-text text-lg mb-4">
              {getQuestionContent(selectedQuestion.content, language) || getContentText(selectedQuestion.content, 'zh') || ''}
            </p>
            {selectedQuestion.image && (
              <QuestionImage
                src={selectedQuestion.image}
                alt={t('mistakes.image')}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 800px"
                className="relative w-full aspect-video"
              />
            )}
            
            {selectedQuestion.type === 'truefalse' ? (
              <div className="space-y-3">
                {['true', 'false'].map((option) => {
                  const isSelected =
                    (Array.isArray(practiceSelected)
                      ? practiceSelected[0]
                      : practiceSelected) === option;
                  const isCorrectOption =
                    (selectedQuestion.correctAnswer === 'true' &&
                      option === 'true') ||
                    (selectedQuestion.correctAnswer === 'false' &&
                      option === 'false');

                  return (
                    <button
                      key={option}
                      onClick={() => handlePracticeAnswer(selectedQuestion, option)}
                      disabled={practiceShowAnswer}
                      className={`w-full p-4 rounded-xl text-left transition-colors ${
                        practiceShowAnswer
                          ? isCorrectOption
                            ? 'bg-green-50 dark:bg-green-900/30 border-2 border-green-500'
                            : isSelected
                            ? 'bg-red-50 dark:bg-red-900/30 border-2 border-red-500'
                            : 'bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent dark:border-ios-dark-border'
                          : isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-600'
                          : 'bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent dark:border-ios-dark-border hover:bg-gray-100 dark:hover:bg-ios-dark-bg-tertiary/80'
                      }`}
                    >
                      {option === 'true' ? t('mistakes.true') : t('mistakes.false')}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {options.map((option, index) => {
                  const optionLabel = String.fromCharCode(65 + index);
                  const isSelected = Array.isArray(practiceSelected)
                    ? practiceSelected.includes(optionLabel)
                    : practiceSelected === optionLabel;
                  const correct = selectedQuestion.correctAnswer;
                  const isCorrectOption = Array.isArray(correct)
                    ? correct.includes(optionLabel)
                    : correct === optionLabel;

                  return (
                    <button
                      key={index}
                      onClick={() => handlePracticeAnswer(selectedQuestion, optionLabel)}
                      disabled={practiceShowAnswer && selectedQuestion.type !== 'multiple'}
                      className={`w-full p-4 rounded-xl text-left transition-colors ${
                        practiceShowAnswer
                          ? isCorrectOption
                            ? 'bg-green-50 dark:bg-green-900/30 border-2 border-green-500'
                            : isSelected
                            ? 'bg-red-50 dark:bg-red-900/30 border-2 border-red-500'
                            : 'bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent dark:border-ios-dark-border'
                          : isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-600'
                          : 'bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent dark:border-ios-dark-border hover:bg-gray-100 dark:hover:bg-ios-dark-bg-tertiary/80'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-ios-dark-text">
                        {optionLabel}:{' '}
                      </span>
                      <span className="text-gray-900 dark:text-ios-dark-text">
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {practiceShowAnswer && (
            <div className="mt-6 p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
              <h3 className="text-gray-800 dark:text-ios-dark-text font-medium mb-1">
                {isPracticeCorrect(selectedQuestion, practiceSelected)
                  ? t('question.correctAnswer')
                  : t('question.wrongAnswer')}
              </h3>
            </div>
          )}

          {selectedQuestion.explanation && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                {t('mistakes.explanation')}
              </h3>
              <p className="text-blue-800 dark:text-blue-200">
                {typeof selectedQuestion.explanation === 'string' 
                  ? selectedQuestion.explanation 
                  : getQuestionContent(selectedQuestion.explanation as any, language) || ''}
              </p>
            </div>
          )}

          {/* 错题内上一题 / 下一题导航 */}
          {mistakeQuestions.length > 1 && currentIndex !== -1 && (
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-ios-dark-border flex justify-between items-center">
              <button
                onClick={() => {
                  if (hasPrev) {
                    resetPracticeState();
                    setSelectedQuestion(mistakeQuestions[currentIndex - 1]);
                  }
                }}
                disabled={!hasPrev}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                  !hasPrev
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 dark:text-ios-dark-text-secondary dark:hover:text-ios-dark-text'
                }`}
              >
                <ChevronLeft className="h-5 w-5" />
                <span>{t('mistakes.previous')}</span>
              </button>

              <span className="text-xs text-gray-500 dark:text-ios-dark-text-secondary">
                {currentIndex + 1}/{mistakeQuestions.length}
              </span>

              <button
                onClick={() => {
                  if (hasNext) {
                    resetPracticeState();
                    setSelectedQuestion(mistakeQuestions[currentIndex + 1]);
                  }
                }}
                disabled={!hasNext}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                  !hasNext
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 dark:text-ios-dark-text-secondary dark:hover:text-ios-dark-text'
                }`}
              >
                <span>{t('mistakes.next')}</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

      {/* AI助手对话框 */}
      {selectedQuestion && (
        <QuestionAIDialog
          question={selectedQuestion}
          isOpen={showAIDialog}
          onClose={() => setShowAIDialog(false)}
        />
      )}
    </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      <div className="flex items-center space-x-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-ios-dark-text">
          {t('mistakes.title')}
        </h1>
        {mistakeQuestions.length > 0 && (
          <div className="ml-auto flex items-center space-x-3">
            <button
              onClick={() => {
                // 从第一题开始错题练习（在当前页面内导航）
                resetPracticeState();
                setSelectedQuestion(mistakeQuestions[0]);
              }}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
            >
              {t('mistakes.practice')}
            </button>
            <button
              onClick={clearAllMistakes}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm"
            >
              {t('mistakes.clearAll')}
            </button>
          </div>
        )}
      </div>

      {mistakeQuestions.length === 0 ? (
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-12 shadow-sm dark:shadow-ios-dark-sm text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-ios-dark-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
            <XSquare className="h-8 w-8 text-gray-400 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-ios-dark-text mb-2">
            {t('mistakes.empty')}
          </h3>
          <p className="text-gray-600 dark:text-ios-dark-text-secondary">
            {t('mistakes.emptyDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {mistakeQuestions.map((question, index) => (
            <div
              key={`${question.id}-${index}`}
              className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-4 shadow-sm dark:shadow-ios-dark-sm hover:shadow-md dark:hover:shadow-ios-dark-sm transition-shadow cursor-pointer"
              onClick={() => setSelectedQuestion(question)}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getQuestionIcon(question)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-ios-dark-text line-clamp-2">
                      {index + 1}. {getQuestionContent(question.content, language) || getContentText(question.content, 'zh') || ''}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMistakeQuestion(question.id);
                      }}
                      className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:text-ios-dark-text-secondary dark:hover:text-red-400 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-ios-dark-text-secondary">
                    <span>{getQuestionTypeText(question.type)}</span>
                    {question.fromExam && question.examTitle && (
                      <span className="bg-purple-10 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-2 py-1 rounded-full">
                        {question.examTitle}
                      </span>
                    )}
                    {question.fromStudy && question.studySetTitle && (
                      <span className="bg-blue-10 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-full">
                        {question.studySetTitle}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MistakeBookPage;
