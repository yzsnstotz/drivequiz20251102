"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Header from "@/components/common/Header";
import AdSlot from "@/components/common/AdSlot";
import AIButton from "@/components/common/AIButton";
import QuestionAIDialog from "@/components/QuestionAIDialog";
import QuestionImage from "@/components/common/QuestionImage";
import { isValidImageUrl } from "@/lib/imageUtils";
import { useLanguage } from "@/lib/i18n";
import { ArrowLeft, Check, X, Bot } from "lucide-react";

interface Question {
  id: number;
  type: "single" | "multiple" | "truefalse";
  content: string;
  options?: string[];
  correctAnswer: string | string[];
  image?: string;
  explanation?: string;
  category?: string;
}

export default function LicenseStudyPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const setId = params?.setId as string;
  const licenseType = searchParams.get("type") || "provisional";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[]>("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAIDialog, setShowAIDialog] = useState(false);

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 使用新的API接口加载题目
      const queryParams = new URLSearchParams({
        licenseType: licenseType,
        page: "1",
        limit: "1000", // 学习模式加载所有题目
        sortBy: "id",
        order: "asc",
      });
      
      const response = await fetch(`/api/exam/${setId}?${queryParams.toString()}`);
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.message || "加载题目失败");
      }
      
      setQuestions(result.data || []);
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
      const prevArray = Array.isArray(selectedAnswer) ? selectedAnswer : [];
      if (prevArray.includes(answer)) {
        setSelectedAnswer(prevArray.filter((a) => a !== answer));
      } else {
        setSelectedAnswer([...prevArray, answer]);
      }
    } else {
      setSelectedAnswer(answer);
      setShowAnswer(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer("");
      setShowAnswer(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedAnswer("");
      setShowAnswer(false);
    }
  };

  const isCorrect = () => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return false;
    
    if (currentQuestion.type === "multiple") {
      // 多选题：比较数组
      const selected = Array.isArray(selectedAnswer) ? selectedAnswer : [];
      const correct = Array.isArray(currentQuestion.correctAnswer)
        ? currentQuestion.correctAnswer
        : [currentQuestion.correctAnswer];
      return (
        selected.length === correct.length &&
        selected.every((ans) => correct.includes(ans))
      );
    } else if (currentQuestion.type === "truefalse") {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="学习" showAIButton={true} aiContext="license" />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="学习" showAIButton={true} aiContext="license" />
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

  const currentQuestion = questions[currentIndex];
  const isAnswerCorrect = showAnswer ? isCorrect() : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="学习" showAIButton={true} aiContext="license" />
      
      {/* 广告位 */}
      <div className="container mx-auto px-4 py-4">
        <AdSlot position="license_study" />
      </div>

      <div className="container mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          返回
        </button>

        {/* 进度指示 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              题目 {currentIndex + 1} / {questions.length}
            </span>
            <span className="text-sm text-gray-600">
              {Math.round(((currentIndex + 1) / questions.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* 题目卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
              {currentQuestion.type === "single"
                ? "单选题"
                : currentQuestion.type === "multiple"
                ? "多选题"
                : "判断题"}
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

          <h2 className="text-xl font-semibold text-gray-900 mb-4">{currentQuestion.content}</h2>

          {isValidImageUrl(currentQuestion.image) && (
            <QuestionImage
              src={currentQuestion.image!}
              alt="题目图片"
              useNativeImg={true}
            />
          )}

          {currentQuestion.type !== "truefalse" && currentQuestion.options && (
            <div className="space-y-2 mb-4">
              {currentQuestion.options.map((option, index) => {
                const isSelected = Array.isArray(selectedAnswer)
                  ? selectedAnswer.includes(option)
                  : selectedAnswer === option;
                const isCorrectOption = Array.isArray(currentQuestion.correctAnswer)
                  ? currentQuestion.correctAnswer.includes(option)
                  : currentQuestion.correctAnswer === option;

                return (
                  <button
                    key={index}
                    onClick={() => !showAnswer && handleAnswer(option)}
                    disabled={showAnswer}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      showAnswer
                        ? isCorrectOption
                          ? "border-green-500 bg-green-50"
                          : isSelected
                          ? "border-red-500 bg-red-50"
                          : "border-gray-200"
                        : isSelected
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
                onClick={() => !showAnswer && handleAnswer("true")}
                disabled={showAnswer}
                className={`w-full p-3 rounded-lg border-2 transition-colors ${
                  showAnswer
                    ? currentQuestion.correctAnswer === "true"
                      ? "border-green-500 bg-green-50"
                      : selectedAnswer === "true"
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200"
                    : selectedAnswer === "true"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                正确
              </button>
              <button
                onClick={() => !showAnswer && handleAnswer("false")}
                disabled={showAnswer}
                className={`w-full p-3 rounded-lg border-2 transition-colors ${
                  showAnswer
                    ? currentQuestion.correctAnswer === "false"
                      ? "border-green-500 bg-green-50"
                      : selectedAnswer === "false"
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200"
                    : selectedAnswer === "false"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                错误
              </button>
            </div>
          )}

          {showAnswer && (
            <div
              className={`p-4 rounded-lg mb-4 ${
                isAnswerCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center space-x-2 mb-2">
                {isAnswerCorrect ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <X className="h-5 w-5 text-red-600" />
                )}
                <span className={`font-semibold ${isAnswerCorrect ? "text-green-800" : "text-red-800"}`}>
                  {isAnswerCorrect ? "回答正确！" : "回答错误"}
                </span>
              </div>
              {currentQuestion.explanation && (
                <p className="text-sm text-gray-700">{currentQuestion.explanation}</p>
              )}
            </div>
          )}

          {/* 导航按钮 */}
          <div className="flex justify-between">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一题
            </button>
            {currentQuestion.type === "multiple" && !showAnswer && (
              <button
                onClick={() => setShowAnswer(true)}
                disabled={
                  !Array.isArray(selectedAnswer) ||
                  selectedAnswer.length === 0 ||
                  selectedAnswer.length !==
                    (Array.isArray(currentQuestion.correctAnswer)
                      ? currentQuestion.correctAnswer.length
                      : 1)
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                查看答案
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一题
            </button>
          </div>
        </div>

        {/* AI助手 */}
        <div className="flex justify-center">
          <AIButton context="license" />
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

