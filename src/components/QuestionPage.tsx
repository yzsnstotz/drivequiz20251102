import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Bot } from 'lucide-react';
import QuestionAIDialog from './QuestionAIDialog';
import { loadUnifiedQuestionsPackage } from '@/lib/questionsLoader';
import { useLanguage } from '@/lib/i18n';
import { getQuestionContent, getQuestionOptions } from '@/lib/questionUtils';

interface Question {
  id: number;
  type: 'single' | 'multiple' | 'truefalse';
  content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
  image?: string;
  options?: string[] | Array<{ zh: string; en?: string; ja?: string; [key: string]: string | undefined }>;
  correctAnswer: string | string[];
  explanation?: string;
}

interface QuestionPageProps {
  questionSet: {
    id: string;
    title: string;
    totalQuestions: number;
  };
  onBack: () => void;
}

function QuestionPage({ questionSet, onBack }: QuestionPageProps) {
  const { language, t } = useLanguage();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[]>('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [showAIDialog, setShowAIDialog] = useState(false);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        // 通过版本检查与缓存的统一加载器获取题库，并按类别筛选
        const pkg = await loadUnifiedQuestionsPackage();
        
        // 优先使用当前语言的多语言包，如果没有则使用默认的questions
        let allQuestions: any[] = [];
        if (pkg?.questionsByLocale && pkg.questionsByLocale[language]) {
          allQuestions = pkg.questionsByLocale[language];
        } else {
          allQuestions = pkg?.questions || [];
        }
        
        const filtered = allQuestions.filter((q: any) => q.category === questionSet.title);
        if (filtered.length > 0) {
          setQuestions(filtered as unknown as Question[]);
        } else {
          // 兼容旧逻辑：尝试从指定文件读取
          const response = await import(`../data/questions/zh/${questionSet.title}.json`);
          setQuestions((response.questions || response.default?.questions || []) as unknown as Question[]);
        }
      } catch (error) {
        console.error('加载题目失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestions();

    // 从localStorage加载进度
    const savedProgress = localStorage.getItem(`progress_${questionSet.title}`);
    if (savedProgress) {
      const progress = JSON.parse(savedProgress);
      setCurrentQuestionIndex(progress.currentIndex);
      setCorrectAnswers(progress.correctAnswers);
      setAnsweredQuestions(new Set(progress.answeredQuestions));
    }
  }, [questionSet.title, language]);

  const saveProgress = (isAnswerCorrect: boolean) => {
    const newAnsweredQuestions = new Set(answeredQuestions);
    newAnsweredQuestions.add(currentQuestionIndex);
    setAnsweredQuestions(newAnsweredQuestions);

    const newCorrectAnswers = isAnswerCorrect ? correctAnswers + 1 : correctAnswers;
    setCorrectAnswers(newCorrectAnswers);
    
    // 保存进度到localStorage
    const progress = {
      currentIndex: currentQuestionIndex,
      correctAnswers: newCorrectAnswers,
      totalQuestions: questions.length,
      answeredQuestions: Array.from(newAnsweredQuestions)
    };
    localStorage.setItem(`progress_${questionSet.title}`, JSON.stringify(progress));
  };

  const currentQuestion = questions[currentQuestionIndex];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{questionSet.title}</h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 flex justify-center items-center">
          <p className="text-gray-600">{t('question.loading')}</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{questionSet.title}</h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 flex justify-center items-center">
          <p className="text-gray-600">暂无题目数据</p>
        </div>
      </div>
    );
  }

  const handleAnswer = (answer: string) => {
    if (currentQuestion.type === 'multiple') {
      setSelectedAnswer((prev: string | string[]) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        if (prevArray.includes(answer)) {
          return prevArray.filter(a => a !== answer);
        }
        const newAnswer = [...prevArray, answer];
        if (newAnswer.length === currentQuestion.correctAnswer.length) {
          checkAnswer(newAnswer);
        }
        return newAnswer;
      });
    } else {
      setSelectedAnswer(answer);
      checkAnswer(answer);
    }
  };

  const checkAnswer = (answer: string | string[]) => {
    setShowAnswer(true);
    saveProgress(isCorrect());
    
    // 使用setTimeout让答案展示有延迟，配合CSS动画
    // setTimeout(() => {
    //   handleNext();
    // }, 1000);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer('');
      setShowAnswer(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setSelectedAnswer('');
      setShowAnswer(false);
    }
  };

  const isCorrect = () => {
    if (Array.isArray(currentQuestion.correctAnswer)) {
      // 多选题：比较数组
      const selectedArray = Array.isArray(selectedAnswer) ? selectedAnswer : [];
      return (
        selectedArray.length === currentQuestion.correctAnswer.length &&
        selectedArray.every(answer => currentQuestion.correctAnswer.includes(answer))
      );
    } else if (currentQuestion.type === 'truefalse') {
      // 判断题：需要统一类型比较（correctAnswer可能是布尔值，selectedAnswer是字符串）
      const correctAnswerValue = typeof currentQuestion.correctAnswer === 'boolean' 
        ? String(currentQuestion.correctAnswer) 
        : currentQuestion.correctAnswer;
      const answerValue = typeof selectedAnswer === 'string' ? selectedAnswer : String(selectedAnswer);
      return correctAnswerValue === answerValue;
    } else {
      // 单选题：直接比较
      return selectedAnswer === currentQuestion.correctAnswer;
    }
  };

  const calculateProgress = () => {
    if (questions.length === 0) return 0;
    return Math.round((answeredQuestions.size / questions.length) * 100);
  };

  const calculateAccuracy = () => {
    if (answeredQuestions.size === 0) return 0;
    return Math.round((correctAnswers / answeredQuestions.size) * 100);
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{questionSet.title}</h1>
        <div className="ml-auto flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            进度: {calculateProgress()}%
          </span>
          <span className="text-sm text-blue-600">
            正确率: {calculateAccuracy()}%
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600">
            题目 {currentQuestionIndex + 1}/{questions.length}
          </span>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-blue-600">
              {currentQuestion.type === 'single' ? '单选题' : 
               currentQuestion.type === 'multiple' ? '多选题' : '判断题'}
            </span>
            <button
              onClick={() => setShowAIDialog(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              aria-label="打开AI助手"
            >
              <Bot className="h-4 w-4" />
              <span>AI助手</span>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-gray-900 text-lg mb-4">{getQuestionContent(currentQuestion.content, language) || ''}</p>
          {currentQuestion.image && (
            <div className="mb-4">
              <Image
                src={currentQuestion.image.trim()}
                alt={t('question.image')}
                width={800}
                height={600}
                className="max-w-full rounded-lg shadow-sm"
              />
            </div>
          )}
          
          {currentQuestion.type === 'truefalse' ? (
            <div className="space-y-3">
              {['true', 'false'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  className={`w-full p-4 rounded-xl text-left ${
                    selectedAnswer === option
                      ? 'bg-blue-50 border-2 border-blue-600'
                      : 'bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  {option === 'true' ? t('question.correct') : t('question.incorrect')}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {getQuestionOptions(currentQuestion.options, language).map((option, index) => {
                const optionLabel = String.fromCharCode(65 + index);
                const isSelected = Array.isArray(selectedAnswer)
                  ? selectedAnswer.includes(optionLabel)
                  : selectedAnswer === optionLabel;

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(optionLabel)}
                    className={`w-full p-4 rounded-xl text-left ${
                      isSelected
                        ? 'bg-blue-50 border-2 border-blue-600'
                        : 'bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border-t py-4 flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              currentQuestionIndex === 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
            <span>{t('question.previous')}</span>
          </button>

          {/* {showAnswer && (
            <div className={`text-${isCorrect() ? 'green' : 'red'}-600 font-medium`}>
              {isCorrect() ? t('question.correctAnswer') : t('question.wrongAnswer')}
            </div>
          )} */}

          <button
            onClick={handleNext}
            disabled={currentQuestionIndex === questions.length - 1}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              currentQuestionIndex === questions.length - 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{t('question.next')}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {showAnswer && (
          <div className="mt-6 p-4 rounded-lg border bg-blue-50 border-blue-200 animate-fadeIn">
            <h3 className="text-gray-800 font-medium mb-2">
              {isCorrect() ? t('question.correctAnswer') : t('question.wrongAnswer')}
            </h3>
            {currentQuestion.explanation && (
              <p className="text-gray-700">{getQuestionContent(currentQuestion.explanation as any, language) || (typeof currentQuestion.explanation === 'object' ? currentQuestion.explanation?.zh : currentQuestion.explanation) || ''}</p>
            )}
          </div>
        )}
      </div>

      {/* AI助手对话框 */}
      {currentQuestion && (
        <QuestionAIDialog
          question={currentQuestion}
          isOpen={showAIDialog}
          onClose={() => setShowAIDialog(false)}
        />
      )}
    </div>
  );
}

export default QuestionPage;