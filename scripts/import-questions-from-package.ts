#!/usr/bin/env tsx
// ============================================================
// 脚本：从 question_package_versions 表的 package_content 字段导入题目到 questions_duplicate 表
// 功能：读取指定版本的 package_content，解析其中的 questions 数组，插入到 questions_duplicate 表
// 使用方法: tsx scripts/import-questions-from-package.ts
// ============================================================

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

// 处理 SSL 证书问题（仅用于开发环境）
const isDevelopment = process.env.NODE_ENV === 'development';
const isVercel = !!process.env.VERCEL;
const hasTlsReject = !!process.env.NODE_TLS_REJECT_UNAUTHORIZED;

if ((isDevelopment || !isVercel) && !hasTlsReject) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log("[importQuestionsFromPackage] 已设置 NODE_TLS_REJECT_UNAUTHORIZED=0 以处理 SSL 证书问题（仅开发环境）");
}

import { db } from "../src/lib/db";
import { calculateQuestionHash, Question } from "../src/lib/questionHash";
import { sanitizeJsonForDb } from "../src/app/api/admin/question-processing/_lib/jsonUtils";

// 配置参数
const PACKAGE_ID = 11;
const PACKAGE_VERSION = "fbd0a7a3f20495eb-1763066525733";

/**
 * 将 Question 格式转换为数据库格式
 */
function convertQuestionToDbFormat(question: Question): {
  content_hash: string;
  type: "single" | "multiple" | "truefalse";
  content: any;
  options: any | null;
  correct_answer: any | null;
  image: string | null;
  explanation: any | null;
  license_type_tag: any | null;
  category: string | null;
  stage_tag: "both" | "provisional" | "regular" | null;
  topic_tags: string[] | null;
  version: string | null;
} {
  // 计算 content_hash
  const contentHash = question.hash || calculateQuestionHash(question);

  // 规范化 content 字段：如果是字符串，转换为多语言对象
  let contentMultilang: any = null;
  if (typeof question.content === "string") {
    contentMultilang = { zh: question.content };
  } else if (question.content && typeof question.content === "object") {
    contentMultilang = question.content;
  }
  contentMultilang = sanitizeJsonForDb(contentMultilang);
  if (contentMultilang && typeof contentMultilang === "object" && !Array.isArray(contentMultilang) && Object.keys(contentMultilang).length === 0) {
    contentMultilang = null;
  }

  // 规范化 explanation 字段：如果是字符串，转换为多语言对象
  let explanationMultilang: any = null;
  if (question.explanation) {
    if (typeof question.explanation === "string") {
      explanationMultilang = { zh: question.explanation };
    } else if (typeof question.explanation === "object" && question.explanation !== null) {
      explanationMultilang = question.explanation;
    }
  }
  explanationMultilang = sanitizeJsonForDb(explanationMultilang);
  if (explanationMultilang && typeof explanationMultilang === "object" && !Array.isArray(explanationMultilang) && Object.keys(explanationMultilang).length === 0) {
    explanationMultilang = null;
  }

  // 清理 options 字段
  let cleanedOptions = sanitizeJsonForDb(question.options);
  if (cleanedOptions && Array.isArray(cleanedOptions)) {
    cleanedOptions = cleanedOptions
      .filter((opt: any) => {
        if (typeof opt !== "string") return false;
        const trimmed = opt.trim();
        return trimmed !== "" && trimmed.toLowerCase() !== "explanation";
      })
      .map((opt: any) => {
        if (typeof opt === "string" && opt.includes("\n")) {
          return opt.split("\n")
            .map((line: string) => line.trim())
            .filter((line: string) => line !== "" && line.toLowerCase() !== "explanation");
        }
        return opt;
      })
      .flat();
    
    if (cleanedOptions.length === 0) {
      cleanedOptions = null;
    }
  }

  // 清理 correct_answer 字段
  let cleanedCorrectAnswer = sanitizeJsonForDb(question.correctAnswer);
  if (cleanedCorrectAnswer && Array.isArray(cleanedCorrectAnswer) && cleanedCorrectAnswer.length === 0) {
    cleanedCorrectAnswer = null;
  } else if (cleanedCorrectAnswer && typeof cleanedCorrectAnswer === "object" && !Array.isArray(cleanedCorrectAnswer) && Object.keys(cleanedCorrectAnswer).length === 0) {
    cleanedCorrectAnswer = null;
  }

  // 处理 license_type_tag（兼容 license_tags）
  let licenseTypeTag: any = null;
  if ((question as any).license_type_tag !== null && (question as any).license_type_tag !== undefined) {
    if (Array.isArray((question as any).license_type_tag)) {
      const cleaned = (question as any).license_type_tag
        .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
        .map((tag: any) => tag.trim());
      licenseTypeTag = cleaned.length > 0 ? cleaned : null;
    }
  } else if (question.license_tags) {
    // 兼容旧字段 license_tags
    if (Array.isArray(question.license_tags)) {
      const cleaned = question.license_tags
        .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
        .map((tag: any) => tag.trim());
      licenseTypeTag = cleaned.length > 0 ? cleaned : null;
    }
  }

  // 处理 topic_tags
  let topicTags: string[] | null = null;
  if (question.topic_tags !== null && question.topic_tags !== undefined) {
    if (Array.isArray(question.topic_tags)) {
      const cleaned = question.topic_tags
        .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
        .map((tag: any) => tag.trim());
      topicTags = cleaned.length > 0 ? cleaned : null;
    }
  }

  return {
    content_hash: contentHash,
    type: question.type,
    content: contentMultilang,
    options: cleanedOptions,
    correct_answer: cleanedCorrectAnswer,
    image: question.image || null,
    explanation: explanationMultilang,
    // 注意：questions_duplicate 表可能没有 license_types 字段，所以不包含它
    license_type_tag: licenseTypeTag,
    category: question.category || null,
    stage_tag: question.stage_tag || null,
    topic_tags: topicTags,
    version: null, // 不设置版本号
  };
}

