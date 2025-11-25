"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Bot, Clock } from "lucide-react";
import { loadUnifiedQuestionsPackage } from "@/lib/questionsLoader";
import {
  filterQuestions,
  getRandomQuestions,
  getExamQuestionCount,
} from "@/lib/questionFilter";
import { useLanguage } from "@/lib/i18n";
import { getQuestionContent, getQuestionOptions } from "@/lib/questionUtils";
import QuestionAIDialog from "@/components/QuestionAIDialog";
import QuestionImage from "@/components/common/QuestionImage";
import FavoriteButton from "../components/FavoriteButton";
import { isFavorite } from "@/lib/favorites";

interface Question {
  id: number;
  type: "single" | "multiple" | "truefalse";
  content:
    | string
    | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
  image?: string;
  options?:
    | string[]
    | Array<{
        zh: string;
        en?: string;
        ja?: string;
        [key: string]: string | undefined;
      }>;
  correctAnswer: string | string[];
  explanation?:
    | string
    | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
  hash?: string;
  license_type_tag?: string[];
  stage_tag?: "provisional" | "regular" | "full" | "both" | null;
}

export default function ExamModePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language, t } = useLanguage();

  const licenseType = searchParams.get("licenseType");
  const stage = searchParams.get("stage") as "provisional" | "regular" | null;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[]>("");
  const [answers, setAnswers] = useState<Record<number, string | string[]>>(
    {}
  );
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [favoriteState, setFavoriteState] = useState<Record<string, boolean>>(
    {}
  );

  const questionCount =
    licenseType && stage
      ? getExamQuestionCount(
          licenseType,
          stage === "provisional" ? "provisional" : "regular"
        )
      : 50;

  // 加载题目
  useEffect(() => {
    const loadQuestions = async () => {
      if (!licenseType || !stage) {
        router.push("/study");
        return;
      }

      try {
        setIsLoading(true);
        const pkg = await loadUnifiedQuestionsPackage();
        const allQuestions = (pkg?.questions || []) as Question[];

        if (!allQuestions || allQuestions.length === 0) {
          console.error("Failed to load questions: no questions in package");
          setIsLoading(false);
          return;
        }

        // 筛选题目
        const filtered = filterQuestions(allQuestions, {
          licenseTypeTag: licenseType,
          stageTag: stage === "provisional" ? "provisional" : "regular",
        });

        console.log(`[ExamMode] Loaded ${allQuestions.length} total questions, filtered to ${filtered.length} questions for licenseType=${licenseType}, stage=${stage}`);

        if (filtered.length === 0) {
          console.warn("No questions found for filters:", {
            licenseType,
            stage,
            totalQuestions: allQuestions.length,
          });
          setIsLoading(false);
          return;
        }

        // 随机抽取指定数量的题目
        const selected = getRandomQuestions(filtered, questionCount);
        setQuestions(selected);

        // 初始化收藏状态
        const favorites: Record<string, boolean> = {};
        selected.forEach((q) => {
          const hash = q.hash || q.id?.toString() || `q_${q.id}`;
          favorites[hash] = isFavorite(hash);
        });
        setFavoriteState(favorites);

        // 设置考试时间（根据题目数量，每題1分钟）
        setTimeLeft(questionCount * 60);
        setExamStarted(true);
      } catch (error) {
        console.error("加载题目失败:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestions();
  }, [licenseType, stage, questionCount, router]);

  const calculateScore = useCallback(() => {
    let correct = 0;
    questions.forEach((question, index) => {
      const answer = answers[index];
      if (!answer) return;

      let isCorrect: boolean;
      if (Array.isArray(question.correctAnswer)) {
        isCorrect =
          Array.isArray(answer) &&
          answer.length === question.correctAnswer.length &&
          answer.every((a) => question.correctAnswer.includes(a));
      } else if (question.type === "truefalse") {
        const correctAnswerValue =
          typeof question.correctAnswer === "boolean"
            ? String(question.correctAnswer)
            : question.correctAnswer;
        const answerValue = typeof answer === "string" ? answer : String(answer);
        isCorrect = correctAnswerValue === answerValue;
      } else {
        isCorrect = answer === question.correctAnswer;
      }

      if (isCorrect) correct++;
    });
    return correct;
  }, [questions, answers]);

  const finishExam = useCallback(() => {
    if (questions.length === 0) return;
    
    const score = calculateScore();
    const total = questions.length;
    const passed = score >= Math.ceil(total * 0.9);

    // 保存考试历史
    const examHistory = JSON.parse(
      localStorage.getItem("examHistory") || "[]"
    );
    const examItem = {
      id: `exam-${licenseType}-${stage}-${Date.now()}`,
      licenseType,
      stage,
      score,
      total,
      passed,
      date: new Date().toLocaleString(),
      timeSpent: questionCount * 60 - timeLeft,
    };
    examHistory.push(examItem);
    localStorage.setItem("examHistory", JSON.stringify(examHistory));

    // 显示结果
    alert(
      `${t("exam.title")} ${passed ? t("exam.passed") : t("exam.failed")}\n${t("exam.score")}: ${score}/${total}\n${t("exam.accuracy")}: ${Math.round((score / total) * 100)}%`
    );

    router.push("/study");
  }, [questions, calculateScore, licenseType, stage, timeLeft, questionCount, t, router]);

  // 倒计时
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

  const handleAnswer = (answer: string) => {
    if (!questions[currentIndex]) return;

    const currentQuestion = questions[currentIndex];
    if (currentQuestion.type === "multiple") {
      setSelectedAnswer((prev: string | string[]) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        if (prevArray.includes(answer)) {
          const newAnswer = prevArray.filter((a) => a !== answer);
          setAnswers({
            ...answers,
            [currentIndex]: newAnswer,
          });
          return newAnswer;
        }
        const newAnswer = [...prevArray, answer];
        setAnswers({
          ...answers,
          [currentIndex]: newAnswer,
        });
        return newAnswer;
      });
    } else {
      setSelectedAnswer(answer);
      setAnswers({
        ...answers,
        [currentIndex]: answer,
      });
    }
  };

  const checkAnswer = (answer: string | string[]) => {
    if (!questions[currentIndex]) return;

    setShowAnswer(true);
    const currentQuestion = questions[currentIndex];

    let isCorrectResult: boolean;
    if (Array.isArray(currentQuestion.correctAnswer)) {
      isCorrectResult =
        Array.isArray(answer) &&
        answer.length === currentQuestion.correctAnswer.length &&
        answer.every((a) => currentQuestion.correctAnswer.includes(a));
    } else if (currentQuestion.type === "truefalse") {
      const correctAnswerValue =
        typeof currentQuestion.correctAnswer === "boolean"
          ? String(currentQuestion.correctAnswer)
          : currentQuestion.correctAnswer;
      const answerValue =
        typeof answer === "string" ? answer : String(answer);
      isCorrectResult = correctAnswerValue === answerValue;
    } else {
      isCorrectResult = answer === currentQuestion.correctAnswer;
    }

    // 添加到错题本
    if (!isCorrectResult) {
      const mistakeBook = JSON.parse(
        localStorage.getItem("mistakeBook") || "[]"
      );
      const questionToAdd = {
        ...currentQuestion,
        fromExam: true,
        examLicenseType: licenseType,
        examStage: stage,
      };

      const currentHash =
        currentQuestion.hash ||
        currentQuestion.id?.toString() ||
        `q_${currentQuestion.id}`;
      const exists = mistakeBook.some(
        (q: any) =>
          (q.hash === currentHash || q.id === currentQuestion.id) &&
          q.fromExam === true
      );
      if (!exists) {
        mistakeBook.push(questionToAdd);
        localStorage.setItem("mistakeBook", JSON.stringify(mistakeBook));
      }
    }
  };

  const handleNext = () => {
    if (showAnswer) {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setSelectedAnswer(answers[currentIndex + 1] || "");
        setShowAnswer(false);
      } else {
        finishExam();
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSelectedAnswer(answers[currentIndex - 1] || "");
      setShowAnswer(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleFavoriteToggle = (isFavorite: boolean) => {
    const currentQuestion = questions[currentIndex];
    if (currentQuestion) {
      const hash =
        currentQuestion.hash ||
        currentQuestion.id?.toString() ||
        `q_${currentQuestion.id}`;
      setFavoriteState((prev) => ({
        ...prev,
        [hash]: isFavorite,
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => router.push("/study")}
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {t("study.mode.exam")}
          </h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">{t("common.loading")}</p>
            <p className="text-sm text-gray-500 mt-2">{t("study.loadingQuestions")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!questions[currentIndex]) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => router.push("/study")}
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {t("study.mode.exam")}
          </h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-red-600 mb-4">
              <svg
                className="h-12 w-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p className="text-gray-900 font-medium mb-2">
              {questions.length === 0
                ? t("question.loadError")
                : t("question.loading")}
            </p>
            {questions.length === 0 && (
              <p className="text-sm text-gray-600 text-center max-w-md">
                {t("study.noQuestionsFound")}
              </p>
            )}
            <button
              onClick={() => router.push("/study")}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t("study.back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentHash =
    currentQuestion.hash ||
    currentQuestion.id?.toString() ||
    `q_${currentQuestion.id}`;

  // 确保使用正确的语言代码（useLanguage 返回的是 'zh' | 'en' | 'ja'）
  const currentLang = language as 'zh' | 'en' | 'ja';
  
  const contentText = getQuestionContent(
    currentQuestion.content as any,
    currentLang
  );
  const explanationText = currentQuestion.explanation
    ? getQuestionContent(currentQuestion.explanation as any, currentLang)
    : null;
  const options = getQuestionOptions(
    currentQuestion.options as any,
    currentLang
  );

  const isCorrect = () => {
    if (Array.isArray(currentQuestion.correctAnswer)) {
      const selectedArray = Array.isArray(selectedAnswer)
        ? selectedAnswer
        : [];
      return (
        selectedArray.length === currentQuestion.correctAnswer.length &&
        selectedArray.every((answer) =>
          currentQuestion.correctAnswer.includes(answer)
        )
      );
    }
    return selectedAnswer === currentQuestion.correctAnswer;
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => router.push("/study")}
          className="text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {t("study.mode.exam")}
        </h1>
        <div className="ml-auto flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-red-600">
            <Clock className="h-5 w-5" />
            <span className="font-medium">{formatTime(timeLeft)}</span>
          </div>
          <span className="text-sm text-gray-600">
            {t("exam.progress")}: {currentIndex + 1}/{questions.length}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600">
            {t("question.current")} {currentIndex + 1}/{questions.length}
          </span>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-blue-600">
              {currentQuestion.type === "single"
                ? t("exam.type.single")
                : currentQuestion.type === "multiple"
                ? t("exam.type.multiple")
                : t("exam.type.truefalse")}
            </span>
            <FavoriteButton
              questionHash={currentHash}
              onToggle={handleFavoriteToggle}
            />
            <button
              onClick={() => setShowAIDialog(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              <Bot className="h-4 w-4" />
              <span>{t("exam.aiAssistant")}</span>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-gray-900 text-lg mb-4">{contentText || ""}</p>
          {currentQuestion.image && (
            <QuestionImage
              src={currentQuestion.image}
              alt={t("question.image")}
              width={800}
              height={600}
            />
          )}

          {currentQuestion.type === "truefalse" ? (
            <div className="space-y-3">
              {["true", "false"].map((option) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOption =
                  (currentQuestion.correctAnswer === "true" &&
                    option === "true") ||
                  (currentQuestion.correctAnswer === "false" &&
                    option === "false");

                return (
                  <button
                    key={option}
                    onClick={() => !showAnswer && handleAnswer(option)}
                    disabled={showAnswer}
                    className={`w-full p-4 rounded-xl text-left transition-colors ${
                      showAnswer
                        ? isCorrectOption
                          ? "bg-green-50 border-2 border-green-500"
                          : isSelected
                          ? "bg-red-50 border-2 border-red-500"
                          : "bg-gray-50 border-2 border-transparent"
                        : isSelected
                        ? "bg-blue-50 border-2 border-blue-600"
                        : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                    }`}
                  >
                    {option === "true" ? t("exam.true") : t("exam.false")}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {options.map((option, index) => {
                const optionLabel = String.fromCharCode(65 + index);
                const isSelected = Array.isArray(selectedAnswer)
                  ? selectedAnswer.includes(optionLabel)
                  : selectedAnswer === optionLabel;
                const isCorrectOption = Array.isArray(
                  currentQuestion.correctAnswer
                )
                  ? currentQuestion.correctAnswer.includes(optionLabel)
                  : currentQuestion.correctAnswer === optionLabel;

                return (
                  <button
                    key={index}
                    onClick={() => !showAnswer && handleAnswer(optionLabel)}
                    disabled={showAnswer}
                    className={`w-full p-4 rounded-xl text-left transition-colors ${
                      showAnswer
                        ? isCorrectOption
                          ? "bg-green-50 border-2 border-green-500"
                          : isSelected
                          ? "bg-red-50 border-2 border-red-500"
                          : "bg-gray-50 border-2 border-transparent"
                        : isSelected
                        ? "bg-blue-50 border-2 border-blue-600"
                        : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                    }`}
                  >
                    <span className="font-medium">{optionLabel}: </span>
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
            disabled={currentIndex === 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              currentIndex === 0
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
            <span>{t("question.previous")}</span>
          </button>

          <button
            onClick={() => {
              if (showAnswer) {
                checkAnswer(selectedAnswer);
              } else {
                setShowAnswer(true);
                checkAnswer(selectedAnswer);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showAnswer ? t("question.next") : t("exam.submit")}
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              currentIndex === questions.length - 1
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>{t("question.next")}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {showAnswer && (
          <div className="mt-6 p-4 rounded-lg border bg-blue-50 border-blue-200 animate-fadeIn">
            <h3 className="text-gray-800 font-medium mb-2">
              {isCorrect()
                ? t("question.correctAnswer")
                : t("question.wrongAnswer")}
            </h3>
            {explanationText && (
              <p className="text-gray-700">{explanationText}</p>
            )}
          </div>
        )}
      </div>

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

