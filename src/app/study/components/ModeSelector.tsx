"use client";

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import { getExamQuestionCount } from "@/lib/questionFilter";
import { useRouter } from "next/navigation";
import { Clock, Play, RotateCcw } from "lucide-react";

interface ModeSelectorProps {
  licenseType: string;
  stage: "provisional" | "regular";
  selectedMode: "study" | "exam" | null;
  onSelect: (mode: "study" | "exam") => void;
}

interface StudyProgress {
  questionHashes: string[];
  currentIndex: number;
  answeredQuestions: string[];
  correctAnswers: number;
  questionCorrectness: Record<string, boolean>;
}

interface IncompleteExamState {
  questionHashes: string[];
  currentIndex: number;
  answers: Record<number, string | string[]>;
  timeLeft: number;
  startTime: number;
  totalTime: number;
}

export default function ModeSelector({
  licenseType,
  stage,
  selectedMode,
  onSelect,
}: ModeSelectorProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const examQuestionCount = getExamQuestionCount(licenseType, stage);
  
  const [studyProgress, setStudyProgress] = useState<StudyProgress | null>(null);
  const [incompleteExam, setIncompleteExam] = useState<IncompleteExamState | null>(null);

  // 加载学习进度和考试状态
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 加载学习进度
    const progressKey = `study_progress_${licenseType}_${stage}`;
    const savedProgress = localStorage.getItem(progressKey);
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress) as StudyProgress;
        setStudyProgress(progress);
      } catch (error) {
        console.error("[ModeSelector] Failed to parse study progress:", error);
      }
    }

    // 加载未完成考试状态
    const examKey = `exam_in_progress_${licenseType}_${stage}`;
    const savedExamState = localStorage.getItem(examKey);
    if (savedExamState) {
      try {
        const examState = JSON.parse(savedExamState) as IncompleteExamState;
        // 计算剩余时间（考虑已经过去的时间）
        const elapsed = Math.floor((Date.now() - examState.startTime) / 1000);
        const remainingTime = Math.max(0, examState.totalTime - elapsed);
        if (remainingTime > 0) {
          setIncompleteExam({
            ...examState,
            timeLeft: remainingTime,
          });
        } else {
          // 时间已用完，清除未完成状态
          localStorage.removeItem(examKey);
        }
      } catch (error) {
        console.error("[ModeSelector] Failed to parse incomplete exam state:", error);
      }
    }
  }, [licenseType, stage]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleContinueExam = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams({
      licenseType,
      stage,
      continue: "true",
    });
    router.push(`/study/exam?${params.toString()}`);
  };

  const handleNewExam = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 清除未完成考试状态
    const examKey = `exam_in_progress_${licenseType}_${stage}`;
    localStorage.removeItem(examKey);
    setIncompleteExam(null);
    // 开始新考试
    onSelect("exam");
  };

  const studyProgressText = studyProgress
    ? `${studyProgress.answeredQuestions.length}/${studyProgress.questionHashes.length} ${t("study.answered")}`
    : null;
  const studyAccuracy = studyProgress && studyProgress.answeredQuestions.length > 0
    ? Math.round((studyProgress.correctAnswers / studyProgress.answeredQuestions.length) * 100)
    : null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t("study.selectMode")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSelect("study")}
          className={`p-4 rounded-xl border-2 ios-button transition-all duration-200 text-left ${
            selectedMode === "study"
              ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-500/20 text-blue-900 dark:text-blue-200 shadow-ios-sm dark:shadow-ios-dark-sm"
              : "border-gray-200 dark:border-ios-dark-border bg-white dark:bg-ios-dark-bg-secondary text-gray-700 dark:text-white active:border-gray-300 dark:active:border-ios-dark-border active:scale-[0.98]"
          }`}
        >
          <div className="font-medium">{t("study.mode.study")}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t("study.mode.studyDesc")}
          </div>
          {studyProgressText && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
              <div>{studyProgressText}</div>
              {studyAccuracy !== null && (
                <div>
                  {t("study.accuracy")}: {studyAccuracy}%
                </div>
              )}
            </div>
          )}
        </button>
        <button
          onClick={() => onSelect("exam")}
          className={`p-4 rounded-xl border-2 ios-button transition-all duration-200 text-left ${
            selectedMode === "exam"
              ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-500/20 text-blue-900 dark:text-blue-200 shadow-ios-sm dark:shadow-ios-dark-sm"
              : "border-gray-200 dark:border-ios-dark-border bg-white dark:bg-ios-dark-bg-secondary text-gray-700 dark:text-white active:border-gray-300 dark:active:border-ios-dark-border active:scale-[0.98]"
          }`}
        >
          <div className="font-medium">{t("study.mode.exam")}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t("study.mode.examDesc")}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {examQuestionCount} {t("exam.questions")}
          </div>
        </button>
      </div>

      {/* 未完成考试状态卡片 */}
      {incompleteExam && (
        <div className="mt-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base text-amber-900 dark:text-amber-200">
                {t("exam.incompleteExam")}
              </span>
            </div>
          </div>
          <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
            <div>
              {t("exam.progress")}: {incompleteExam.currentIndex + 1}/{incompleteExam.questionHashes.length}
            </div>
            <div className="flex items-center space-x-2 flex-wrap">
              <span>{t("exam.timeLeft")}:</span>
              <span className="font-medium">{formatTime(incompleteExam.timeLeft)}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 mt-3">
            <button
              onClick={handleContinueExam}
              className="flex-1 flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-amber-600 dark:bg-amber-500 text-white rounded-lg hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors text-sm sm:text-base"
            >
              <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">{t("exam.continue")}</span>
            </button>
            <button
              onClick={handleNewExam}
              className="flex-1 flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">{t("exam.newExam")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

