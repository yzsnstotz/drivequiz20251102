"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Bot, Clock } from "lucide-react";
import { loadUnifiedQuestionsPackage, Question } from "@/lib/questionsLoader";
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

function ExamModePageFallback() {
  const { t } = useLanguage();
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center space-x-4 mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">{t("study.mode.exam")}</h1>
      </div>
      <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
          <p className="text-gray-600 dark:text-ios-dark-text-secondary">{t("common.loading")}</p>
        </div>
      </div>
    </div>
  );
}

function ExamModePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { language, t } = useLanguage();

  const licenseType = searchParams.get("licenseType");
  const stage = searchParams.get("stage") as "provisional" | "regular" | null;
  const continueExam = searchParams.get("continue") === "true";

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
  const [examStartTime, setExamStartTime] = useState<number | null>(null);
  const [totalExamTime, setTotalExamTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const examStartedRef = useRef<boolean>(false);

  // 统一的清理计时器函数（提前定义，以便在 loadQuestions 中使用）
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    examStartedRef.current = false;
  }, []);

  const questionCount =
    licenseType && stage
      ? getExamQuestionCount(
          licenseType,
          stage === "provisional" ? "provisional" : "regular"
        )
      : 50;

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

        // 检查是否有未完成的考试
        const examKey = `exam_in_progress_${licenseType}_${stage}`;
        const savedExamState = localStorage.getItem(examKey);
        
        // 如果URL参数中没有continue=true，清除未完成状态（用户选择开始新考试）
        if (!continueExam && savedExamState) {
          localStorage.removeItem(examKey);
          console.log("[ExamMode] Cleared incomplete exam state (new exam requested)");
        }
        
        if (continueExam && savedExamState) {
          try {
            const examState = JSON.parse(savedExamState);
            const { questionHashes, currentIndex: savedIndex, answers: savedAnswers, timeLeft: savedTimeLeft, startTime: savedStartTime, totalTime: savedTotalTime } = examState;

            // 验证保存的题目顺序是否仍然有效
            if (questionHashes && questionHashes.length > 0) {
              const restoredQuestions = questionHashes
                .map((h: string) =>
                  filtered.find(
                    (q) => q.hash === h || q.id?.toString() === h
                  )
                )
                .filter((q: Question | undefined): q is Question => q !== undefined);

              if (restoredQuestions.length === questionHashes.length) {
                // 恢复成功前，先清理所有现有计时器
                clearTimer();
                
                setQuestions(restoredQuestions);
                setCurrentIndex(savedIndex || 0);
                setAnswers(savedAnswers || {});

                // 初始化收藏状态
                const favorites: Record<string, boolean> = {};
                restoredQuestions.forEach((q: Question) => {
                  const hash = q.hash || q.id?.toString() || `q_${q.id}`;
                  favorites[hash] = isFavorite(hash);
                });
                setFavoriteState(favorites);

                // 计算剩余时间（考虑已经过去的时间）
                const elapsed = savedStartTime ? Math.floor((Date.now() - savedStartTime) / 1000) : 0;
                const remainingTime = Math.max(0, (savedTotalTime || questionCount * 60) - elapsed);
                setTotalExamTime(savedTotalTime || questionCount * 60);
                setExamStartTime(savedStartTime || Date.now());
                
                // 先设置 examStarted 为 true，然后设置 timeLeft
                // 这样计时器的 useEffect 会在 examStarted 和 timeLeft 都设置好后启动
                examStartedRef.current = true;
                setExamStarted(true);
                // 使用 setTimeout 确保 examStarted 状态更新后再设置 timeLeft
                setTimeout(() => {
                  setTimeLeft(remainingTime);
                }, 0);
                
                setIsLoading(false);
                console.log("[ExamMode] Restored incomplete exam state");
                return;
              }
            }
          } catch (error) {
            console.warn("[ExamMode] Failed to restore exam state:", error);
            // 继续正常流程
          }
        }

        // 如果没有未完成的考试或恢复失败，正常开始新考试
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

        // 开始新考试前，先清理所有现有计时器
        clearTimer();
        
        // 设置考试时间（根据题目数量，每題1分钟）
        const totalTime = questionCount * 60;
        setTotalExamTime(totalTime);
        setExamStartTime(Date.now());
        
        // 先设置 examStarted 为 true，然后设置 timeLeft
        // 这样计时器的 useEffect 会在 examStarted 和 timeLeft 都设置好后启动
        examStartedRef.current = true;
        setExamStarted(true);
        // 使用 setTimeout 确保 examStarted 状态更新后再设置 timeLeft
        setTimeout(() => {
          setTimeLeft(totalTime);
        }, 0);
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
  }, [licenseType, stage, questionCount, router, continueExam, clearTimer]);

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

  // 保存未完成考试状态
  const saveIncompleteExam = useCallback(() => {
    if (!licenseType || !stage || !examStarted || questions.length === 0) return;

    const questionHashes = questions.map(
      (q) => q.hash || q.id?.toString() || `q_${q.id}`
    );

    const examState = {
      questionHashes,
      currentIndex,
      answers,
      timeLeft,
      startTime: examStartTime || Date.now(),
      totalTime: totalExamTime || questionCount * 60,
    };

    const examKey = `exam_in_progress_${licenseType}_${stage}`;
    localStorage.setItem(examKey, JSON.stringify(examState));
    console.log("[ExamMode] Saved incomplete exam state:", examKey);
  }, [licenseType, stage, examStarted, questions, currentIndex, answers, timeLeft, examStartTime, totalExamTime, questionCount]);

  // 清除未完成考试状态
  const clearIncompleteExam = useCallback(() => {
    if (!licenseType || !stage) return;
    const examKey = `exam_in_progress_${licenseType}_${stage}`;
    localStorage.removeItem(examKey);
    console.log("[ExamMode] Cleared incomplete exam state:", examKey);
  }, [licenseType, stage]);

  const finishExam = useCallback(() => {
    if (questions.length === 0) return;
    
    const score = calculateScore();
    const total = questions.length;
    const passed = score >= Math.ceil(total * 0.9);

    // 立即清理计时器
    clearTimer();
    // 停止计时器
    setExamStarted(false);

    // 清除未完成考试状态
    clearIncompleteExam();

    // 收集错题信息
    const wrongQuestions: Array<{
      question: Question;
      userAnswer: string | string[];
      correctAnswer: string | string[] | boolean;
      questionIndex: number;
    }> = [];

    questions.forEach((question, index) => {
      const answer = answers[index];
      if (!answer) {
        // 未答题也算错题
        wrongQuestions.push({
          question,
          userAnswer: '',
          correctAnswer: question.correctAnswer,
          questionIndex: index,
        });
        return;
      }

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

      if (!isCorrect) {
        wrongQuestions.push({
          question,
          userAnswer: answer,
          correctAnswer: question.correctAnswer,
          questionIndex: index,
        });
      }
    });

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
      wrongQuestions: wrongQuestions.map(wq => ({
        question: wq.question,
        userAnswer: wq.userAnswer,
        correctAnswer: wq.correctAnswer,
        questionIndex: wq.questionIndex,
      })),
    };
    examHistory.push(examItem);
    localStorage.setItem("examHistory", JSON.stringify(examHistory));

    // 显示结果
    alert(
      `${t("exam.title")} ${passed ? t("exam.passed") : t("exam.failed")}\n${t("exam.score")}: ${score}/${total}\n${t("exam.accuracy")}: ${Math.round((score / total) * 100)}%`
    );

    router.push("/study");
  }, [questions, calculateScore, licenseType, stage, timeLeft, questionCount, t, router, clearIncompleteExam, clearTimer]);

  // 处理返回，停止计时器并保存状态
  const handleBack = useCallback(() => {
    // 立即清理计时器（无论 examStarted 状态如何）
    clearTimer();
    
    if (examStarted) {
      // 停止计时器
      setExamStarted(false);
      // 保存未完成考试状态
      saveIncompleteExam();
    }
    
    // 直接跳转，不依赖 setTimeout
    router.push("/study");
  }, [examStarted, saveIncompleteExam, router, clearTimer]);

  // 同步 examStarted 状态到 ref
  useEffect(() => {
    examStartedRef.current = examStarted;
  }, [examStarted]);

  // 创建稳定的 finishExam 引用
  const finishExamRef = useRef(finishExam);
  useEffect(() => {
    finishExamRef.current = finishExam;
  }, [finishExam]);

  // 倒计时
  useEffect(() => {
    // 清理之前的计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 只在考试开始且时间大于0时启动计时器
    if (examStarted && timeLeft > 0) {
      examStartedRef.current = true;
      timerRef.current = setInterval(() => {
        // 检查 examStarted 状态，如果为 false 则停止
        if (!examStartedRef.current) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return;
        }
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            finishExamRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // 如果考试未开始或时间为0，确保计时器被清理
      examStartedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [examStarted, timeLeft]);

  // 监听路由变化，离开考试页面时立即清理计时器
  useEffect(() => {
    if (!pathname.startsWith("/study/exam")) {
      // 如果不在考试页面，立即清理计时器
      clearTimer();
      // 注意：这里不设置 examStarted 状态，因为组件可能正在卸载
    }
  }, [pathname, clearTimer]);

  // 定期保存未完成考试状态（每30秒）
  useEffect(() => {
    if (!examStarted || !licenseType || !stage) return;

    const saveInterval = setInterval(() => {
      saveIncompleteExam();
    }, 30000); // 每30秒保存一次

    return () => clearInterval(saveInterval);
  }, [examStarted, licenseType, stage, saveIncompleteExam]);

  // 在答案或当前索引变化时保存状态
  useEffect(() => {
    if (examStarted && licenseType && stage) {
      saveIncompleteExam();
    }
  }, [answers, currentIndex, examStarted, licenseType, stage, saveIncompleteExam]);

  // 页面卸载或路由变化时保存状态并停止计时器
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (examStarted) {
        saveIncompleteExam();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // 组件卸载时也保存并停止计时器
      // 立即清理计时器（无论 examStarted 状态如何）
      clearTimer();
      if (examStarted) {
        saveIncompleteExam();
      }
    };
  }, [examStarted, saveIncompleteExam, clearTimer]);

  const handleAnswer = (answer: string) => {
    if (!questions[currentIndex] || showAnswer) return;

    const currentQuestion = questions[currentIndex];
    if (currentQuestion.type === "multiple") {
      setSelectedAnswer((prev: string | string[]) => {
        const prevArray = Array.isArray(prev) ? prev : [];
        let newAnswer: string[];
        if (prevArray.includes(answer)) {
          newAnswer = prevArray.filter((a) => a !== answer);
        } else {
          newAnswer = [...prevArray, answer];
        }
        
        setAnswers({
          ...answers,
          [currentIndex]: newAnswer,
        });
        
        // 如果选择了所有正确答案，自动显示答案
        const correctAnswerArray = Array.isArray(currentQuestion.correctAnswer)
          ? currentQuestion.correctAnswer
          : [currentQuestion.correctAnswer];
        if (
          newAnswer.length === correctAnswerArray.length &&
          newAnswer.every((a) => correctAnswerArray.includes(a))
        ) {
          checkAnswer(newAnswer);
        }
        
        return newAnswer;
      });
    } else {
      setSelectedAnswer(answer);
      setAnswers({
        ...answers,
        [currentIndex]: answer,
      });
      // 单选和判断题选择后立即显示答案
      checkAnswer(answer);
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
    if (currentIndex < questions.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setSelectedAnswer(answers[newIndex] || "");
      setShowAnswer(false);
    } else {
      // 如果是最后一题且已显示答案，完成考试
      if (showAnswer) {
        finishExam();
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setSelectedAnswer(answers[newIndex] || "");
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
            onClick={handleBack}
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {t("study.mode.exam")}
          </h1>
        </div>
        <div className="bg-white dark:bg-ios-dark-bg-secondary rounded-2xl p-6 shadow-sm dark:shadow-ios-dark-sm mb-6">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
            <p className="text-gray-600 dark:text-ios-dark-text-secondary">{t("common.loading")}</p>
            <p className="text-sm text-gray-500 dark:text-ios-dark-text-secondary mt-2">{t("study.loadingQuestions")}</p>
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
            onClick={handleBack}
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
            <p className="text-gray-900 dark:text-ios-dark-text font-medium mb-2">
              {questions.length === 0
                ? t("question.loadError")
                : t("question.loading")}
            </p>
            {questions.length === 0 && (
              <p className="text-sm text-gray-600 dark:text-ios-dark-text-secondary text-center max-w-md">
                {t("study.noQuestionsFound")}
              </p>
            )}
            <button
              onClick={handleBack}
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
  const options = getQuestionOptions(
    currentQuestion.options as any,
    currentLang
  );

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={handleBack}
          className="text-gray-600 dark:text-ios-dark-text-secondary hover:text-gray-900 dark:hover:text-ios-dark-text"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-ios-dark-text">
          {t("study.mode.exam")}
        </h1>
        <div className="ml-auto flex items-center space-x-4">
          {examStarted && timeLeft > 0 && (
            <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
              <Clock className="h-5 w-5" />
              <span className="font-medium">{formatTime(timeLeft)}</span>
            </div>
          )}
          <span className="text-sm text-gray-600 dark:text-ios-dark-text-secondary">
            {t("exam.progress")}: {currentIndex + 1}/{questions.length}
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

                return (
                  <button
                    key={option}
                    onClick={() => !showAnswer && handleAnswer(option)}
                    disabled={showAnswer}
                    className={`w-full p-4 rounded-xl text-left transition-colors ${
                      isSelected
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

                return (
                  <button
                    key={index}
                    onClick={() => !showAnswer && handleAnswer(optionLabel)}
                    disabled={showAnswer}
                    className={`w-full p-4 rounded-xl text-left transition-colors ${
                      isSelected
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
            disabled={currentIndex === questions.length - 1 && !showAnswer}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              currentIndex === questions.length - 1 && !showAnswer
                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : "text-gray-600 dark:text-ios-dark-text-secondary hover:text-gray-900 dark:hover:text-ios-dark-text"
            }`}
          >
            <span>{t("question.next")}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

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

export default function ExamModePage() {
  return (
    <Suspense fallback={<ExamModePageFallback />}>
      <ExamModePageContent />
    </Suspense>
  );
}
