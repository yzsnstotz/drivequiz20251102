"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Bot, RotateCcw } from "lucide-react";
import { loadUnifiedQuestionsPackage, Question } from "@/lib/questionsLoader";
import { filterQuestions } from "@/lib/questionFilter";
import { useLanguage } from "@/lib/i18n";
import { getQuestionContent, getQuestionOptions } from "@/lib/questionUtils";
import QuestionAIDialog from "@/components/QuestionAIDialog";
import QuestionImage from "@/components/common/QuestionImage";
import FavoriteButton from "../components/FavoriteButton";
import { isFavorite } from "@/lib/favorites";

function StudyModePageFallback() {
  const { t } = useLanguage();
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center space-x-4 mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">{t("study.mode.study")}</h1>
      </div>
      <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 mb-4" style={{ animation: 'spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}></div>
          <p className="text-gray-600 dark:text-ios-dark-text-secondary">{t("common.loading")}</p>
        </div>
      </div>
    </div>
  );
}

function StudyModePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language, t } = useLanguage();

  const licenseType = searchParams.get("licenseType");
  const stage = searchParams.get("stage") as "provisional" | "regular" | null;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionHashes, setQuestionHashes] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[]>("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(
    new Set()
  );
  const [correctAnswers, setCorrectAnswers] = useState(0);
  // 跟踪每道题的答题状态（hash -> isCorrect）
  const [questionCorrectness, setQuestionCorrectness] = useState<Record<string, boolean>>({});
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [favoriteState, setFavoriteState] = useState<Record<string, boolean>>(
    {}
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 加载题目
  useEffect(() => {
    let isMounted = true; // 用于检查组件是否已卸载
    
    const loadQuestions = async () => {
      if (!licenseType || !stage) {
        router.push("/study");
        return;
      }

      try {
        setIsLoading(true);
        const pkg = await loadUnifiedQuestionsPackage();
        
        if (!isMounted) return; // 如果组件已卸载，不再更新状态
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

        // 调试：找出被过滤掉的题目
        const filteredOut = allQuestions.filter((q) => {
          const qWithTags = q as Question & {
            license_type_tag?: string[];
            stage_tag?: "provisional" | "regular" | "full" | "both" | null;
          };
          const matchesLicense = !qWithTags.license_type_tag || 
            qWithTags.license_type_tag.length === 0 ||
            qWithTags.license_type_tag.includes(licenseType) ||
            qWithTags.license_type_tag.includes("common_all");
          const matchesStage = !qWithTags.stage_tag ||
            (stage === "provisional" && (qWithTags.stage_tag === "provisional" || qWithTags.stage_tag === "both")) ||
            (stage === "regular" && (qWithTags.stage_tag === "regular" || qWithTags.stage_tag === "full" || qWithTags.stage_tag === "both"));
          return !(matchesLicense && matchesStage);
        });

        console.log(`[StudyMode] Loaded ${allQuestions.length} total questions, filtered to ${filtered.length} questions for licenseType=${licenseType}, stage=${stage}`);
        if (filteredOut.length > 0) {
          console.log(`[StudyMode] Filtered out ${filteredOut.length} questions:`, filteredOut.map(q => ({
            id: q.id,
            license_type_tag: (q as any).license_type_tag,
            stage_tag: (q as any).stage_tag,
            category: q.category
          })));
        }
        if (allQuestions.length - filtered.length !== filteredOut.length) {
          console.warn(`[StudyMode] Mismatch: expected ${allQuestions.length - filtered.length} filtered out, but found ${filteredOut.length}`);
        }

        if (filtered.length === 0) {
          console.warn("No questions found for filters:", {
            licenseType,
            stage,
            totalQuestions: allQuestions.length,
          });
          setIsLoading(false);
          return;
        }

        // 检查是否有保存的进度
        const progressKey = `study_progress_${licenseType}_${stage}`;
        const savedProgress = localStorage.getItem(progressKey);

        let hashes: string[];
        let startIndex = 0;

        if (savedProgress) {
          try {
            const progress = JSON.parse(savedProgress);
            hashes = progress.questionHashes || [];
            startIndex = progress.currentIndex || 0;
            setAnsweredQuestions(new Set(progress.answeredQuestions || []));
            setCorrectAnswers(progress.correctAnswers || 0);
            // 恢复每道题的答题状态
            if (progress.questionCorrectness) {
              setQuestionCorrectness(progress.questionCorrectness);
            } else {
              // 如果没有保存的状态，从answeredQuestions和correctAnswers重建
              // 但这是不准确的，所以初始化为空
              setQuestionCorrectness({});
            }

            // 验证保存的题目顺序是否仍然有效
            if (
              hashes.length === filtered.length &&
              hashes.every((h) =>
                filtered.some((q) => q.hash === h || q.id?.toString() === h)
              )
            ) {
              // 使用保存的顺序
              const orderedQuestions = hashes
                .map((h) =>
                  filtered.find(
                    (q) => q.hash === h || q.id?.toString() === h
                  )
                )
                .filter((q): q is Question => q !== undefined);

              setQuestions(orderedQuestions);
              setQuestionHashes(hashes);
              setCurrentIndex(startIndex);
            } else {
              // 顺序无效，重新随机化
              throw new Error("Invalid saved progress");
            }
          } catch (error) {
            // 进度无效，重新随机化
            console.warn("Invalid saved progress, reshuffling:", error);
            const shuffled = [...filtered].sort(() => Math.random() - 0.5);
            hashes = shuffled.map(
              (q) => q.hash || q.id?.toString() || `q_${q.id}`
            );
            setQuestions(shuffled);
            setQuestionHashes(hashes);
            localStorage.setItem(
              progressKey,
              JSON.stringify({
                questionHashes: hashes,
                currentIndex: 0,
                answeredQuestions: [],
                correctAnswers: 0,
                questionCorrectness: {},
              })
            );
          }
        } else {
          // 没有保存的进度，随机化并保存
          const shuffled = [...filtered].sort(() => Math.random() - 0.5);
          hashes = shuffled.map(
            (q) => q.hash || q.id?.toString() || `q_${q.id}`
          );
          setQuestions(shuffled);
          setQuestionHashes(hashes);
          localStorage.setItem(
            progressKey,
            JSON.stringify({
              questionHashes: hashes,
              currentIndex: 0,
              answeredQuestions: [],
              correctAnswers: 0,
              questionCorrectness: {},
            })
          );
        }

        // 初始化收藏状态
        const favorites: Record<string, boolean> = {};
        filtered.forEach((q) => {
          const hash = q.hash || q.id?.toString() || `q_${q.id}`;
          favorites[hash] = isFavorite(hash);
        });
        setFavoriteState(favorites);
      } catch (error) {
        console.error("加载题目失败:", error);
        if (isMounted) {
          setIsLoading(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadQuestions();
    
    return () => {
      isMounted = false; // 组件卸载时标记
    };
  }, [licenseType, stage, router]);

  // 保存进度
  const saveProgress = useCallback(
    (isAnswerCorrect: boolean) => {
      if (!licenseType || !stage) return;

      const currentHash =
        questionHashes[currentIndex] ||
        questions[currentIndex]?.hash ||
        questions[currentIndex]?.id?.toString() ||
        `q_${questions[currentIndex]?.id}`;

      const wasAlreadyAnswered = answeredQuestions.has(currentHash);
      const previousWasCorrect = questionCorrectness[currentHash] === true;

      const newAnsweredQuestions = new Set(answeredQuestions);
      newAnsweredQuestions.add(currentHash);
      setAnsweredQuestions(newAnsweredQuestions);

      // 更新答题状态
      const newQuestionCorrectness = {
        ...questionCorrectness,
        [currentHash]: isAnswerCorrect,
      };
      setQuestionCorrectness(newQuestionCorrectness);

      // 计算新的正确数
      let newCorrectAnswers = correctAnswers;
      if (!wasAlreadyAnswered) {
        // 第一次答题
        if (isAnswerCorrect) {
          newCorrectAnswers = correctAnswers + 1;
        }
      } else {
        // 重新答题
        if (previousWasCorrect && !isAnswerCorrect) {
          // 之前答对了，现在答错了，减少
          newCorrectAnswers = correctAnswers - 1;
        } else if (!previousWasCorrect && isAnswerCorrect) {
          // 之前答错了，现在答对了，增加
          newCorrectAnswers = correctAnswers + 1;
        }
        // 如果状态没变（都对或都错），不需要调整
      }
      setCorrectAnswers(newCorrectAnswers);

      const progressKey = `study_progress_${licenseType}_${stage}`;
      localStorage.setItem(
        progressKey,
        JSON.stringify({
          questionHashes,
          currentIndex,
          answeredQuestions: Array.from(newAnsweredQuestions),
          correctAnswers: newCorrectAnswers,
          questionCorrectness: newQuestionCorrectness,
        })
      );
    },
    [
      licenseType,
      stage,
      questionHashes,
      currentIndex,
      answeredQuestions,
      correctAnswers,
      questions,
      questionCorrectness,
    ]
  );

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

    saveProgress(isCorrectResult);

    // 添加到错题本
    if (!isCorrectResult) {
      const mistakeBook = JSON.parse(
        localStorage.getItem("mistakeBook") || "[]"
      );
      const questionToAdd = {
        ...currentQuestion,
        fromStudy: true,
        studyLicenseType: licenseType,
        studyStage: stage,
      };

      const exists = mistakeBook.some(
        (q: any) =>
          (q.hash === currentHash || q.id === currentQuestion.id) &&
          q.fromStudy === true
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
      id: `study-${licenseType}-${stage}-${currentIndex}-${Date.now()}`,
      questionId: currentQuestion.id,
      questionHash: currentHash,
      content: currentQuestion.content,
      type: currentQuestion.type,
      correct: isCorrectResult,
      date: new Date().toLocaleString(),
      from: "study",
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
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setSelectedAnswer("");
      setShowAnswer(false);

      // 更新进度
      if (!licenseType || !stage) return;
      const progressKey = `study_progress_${licenseType}_${stage}`;
      const savedProgress = localStorage.getItem(progressKey);
      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        progress.currentIndex = newIndex;
        localStorage.setItem(progressKey, JSON.stringify(progress));
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setSelectedAnswer("");
      setShowAnswer(false);

      // 更新进度
      if (!licenseType || !stage) return;
      const progressKey = `study_progress_${licenseType}_${stage}`;
      const savedProgress = localStorage.getItem(progressKey);
      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        progress.currentIndex = newIndex;
        localStorage.setItem(progressKey, JSON.stringify(progress));
      }
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

  const calculateProgress = () => {
    if (questions.length === 0) return 0;
    return Math.round((answeredQuestions.size / questions.length) * 100);
  };

  const calculateAccuracy = () => {
    if (answeredQuestions.size === 0) return 0;
    return Math.round((correctAnswers / answeredQuestions.size) * 100);
  };

  const handleFavoriteToggle = (isFavorite: boolean) => {
    if (currentHash) {
      setFavoriteState((prev) => ({
        ...prev,
        [currentHash]: isFavorite,
      }));
    }
  };

  const handleResetProgress = () => {
    if (!licenseType || !stage) return;
    
    // 清除进度
    const progressKey = `study_progress_${licenseType}_${stage}`;
    localStorage.removeItem(progressKey);
    
    // 重置状态
    setCurrentIndex(0);
    setSelectedAnswer("");
    setShowAnswer(false);
    setAnsweredQuestions(new Set());
    setCorrectAnswers(0);
    setQuestionCorrectness({});
    
    // 关闭确认弹窗
    setShowResetConfirm(false);
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
            {t("study.mode.study")}
          </h1>
        </div>
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 mb-4" style={{ animation: 'spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}></div>
            <p className="text-gray-600 dark:text-ios-dark-text-secondary">{t("common.loading")}</p>
            <p className="text-sm text-gray-500 mt-2">{t("study.loadingQuestions")}</p>
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
            onClick={() => router.push("/study")}
            className="text-gray-600 dark:text-ios-dark-text-secondary hover:text-gray-900 dark:hover:text-ios-dark-text"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">
            {t("study.mode.study")}
          </h1>
        </div>
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6 flex justify-center items-center">
          <p className="text-gray-600 dark:text-ios-dark-text-secondary">
            {questions.length === 0
              ? t("question.loadError")
              : t("question.loading")}
          </p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <div className="flex items-center space-x-4 mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">
          {t("study.mode.study")}
        </h1>
        <div className="ml-auto flex items-center space-x-4">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 dark:text-ios-dark-text-secondary hover:text-gray-900 dark:hover:text-ios-dark-text rounded-lg hover:bg-gray-100 dark:hover:bg-ios-dark-bg-tertiary transition-colors"
            title={t('study.reset')}
          >
            <RotateCcw className="h-4 w-4" />
            <span>{t('study.reset')}</span>
          </button>
          <span className="text-sm text-gray-600 dark:text-ios-dark-text-secondary">
            {t("study.progress")}: {calculateProgress()}%
          </span>
          <span className="text-sm text-blue-600 dark:text-blue-400">
            {t("exam.accuracy")}: {calculateAccuracy()}%
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600 dark:text-ios-dark-text-secondary">
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
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-colors text-sm font-medium"
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
                  (currentQuestion.correctAnswer === "true" && option === "true") ||
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
                          ? "bg-green-50 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-400 text-gray-900 dark:text-ios-dark-text"
                          : isSelected
                          ? "bg-red-50 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-400 text-gray-900 dark:text-ios-dark-text"
                          : "bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent text-gray-900 dark:text-ios-dark-text"
                        : isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-600 dark:border-blue-400 text-gray-900 dark:text-ios-dark-text"
                        : "bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent hover:bg-gray-100 dark:hover:bg-ios-dark-bg-tertiary/80 text-gray-900 dark:text-ios-dark-text"
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
                          ? "bg-green-50 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-400 text-gray-900 dark:text-ios-dark-text"
                          : isSelected
                          ? "bg-red-50 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-400 text-gray-900 dark:text-ios-dark-text"
                          : "bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent text-gray-900 dark:text-ios-dark-text"
                        : isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-600 dark:border-blue-400 text-gray-900 dark:text-ios-dark-text"
                        : "bg-gray-50 dark:bg-ios-dark-bg-tertiary border-2 border-transparent hover:bg-gray-100 dark:hover:bg-ios-dark-bg-tertiary/80 text-gray-900 dark:text-ios-dark-text"
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

        <div className="bg-white dark:bg-ios-dark-bg-secondary border-t dark:border-ios-dark-border py-4 flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              currentIndex === 0
                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : "text-gray-600 dark:text-ios-dark-text-secondary hover:text-gray-900 dark:hover:text-ios-dark-text"
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
                : "text-gray-600 dark:text-ios-dark-text-secondary hover:text-gray-900 dark:hover:text-ios-dark-text"
            }`}
          >
            <span>{t("question.next")}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {showAnswer && (
          <div className="mt-6 p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 animate-fadeIn">
            <h3 className="text-gray-800 dark:text-ios-dark-text font-medium mb-2">
              {isCorrect()
                ? t("question.correctAnswer")
                : t("question.wrongAnswer")}
            </h3>
            {explanationText && (
              <p className="text-gray-700 dark:text-ios-dark-text-secondary">{explanationText}</p>
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

      {/* 从头开始确认弹窗 */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl w-full max-w-md p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 dark:text-ios-dark-text mb-4">
              确认从头开始
            </h3>
            <p className="text-sm text-gray-700 dark:text-ios-dark-text-secondary mb-6">
              确定要清除当前学习进度吗？此操作将：
            </p>
            <ul className="text-sm text-gray-600 dark:text-ios-dark-text-secondary mb-6 space-y-2 list-disc list-inside">
              <li>清除所有答题记录</li>
              <li>重置进度为0%</li>
              <li>从第一题重新开始</li>
            </ul>
            <p className="text-sm text-gray-600 dark:text-ios-dark-text-secondary mb-6">
              此操作无法撤销，确定要继续吗？
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-ios-dark-text-secondary bg-gray-100 dark:bg-ios-dark-bg-tertiary rounded-lg hover:bg-gray-200 dark:hover:bg-ios-dark-bg-tertiary/80 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleResetProgress}
                className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
              >
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudyModePage() {
  return (
    <Suspense fallback={<StudyModePageFallback />}>
      <StudyModePageContent />
    </Suspense>
  );
}
