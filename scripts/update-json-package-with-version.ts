#!/usr/bin/env tsx
// ============================================================
// 脚本：使用指定版本号更新JSON包
// 功能：从数据库读取所有题目和答案，使用规范化函数确保格式正确，写入到questions.json
// 使用方法: tsx scripts/update-json-package-with-version.ts [version]
// ============================================================

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

// 处理 SSL 证书问题（仅用于开发环境）
// 在生产环境中不应禁用证书验证
if ((process.env.NODE_ENV === 'development' || !process.env.VERCEL) && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log("[updateJsonPackageWithVersion] 已设置 NODE_TLS_REJECT_UNAUTHORIZED=0 以处理 SSL 证书问题（仅开发环境）");
} else if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  console.log("[updateJsonPackageWithVersion] 生产环境模式：使用 SSL 配置中的 rejectUnauthorized: false，不设置全局环境变量");
}

// 注意：这里直接使用 db，它会自动处理 SSL 连接
import { db } from "../src/lib/db";
import { calculateQuestionHash, generateUnifiedVersion, Question } from "../src/lib/questionHash";
import { normalizeCorrectAnswer, getAIAnswerFromDb, saveUnifiedVersion } from "../src/lib/questionDb";
import fs from "fs/promises";
import path from "path";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");
const OUTPUT_FILE = path.join(QUESTIONS_DIR, "questions.json");

/**
 * 使用指定版本号更新JSON包
 */
