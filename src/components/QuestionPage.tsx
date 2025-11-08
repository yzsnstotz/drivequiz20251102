import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Bot } from 'lucide-react';
import QuestionAIDialog from './QuestionAIDialog';

interface Question {
  id: number;
  type: 'single' | 'multiple' | 'truefalse';
  content: string;
  image?: string;
  options?: string[];
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
        const response = await import(`../data/questions/zh/${questionSet.title}.json`);
        setQuestions(response.questions);
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
  }, [questionSet.title]);

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
          <p className="text-gray-600">加载题目中...</p>
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
      const selectedArray = Array.isArray(selectedAnswer) ? selectedAnswer : [];
      return (
        selectedArray.length === currentQuestion.correctAnswer.length &&
        selectedArray.every(answer => currentQuestion.correctAnswer.includes(answer))
      );
    }
    return selectedAnswer === currentQuestion.correctAnswer;
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
          <p className="text-gray-900 text-lg mb-4">{currentQuestion.content}</p>
          {currentQuestion.image && (
            <div className="mb-4">
              <Image
                src={currentQuestion.image}
                alt="题目图片"
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
                  {option === 'true' ? '正确' : '错误'}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {currentQuestion.options?.map((option, index) => {
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
            <span>上一题</span>
          </button>

          {/* {showAnswer && (
            <div className={`text-${isCorrect() ? 'green' : 'red'}-600 font-medium`}>
              {isCorrect() ? '回答正确！' : '回答错误'}
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
            <span>下一题</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {showAnswer && (
          <div className="mt-6 p-4 rounded-lg border bg-blue-50 border-blue-200 animate-fadeIn">
            <h3 className="text-gray-800 font-medium mb-2">
              {isCorrect() ? '答对了！' : '答错了...'}
            </h3>
            {currentQuestion.explanation && (
              <p className="text-gray-700">{currentQuestion.explanation}</p>
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