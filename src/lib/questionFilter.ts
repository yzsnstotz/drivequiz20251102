/**
 * 题目筛选工具函数
 * 从本地 JSON 包中根据 license_type_tag 和 stage_tag 筛选题目
 */

import type { Question } from "@/lib/questionsLoader";

export interface QuestionFilter {
  licenseTypeTag: string;
  stageTag: "provisional" | "regular" | "full";
}

/**
 * 从题目数组中筛选符合条件的题目
 * @param questions 题目数组
 * @param filter 筛选条件
 * @returns 筛选后的题目数组
 */
export function filterQuestions(
  questions: Question[],
  filter: QuestionFilter
): Question[] {
  return questions.filter((question) => {
    // 扩展 Question 类型以包含标签字段
    const q = question as Question & {
      license_type_tag?: string[];
      stage_tag?: "provisional" | "regular" | "full" | "both" | null;
    };

    // 检查 license_type_tag
    let matchesLicenseType = false;
    if (q.license_type_tag && Array.isArray(q.license_type_tag) && q.license_type_tag.length > 0) {
      // 检查是否包含选中的驾照类型
      matchesLicenseType = q.license_type_tag.includes(filter.licenseTypeTag);
      // 如果题目包含 common_all，则所有驾照类型都符合
      if (!matchesLicenseType && q.license_type_tag.includes("common_all")) {
        matchesLicenseType = true;
      }
    } else {
      // 如果没有 license_type_tag 或为空数组，默认匹配所有（作为通用题目）
      matchesLicenseType = true;
    }

    // 检查 stage_tag
    let matchesStage = false;
    if (q.stage_tag) {
      // 如果题目有 stage_tag，进行匹配
      if (filter.stageTag === "provisional") {
        // 临时驾照：匹配 provisional 或 both
        matchesStage = q.stage_tag === "provisional" || q.stage_tag === "both";
      } else if (filter.stageTag === "regular" || filter.stageTag === "full") {
        // 正式驾照：匹配 regular、full 或 both（兼容两种值）
        matchesStage =
          q.stage_tag === "regular" ||
          q.stage_tag === "full" ||
          q.stage_tag === "both";
      }
    } else {
      // 如果没有 stage_tag，默认匹配所有（作为通用题目）
      matchesStage = true;
    }

    return matchesLicenseType && matchesStage;
  });
}

/**
 * 从题目数组中随机抽取指定数量的题目
 * @param questions 题目数组
 * @param count 需要抽取的数量
 * @returns 随机抽取的题目数组
 */
export function getRandomQuestions(
  questions: Question[],
  count: number
): Question[] {
  if (questions.length <= count) {
    return [...questions];
  }

  // Fisher-Yates 洗牌算法
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

/**
 * 根据驾照类型和阶段获取模拟考试的题目数量
 * @param licenseTypeTag 驾照类型
 * @param stageTag 考试阶段
 * @returns 题目数量
 */
export function getExamQuestionCount(
  licenseTypeTag: string,
  stageTag: "provisional" | "regular" | "full"
): number {
  // 外免切替固定10题
  if (licenseTypeTag === "foreign_exchange") {
    return 10;
  }

  // 二轮和原付固定50题（不分仮免/本免）
  if (
    licenseTypeTag === "motorcycle_std" ||
    licenseTypeTag === "motorcycle_large" ||
    licenseTypeTag === "moped"
  ) {
    return 50;
  }

  // 二種固定100题
  if (
    licenseTypeTag === "ordinary_2" ||
    licenseTypeTag === "medium_2" ||
    licenseTypeTag === "large_2"
  ) {
    return 100;
  }

  // 根据阶段决定题目数量
  if (stageTag === "provisional") {
    return 50; // 临时驾照50题
  } else {
    return 100; // 正式驾照100题
  }
}