async function updateJsonPackageWithVersion(version?: string) {
  try {
    console.log("开始更新JSON包...");
    
    // 1. 从数据库读取所有题目
    console.log(`[updateJsonPackageWithVersion] 开始从数据库读取所有题目`);
    const allDbQuestions = await db
      .selectFrom("questions")
      .selectAll()
      .orderBy("id", "asc")
      .execute();

    console.log(`[updateJsonPackageWithVersion] 从数据库读取到 ${allDbQuestions.length} 个题目`);

    // 2. 转换为前端格式，使用规范化函数确保答案格式正确
    const allQuestions: Question[] = allDbQuestions.map((q) => {
      // 从license_types数组中获取category（取第一个，如果没有则使用"其他"）
      const category = (Array.isArray(q.license_types) && q.license_types.length > 0)
        ? q.license_types[0]
        : "其他";

      return {
        id: q.id,
        type: q.type,
        content: q.content,
        options: Array.isArray(q.options) ? q.options : (q.options ? [q.options] : undefined),
        // 使用规范化函数确保答案格式正确
        correctAnswer: normalizeCorrectAnswer(q.correct_answer, q.type),
        image: q.image || undefined,
        explanation: q.explanation || undefined,
        category,
      };
    });
    
    // 3. 重新计算所有题目的hash（刷新contenthash）
    const questionsWithHash = allQuestions.map((q) => {
      const hash = calculateQuestionHash(q);
      return {
        ...q,
        hash,
      };
    });
    
    console.log(`[updateJsonPackageWithVersion] 已计算所有题目的hash`);

    // 4. 获取所有题目的AI回答（从数据库，含多语言）
    console.log(`[updateJsonPackageWithVersion] 开始获取AI回答...`);
    const aiAnswers: Record<string, string> = {};
    const aiAnswersByLocale: Record<string, Record<string, string>> = {};
    let aiAnswerCount = 0;
    const hashes = questionsWithHash.map((q) => (q as any).hash || calculateQuestionHash(q)).filter(Boolean) as string[];
    if (hashes.length > 0) {
      try {
        const rows = await db
          .selectFrom("question_ai_answers")
          .select(["question_hash", "answer", "created_at", "locale"])
          .where("question_hash", "in", hashes)
          .orderBy("question_hash", "asc")
          .orderBy("created_at", "desc")
          .execute();
        for (const r of rows) {
          const loc = r.locale || "zh";
          if (!aiAnswersByLocale[loc]) aiAnswersByLocale[loc] = {};
          if (!aiAnswersByLocale[loc][r.question_hash] && r.answer) {
            aiAnswersByLocale[loc][r.question_hash] = r.answer;
          }
        }
        const zhMap = aiAnswersByLocale["zh"] || aiAnswersByLocale["zh-CN"] || aiAnswersByLocale["zh_CN"] || {};
        Object.assign(aiAnswers, zhMap);
        aiAnswerCount = Object.keys(aiAnswers).length;
      } catch (e) {
        // 回退到单语言查询
        for (const question of questionsWithHash) {
          const questionHash = (question as any).hash || calculateQuestionHash(question);
          const answer = await getAIAnswerFromDb(questionHash, "zh");
          if (answer) {
            aiAnswers[questionHash] = answer;
            aiAnswerCount++;
          }
        }
      }
    }
    
    console.log(`[updateJsonPackageWithVersion] 获取到 ${aiAnswerCount} 个AI回答`);

    // 5. 确定版本号
    let finalVersion: string;
    if (version) {
      // 如果指定了版本号，使用指定的版本号
      finalVersion = version;
      console.log(`[updateJsonPackageWithVersion] 使用指定的版本号: ${finalVersion}`);
    } else {
      // 如果没有指定版本号，生成新的版本号
      finalVersion = generateUnifiedVersion(questionsWithHash);
      console.log(`[updateJsonPackageWithVersion] 生成新版本号: ${finalVersion}`);
    }

    // 6. 保存统一版本号到数据库
    await saveUnifiedVersion(
      finalVersion,
      questionsWithHash.length,
      Object.keys(aiAnswers).length
    );
    console.log(`[updateJsonPackageWithVersion] 已保存版本号到数据库`);

    // 6. 读取启用语言/生成多语言题目
    const questionsByLocale: Record<string, Question[]> = {};
    try {
      const langs = await db.selectFrom("languages").select(["locale"]).where("enabled", "=", true).execute();
      const locales = (langs.length ? langs.map(l => l.locale) : ["zh"]);
      for (const loc of locales) {
        if (loc.toLowerCase().startsWith("zh")) {
          questionsByLocale[loc] = questionsWithHash;
        } else {
          const trs = await db
            .selectFrom("question_translations")
            .select(["content_hash", "content", "options", "explanation"])
            .where("locale", "=", loc)
            .execute();
          const tmap = new Map<string, any>();
          for (const t of trs) tmap.set(t.content_hash, t);
          questionsByLocale[loc] = questionsWithHash.map((q) => {
            const hash = (q as any).hash;
            const t = hash ? tmap.get(hash) : undefined;
            if (t) {
              return {
                ...q,
                content: t.content,
                options: Array.isArray(t.options) ? t.options : (t.options ? [t.options] : undefined),
                explanation: t.explanation || undefined,
              };
            }
            return q;
          });
        }
      }
    } catch {
      // 忽略多语言生成错误
    }

    // 7. 保存到统一的questions.json
    const unifiedData: any = {
      questions: questionsWithHash,
      version: finalVersion,
      aiAnswers: aiAnswers,
      questionsByLocale,
      aiAnswersByLocale,
    };
    
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(unifiedData, null, 2), "utf-8");
    console.log(`[updateJsonPackageWithVersion] 已保存到 ${OUTPUT_FILE}`);

    // 8. 验证保存的数据格式
    console.log(`[updateJsonPackageWithVersion] 验证保存的数据格式...`);
    const savedContent = await fs.readFile(OUTPUT_FILE, "utf-8");
    const savedData = JSON.parse(savedContent);
    
    // 检查答案格式
    let formatErrors = 0;
    for (const question of savedData.questions) {
      const normalized = normalizeCorrectAnswer(question.correctAnswer, question.type);
      // 如果规范化后的答案与原始答案不同，说明格式有问题
      if (JSON.stringify(normalized) !== JSON.stringify(question.correctAnswer)) {
        formatErrors++;
        console.warn(`[updateJsonPackageWithVersion] 警告: 题目 ${question.id} 的答案格式需要规范化`);
        // 更新为规范化后的答案
        question.correctAnswer = normalized;
      }
    }
    
    if (formatErrors > 0) {
      console.log(`[updateJsonPackageWithVersion] 发现 ${formatErrors} 个格式问题，正在修复...`);
      // 重新保存修复后的数据
      await fs.writeFile(OUTPUT_FILE, JSON.stringify(savedData, null, 2), "utf-8");
      console.log(`[updateJsonPackageWithVersion] 已修复并重新保存`);
    } else {
      console.log(`[updateJsonPackageWithVersion] 所有答案格式正确`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("更新完成！");
    console.log("=".repeat(60));
    console.log(`版本号: ${finalVersion}`);
    console.log(`题目总数: ${questionsWithHash.length}`);
    console.log(`AI回答数: ${Object.keys(aiAnswers).length}`);
    console.log(`输出文件: ${OUTPUT_FILE}`);
    
    return {
      version: finalVersion,
      totalQuestions: questionsWithHash.length,
      aiAnswersCount: Object.keys(aiAnswers).length,
    };
  } catch (error) {
    console.error(`[updateJsonPackageWithVersion] Error:`, error);
    throw error;
  }
}

// 执行更新
if (require.main === module) {
  const version = process.argv[2];
  
  updateJsonPackageWithVersion(version)
    .then((result) => {
      console.log("\n脚本执行完成");
      console.log("结果:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n脚本执行失败:", error);
      process.exit(1);
    });
}

export { updateJsonPackageWithVersion };

