"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Header from "@/components/common/Header";
import AdSlot from "@/components/common/AdSlot";
import QuestionAIDialog from "@/components/QuestionAIDialog";
import { ArrowLeft, Clock, Bot } from "lucide-react";

interface Question {
  id: number;
  type: "single" | "multiple" | "truefalse";
  content: string;
  options?: string[];
  correctAnswer: string | string[];
  image?: string;
  explanation?: string;
}

export default function LicenseExamPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const setId = params?.setId as string;
  const licenseType = searchParams.get("type") || "provisional";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60分钟
  const [examStarted, setExamStarted] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAIDialog, setShowAIDialog] = useState(false);

  const finishExam = useCallback(() => {
    setExamFinished(true);
    setExamStarted(false);
  }, []);

  useEffect(() => {
    if (examStarted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            finishExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [examStarted, timeLeft, finishExam]);

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 使用新的API接口加载题目
      const queryParams = new URLSearchParams({
        licenseType: licenseType,
        page: "1",
        limit: "1000", // 先加载所有题目，然后随机选择
        sortBy: "id",
        order: "asc",
      });
      
      const response = await fetch(`/api/exam/${setId}?${queryParams.toString()}`);
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.message || "加载题目失败");
      }
      
      const allQuestions = result.data || [];
      // 随机选择50道题目
      const selectedQuestions = allQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, 50);
      setQuestions(selectedQuestions);
      setExamStarted(true);
    } catch (err) {
      console.error("加载题目失败:", err);
      setError(err instanceof Error ? err.message : "加载题目失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [setId, licenseType]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleAnswer = (answer: string) => {
    const currentQuestion = questions[currentIndex];
    if (currentQuestion.type === "multiple") {
      const prevArray = Array.isArray(answers[currentIndex]) ? answers[currentIndex] : [];
      if (prevArray.includes(answer)) {
        setAnswers({
          ...answers,
          [currentIndex]: prevArray.filter((a) => a !== answer),
        });
      } else {
        setAnswers({
          ...answers,
          [currentIndex]: [...prevArray, answer],
        });
      }
    } else {
      setAnswers({
        ...answers,
        [currentIndex]: answer,
      });
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((question, index) => {
      const userAnswer = answers[index];
      if (Array.isArray(question.correctAnswer)) {
        const userArray = Array.isArray(userAnswer) ? userAnswer : [];
        const correctArray = question.correctAnswer;
        if (
          userArray.length === correctArray.length &&
          userArray.every((ans) => correctArray.includes(ans))
        ) {
          correct++;
        }
      } else {
        if (userAnswer === question.correctAnswer) {
          correct++;
        }
      }
    });
    return { correct, total: questions.length, percentage: Math.round((correct / questions.length) * 100) };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="考试" showAIButton={false} />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="考试" showAIButton={false} />
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-red-600 mb-4">{error || "没有找到题目"}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  if (examFinished) {
    const score = calculateScore();
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="考试结果" showAIButton={false} />
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">考试完成</h2>
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-blue-600 mb-2">{score.percentage}%</div>
              <p className="text-gray-600">
                正确: {score.correct} / {score.total}
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => router.push("/license")}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                返回
              </button>
              <button
                onClick={() => {
                  setExamFinished(false);
                  setExamStarted(true);
                  setTimeLeft(60 * 60);
                  setAnswers({});
                  setCurrentIndex(0);
                  loadQuestions();
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                重新考试
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex] || (currentQuestion.type === "multiple" ? [] : "");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="考试" showAIButton={false} />
      
      {/* 广告位 */}
      <div className="container mx-auto px-4 py-4">
        <AdSlot position="license_exam" />
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* 考试信息栏 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-gray-600" />
                <span className="text-lg font-semibold text-gray-900">{formatTime(timeLeft)}</span>
              </div>
              <span className="text-gray-600">
                题目 {currentIndex + 1} / {questions.length}
              </span>
            </div>
            <button
              onClick={finishExam}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              提交试卷
            </button>
          </div>
        </div>

        {/* 题目卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">{currentQuestion.content}</h2>
            <button
              onClick={() => setShowAIDialog(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              aria-label="打开AI助手"
            >
              <Bot className="h-4 w-4" />
              <span>AI助手</span>
            </button>
          </div>

          {currentQuestion.image && (
            // eslint-disable-next-line @next/next/no-img-element -- 题目图片可能来自动态第三方域名，未知尺寸
            <img
              src={currentQuestion.image}
              alt="题目图片"
              className="w-full max-w-md mx-auto mb-4 rounded-lg"
            />
          )}

          {currentQuestion.type !== "truefalse" && currentQuestion.options && (
            <div className="space-y-2 mb-4">
              {currentQuestion.options.map((option, index) => {
                const isSelected = Array.isArray(currentAnswer)
                  ? currentAnswer.includes(option)
                  : currentAnswer === option;

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(option)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {currentQuestion.type === "truefalse" && (
            <div className="space-y-2 mb-4">
              <button
                onClick={() => handleAnswer("true")}
                className={`w-full p-3 rounded-lg border-2 transition-colors ${
                  currentAnswer === "true"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                正确
              </button>
              <button
                onClick={() => handleAnswer("false")}
                className={`w-full p-3 rounded-lg border-2 transition-colors ${
                  currentAnswer === "false"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                错误
              </button>
            </div>
          )}

          {/* 导航按钮 */}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一题
            </button>
            <button
              onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一题
            </button>
          </div>
        </div>

        {/* 题目导航网格 */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">题目导航</h3>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`p-2 rounded text-sm ${
                  index === currentIndex
                    ? "bg-blue-600 text-white"
                    : answers[index]
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
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

