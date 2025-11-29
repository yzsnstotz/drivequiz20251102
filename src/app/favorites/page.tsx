"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Bot, Star } from "lucide-react";
import { loadUnifiedQuestionsPackage } from "@/lib/questionsLoader";
import { getFavorites, removeFavorite } from "@/lib/favorites";
import { useLanguage } from "@/lib/i18n";
import { getQuestionContent, getQuestionOptions } from "@/lib/questionUtils";
import QuestionAIDialog from "@/components/QuestionAIDialog";
import QuestionImage from "@/components/common/QuestionImage";
import FavoriteButton from "@/app/study/components/FavoriteButton";

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
}

export default function FavoritesPage() {
  const router = useRouter();
  const { language, t } = useLanguage();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[]>("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [favoriteHashes, setFavoriteHashes] = useState<Set<string>>(new Set());

  // 加载收藏的题目
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        setIsLoading(true);
        const favorites = getFavorites();
        setFavoriteHashes(new Set(favorites));

        if (favorites.length === 0) {
          setQuestions([]);
          setIsLoading(false);
          return;
        }

        const pkg = await loadUnifiedQuestionsPackage();
        const allQuestions = (pkg?.questions || []) as Question[];

        // 根据 hash 查找收藏的题目
        const favoriteQuestions = allQuestions.filter((q) => {
          const hash = q.hash || q.id?.toString() || `q_${q.id}`;
          return favorites.includes(hash);
        });

        setQuestions(favoriteQuestions);
      } catch (error) {
        console.error("加载收藏题目失败:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();
  }, []);

  const currentQuestion = questions[currentIndex];
  const currentHash =
    currentQuestion?.hash ||
    currentQuestion?.id?.toString() ||
    `q_${currentQuestion?.id}`;

  const handleAnswer = (answer: string) => {
    if (!currentQuestion) return;

    if (currentQuestion.type === "multiple") {
      setSelectedAnswer((prev: string | string[]) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        if (prevArray.includes(answer)) {
          return prevArray.filter((a) => a !== answer);
        }
        const newAnswer = [...prevArray, answer];
        if (
          newAnswer.length ===
          (Array.isArray(currentQuestion.correctAnswer)
            ? currentQuestion.correctAnswer.length
            : 1)
        ) {
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
    if (!currentQuestion) return;

    setShowAnswer(true);

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
        fromFavorites: true,
      };

      const exists = mistakeBook.some(
        (q: any) =>
          (q.hash === currentHash || q.id === currentQuestion.id) &&
          q.fromFavorites === true
      );
      if (!exists) {
        mistakeBook.push(questionToAdd);
        localStorage.setItem("mistakeBook", JSON.stringify(mistakeBook));
      }
    }

    // 添加到练习历史
    const practiceHistory = JSON.parse(
      localStorage.getItem("practiceHistory") || "[]"
    );
    const practiceItem = {
      id: `favorites-${currentIndex}-${Date.now()}`,
      questionId: currentQuestion.id,
      questionHash: currentHash,
      content: currentQuestion.content,
      type: currentQuestion.type,
      correct: isCorrectResult,
      date: new Date().toLocaleString(),
      from: "favorites",
    };
    practiceHistory.push(practiceItem);
    const recentPracticeHistory = practiceHistory.slice(-50);
    localStorage.setItem(
      "practiceHistory",
      JSON.stringify(recentPracticeHistory)
    );
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer("");
      setShowAnswer(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSelectedAnswer("");
      setShowAnswer(false);
    }
  };

  const handleRemoveFavorite = () => {
    if (!currentHash) return;
    removeFavorite(currentHash);
    setFavoriteHashes((prev) => {
      const newSet = new Set(prev);
      newSet.delete(currentHash);
      return newSet;
    });

    // 从列表中移除
    setQuestions((prev) =>
      prev.filter(
        (q) =>
          (q.hash || q.id?.toString() || `q_${q.id}`) !== currentHash
      )
    );

    // 如果当前题目被移除，调整索引
    if (currentIndex >= questions.length - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const isCorrect = () => {
    if (!currentQuestion) return false;
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 dark:text-ios-dark-text-secondary dark:hover:text-ios-dark-text"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">
            {t("favorites.title")}
          </h1>
        </div>
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6 flex justify-center items-center">
          <p className="text-gray-600 dark:text-ios-dark-text-secondary">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 dark:text-ios-dark-text-secondary dark:hover:text-ios-dark-text"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">
            {t("favorites.title")}
          </h1>
        </div>
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6">
          <div className="text-center py-12">
            <Star className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-ios-dark-text-secondary text-lg mb-2">{t("favorites.empty")}</p>
            <p className="text-gray-500 dark:text-ios-dark-text-secondary text-sm">{t("favorites.emptyDesc")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 dark:text-ios-dark-text-secondary dark:hover:text-ios-dark-text"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">
            {t("favorites.title")}
          </h1>
        </div>
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6 flex justify-center items-center">
          <p className="text-gray-600 dark:text-ios-dark-text-secondary">{t("question.loadError")}</p>
        </div>
      </div>
    );
  }

  const contentText = getQuestionContent(
    currentQuestion.content as any,
    language
  );
  const explanationText = currentQuestion.explanation
    ? getQuestionContent(currentQuestion.explanation as any, language)
    : null;
  const options = getQuestionOptions(
    currentQuestion.options as any,
    language
  );

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900 dark:text-ios-dark-text-secondary dark:hover:text-ios-dark-text"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">
          {t("favorites.title")}
        </h1>
        <div className="ml-auto flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-ios-dark-text-secondary">
            {currentIndex + 1}/{questions.length}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600 dark:text-ios-dark-text-secondary">
            {t("question.current")} {currentIndex + 1}/{questions.length}
          </span>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {currentQuestion.type === "single"
                ? t("exam.type.single")
                : currentQuestion.type === "multiple"
                ? t("exam.type.multiple")
                : t("exam.type.truefalse")}
            </span>
            <FavoriteButton
              questionHash={currentHash}
              onToggle={(isFavorite) => {
                if (!isFavorite) {
                  handleRemoveFavorite();
                }
              }}
            />
            <button
              onClick={() => setShowAIDialog(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
            >
              <Bot className="h-4 w-4" />
              <span>{t("exam.aiAssistant")}</span>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-gray-900 dark:text-ios-dark-text text-lg mb-4">{contentText || ""}</p>
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
                          ? "bg-green-50 dark:bg-green-900/30 border-2 border-green-500"
                          : isSelected
                          ? "bg-red-50 dark:bg-red-900/30 border-2 border-red-500"
                          : "bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent dark:border-ios-dark-border"
                        : isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-600"
                        : "bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent dark:border-ios-dark-border hover:bg-gray-100 dark:hover:bg-ios-dark-bg-tertiary/80"
                    }`}
                  >
                    <span className="text-gray-900 dark:text-ios-dark-text">
                      {option === "true" ? t("exam.true") : t("exam.false")}
                    </span>
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
                          ? "bg-green-50 dark:bg-green-900/30 border-2 border-green-500"
                          : isSelected
                          ? "bg-red-50 dark:bg-red-900/30 border-2 border-red-500"
                          : "bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent dark:border-ios-dark-border"
                        : isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-600"
                        : "bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent dark:border-ios-dark-border hover:bg-gray-100 dark:hover:bg-ios-dark-bg-tertiary/80"
                    }`}
                  >
                    <span className="font-medium text-gray-900 dark:text-ios-dark-text">{optionLabel}: </span>
                    <span className="text-gray-900 dark:text-ios-dark-text">{option}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-ios-dark-bg-secondary border-t dark:border-ios-dark-border py-4 flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              currentIndex === 0
                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-900 dark:text-ios-dark-text-secondary dark:hover:text-ios-dark-text"
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
            <span>{t("question.previous")}</span>
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              currentIndex === questions.length - 1
                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-900 dark:text-ios-dark-text-secondary dark:hover:text-ios-dark-text"
            }`}
          >
            <span>{t("question.next")}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {showAnswer && (
          <div className="mt-6 p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 animate-fadeIn">
            <h3 className="text-gray-800 dark:text-ios-dark-text font-medium mb-2">
              {isCorrect()
                ? t("question.correctAnswer")
                : t("question.wrongAnswer")}
            </h3>
            {explanationText && (
              <p className="text-gray-700 dark:text-blue-200">{explanationText}</p>
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

