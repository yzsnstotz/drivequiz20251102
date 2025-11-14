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
import { calculateQuestionHash, Question } from "@/lib/questionHash";
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
    const { password, packageName, source, version } = body;

    if (!password || typeof password !== "string") {
      return badRequest("超级管理员密码不能为空");
    }

    const isValidPassword = await verifySuperAdminPassword(password);
    if (!isValidPassword) {
      return forbidden("超级管理员密码错误");
    }

    // 3. 确定要导入的包和源
    let questionsToImport: Question[] = [];
    let packageInfo: { name: string; source: string } | null = null;

    if (source === "database" && version) {
      // 从数据库packages_version表读取
      const { getUnifiedVersionContent } = await import("@/lib/questionDb");
      const versionContent = await getUnifiedVersionContent(version);
      if (!versionContent || !versionContent.questions || versionContent.questions.length === 0) {
        return badRequest(`数据库中没有找到版本 ${version} 的JSON包内容`);
      }
      questionsToImport = versionContent.questions;
      packageInfo = { name: version, source: "database" };
      console.log(`[import-from-json] 从数据库版本 ${version} 读取，共 ${questionsToImport.length} 个题目`);
    } else {
      // 从文件系统读取（默认行为）
      if (packageName) {
        // 如果指定了packageName，直接读取该文件（不经过loadQuestionFile的questions.json优先逻辑）
        const filePath = path.join(QUESTIONS_DIR, `${packageName}.json`);
        try {
          const fileContent = await fs.readFile(filePath, "utf-8");
          const fileData = JSON.parse(fileContent);
          
          // 兼容多种格式
          if (Array.isArray(fileData)) {
            questionsToImport = fileData;
          } else {
            questionsToImport = fileData.questions || [];
          }
          
          if (questionsToImport.length === 0) {
            return badRequest(`JSON包 ${packageName} 不存在或为空`);
          }
          
          packageInfo = { name: packageName, source: "filesystem" };
          console.log(`[import-from-json] 从文件系统直接读取文件 ${packageName}.json，共 ${questionsToImport.length} 个题目`);
        } catch (error: any) {
          return badRequest(`无法读取JSON包 ${packageName}: ${error.message || String(error)}`);
        }
      } else {
        // 如果没有指定packageName，使用loadQuestionFile（会从questions.json读取）
        const categories = await getAllCategories();
        
        if (categories.length === 0) {
          return badRequest("没有找到可导入的JSON包");
        }

        // 加载第一个包
        const category = categories[0];
        const file = await loadQuestionFile(category);
        if (!file || !file.questions || file.questions.length === 0) {
          return badRequest(`JSON包 ${category} 不存在或为空`);
        }
        questionsToImport = file.questions;
        packageInfo = { name: category, source: "filesystem" };
        console.log(`[import-from-json] 从文件系统读取包 ${category}，共 ${questionsToImport.length} 个题目`);
      }
    }

    // 4. 导入题目
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

    if (!packageInfo || questionsToImport.length === 0) {
      return badRequest("没有可导入的题目");
    }

    try {
      let packageProcessed = 0;
      let packageImported = 0;
      let packageUpdated = 0;
      let packageErrors = 0;

      // 批量处理：每批100个题目，使用批量查询和批量插入/更新优化性能
      const BATCH_SIZE = 100;
      const totalQuestions = questionsToImport.length;
      
      console.log(`[import-from-json] 开始导入包 ${packageInfo.name}（来源：${packageInfo.source}），共 ${totalQuestions} 个题目，将分 ${Math.ceil(totalQuestions / BATCH_SIZE)} 批处理`);

      // 辅助函数：规范化content字段
      const normalizeContent = (question: Question): { zh: string; en?: string; ja?: string; [key: string]: string | undefined } => {
        if (typeof question.content === "string") {
          return { zh: question.content };
        } else {
          const contentObj = question.content as { [key: string]: string | undefined };
          const isPlaceholder = (value: string | undefined): boolean => {
            return value !== undefined && typeof value === 'string' && 
              (value.trim().startsWith('[EN]') || value.trim().startsWith('[JA]'));
          };
          
          const result: { zh: string; en?: string; ja?: string; [key: string]: string | undefined } = { zh: contentObj.zh || "" };
          if (contentObj.en && !isPlaceholder(contentObj.en)) {
            result.en = contentObj.en;
          }
          if (contentObj.ja && !isPlaceholder(contentObj.ja)) {
            result.ja = contentObj.ja;
          }
          return result;
        }
      };

      // 辅助函数：规范化explanation字段
      const normalizeExplanation = (question: Question): { zh: string; en?: string; ja?: string; [key: string]: string | undefined } | string | null => {
        if (!question.explanation) return null;
        if (typeof question.explanation === "string") {
          return question.explanation;
        } else {
          const expObj = question.explanation as { [key: string]: string | undefined };
          const isPlaceholder = (value: string | undefined): boolean => {
            return value !== undefined && typeof value === 'string' && 
              (value.trim().startsWith('[EN]') || value.trim().startsWith('[JA]'));
          };
          
          const result: { zh: string; en?: string; ja?: string; [key: string]: string | undefined } = { zh: expObj.zh || "" };
          if (expObj.en && !isPlaceholder(expObj.en)) {
            result.en = expObj.en;
          }
          if (expObj.ja && !isPlaceholder(expObj.ja)) {
            result.ja = expObj.ja;
          }
          return result;
        }
      };

      for (let i = 0; i < totalQuestions; i += BATCH_SIZE) {
        const batch = questionsToImport.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalQuestions / BATCH_SIZE);
        
        console.log(`[import-from-json] 处理批次 ${batchNumber}/${totalBatches}，包含 ${batch.length} 个题目`);

        try {
          // 步骤1：批量计算所有题目的hash
          const questionHashes = batch.map(q => ({
            question: q,
            hash: calculateQuestionHash(q),
          }));

          // 步骤2：批量查询所有已存在的题目（一次性查询）
          const hashes = questionHashes.map(qh => qh.hash);
          const existingQuestions = await db
            .selectFrom("questions")
            .select(["id", "content_hash"])
            .where("content_hash", "in", hashes)
            .execute();

          // 创建hash到id的映射
          const hashToIdMap = new Map<string, number>();
          for (const eq of existingQuestions) {
            hashToIdMap.set(eq.content_hash, eq.id);
          }

          // 步骤3：准备批量插入和更新的数据
          const toInsert: Array<{
            content_hash: string;
            type: string;
            content: any;
            options: any;
            correct_answer: any;
            image: string | null;
            explanation: any;
            license_types: any;
            category: string;
            stage_tag: string | null;
            topic_tags: any;
          }> = [];
          const toUpdate: Array<{
            id: number;
            type: string;
            content: any;
            options: any;
            correct_answer: any;
            image: string | null;
            explanation: any;
            license_types: any;
            category: string;
            stage_tag: string | null;
            topic_tags: any;
          }> = [];

          // 步骤4：处理每个题目，准备批量操作数据
          for (const { question, hash } of questionHashes) {
            try {
              packageProcessed++;
              totalProcessed++;

              const contentMultilang = normalizeContent(question);
              const explanationMultilang = normalizeExplanation(question);
              const questionCategory = question.category || "其他";
              const licenseTypes = (question.license_tags && question.license_tags.length > 0) 
                ? question.license_tags 
                : null;
              const stageTag = question.stage_tag || null;
              const topicTags = question.topic_tags || null;

              const existingId = hashToIdMap.get(hash);
              
              if (existingId) {
                // 准备更新数据
                toUpdate.push({
                  id: existingId,
                  type: question.type,
                  content: contentMultilang as any,
                  options: question.options ? (question.options as any) : null,
                  correct_answer: question.correctAnswer as any,
                  image: question.image || null,
                  explanation: explanationMultilang as any,
                  license_types: licenseTypes,
                  category: questionCategory,
                  stage_tag: stageTag,
                  topic_tags: topicTags,
                });
              } else {
                // 准备插入数据
                toInsert.push({
                  content_hash: hash,
                  type: question.type,
                  content: contentMultilang as any,
                  options: question.options ? (question.options as any) : null,
                  correct_answer: question.correctAnswer as any,
                  image: question.image || null,
                  explanation: explanationMultilang as any,
                  license_types: licenseTypes,
                  category: questionCategory,
                  stage_tag: stageTag,
                  topic_tags: topicTags,
                });
              }
            } catch (error: any) {
              packageErrors++;
              totalErrors++;
              const errorMsg = `准备题目 ${question.id || 'unknown'} (${packageInfo.name}) 失败: ${error.message || String(error)}`;
              errors.push(errorMsg);
              console.error("[import-from-json] Error preparing question:", {
                questionId: question.id,
                packageName: packageInfo.name,
                error: error.message || String(error),
              });
            }
          }

          // 步骤5：批量插入新题目
          if (toInsert.length > 0) {
            try {
              await db
                .insertInto("questions")
                .values(toInsert)
                .execute();
              packageImported += toInsert.length;
              totalImported += toInsert.length;
              console.log(`[import-from-json] 批次 ${batchNumber} 批量插入 ${toInsert.length} 个新题目`);
            } catch (error: any) {
              console.error(`[import-from-json] 批次 ${batchNumber} 批量插入失败:`, error);
              // 如果批量插入失败，尝试逐个插入
              for (const item of toInsert) {
                try {
                  await db.insertInto("questions").values(item).execute();
                  packageImported++;
                  totalImported++;
                } catch (singleError: any) {
                  packageErrors++;
                  totalErrors++;
                  errors.push(`插入题目失败: ${singleError.message || String(singleError)}`);
                }
              }
            }
          }

          // 步骤6：批量更新现有题目（使用事务或逐个更新）
          if (toUpdate.length > 0) {
            // Kysely 不支持批量更新，需要逐个更新，但使用 Promise.all 并行执行
            const updatePromises = toUpdate.map(async (item) => {
              try {
                await db
                  .updateTable("questions")
                  .set({
                    type: item.type,
                    content: item.content,
                    options: item.options,
                    correct_answer: item.correct_answer,
                    image: item.image,
                    explanation: item.explanation,
                    license_types: item.license_types,
                    category: item.category,
                    stage_tag: item.stage_tag,
                    topic_tags: item.topic_tags,
                    updated_at: new Date(),
                  })
                  .where("id", "=", item.id)
                  .execute();
                return true;
              } catch (error: any) {
                console.error(`[import-from-json] 更新题目 ${item.id} 失败:`, error);
                return false;
              }
            });

            const updateResults = await Promise.all(updatePromises);
            const successCount = updateResults.filter(r => r === true).length;
            packageUpdated += successCount;
            totalUpdated += successCount;
            if (successCount < toUpdate.length) {
              packageErrors += (toUpdate.length - successCount);
              totalErrors += (toUpdate.length - successCount);
            }
            console.log(`[import-from-json] 批次 ${batchNumber} 批量更新 ${successCount}/${toUpdate.length} 个题目`);
          }

          // 每批处理完后，记录进度
          console.log(`[import-from-json] 批次 ${batchNumber}/${totalBatches} 完成，已处理 ${packageProcessed}/${totalQuestions} 个题目（新增 ${packageImported}，更新 ${packageUpdated}，错误 ${packageErrors}）`);
        } catch (error: any) {
          // 批次级别的错误处理
          console.error(`[import-from-json] 批次 ${batchNumber} 处理失败:`, error);
          if (error.message?.includes("timeout") || error.message?.includes("aborted") || error.message?.includes("signal")) {
            console.error("[import-from-json] 检测到超时或中断错误，可能是请求超时或数据库连接问题");
            // 如果是因为超时，抛出错误以便上层处理
            throw error;
          }
          // 其他错误继续处理下一批
          packageErrors += batch.length;
          totalErrors += batch.length;
        }
      }

      // 如果有AI回答，也导入到数据库（失败不影响主流程）
      // 注意：从数据库版本导入时，AI回答已经在package_content中，这里暂时跳过
      // 如果需要导入AI回答，可以从versionContent.aiAnswers获取
      console.log(`[import-from-json] 包 ${packageInfo.name} 处理完成`);
      
      results.push({
        packageName: packageInfo.name,
        processed: packageProcessed,
        imported: packageImported,
        updated: packageUpdated,
        errors: packageErrors,
      });
    } catch (error: any) {
      const errorMsg = `导入包 ${packageInfo?.name || 'unknown'} 失败: ${error.message || String(error)}`;
      errors.push(errorMsg);
      console.error("[import-from-json] Error importing package:", {
        packageName: packageInfo?.name,
        error: error.message || String(error),
      });
      
      results.push({
        packageName: packageInfo?.name || 'unknown',
        processed: 0,
        imported: 0,
        updated: 0,
        errors: 1,
      });
    }

    // 如果是从文件系统导入，尝试导入AI回答（从文件读取）
    if (packageInfo?.source === "filesystem") {
      try {
        const fileName = packageInfo.name;
        // 直接读取文件，不经过loadQuestionFile的questions.json优先逻辑
        const filePath = path.join(QUESTIONS_DIR, `${fileName}.json`);
        const fileContent = await fs.readFile(filePath, "utf-8").catch(() => null);
        if (fileContent) {
          const fileData = JSON.parse(fileContent);
          const aiAnswers = fileData.aiAnswers || (Array.isArray(fileData) ? {} : fileData.aiAnswers);
          if (aiAnswers && Object.keys(aiAnswers).length > 0) {
          console.log(`[import-from-json] 开始导入AI回答，共 ${Object.keys(aiAnswers).length} 个`);
          let aiAnswerSuccess = 0;
          let aiAnswerErrors = 0;
          
          for (const [questionHash, answer] of Object.entries(aiAnswers)) {
            try {
              const answerText = typeof answer === "string" ? answer : String(answer);
              
              // 检查是否已存在
              const existing = await db
                .selectFrom("question_ai_answers")
                .select(["id"])
                .where("question_hash", "=", questionHash)
                .where("locale", "=", "zh")
                .executeTakeFirst();

              // 从questions表获取标签信息（用于同步标签字段）
              const questionInfo = await db
                .selectFrom("questions")
                .select(["category", "stage_tag", "topic_tags"])
                .where("content_hash", "=", questionHash)
                .executeTakeFirst();

              if (existing) {
                // 更新现有回答（同时更新标签字段）
                await db
                  .updateTable("question_ai_answers")
                  .set({
                    answer: answerText,
                    category: questionInfo?.category || null,
                    stage_tag: questionInfo?.stage_tag || null,
                    topic_tags: questionInfo?.topic_tags || null,
                    updated_at: new Date(),
                  })
                  .where("id", "=", existing.id)
                  .execute();
              } else {
                // 插入新回答（包含标签字段）
                await db
                  .insertInto("question_ai_answers")
                  .values({
                    question_hash: questionHash,
                    locale: "zh",
                    answer: answerText,
                    view_count: 0,
                    category: questionInfo?.category || null,
                    stage_tag: questionInfo?.stage_tag || null,
                    topic_tags: questionInfo?.topic_tags || null,
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
        }
      } catch (error: any) {
        console.error(`[import-from-json] Error importing AI answers:`, error);
        // AI回答导入失败不影响主流程
      }
    }

    console.log(`[import-from-json] 导入完成:`, {
      totalProcessed,
      totalImported,
      totalUpdated,
      totalErrors,
    });

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