/**
 * 主函数：从 package_content 导入题目到 questions_duplicate 表
 */
async function importQuestionsFromPackage() {
  try {
    console.log("开始导入题目...");
    console.log(`目标: question_package_versions 表，id=${PACKAGE_ID}, version=${PACKAGE_VERSION}`);

    // 1. 查询指定版本的 package_content
    const packageVersion = await db
      .selectFrom("question_package_versions")
      .select(["id", "package_name", "version", "package_content"])
      .where("id", "=", PACKAGE_ID)
      .where("version", "=", PACKAGE_VERSION)
      .executeTakeFirst();

    if (!packageVersion) {
      throw new Error(`未找到 id=${PACKAGE_ID}, version=${PACKAGE_VERSION} 的记录`);
    }

    if (!packageVersion.package_content) {
      throw new Error(`package_content 字段为空`);
    }

    console.log(`找到记录: package_name=${packageVersion.package_name}, version=${packageVersion.version}`);

    // 2. 解析 package_content
    const packageContent = packageVersion.package_content as any;
    
    if (!packageContent.questions || !Array.isArray(packageContent.questions)) {
      throw new Error(`package_content 中没有 questions 数组或格式不正确`);
    }

    const questions = packageContent.questions as Question[];
    console.log(`找到 ${questions.length} 个题目`);

    // 3. 转换并插入到 questions_duplicate 表
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      try {
        // 转换题目格式
        const dbQuestion = convertQuestionToDbFormat(question);

        // 插入到 questions_duplicate 表
        await db
          .insertInto("questions_duplicate")
          .values(dbQuestion)
          .execute();

        successCount++;
        
        if ((i + 1) % 100 === 0) {
          console.log(`已处理 ${i + 1}/${questions.length} 个题目...`);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ index: i, error: errorMsg });
        console.error(`题目 ${i + 1} 导入失败:`, errorMsg);
      }
    }

    // 4. 输出结果
    console.log("\n导入完成！");
    console.log(`成功: ${successCount} 个题目`);
    console.log(`失败: ${errorCount} 个题目`);
    
    if (errors.length > 0) {
      console.log("\n错误详情:");
      errors.slice(0, 10).forEach(({ index, error }) => {
        console.log(`  题目 ${index + 1}: ${error}`);
      });
      if (errors.length > 10) {
        console.log(`  ... 还有 ${errors.length - 10} 个错误`);
      }
    }

  } catch (error) {
    console.error("导入过程中发生错误:", error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await db.destroy();
  }
}

// 执行脚本
importQuestionsFromPackage();

