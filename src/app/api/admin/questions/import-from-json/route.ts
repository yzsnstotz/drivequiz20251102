// ============================================================
// 文件路径: src/app/api/admin/questions/import-from-json/route.ts
// 功能: 将JSON包导入到数据库（逆向操作）
// ============================================================

export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 设置更长的超时时间（5分钟），用于处理大量题目入库
export const maxDuration = 300; // Vercel Pro计划最多300秒

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError, forbidden } from "@/app/api/_lib/errors";
import { requireDefaultAdmin } from "@/app/api/_lib/withAdminAuth";
import { calculateQuestionHash } from "@/lib/questionHash";
import { saveQuestionToDb, loadQuestionFile } from "@/lib/questionDb";
import { db } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// 获取所有卷类列表（从文件系统）
async function getAllCategories(): Promise<string[]> {
  try {
    const files = await fs.readdir(QUESTIONS_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch (error) {
    console.error("[getAllCategories] Error:", error);
    return [];
  }
}

// 超级管理员密码验证
async function verifySuperAdminPassword(password: string): Promise<boolean> {
  // 从环境变量读取超级管理员密码
  const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
  
  if (!SUPER_ADMIN_PASSWORD) {
    console.error("[import-from-json] SUPER_ADMIN_PASSWORD not configured");
    return false;
  }
  
  // 简单比较（生产环境建议使用哈希比较）
  return password === SUPER_ADMIN_PASSWORD;
}

// ============================================================
// POST /api/admin/questions/import-from-json
// 将JSON包导入到数据库
// ============================================================
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    // 1. 验证是否为默认管理员（超级管理员）
    const authError = await requireDefaultAdmin(req);
    if (authError) {
      return authError;
    }

    // 2. 验证超级管理员密码
    const body = await req.json();
    const { password, packageName } = body;

    if (!password || typeof password !== "string") {
      return badRequest("超级管理员密码不能为空");
    }

    const isValidPassword = await verifySuperAdminPassword(password);
    if (!isValidPassword) {
      return forbidden("超级管理员密码错误");
    }

    // 3. 确定要导入的包
    const categories = packageName ? [packageName] : await getAllCategories();
    
    if (categories.length === 0) {
      return badRequest("没有找到可导入的JSON包");
    }

    // 4. 导入每个包
    let totalProcessed = 0;
    let totalImported = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const errors: string[] = [];
    const results: Array<{
      packageName: string;
      processed: number;
      imported: number;
      updated: number;
      errors: number;
    }> = [];

    for (const category of categories) {
      try {
        // 加载JSON包
        const file = await loadQuestionFile(category);
        if (!file || !file.questions || file.questions.length === 0) {
          if (packageName) {
            return badRequest(`JSON包 ${packageName} 不存在或为空`);
          }
          continue;
        }

        let packageProcessed = 0;
        let packageImported = 0;
        let packageUpdated = 0;
        let packageErrors = 0;

        // 批量处理：每批50个题目，避免一次性处理过多导致超时
        const BATCH_SIZE = 50;
        const totalQuestions = file.questions.length;
        
        console.log(`[import-from-json] 开始导入包 ${category}，共 ${totalQuestions} 个题目，将分 ${Math.ceil(totalQuestions / BATCH_SIZE)} 批处理`);

        for (let i = 0; i < totalQuestions; i += BATCH_SIZE) {
          const batch = file.questions.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(totalQuestions / BATCH_SIZE);
          
          console.log(`[import-from-json] 处理批次 ${batchNumber}/${totalBatches}，包含 ${batch.length} 个题目`);

          // 导入每个题目
          for (const question of batch) {
            try {
              packageProcessed++;
              totalProcessed++;

              // 计算题目hash
              const contentHash = calculateQuestionHash(question);

              // 检查数据库中是否已存在
              const existing = await db
                .selectFrom("questions")
                .select(["id"])
                .where("content_hash", "=", contentHash)
                .executeTakeFirst();

              if (existing) {
                // 更新现有题目
                await db
                  .updateTable("questions")
                  .set({
                    type: question.type,
                    content: question.content,
                    options: question.options ? (question.options as any) : null,
                    correct_answer: question.correctAnswer as any,
                    image: question.image || null,
                    explanation: question.explanation || null,
                    license_types: [category],
                    updated_at: new Date(),
                  })
                  .where("id", "=", existing.id)
                  .execute();

                packageUpdated++;
                totalUpdated++;
              } else {
                // 插入新题目
                await db
                  .insertInto("questions")
                  .values({
                    content_hash: contentHash,
                    type: question.type,
                    content: question.content,
                    options: question.options ? (question.options as any) : null,
                    correct_answer: question.correctAnswer as any,
                    image: question.image || null,
                    explanation: question.explanation || null,
                    license_types: [category],
                  })
                  .execute();

                packageImported++;
                totalImported++;
              }
            } catch (error: any) {
              packageErrors++;
              totalErrors++;
              const errorMsg = `导入题目 ${question.id} (${category}) 失败: ${error.message || String(error)}`;
              errors.push(errorMsg);
              console.error("[import-from-json] Error importing question:", {
                questionId: question.id,
                category,
                error: error.message || String(error),
                stack: error.stack,
              });
              
              // 如果是数据库连接错误或超时，记录更详细的信息
              if (error.message?.includes("timeout") || error.message?.includes("aborted") || error.message?.includes("signal")) {
                console.error("[import-from-json] 检测到超时或中断错误，可能是请求超时或数据库连接问题");
              }
            }
          }

          // 每批处理完后，记录进度
          console.log(`[import-from-json] 批次 ${batchNumber}/${totalBatches} 完成，已处理 ${packageProcessed}/${totalQuestions} 个题目`);
        }

        // 如果有AI回答，也导入到数据库（失败不影响主流程）
        if (file.aiAnswers) {
          console.log(`[import-from-json] 开始导入AI回答，共 ${Object.keys(file.aiAnswers).length} 个`);
          let aiAnswerSuccess = 0;
          let aiAnswerErrors = 0;
          
          for (const [questionHash, answer] of Object.entries(file.aiAnswers)) {
            try {
              // 检查是否已存在
              const existing = await db
                .selectFrom("question_ai_answers")
                .select(["id"])
                .where("question_hash", "=", questionHash)
                .where("locale", "=", "zh")
                .executeTakeFirst();

              if (existing) {
                // 更新现有回答
                await db
                  .updateTable("question_ai_answers")
                  .set({
                    answer,
                    updated_at: new Date(),
                  })
                  .where("id", "=", existing.id)
                  .execute();
              } else {
                // 插入新回答
                await db
                  .insertInto("question_ai_answers")
                  .values({
                    question_hash: questionHash,
                    locale: "zh",
                    answer,
                    view_count: 0,
                  })
                  .execute();
              }
              aiAnswerSuccess++;
            } catch (error: any) {
              aiAnswerErrors++;
              console.error(`[import-from-json] Error importing AI answer for ${questionHash}:`, error);
              // AI回答导入失败不影响主流程，只记录错误
            }
          }
          
          console.log(`[import-from-json] AI回答导入完成：成功 ${aiAnswerSuccess} 个，失败 ${aiAnswerErrors} 个`);
        }

        results.push({
          packageName: category,
          processed: packageProcessed,
          imported: packageImported,
          updated: packageUpdated,
          errors: packageErrors,
        });

        console.log(`[import-from-json] Imported package ${category}:`, {
          processed: packageProcessed,
          imported: packageImported,
          updated: packageUpdated,
          errors: packageErrors,
        });
      } catch (error: any) {
        totalErrors++;
        const errorMsg = `导入包 ${category} 失败: ${error.message || String(error)}`;
        errors.push(errorMsg);
        console.error("[import-from-json] Error importing package:", {
          category,
          error: error.message || String(error),
          stack: error.stack,
        });
        
        // 如果是超时或中断错误，提供更明确的提示
        if (error.message?.includes("timeout") || error.message?.includes("aborted") || error.message?.includes("signal")) {
          console.error("[import-from-json] 检测到超时或中断错误，建议：1) 检查数据库连接；2) 增加超时时间；3) 减少批量大小");
        }
      }
    }

    // 5. 返回结果
    return success({
      totalProcessed,
      totalImported,
      totalUpdated,
      totalErrors,
      errors: errors.slice(0, 50), // 限制错误数量
      results,
    });
  } catch (err: any) {
    console.error("[POST /api/admin/questions/import-from-json] Error:", {
      error: err.message || String(err),
      stack: err.stack,
      name: err.name,
    });
    
    // 如果是超时或中断错误，提供更明确的错误信息
    if (err.message?.includes("timeout") || err.message?.includes("aborted") || err.message?.includes("signal")) {
      return internalError(
        `JSON入库操作超时或中断。可能原因：1) 题目数量过多；2) 数据库连接超时；3) 请求超时。` +
        `已处理的部分数据可能已保存，请检查数据库状态。错误详情: ${err.message}`
      );
    }
    
    if (err.ok === false) return err;
    return internalError(`Failed to import questions from JSON: ${err.message || String(err)}`);
  }
});

