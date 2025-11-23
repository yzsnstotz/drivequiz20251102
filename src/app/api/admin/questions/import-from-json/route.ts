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
    const { password, packageName, source, version, useStreaming } = body;

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

    // 如果使用流式响应，返回流式响应
    if (useStreaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const sendProgress = (progress: {
            processed: number;
            total: number;
            imported: number;
            updated: number;
            errors: number;
            currentBatch?: number;
            totalBatches?: number;
          }) => {
            const data = JSON.stringify({ type: 'progress', ...progress });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          };

          try {
            const BATCH_SIZE = 100;
            const totalQuestions = questionsToImport.length;
            
            console.log(`[import-from-json] 开始导入包 ${packageInfo.name}（来源：${packageInfo.source}），共 ${totalQuestions} 个题目，将分 ${Math.ceil(totalQuestions / BATCH_SIZE)} 批处理`);
            
            // 发送初始进度
            sendProgress({
              processed: 0,
              total: totalQuestions,
              imported: 0,
              updated: 0,
              errors: 0,
              currentBatch: 0,
              totalBatches: Math.ceil(totalQuestions / BATCH_SIZE),
            });

            // 执行导入逻辑（内联实现，因为需要共享辅助函数）
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

            // 辅助函数：规范化explanation字段（确保返回有效的JSON对象或null）
            const normalizeExplanation = (question: Question): { zh: string; en?: string; ja?: string; [key: string]: string | undefined } | null => {
              if (!question.explanation) return null;
              if (typeof question.explanation === "string") {
                // 如果是字符串，转换为对象格式
                return { zh: question.explanation };
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

            // 辅助函数：规范化options字段（确保是有效的JSON格式）
            const normalizeOptions = (options: any): any | null => {
              if (!options) return null;
              // 如果已经是数组，直接返回
              if (Array.isArray(options)) {
                return options;
              }
              // 如果是字符串，转换为数组
              if (typeof options === "string") {
                return [options];
              }
              // 如果是对象，尝试转换为数组或保持对象
              if (typeof options === "object") {
                return options;
              }
              // 其他情况返回null
              return null;
            };

            // 辅助函数：规范化correct_answer字段（确保是有效的JSON格式）
            const normalizeCorrectAnswer = (correctAnswer: any, questionType: "single" | "multiple" | "truefalse"): any => {
              if (correctAnswer === null || correctAnswer === undefined) {
                return null;
              }
              // 如果是字符串，根据题目类型处理
              if (typeof correctAnswer === "string") {
                if (questionType === "multiple") {
                  // 多选题应该是数组
                  return [correctAnswer];
                }
                return correctAnswer;
              }
              // 如果是数组，直接返回
              if (Array.isArray(correctAnswer)) {
                return correctAnswer;
              }
              // 其他情况返回原值
              return correctAnswer;
            };

            let totalProcessed = 0;
            let totalImported = 0;
            let totalUpdated = 0;
            let totalErrors = 0;

            for (let i = 0; i < totalQuestions; i += BATCH_SIZE) {
              const batch = questionsToImport.slice(i, i + BATCH_SIZE);
              const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
              const totalBatches = Math.ceil(totalQuestions / BATCH_SIZE);
              const startIndex = i;
              const endIndex = Math.min(i + BATCH_SIZE, totalQuestions);
              
              console.log(`[import-from-json] ========== 开始处理批次 ${batchNumber}/${totalBatches} ==========`);
              console.log(`[import-from-json] 批次范围: ${startIndex + 1} - ${endIndex} (共 ${batch.length} 个题目)`);
              console.log(`[import-from-json] 当前已处理: ${totalProcessed}/${totalQuestions}`);
              console.log(`[import-from-json] 当前统计 - 新增: ${totalImported}, 更新: ${totalUpdated}, 错误: ${totalErrors}`);

              try {
                // 步骤1：批量计算所有题目的hash
                console.log(`[import-from-json] 批次 ${batchNumber}: 开始计算hash...`);
                const questionHashes = batch.map(q => ({
                  question: q,
                  hash: calculateQuestionHash(q),
                }));
                console.log(`[import-from-json] 批次 ${batchNumber}: 完成hash计算，共 ${questionHashes.length} 个hash`);

                // 步骤2：批量查询所有已存在的题目（一次性查询）
                const hashes = questionHashes.map(qh => qh.hash);
                console.log(`[import-from-json] 批次 ${batchNumber}: 开始查询已存在的题目，查询 ${hashes.length} 个hash...`);
                const existingQuestions = await db
                  .selectFrom("questions")
                  .select(["id", "content_hash"])
                  .where("content_hash", "in", hashes)
                  .execute();
                console.log(`[import-from-json] 批次 ${batchNumber}: 查询完成，找到 ${existingQuestions.length} 个已存在的题目`);

                // 创建hash到id的映射
                const hashToIdMap = new Map<string, number>();
                for (const eq of existingQuestions) {
                  hashToIdMap.set(eq.content_hash, eq.id);
                }

                // 步骤3：准备批量插入和更新的数据
                const toInsert: Array<{
                  content_hash: string;
                  type: "single" | "multiple" | "truefalse";
                  content: any;
                  options: any;
                  correct_answer: any;
                  image: string | null;
                  explanation: any;
                  license_type_tag: any;
                  category: string;
                  stage_tag: "both" | "provisional" | "regular" | null;
                  topic_tags: any;
                }> = [];
                const toUpdate: Array<{
                  id: number;
                  type: "single" | "multiple" | "truefalse";
                  content: any;
                  options: any;
                  correct_answer: any;
                  image: string | null;
                  explanation: any;
                  license_type_tag: any;
                  category: string;
                  stage_tag: "both" | "provisional" | "regular" | null;
                  topic_tags: any;
                }> = [];

                // 步骤4：处理每个题目，准备批量操作数据
                console.log(`[import-from-json] 批次 ${batchNumber}: 开始处理 ${questionHashes.length} 个题目，准备插入/更新数据...`);
                let processedInBatch = 0;
                for (const { question, hash } of questionHashes) {
                  try {
                    totalProcessed++;
                    processedInBatch++;
                    
                    // 特别记录346条记录附近的情况
                    if (totalProcessed >= 340 && totalProcessed <= 350) {
                      console.log(`[import-from-json] ⚠️  处理第 ${totalProcessed} 条记录 (题目ID: ${question.id || 'unknown'}, Hash: ${hash.substring(0, 16)}...)`);
                    }

                    const contentMultilang = normalizeContent(question);
                    const explanationMultilang = normalizeExplanation(question);
                    const optionsNormalized = normalizeOptions(question.options);
                    const correctAnswerNormalized = normalizeCorrectAnswer(question.correctAnswer, question.type as "single" | "multiple" | "truefalse");
                    const questionCategory = question.category || "其他";
                    // 优先使用 license_type_tag，如果没有则使用 license_tags（兼容旧格式）
                    const licenseTypeTag = (question as any).license_type_tag 
                      || (question.license_tags && question.license_tags.length > 0 ? question.license_tags : null);
                    const stageTag: "both" | "provisional" | "regular" | null = 
                      (question.stage_tag === "both" || question.stage_tag === "provisional" || question.stage_tag === "regular")
                        ? question.stage_tag
                        : null;
                    const topicTags = question.topic_tags || null;

                    const existingId = hashToIdMap.get(hash);
                    
                    if (existingId) {
                      toUpdate.push({
                        id: existingId,
                        type: question.type as "single" | "multiple" | "truefalse",
                        content: contentMultilang as any,
                        options: optionsNormalized,
                        correct_answer: correctAnswerNormalized,
                        image: question.image || null,
                        explanation: explanationMultilang as any,
                        license_type_tag: licenseTypeTag,
                        category: questionCategory,
                        stage_tag: stageTag,
                        topic_tags: topicTags,
                      });
                    } else {
                      // 插入新题目 - 确保不包含id字段，让数据库自动生成
                      const insertData: any = {
                        content_hash: hash,
                        type: question.type as "single" | "multiple" | "truefalse",
                        content: contentMultilang as any,
                        options: optionsNormalized,
                        correct_answer: correctAnswerNormalized,
                        image: question.image || null,
                        explanation: explanationMultilang as any,
                        license_type_tag: licenseTypeTag,
                        category: questionCategory,
                        stage_tag: stageTag,
                        topic_tags: topicTags,
                      };
                      // 明确排除id字段（如果存在）
                      delete insertData.id;
                      toInsert.push(insertData);
                    }
                  } catch (error: any) {
                    totalErrors++;
                    const errorMsg = `准备题目 ${question.id || 'unknown'} (${packageInfo.name}) 失败: ${error.message || String(error)}`;
                    errors.push(errorMsg);
                    console.error(`[import-from-json] ❌ 准备题目失败 (第 ${totalProcessed} 条):`, {
                      questionId: question.id,
                      error: error.message,
                      stack: error.stack?.substring(0, 300),
                    });
                  }
                }
                console.log(`[import-from-json] 批次 ${batchNumber}: 完成数据准备，待插入: ${toInsert.length}, 待更新: ${toUpdate.length}`);

                // 步骤5：批量插入新题目
                if (toInsert.length > 0) {
                  console.log(`[import-from-json] 批次 ${batchNumber}: 开始批量插入 ${toInsert.length} 个新题目...`);
                  const insertStartTime = Date.now();
                  // 确保所有插入数据都不包含id字段
                  const cleanInsertData = toInsert.map(item => {
                    const clean: any = { ...item };
                    delete clean.id; // 明确删除id字段
                    return clean;
                  });
                  
                  try {
                    await db.transaction().execute(async (trx) => {
                      const INSERT_BATCH_SIZE = 50;
                      const insertSubBatches = Math.ceil(cleanInsertData.length / INSERT_BATCH_SIZE);
                      console.log(`[import-from-json] 批次 ${batchNumber}: 将分 ${insertSubBatches} 个子批次插入`);
                      for (let j = 0; j < cleanInsertData.length; j += INSERT_BATCH_SIZE) {
                        const insertBatch = cleanInsertData.slice(j, j + INSERT_BATCH_SIZE);
                        const subBatchNum = Math.floor(j / INSERT_BATCH_SIZE) + 1;
                        console.log(`[import-from-json] 批次 ${batchNumber}: 插入子批次 ${subBatchNum}/${insertSubBatches} (${insertBatch.length} 条)...`);
                        const subBatchStartTime = Date.now();
                        await trx.insertInto("questions").values(insertBatch).execute();
                        const subBatchDuration = Date.now() - subBatchStartTime;
                        console.log(`[import-from-json] 批次 ${batchNumber}: 子批次 ${subBatchNum} 插入完成，耗时 ${subBatchDuration}ms`);
                      }
                    });
                    totalImported += toInsert.length;
                    const insertDuration = Date.now() - insertStartTime;
                    console.log(`[import-from-json] ✅ 批次 ${batchNumber}: 批量插入完成，共 ${toInsert.length} 个，耗时 ${insertDuration}ms`);
                  } catch (error: any) {
                    const insertDuration = Date.now() - insertStartTime;
                    console.error(`[import-from-json] ❌ 批次 ${batchNumber}: 批量插入失败，耗时 ${insertDuration}ms`, {
                      error: error.message,
                      code: error.code,
                      detail: error.detail,
                      constraint: error.constraint,
                      stack: error.stack?.substring(0, 500),
                    });
                    console.log(`[import-from-json] 批次 ${batchNumber}: 开始逐个插入（带重试）...`);
                    // 逐个插入（带重试）
                    for (let idx = 0; idx < toInsert.length; idx++) {
                      const item = toInsert[idx];
                      // 确保不包含id字段
                      const cleanItem: any = { ...item };
                      delete cleanItem.id;
                      
                      let retryCount = 0;
                      const maxRetries = 3;
                      let success = false;
                      
                      // 特别记录346条记录附近的插入情况
                      if (totalProcessed >= 340 && totalProcessed <= 350) {
                        console.log(`[import-from-json] ⚠️  逐个插入第 ${idx + 1}/${toInsert.length} 条 (总第 ${totalProcessed} 条, Hash: ${cleanItem.content_hash?.substring(0, 16)}...)`);
                      }
                      
                      while (retryCount < maxRetries && !success) {
                        try {
                          await db.insertInto("questions").values(cleanItem).execute();
                          totalImported++;
                          success = true;
                          if (retryCount > 0) {
                            console.log(`[import-from-json] 批次 ${batchNumber}: 题目 ${idx + 1} 重试 ${retryCount} 次后成功`);
                          }
                        } catch (singleError: any) {
                          retryCount++;
                          if (retryCount >= maxRetries) {
                            totalErrors++;
                            const errorMsg = `插入题目失败 (批次 ${batchNumber}, 索引 ${idx + 1}): ${singleError.message || String(singleError)}`;
                            errors.push(errorMsg);
                            console.error(`[import-from-json] ${errorMsg}`, {
                              code: singleError.code,
                              detail: singleError.detail,
                              constraint: singleError.constraint,
                              hash: cleanItem.content_hash?.substring(0, 16),
                              hasId: 'id' in cleanItem,
                            });
                          } else {
                            const waitTime = 1000 * retryCount;
                            console.warn(`[import-from-json] 批次 ${batchNumber}: 题目 ${idx + 1} 插入失败，${waitTime}ms 后重试 (${retryCount}/${maxRetries})...`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                          }
                        }
                      }
                    }
                    console.log(`[import-from-json] 批次 ${batchNumber}: 逐个插入完成`);
                  }
                }

                // 步骤6：批量更新现有题目
                if (toUpdate.length > 0) {
                  console.log(`[import-from-json] 批次 ${batchNumber}: 开始批量更新 ${toUpdate.length} 个现有题目...`);
                  const updateStartTime = Date.now();
                  const updatePromises = toUpdate.map(async (item, idx) => {
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
                          license_type_tag: item.license_type_tag,
                          category: item.category,
                          stage_tag: item.stage_tag,
                          topic_tags: item.topic_tags,
                          updated_at: new Date(),
                        })
                        .where("id", "=", item.id)
                        .execute();
                      return true;
                    } catch (error: any) {
                      console.error(`[import-from-json] 批次 ${batchNumber}: 更新题目 ${item.id} 失败 (索引 ${idx + 1}):`, {
                        error: error.message,
                        code: error.code,
                        detail: error.detail,
                      });
                      return false;
                    }
                  });

                  const updateResults = await Promise.all(updatePromises);
                  const successCount = updateResults.filter(r => r === true).length;
                  totalUpdated += successCount;
                  const updateDuration = Date.now() - updateStartTime;
                  console.log(`[import-from-json] ✅ 批次 ${batchNumber}: 批量更新完成，成功 ${successCount}/${toUpdate.length}，耗时 ${updateDuration}ms`);
                  if (successCount < toUpdate.length) {
                    totalErrors += (toUpdate.length - successCount);
                    console.warn(`[import-from-json] ⚠️  批次 ${batchNumber}: ${toUpdate.length - successCount} 个更新失败`);
                  }
                }

                // 发送进度更新
                console.log(`[import-from-json] ========== 批次 ${batchNumber}/${totalBatches} 处理完成 ==========`);
                console.log(`[import-from-json] 累计统计 - 已处理: ${totalProcessed}/${totalQuestions}, 新增: ${totalImported}, 更新: ${totalUpdated}, 错误: ${totalErrors}`);
                sendProgress({
                  processed: totalProcessed,
                  total: totalQuestions,
                  imported: totalImported,
                  updated: totalUpdated,
                  errors: totalErrors,
                  currentBatch: batchNumber,
                  totalBatches: totalBatches,
                });
              } catch (error: any) {
                console.error(`[import-from-json] ❌❌❌ 批次 ${batchNumber} 处理失败 ❌❌❌`, {
                  error: error.message,
                  code: error.code,
                  detail: error.detail,
                  constraint: error.constraint,
                  stack: error.stack,
                  batchNumber,
                  batchSize: batch.length,
                  totalProcessed,
                });
                totalErrors += batch.length;
                // 发送错误进度更新
                sendProgress({
                  processed: totalProcessed,
                  total: totalQuestions,
                  imported: totalImported,
                  updated: totalUpdated,
                  errors: totalErrors,
                  currentBatch: batchNumber,
                  totalBatches: totalBatches,
                });
              }
            }

            // 发送最终结果
            const finalResult = {
              type: 'complete',
              totalProcessed: totalProcessed,
              totalImported: totalImported,
              totalUpdated: totalUpdated,
              totalErrors: totalErrors,
              errors: errors.slice(0, 50),
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalResult)}\n\n`));
            controller.close();
          } catch (error: any) {
            const errorResult = {
              type: 'error',
              message: error.message || String(error),
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorResult)}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 非流式响应（原有逻辑）
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

      // 辅助函数：规范化explanation字段（确保返回有效的JSON对象或null）
      const normalizeExplanation = (question: Question): { zh: string; en?: string; ja?: string; [key: string]: string | undefined } | null => {
        if (!question.explanation) return null;
        if (typeof question.explanation === "string") {
          // 如果是字符串，转换为对象格式
          return { zh: question.explanation };
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

      // 辅助函数：规范化options字段（确保是有效的JSON格式）
      const normalizeOptions = (options: any): any | null => {
        if (!options) return null;
        // 如果已经是数组，直接返回
        if (Array.isArray(options)) {
          return options;
        }
        // 如果是字符串，转换为数组
        if (typeof options === "string") {
          return [options];
        }
        // 如果是对象，尝试转换为数组或保持对象
        if (typeof options === "object") {
          return options;
        }
        // 其他情况返回null
        return null;
      };

      // 辅助函数：规范化correct_answer字段（确保是有效的JSON格式）
      const normalizeCorrectAnswer = (correctAnswer: any, questionType: "single" | "multiple" | "truefalse"): any => {
        if (correctAnswer === null || correctAnswer === undefined) {
          return null;
        }
        // 如果是字符串，根据题目类型处理
        if (typeof correctAnswer === "string") {
          if (questionType === "multiple") {
            // 多选题应该是数组
            return [correctAnswer];
          }
          return correctAnswer;
        }
        // 如果是数组，直接返回
        if (Array.isArray(correctAnswer)) {
          return correctAnswer;
        }
        // 其他情况返回原值
        return correctAnswer;
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
            type: "single" | "multiple" | "truefalse";
            content: any;
            options: any;
            correct_answer: any;
            image: string | null;
            explanation: any;
            license_type_tag: any;
            category: string;
            stage_tag: "both" | "provisional" | "regular" | null;
            topic_tags: any;
          }> = [];
          const toUpdate: Array<{
            id: number;
            type: "single" | "multiple" | "truefalse";
            content: any;
            options: any;
            correct_answer: any;
            image: string | null;
            explanation: any;
            license_type_tag: any;
            category: string;
            stage_tag: "both" | "provisional" | "regular" | null;
            topic_tags: any;
          }> = [];

          // 步骤4：处理每个题目，准备批量操作数据
          for (const { question, hash } of questionHashes) {
            try {
              packageProcessed++;
              totalProcessed++;

              const contentMultilang = normalizeContent(question);
              const explanationMultilang = normalizeExplanation(question);
              const optionsNormalized = normalizeOptions(question.options);
              const correctAnswerNormalized = normalizeCorrectAnswer(question.correctAnswer, question.type as "single" | "multiple" | "truefalse");
              const questionCategory = question.category || "其他";
              // 优先使用 license_type_tag，如果没有则使用 license_tags（兼容旧格式）
              const licenseTypeTag = (question as any).license_type_tag 
                || (question.license_tags && question.license_tags.length > 0 ? question.license_tags : null);
              const stageTag: "both" | "provisional" | "regular" | null = 
                (question.stage_tag === "both" || question.stage_tag === "provisional" || question.stage_tag === "regular")
                  ? question.stage_tag
                  : null;
              const topicTags = question.topic_tags || null;

              const existingId = hashToIdMap.get(hash);
              
              if (existingId) {
                // 准备更新数据
                toUpdate.push({
                  id: existingId,
                  type: question.type as "single" | "multiple" | "truefalse",
                  content: contentMultilang as any,
                  options: optionsNormalized,
                  correct_answer: correctAnswerNormalized,
                  image: question.image || null,
                  explanation: explanationMultilang as any,
                  license_type_tag: licenseTypeTag,
                  category: questionCategory,
                  stage_tag: stageTag,
                  topic_tags: topicTags,
                });
              } else {
                // 准备插入数据 - 确保不包含id字段，让数据库自动生成
                const insertData: any = {
                  content_hash: hash,
                  type: question.type as "single" | "multiple" | "truefalse",
                  content: contentMultilang as any,
                  options: optionsNormalized,
                  correct_answer: correctAnswerNormalized,
                  image: question.image || null,
                  explanation: explanationMultilang as any,
                  license_type_tag: licenseTypeTag,
                  category: questionCategory,
                  stage_tag: stageTag,
                  topic_tags: topicTags,
                };
                // 明确排除id字段（如果存在）
                delete insertData.id;
                toInsert.push(insertData);
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
            // 确保所有插入数据都不包含id字段
            const cleanInsertData = toInsert.map(item => {
              const clean: any = { ...item };
              delete clean.id; // 明确删除id字段
              return clean;
            });
            
            try {
              // 使用事务确保数据一致性
              await db.transaction().execute(async (trx) => {
                // 分批插入，避免单次插入过多数据导致超时
                const INSERT_BATCH_SIZE = 50; // 减小批量插入大小
                for (let j = 0; j < cleanInsertData.length; j += INSERT_BATCH_SIZE) {
                  const insertBatch = cleanInsertData.slice(j, j + INSERT_BATCH_SIZE);
                  await trx
                    .insertInto("questions")
                    .values(insertBatch)
                    .execute();
                  console.log(`[import-from-json] 批次 ${batchNumber} 子批次 ${Math.floor(j / INSERT_BATCH_SIZE) + 1} 插入 ${insertBatch.length} 个题目`);
                }
              });
              packageImported += toInsert.length;
              totalImported += toInsert.length;
              console.log(`[import-from-json] 批次 ${batchNumber} 批量插入完成，共 ${toInsert.length} 个新题目`);
            } catch (error: any) {
              console.error(`[import-from-json] 批次 ${batchNumber} 批量插入失败:`, error);
              console.error(`[import-from-json] 错误详情:`, {
                message: error.message,
                code: error.code,
                detail: error.detail,
                constraint: error.constraint,
                stack: error.stack?.substring(0, 500),
              });
              // 如果批量插入失败，尝试逐个插入（带重试）
              for (let idx = 0; idx < cleanInsertData.length; idx++) {
                const item = cleanInsertData[idx];
                let retryCount = 0;
                const maxRetries = 3;
                let success = false;
                
                while (retryCount < maxRetries && !success) {
                  try {
                    await db.insertInto("questions").values(item).execute();
                    packageImported++;
                    totalImported++;
                    success = true;
                    if (retryCount > 0) {
                      console.log(`[import-from-json] 批次 ${batchNumber} 题目 ${idx + 1} 重试 ${retryCount} 次后成功`);
                    }
                  } catch (singleError: any) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                      packageErrors++;
                      totalErrors++;
                      const errorMsg = `插入题目失败 (批次 ${batchNumber}, 索引 ${idx + 1}): ${singleError.message || String(singleError)}`;
                      errors.push(errorMsg);
                      console.error(`[import-from-json] ${errorMsg}`, {
                        code: singleError.code,
                        detail: singleError.detail,
                        constraint: singleError.constraint,
                        hash: item.content_hash?.substring(0, 16),
                        hasId: 'id' in item,
                      });
                    } else {
                      // 等待后重试
                      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                      console.warn(`[import-from-json] 批次 ${batchNumber} 题目 ${idx + 1} 插入失败，${retryCount} 秒后重试...`);
                    }
                  }
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
                    license_type_tag: item.license_type_tag,
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

