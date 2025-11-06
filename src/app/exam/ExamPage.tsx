"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Clock, CheckSquare, XSquare } from 'lucide-react';

interface Question {
  id: number;
  type: 'single' | 'multiple' | 'truefalse';
  content: string;
  image?: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
}

interface ExamSet {
  id: string;
  title: string;
  totalQuestions: number;
  timeLimit: number; // in minutes
}

const examSets: ExamSet[] = [
  {
    id: "exam-1",
    title: "模拟考试-1",
    totalQuestions: 50,
    timeLimit: 60,
  },
 {
    id: "exam-2",
    title: "模拟考试-2",
    totalQuestions: 50,
    timeLimit: 60,
  },
  {
    id: "exam-3",
    title: "模拟考试-3",
    totalQuestions: 50,
    timeLimit: 60,
  },
  {
    id: "exam-4",
    title: "模拟考试-4",
    totalQuestions: 50,
    timeLimit: 60,
  },
  {
    id: "exam-5",
    title: "模拟考试-5",
    totalQuestions: 50,
    timeLimit: 60,
  },
];

function ExamPage() {
  const [selectedSet, setSelectedSet] = useState<ExamSet | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[]>('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [wrongQuestions, setWrongQuestions] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (selectedSet && examStarted) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [selectedSet, examStarted]);

  const startExam = (examSet: ExamSet) => {
    setSelectedSet(examSet);
    setTimeLeft(examSet.timeLimit * 60); // convert to seconds
    setExamStarted(true);
    setAnsweredQuestions(new Set());
    setWrongQuestions(new Set());
    
    // Load questions from the same source as study page
    const loadQuestions = async () => {
      try {
        // For exam, we'll use a random selection of questions from existing sets
        // For now, let's use a specific set as example
        const response = await import(`../../data/questions/zh/仮免-1.json`);
        const allQuestions = response.questions;
        
        // Randomly select questions for the exam
        const selectedQuestions = allQuestions
          .sort(() => Math.random() - 0.5)
          .slice(0, examSet.totalQuestions);
        
        // Type assertion to ensure correct typing
        setQuestions(selectedQuestions as Question[]);
        setCurrentQuestionIndex(0);
        setSelectedAnswer('');
        setShowAnswer(false);
        setIsLoading(false);
      } catch (error) {
        console.error('加载题目失败:', error);
        setIsLoading(false);
      }
    };

    loadQuestions();
  };

  const handleAnswer = (answer: string) => {
    if (questions[currentQuestionIndex].type === 'multiple') {
      setSelectedAnswer((prev: string | string[]) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        if (prevArray.includes(answer)) {
          return prevArray.filter(a => a !== answer);
        }
        const newAnswer = [...prevArray, answer];
        if (newAnswer.length === questions[currentQuestionIndex].correctAnswer.length) {
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
    
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = Array.isArray(currentQuestion.correctAnswer)
      ? Array.isArray(answer) &&
        answer.length === currentQuestion.correctAnswer.length &&
        answer.every(a => currentQuestion.correctAnswer.includes(a))
      : answer === currentQuestion.correctAnswer;

    // Add to answered questions
    const newAnsweredQuestions = new Set(answeredQuestions);
    newAnsweredQuestions.add(currentQuestionIndex);
    setAnsweredQuestions(newAnsweredQuestions);

    // Add to wrong questions if incorrect
    if (!isCorrect) {
      const newWrongQuestions = new Set(wrongQuestions);
      newWrongQuestions.add(currentQuestionIndex);
      
      // Add to local storage for mistake book
      const mistakeBook = JSON.parse(localStorage.getItem('mistakeBook') || '[]');
      const questionToAdd = {
        ...currentQuestion,
        fromExam: true,
        examId: selectedSet?.id,
        examTitle: selectedSet?.title
      };
      
      // Check if question already exists in mistake book
      const exists = mistakeBook.some((q: any) => q.id === currentQuestion.id && q.fromExam === true);
      if (!exists) {
        mistakeBook.push(questionToAdd);
        localStorage.setItem('mistakeBook', JSON.stringify(mistakeBook));
      }
      
      setWrongQuestions(newWrongQuestions);
    }

    // Add to practice history
    const practiceHistory = JSON.parse(localStorage.getItem('practiceHistory') || '[]');
    const practiceItem = {
      id: `exam-${selectedSet?.id}-${currentQuestionIndex}-${Date.now()}`,
      questionId: currentQuestion.id,
      content: currentQuestion.content,
      type: currentQuestion.type,
      correct: isCorrect,
      date: new Date().toLocaleString('zh-CN'),
      from: 'exam'
    };
    practiceHistory.push(practiceItem);
    // Keep only last 50 items
    const recentPracticeHistory = practiceHistory.slice(-50);
    localStorage.setItem('practiceHistory', JSON.stringify(recentPracticeHistory));

    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer('');
        setShowAnswer(false);
      } else {
        // Exam completed - save exam history
        const examHistory = JSON.parse(localStorage.getItem('examHistory') || '[]');
        const examResult = {
          id: selectedSet?.id,
          title: selectedSet?.title,
          score: answeredQuestions.size - wrongQuestions.size + (isCorrect ? 1 : 0), // Include current question
          totalQuestions: questions.length,
          date: new Date().toLocaleString('zh-CN'),
          timeSpent: (selectedSet?.timeLimit || 60) * 60 - timeLeft
        };
        examHistory.push(examResult);
        localStorage.setItem('examHistory', JSON.stringify(examHistory));
        
        setExamStarted(false);
      }
    }, 1500);
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
    const currentQuestion = questions[currentQuestionIndex];
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
    const correctCount = answeredQuestions.size - wrongQuestions.size;
    return Math.round((correctCount / answeredQuestions.size) * 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!selectedSet) {
    return (
      <div className="container mx-auto px-4 py-6 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">模拟考试</h1>
          <p className="text-gray-600">选择一套模拟考试开始练习</p>
        </div>

        <div className="grid gap-4">
          {examSets.map((examSet) => (
            <button
              key={examSet.id}
              onClick={() => startExam(examSet)}
              className="bg-white rounded-2xl p-6 text-left shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{examSet.title}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>{examSet.totalQuestions} 题目</span>
                    <span>{examSet.timeLimit} 分钟</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-blue-600 font-medium">{examSet.timeLimit}分钟</div>
                  <div className="text-sm text-gray-500">限时</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading || !examStarted) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => setSelectedSet(null)}
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{selectedSet.title}</h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 flex justify-center items-center">
          <p className="text-gray-600">加载考试中...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => setSelectedSet(null)}
          className="text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{selectedSet.title}</h1>
        <div className="ml-auto flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm">
            <Clock className="h-4 w-4 text-gray-600" />
            <span className={`font-medium ${timeLeft < 300 ? 'text-red-600' : 'text-gray-600'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
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
          <span className="text-sm font-medium text-blue-600">
            {currentQuestion.type === 'single' ? '单选题' : 
             currentQuestion.type === 'multiple' ? '多选题' : '判断题'}
          </span>
        </div>

        <div className="mb-6">
          <p className="text-gray-900 text-lg mb-4">{currentQuestion.content}</p>
          {currentQuestion.image && (
            <div className="mb-4 relative w-full aspect-video">
              <Image
                src={currentQuestion.image}
                alt="题目图片"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 800px"
                className="object-contain rounded-lg shadow-sm"
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
          <div className={`mt-6 p-4 rounded-lg border animate-fadeIn ${
            isCorrect() 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <h3 className="font-medium mb-2">
              {isCorrect() ? (
                <div className="flex items-center">
                  <CheckSquare className="h-5 w-5 mr-2" />
                  答对了！
                </div>
              ) : (
                <div className="flex items-center">
                  <XSquare className="h-5 w-5 mr-2" />
                  答错了...
                </div>
              )}
            </h3>
            {currentQuestion.explanation && (
              <p className="text-sm">{currentQuestion.explanation}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExamPage;
