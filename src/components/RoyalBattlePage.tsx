import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Heart, Timer, Trophy } from 'lucide-react';
import QuestionImage from './common/QuestionImage';
import { isValidImageUrl } from '@/lib/imageUtils';
import { loadAllQuestions, Question } from '@/lib/questionsLoader';
import { useLanguage } from '@/lib/i18n';
import { getQuestionContent, getQuestionOptions } from '@/lib/questionUtils';

interface RoyalBattlePageProps {
  onBack: () => void;
}

function RoyalBattlePage({ onBack }: RoyalBattlePageProps) {
  const { language } = useLanguage();
  const [lives, setLives] = useState(5);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(20.0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[]>('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);

  // 计算当前题目的时间限制
  const calculateTimeLimit = (currentScore: number) => {
    // 每100分减少2秒，最低3秒
    const reduction = Math.floor(currentScore / 100) * 2;
    return Math.max(20 - reduction, 3);
  };

  // 加载并打乱所有题目
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        // 通过版本检查与缓存的统一加载器获取题库
        const allQuestions = await loadAllQuestions();
        if (!allQuestions || allQuestions.length === 0) {
          console.error('加载题目失败：未找到题目数据');
          return;
        }

        // Fisher-Yates 洗牌算法
        for (let i = allQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
        }

        setQuestions(allQuestions);
      } catch (error) {
        console.error('加载题目失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestions();
  }, []);

  const handleTimeout = useCallback(() => {
    setLives((prev) => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        setGameOver(true);
      }
      return newLives;
    });
    setShowAnswer(true);
  }, []);

  // 倒计时逻辑
  useEffect(() => {
    if (gameOver || showAnswer || isLoading) return;

    const startTime = Date.now();
    const initialTime = timeLeft;

    const timer = setInterval(() => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      const newTime = Math.max(initialTime - elapsedTime, 0);

      if (newTime <= 0) {
        clearInterval(timer);
        handleTimeout();
        setTimeLeft(0);
      } else {
        setTimeLeft(newTime);
      }
    }, 50); // 更新频率提高到50ms以获得更平滑的效果

    return () => clearInterval(timer);
  }, [currentQuestionIndex, gameOver, showAnswer, isLoading, timeLeft, handleTimeout]);

  const handleAnswer = (answer: string) => {
    if (showAnswer || gameOver) return;

    const currentQuestion = questions[currentQuestionIndex];
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

  const isCorrect = (answer: string | string[]) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (Array.isArray(currentQuestion.correctAnswer)) {
      // 多选题：比较数组
      const selectedArray = Array.isArray(answer) ? answer : [];
      return (
        selectedArray.length === currentQuestion.correctAnswer.length &&
        selectedArray.every(a => currentQuestion.correctAnswer.includes(a))
      );
    } else if (currentQuestion.type === 'truefalse') {
      // 判断题：需要统一类型比较（correctAnswer可能是布尔值，answer是字符串）
      const correctAnswerValue = typeof currentQuestion.correctAnswer === 'boolean' 
        ? String(currentQuestion.correctAnswer) 
        : currentQuestion.correctAnswer;
      const answerValue = typeof answer === 'string' ? answer : String(answer);
      return correctAnswerValue === answerValue;
    } else {
      // 单选题：直接比较
      return answer === currentQuestion.correctAnswer;
    }
  };

  const checkAnswer = (answer: string | string[]) => {
    setShowAnswer(true);
    
    if (isCorrect(answer)) {
      setScore(prev => {
        const newScore = prev + 10;
        // 使用setTimeout让分数变化有延迟，配合CSS动画
        setTimeout(() => {
          handleNext();
        }, 1000);
        return newScore;
      });
    } else {
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setGameOver(true);
        }
        // 使用setTimeout让生命值变化有延迟，配合CSS动画
        setTimeout(() => {
          handleNext();
        }, 1000);
        return newLives;
      });
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer('');
      setShowAnswer(false);
      setTimeLeft(calculateTimeLimit(score));
    }
  };

  const currentQuestion = questions[currentQuestionIndex];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={onBack}
            className="text-gray-600 dark:text-ios-dark-text-secondary hover:text-gray-900 dark:hover:text-ios-dark-text"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">大乱斗</h1>
        </div>
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6 flex justify-center items-center">
          <p className="text-gray-600 dark:text-ios-dark-text-secondary">加载题目中...</p>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={onBack}
            className="text-gray-600 dark:text-ios-dark-text-secondary hover:text-gray-900 dark:hover:text-ios-dark-text"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">游戏结束</h1>
        </div>
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6">
          <div className="text-center">
            <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-ios-dark-text mb-2">最终得分: {score}</h2>
            <p className="text-gray-600 dark:text-ios-dark-text-secondary mb-6">答对题目数: {Math.floor(score / 10)}</p>
            <button
              onClick={onBack}
              className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={onBack}
          className="text-gray-600 dark:text-ios-dark-text-secondary hover:text-gray-900 dark:hover:text-ios-dark-text"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">大乱斗</h1>
      </div>

      <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6">
        
        <div className="flex justify-center items-center">
            <div className="w-full">
              <div className="w-full bg-gray-200 dark:bg-ios-dark-bg-tertiary h-2 overflow-hidden rounded-full">
                <div
                  className={`h-full transition-all duration-100 rounded-full ${timeLeft <= 5 ? 'bg-red-600' : 'bg-blue-600'}`}
                  style={{ width: `${(timeLeft / calculateTimeLimit(score)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        <div className="relative mb-12">
          <div className="absolute left-0 top-0 flex items-center space-x-4">
            <div className="bg-gray-50 dark:bg-ios-dark-bg-tertiary p-2 rounded-xl flex items-center">
              <div className="flex items-center space-x-0.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Heart
                    key={index}
                    className={`h-5 w-5 transition-all duration-500 transform ${index < lives ? 'text-red-500 fill-current scale-105 animate-pulse' : 'text-gray-300 dark:text-ios-dark-text-tertiary scale-95 opacity-50'}`}
                  />
                ))}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-ios-dark-bg-tertiary p-2 rounded-xl flex items-center">
              <Trophy className="h-5 w-5 text-yellow-500 mr-2" />
              <span className="text-xl font-bold text-gray-900 dark:text-ios-dark-text font-mono text-green-600 dark:text-green-400">{score}</span>
            </div>
            <div className="bg-gray-50 dark:bg-ios-dark-bg-tertiary p-2 rounded-xl flex items-center">
              <Timer className="h-5 w-5 text-blue-500 mr-2" />
              <span className={`text-xl font-bold font-mono ${timeLeft <= 5 ? 'text-red-600' : 'text-gray-900 dark:text-ios-dark-text'}`}>
                {timeLeft.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        <div className="mb-6">
          <p className="text-gray-900 dark:text-ios-dark-text text-lg mb-4">{getQuestionContent(currentQuestion.content as any, language as 'zh' | 'en' | 'ja') || ''}</p>
          {isValidImageUrl(currentQuestion.image) && (
            <QuestionImage
              src={currentQuestion.image!}
              alt="题目图片"
              width={800}
              height={600}
            />
          )}
          
          {currentQuestion.type === 'truefalse' ? (
            <div className="space-y-3">
              {['true', 'false'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  disabled={showAnswer}
                  className={`w-full p-4 rounded-xl text-left ${showAnswer ? 'cursor-not-allowed' : ''} ${
                    selectedAnswer === option
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-600 dark:border-blue-500'
                      : 'bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent'
                  } text-gray-900 dark:text-ios-dark-text`}
                >
                  {option === 'true' ? '正确' : '错误'}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {getQuestionOptions(currentQuestion.options as any, language as 'zh' | 'en' | 'ja').map((option, index) => {
                const optionLabel = String.fromCharCode(65 + index);
                const isSelected = Array.isArray(selectedAnswer)
                  ? selectedAnswer.includes(optionLabel)
                  : selectedAnswer === optionLabel;

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(optionLabel)}
                    disabled={showAnswer}
                    className={`w-full p-4 rounded-xl text-left ${showAnswer ? 'cursor-not-allowed' : ''} ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-600 dark:border-blue-500'
                        : 'bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent'
                    } text-gray-900 dark:text-ios-dark-text`}
                  >
                    <span className="font-medium">{optionLabel}: </span>
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {showAnswer && (
          <div className="mt-6 p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 animate-fadeIn">
            <h3 className="text-gray-800 dark:text-ios-dark-text font-medium mb-2">
              {isCorrect(selectedAnswer) ? '答对了！' : '答错了...'}
            </h3>
            {currentQuestion.explanation && (
              <p className="text-gray-700 dark:text-ios-dark-text-secondary">{getQuestionContent(currentQuestion.explanation as any, language as 'zh' | 'en' | 'ja') || ''}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RoyalBattlePage;