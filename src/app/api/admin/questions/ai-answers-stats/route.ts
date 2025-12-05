export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ============================================================
// 文件路径: src/app/api/admin/questions/ai-answers-stats/route.ts
// 功能: 统计AI解析数量
// ============================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, internalError } from "@/app/api/_lib/errors";
import { calculateQuestionHash } from "@/lib/questionHash";
import type { CorrectAnswer } from "@/lib/types/question";
import { db } from "@/lib/db";
import {
  getAIAnswerFromDb,
  getAIAnswerFromJson,
  normalizeCorrectAnswer,
  loadQuestionFile,
  getLatestUnifiedVersionInfo,
} from "@/lib/questionDb";

// ============================================================
// GET /api/admin/questions/ai-answers-stats
// 统计AI解析数量
// 支持 type 参数：jsonPackage | database | cacheCount | all（默认）
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const query = req.nextUrl.searchParams;
    const type = query.get("type") || "all"; // 默认计算所有统计项

    console.log(`[GET /api/admin/questions/ai-answers-stats] 开始统计AI解析数量，类型: ${type}`);

    // 1. 从数据库读取所有题目（所有统计项都需要）
    const allDbQuestions = await db
      .selectFrom("questions")
      .selectAll()
      .orderBy("id", "asc")
      .execute();

    console.log(`[GET /api/admin/questions/ai-answers-stats] 从数据库读取到 ${allDbQuestions.length} 个题目`);

    // 转换为前端格式并计算hash
    const questionsWithHash = allDbQuestions.map((q) => {
      let category = q.category;
      if (!category && q.license_types && Array.isArray(q.license_types) && q.license_types.length > 0) {
        category = q.license_types[0];
      }
      if (!category) {
        category = "其他";
      }

      // 处理content字段：保持原格式
      let content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
      if (typeof q.content === "string") {
        content = q.content;
      } else {
        content = q.content;
      }

      const question = {
        id: q.id,
        type: q.type,
        content,
        options: Array.isArray(q.options) ? q.options : (q.options ? [q.options] : undefined),
        correctAnswer: q.correct_answer as CorrectAnswer | null,
        image: q.image || undefined,
        explanation: q.explanation || undefined,
        category,
      };

      const hash = q.content_hash || calculateQuestionHash(question);

      return {
        ...question,
        hash,
        dbHash: q.content_hash,
      };
    });

    const totalQuestions = questionsWithHash.length;
    let jsonPackageCount: number | null = null;
    let databaseCount: number | null = null;
    let cacheCount: number | null = null;

    // 2. 统计1：从JSON包读取到的有AI解析的题目数量（新逻辑：直接比较aiAnswers的key和questions的hash）
    if (type === "all" || type === "jsonPackage") {
      console.log(`[GET /api/admin/questions/ai-answers-stats] 开始统计JSON包中的AI解析`);
      jsonPackageCount = 0;
      
      try {
        // 1. 定位到当前最新的json包（questions.json）
        const latestVersionInfo = await getLatestUnifiedVersionInfo();
        const file = await loadQuestionFile(undefined); // 加载questions.json
        
        if (!file || !file.aiAnswers) {
          console.log(`[GET /api/admin/questions/ai-answers-stats] JSON包不存在或没有aiAnswers字段`);
          jsonPackageCount = 0;
        } else {
          // 2. 找到json包里的aiAnswers对象
          const aiAnswers = file.aiAnswers;
          const questions = file.questions || [];
          
          // 调试：检查aiAnswers是否为空对象
          const aiAnswersKeys = Object.keys(aiAnswers);
          console.log(`[GET /api/admin/questions/ai-answers-stats] JSON包中aiAnswers对象: ${aiAnswersKeys.length > 0 ? '有数据' : '空对象'}`);
          if (aiAnswersKeys.length === 0) {
            console.log(`[GET /api/admin/questions/ai-answers-stats] ⚠️ 警告：JSON包中的aiAnswers是空对象，说明更新JSON包时没有从数据库获取到AI回答`);
            console.log(`[GET /api/admin/questions/ai-answers-stats] 建议：检查数据库中是否有AI回答数据，以及hash是否匹配`);
          }
          
          // 3. 创建一个hash集合，用于快速查找
          const questionHashSet = new Set<string>();
          let questionsWithHash = 0;
          for (const question of questions) {
            const hash = (question as any).hash;
            if (hash) {
              questionHashSet.add(hash);
              questionsWithHash++;
            }
          }
          
          // 4. 依次拿aiAnswers对象的key(questionHash)与json包里的hash字段做比较
          let matchedCount = 0;
          let unmatchedCount = 0;
          for (const questionHash of aiAnswersKeys) {
            if (questionHashSet.has(questionHash)) {
              jsonPackageCount++;
              matchedCount++;
            } else {
              unmatchedCount++;
            }
          }
          
          console.log(`[GET /api/admin/questions/ai-answers-stats] JSON包中有AI解析的题目数量: ${jsonPackageCount}`);
          console.log(`[GET /api/admin/questions/ai-answers-stats] JSON包中aiAnswers总数: ${aiAnswersKeys.length}`);
          console.log(`[GET /api/admin/questions/ai-answers-stats] JSON包中题目总数: ${questions.length}`);
          console.log(`[GET /api/admin/questions/ai-answers-stats] JSON包中有hash的题目数量: ${questionsWithHash}`);
          console.log(`[GET /api/admin/questions/ai-answers-stats] 匹配的AI回答数量: ${matchedCount}, 不匹配的数量: ${unmatchedCount}`);
          if (latestVersionInfo) {
            console.log(`[GET /api/admin/questions/ai-answers-stats] JSON包版本号: ${latestVersionInfo.version}`);
          }
          
          // 如果aiAnswers不为空但匹配数为0，说明hash不匹配
          if (aiAnswersKeys.length > 0 && matchedCount === 0) {
            console.log(`[GET /api/admin/questions/ai-answers-stats] ⚠️ 警告：JSON包中有${aiAnswersKeys.length}个AI回答，但没有一个与题目的hash匹配`);
            console.log(`[GET /api/admin/questions/ai-answers-stats] 可能原因：JSON包更新时使用的hash与题目中的hash不一致`);
            // 输出前几个hash用于调试
            if (aiAnswersKeys.length > 0) {
              console.log(`[GET /api/admin/questions/ai-answers-stats] aiAnswers中的前3个hash示例:`, aiAnswersKeys.slice(0, 3));
            }
            if (questionsWithHash > 0) {
              const sampleHashes = Array.from(questionHashSet).slice(0, 3);
              console.log(`[GET /api/admin/questions/ai-answers-stats] 题目中的前3个hash示例:`, sampleHashes);
            }
          }
        }
      } catch (error) {
        console.error(`[GET /api/admin/questions/ai-answers-stats] 统计JSON包中的AI解析失败:`, error);
        jsonPackageCount = 0;
      }
    }

    // 3. 统计2：从数据库读取到的有AI解析的题目数量（使用匹配逻辑，逐个查询）
    if (type === "all" || type === "database") {
      console.log(`[GET /api/admin/questions/ai-answers-stats] 开始统计数据库中的AI解析（逐个查询）`);
      databaseCount = 0;
      for (const question of questionsWithHash) {
        const questionHash = question.hash;
        const answer = await getAIAnswerFromDb(questionHash, "zh");
        if (answer) {
          databaseCount++;
        }
      }
      console.log(`[GET /api/admin/questions/ai-answers-stats] 数据库中有AI解析的题目数量（逐个查询）: ${databaseCount}`);
    }

    // 4. 统计3：使用缓存计数逻辑（批量查询，使用content_hash匹配，与题目管理页面逻辑一致）
    if (type === "all" || type === "cacheCount") {
      console.log(`[GET /api/admin/questions/ai-answers-stats] 开始使用缓存计数逻辑统计（批量查询）`);
      cacheCount = 0;
      
      // 收集所有题目的 content_hash
      const questionHashes = questionsWithHash.map((q) => {
        return (q as any).dbHash || q.hash;
      });

      // 批量查询 question_ai_answers 表（与题目管理页面逻辑一致）
      if (questionHashes.length > 0) {
        try {
          const aiAnswers = await db
            .selectFrom("question_ai_answers")
            .select(["question_hash", "answer", "created_at"])
            .where("question_hash", "in", questionHashes)
            .where("locale", "=", "zh")
            .orderBy("question_hash", "asc")
            .orderBy("created_at", "desc")
            .execute();

          // 构建映射（每个 question_hash 只保留最新的回答）
          const aiAnswersMap = new Map<string, string>();
          for (const aiAnswer of aiAnswers) {
            if (!aiAnswersMap.has(aiAnswer.question_hash) && aiAnswer.answer) {
              aiAnswersMap.set(aiAnswer.question_hash, aiAnswer.answer);
              cacheCount++; // 每有一条匹配，计数+1
            }
          }
        } catch (error) {
          console.error(`[GET /api/admin/questions/ai-answers-stats] 批量查询 question_ai_answers 失败:`, error);
        }
      }
      
      console.log(`[GET /api/admin/questions/ai-answers-stats] 缓存计数统计的AI解析数量（批量查询）: ${cacheCount}`);
    }

    return success({
      jsonPackageCount: jsonPackageCount ?? undefined,      // JSON包中有AI解析的题目数量
      databaseCount: databaseCount ?? undefined,             // 数据库中有AI解析的题目数量（逐个查询）
      cacheCount: cacheCount ?? undefined,                  // 缓存计数（批量查询，使用content_hash匹配，与题目管理页面逻辑一致）
      totalQuestions,
    });
  } catch (err: any) {
    console.error("[GET /api/admin/questions/ai-answers-stats] Error:", err);
    return internalError("Failed to calculate AI answers stats");
  }
});
