#!/usr/bin/env tsx
// ============================================================
// 脚本：修复批量处理产生的幽灵题
// 功能：
// 1. 从 question_processing_task_items 表的 ai_response 恢复题目内容到原题目ID
// 2. 删除 ID >= 1377 的幽灵题
// 使用方法: tsx scripts/fix-ghost-questions.ts
// ============================================================

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

// 处理 SSL 证书问题（仅用于脚本环境）
if (process.env.DATABASE_URL?.includes('supabase.com') || process.env.POSTGRES_URL?.includes('supabase.com')) {
  // 对于 Supabase 连接，禁用 SSL 证书验证（仅用于脚本环境）
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { db } from "../src/lib/db";
import { saveQuestionToDb } from "../src/lib/questionDb";
import { normalizeCorrectAnswer } from "../src/lib/questionDb";
import { cleanJsonString, sanitizeJsonForDb } from "../src/app/api/admin/question-processing/_lib/jsonUtils";
import { buildNormalizedQuestion } from "../src/lib/questionNormalize";

// ============================================================
// 本地实现的工具函数（避免依赖服务器端模块）
// ============================================================

/**
 * 安全过滤 AI 返回的 payload
 */
function sanitizeAiPayload(
  aiResult: any,
  params: {
    sourceLanguage: string;
    targetLanguages: string[];
    scene?: string;
  }
): {
  source?: {
    content?: string;
    options?: string[];
    explanation?: string;
  };
  translations?: Record<string, {
    content?: string;
    options?: string[];
    explanation?: string;
  }>;
  tags?: {
    license_type_tags?: string[];
    stage_tags?: string[];
    topic_tags?: string[];
    difficulty_level?: "easy" | "medium" | "hard" | null;
  };
  correct_answer?: any;
} {
  const { sourceLanguage, targetLanguages, scene } = params;
  const sanitized: any = {};

  // 白名单：source 字段
  if (aiResult.source && typeof aiResult.source === "object") {
    sanitized.source = {};
    if (typeof aiResult.source.content === "string") {
      sanitized.source.content = aiResult.source.content;
    }
    if (Array.isArray(aiResult.source.options)) {
      sanitized.source.options = aiResult.source.options.filter((opt: any) => typeof opt === "string");
    }
    if (typeof aiResult.source.explanation === "string") {
      sanitized.source.explanation = aiResult.source.explanation;
    }
  }

  // 白名单：translations 字段
  const translations = aiResult?.translations ?? {};
  const allowedLangs =
    Array.isArray(targetLanguages) && targetLanguages.length > 0
      ? targetLanguages
      : Object.keys(translations);
  
  const filteredTranslations: Record<string, any> = {};
  for (const lang of allowedLangs) {
    if (translations[lang] && typeof translations[lang] === "object") {
      const sanitizedTranslation: any = {};
      if (typeof translations[lang].content === "string") {
        sanitizedTranslation.content = translations[lang].content;
      }
      if (Array.isArray(translations[lang].options)) {
        sanitizedTranslation.options = translations[lang].options.filter((opt: any) => typeof opt === "string");
      }
      if (typeof translations[lang].explanation === "string") {
        sanitizedTranslation.explanation = translations[lang].explanation;
      }
      if (Object.keys(sanitizedTranslation).length > 0) {
        filteredTranslations[lang] = sanitizedTranslation;
      }
    }
  }

  // 如果 scene 是 full_pipeline，并且 AI 在 translations 里也返回了源语言
  if (
    scene === 'question_full_pipeline' &&
    translations[sourceLanguage] &&
    !filteredTranslations[sourceLanguage]
  ) {
    const sourceTranslation = translations[sourceLanguage];
    if (sourceTranslation && typeof sourceTranslation === "object") {
      const sanitizedSourceTranslation: any = {};
      if (typeof sourceTranslation.content === "string") {
        sanitizedSourceTranslation.content = sourceTranslation.content;
      }
      if (Array.isArray(sourceTranslation.options)) {
        sanitizedSourceTranslation.options = sourceTranslation.options.filter((opt: any) => typeof opt === "string");
      }
      if (typeof sourceTranslation.explanation === "string") {
        sanitizedSourceTranslation.explanation = sourceTranslation.explanation;
      }
      if (Object.keys(sanitizedSourceTranslation).length > 0) {
        filteredTranslations[sourceLanguage] = sanitizedSourceTranslation;
      }
    }
  }

  sanitized.translations = filteredTranslations;

  // 白名单：tags 字段
  if (aiResult.tags && typeof aiResult.tags === "object") {
    sanitized.tags = {};
    if (Array.isArray(aiResult.tags.license_type_tags)) {
      sanitized.tags.license_type_tags = aiResult.tags.license_type_tags.filter((t: any) => typeof t === "string");
    }
    if (Array.isArray(aiResult.tags.stage_tags)) {
      sanitized.tags.stage_tags = aiResult.tags.stage_tags.filter((t: any) => typeof t === "string");
    }
    if (Array.isArray(aiResult.tags.topic_tags)) {
      sanitized.tags.topic_tags = aiResult.tags.topic_tags.filter((t: any) => typeof t === "string");
    }
    if (["easy", "medium", "hard"].includes(aiResult.tags.difficulty_level)) {
      sanitized.tags.difficulty_level = aiResult.tags.difficulty_level;
    }
  }

  // 白名单：correct_answer 字段
  if ("correct_answer" in aiResult) {
    sanitized.correct_answer = aiResult.correct_answer;
  }

  // 强制类型检查：translations 必须是 Record<string, any>
  if (sanitized.translations !== undefined) {
    if (typeof sanitized.translations !== 'object' || Array.isArray(sanitized.translations)) {
      throw new Error("[sanitizeAiPayload] translations must be an object");
    }
    
    for (const key of Object.keys(sanitized.translations)) {
      if (typeof key !== "string") {
        throw new Error(`[sanitizeAiPayload] Invalid language key: ${key}`);
      }
    }
  }

  return sanitized;
}

/**
 * 构建 full_pipeline 的数据库落库结构
 */
function buildFullPipelineDbPayload(
  sanitized: any,
  opts: {
    sourceLang: string;
    targetLangs: string[];
  }
): {
  content?: Record<string, string>;
  explanation?: Record<string, string>;
  license_type_tag?: string[];
  stage_tag?: "both" | "provisional" | "regular" | null;
  topic_tags?: string[];
} {
  const payload: any = {};

  // 1) content / explanation 多语言合并
  const content: Record<string, string> = {};
  const explanation: Record<string, string> = {};

  if (sanitized.source?.content) {
    content[opts.sourceLang] = sanitized.source.content;
  }
  if (sanitized.source?.explanation) {
    explanation[opts.sourceLang] = sanitized.source.explanation;
  }

  const translations = sanitized.translations ?? {};
  for (const [lang, value] of Object.entries<any>(translations)) {
    if (value?.content) {
      content[lang] = value.content;
    }
    if (value?.explanation) {
      explanation[lang] = value.explanation;
    }
  }

  if (Object.keys(content).length) {
    payload.content = content;
  }
  if (Object.keys(explanation).length) {
    payload.explanation = explanation;
  }

  // 2) Tags 映射到 DB 字段名
  const rawTags = sanitized.tags ?? {};

  // topic_tags：直接透传 string[]
  if (Array.isArray(rawTags.topic_tags) && rawTags.topic_tags.length > 0) {
    payload.topic_tags = rawTags.topic_tags;
  }

  // license_type_tag：AI 输出为 license_type_tags，映射成 DB 字段名（保持数组）
  if (Array.isArray(rawTags.license_type_tags) && rawTags.license_type_tags.length > 0) {
    payload.license_type_tag = rawTags.license_type_tags;
  }

  // stage_tag：当前 AI 输出为 stage_tags:string[]，DB 为单值
  if (Array.isArray(rawTags.stage_tags) && rawTags.stage_tags.length === 1) {
    const stageTag = rawTags.stage_tags[0].toUpperCase();
    if (stageTag.includes("BOTH")) {
      payload.stage_tag = "both";
    } else if (stageTag.includes("FULL") || stageTag.includes("REGULAR") || stageTag.includes("FULL_LICENSE")) {
      payload.stage_tag = "regular";
    } else if (stageTag.includes("PROVISIONAL")) {
      payload.stage_tag = "provisional";
    } else {
      payload.stage_tag = rawTags.stage_tags[0].toLowerCase();
    }
  } else if (Array.isArray(rawTags.stage_tags) && rawTags.stage_tags.length > 1) {
    const normalized = rawTags.stage_tags
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().toUpperCase());
    
    const hasBoth = normalized.some((t) => t.includes("BOTH"));
    const hasFull = normalized.some((t) => t.includes("FULL") || t.includes("REGULAR") || t.includes("FULL_LICENSE"));
    const hasProvisional = normalized.some((t) => t.includes("PROVISIONAL"));

    if (hasBoth) {
      payload.stage_tag = "both";
    } else if (hasFull) {
      payload.stage_tag = "regular";
    } else if (hasProvisional) {
      payload.stage_tag = "provisional";
    } else {
      payload.stage_tag = normalized[0].toLowerCase();
    }
  } else {
    payload.stage_tag = null;
  }

  return payload;
}

/**
 * 应用 tags 到 question 对象
 */
function applyTagsFromFullPipeline(
  tags: {
    license_type_tags?: string[];
    stage_tags?: string[];
    topic_tags?: string[];
    difficulty_level?: "easy" | "medium" | "hard" | null;
  },
  question: any
): void {
  // 处理 license_type_tag
  if (tags.license_type_tags && Array.isArray(tags.license_type_tags) && tags.license_type_tags.length > 0) {
    const normalized = tags.license_type_tags
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim());
    question.license_tags = Array.from(new Set(normalized));
  }

  // 处理 stage_tag
  if (tags.stage_tags && Array.isArray(tags.stage_tags) && tags.stage_tags.length > 0) {
    const normalized = tags.stage_tags
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().toUpperCase());

    if (normalized.length > 0) {
      const hasBoth = normalized.some((t) => t.includes("BOTH"));
      const hasFull = normalized.some((t) => t.includes("FULL") || t.includes("REGULAR") || t.includes("FULL_LICENSE"));
      const hasProvisional = normalized.some((t) => t.includes("PROVISIONAL"));

      if (hasBoth) {
        question.stage_tag = "both";
      } else if (hasFull) {
        question.stage_tag = "regular";
      } else if (hasProvisional) {
        question.stage_tag = "provisional";
      } else {
        question.stage_tag = normalized[0].toLowerCase();
      }
    }
  }
  
  // 处理 topic_tags
  if (tags.topic_tags && Array.isArray(tags.topic_tags) && tags.topic_tags.length > 0) {
    const normalized = tags.topic_tags
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim());
    question.topic_tags = Array.from(new Set(normalized));
  }
}

interface TaskItem {
  id: number;
  question_id: number;
  operation: string;
  target_lang: string | null;
  status: string;
  ai_response: any;
  ai_request: any;
}

interface GhostQuestion {
  id: number;
  content_hash: string;
  type: "single" | "multiple" | "truefalse";
  content: any;
  options: any;
  correct_answer: any;
  explanation?: any;
}

/**
 * 从 ai_response 恢复题目内容
 */
async function recoverQuestionFromAiResponse(taskItem: TaskItem): Promise<boolean> {
  try {
    const questionId = taskItem.question_id;
    
    // 1. 读取原题目数据
    const originalQuestion = await db
      .selectFrom("questions")
      .selectAll()
      .where("id", "=", questionId)
      .executeTakeFirst();
    
    if (!originalQuestion) {
      console.error(`[恢复] 题目 ID ${questionId} 不存在，跳过`);
      return false;
    }
    
    // 2. 解析 ai_response
    let aiResponse: any = null;
    if (taskItem.ai_response) {
      if (typeof taskItem.ai_response === "string") {
        try {
          aiResponse = JSON.parse(taskItem.ai_response);
        } catch (e) {
          console.error(`[恢复] 题目 ID ${questionId} 的 ai_response 解析失败:`, e);
          return false;
        }
      } else {
        aiResponse = taskItem.ai_response;
      }
    }
    
    if (!aiResponse || typeof aiResponse !== "object") {
      console.error(`[恢复] 题目 ID ${questionId} 的 ai_response 无效`);
      return false;
    }
    
    // 3. 从 ai_request 中提取 sourceLanguage 和 targetLanguages
    let sourceLanguage = "zh";
    let targetLanguages: string[] = ["ja", "en"];
    
    if (taskItem.ai_request) {
      let aiRequest: any = null;
      if (typeof taskItem.ai_request === "string") {
        try {
          aiRequest = JSON.parse(taskItem.ai_request);
        } catch (e) {
          console.warn(`[恢复] 题目 ID ${questionId} 的 ai_request 解析失败，使用默认值`);
        }
      } else {
        aiRequest = taskItem.ai_request;
      }
      
      if (aiRequest && typeof aiRequest === "object") {
        if (aiRequest.sourceLanguage) {
          sourceLanguage = aiRequest.sourceLanguage;
        }
        if (aiRequest.targetLanguages && Array.isArray(aiRequest.targetLanguages)) {
          targetLanguages = aiRequest.targetLanguages;
        } else if (aiRequest.targetLanguage) {
          targetLanguages = [aiRequest.targetLanguage];
        }
      }
    }
    
    // 4. 清理和解析 AI 响应
    let parsed: any = null;
    let rawAnswer = "";
    
    // 尝试从 aiResponse 中提取 answer 字段
    if (aiResponse.answer) {
      rawAnswer = typeof aiResponse.answer === "string" ? aiResponse.answer : JSON.stringify(aiResponse.answer);
    } else if (typeof aiResponse === "string") {
      rawAnswer = aiResponse;
    } else {
      // 如果 aiResponse 本身就是解析后的对象
      parsed = aiResponse;
    }
    
    if (!parsed && rawAnswer) {
      // 尝试从代码块中提取 JSON
      const codeBlockMatch = rawAnswer.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlockMatch) {
        rawAnswer = codeBlockMatch[1].trim();
      }
      
      try {
        parsed = JSON.parse(cleanJsonString(rawAnswer));
      } catch (parseError) {
        console.error(`[恢复] 题目 ID ${questionId} 的 JSON 解析失败:`, parseError);
        return false;
      }
    }
    
    if (!parsed || typeof parsed !== "object") {
      console.error(`[恢复] 题目 ID ${questionId} 的解析结果无效`);
      return false;
    }
    
    // 5. 验证解析结果
    if (!parsed.source || !parsed.source.content) {
      console.error(`[恢复] 题目 ID ${questionId} 的解析结果缺少 source.content`);
      return false;
    }
    
    // 6. 安全过滤 AI payload
    const sanitized = sanitizeAiPayload(parsed, {
      sourceLanguage,
      targetLanguages,
      scene: 'question_full_pipeline',
    });
    
    // 7. 应用 tags
    const questionForTags: any = {
      id: questionId,
      license_tags: originalQuestion.license_type_tag || null,
      stage_tag: originalQuestion.stage_tag || null,
      topic_tags: originalQuestion.topic_tags || null,
    };
    
    if (sanitized.tags) {
      applyTagsFromFullPipeline(sanitized.tags, questionForTags);
    }
    
    // 8. 构建数据库 payload
    const dbPayload = buildFullPipelineDbPayload(sanitized, {
      sourceLang: sourceLanguage,
      targetLangs: targetLanguages,
    });
    
    // 9. 获取数据库中的源语言内容（不使用 AI 返回的 source，防止覆盖）
    let sourceContent = "";
    let sourceOptions: any[] = [];
    
    if (typeof originalQuestion.content === "string") {
      sourceContent = originalQuestion.content;
    } else if (typeof originalQuestion.content === "object" && originalQuestion.content !== null) {
      sourceContent = (originalQuestion.content as any)[sourceLanguage] || "";
    }
    
    if (Array.isArray(originalQuestion.options)) {
      sourceOptions = originalQuestion.options;
    }
    
    // 10. 构建归一化题目（使用数据库中的正确答案，不使用 AI 返回的）
    let normalizedQuestion;
    try {
      normalizedQuestion = buildNormalizedQuestion({
        type: originalQuestion.type,
        aiResult: {
          type: originalQuestion.type,
          correct_answer: originalQuestion.correct_answer, // 使用数据库中的正确答案
          source: {
            content: sourceContent,
            options: sourceOptions,
            explanation: "",
          },
        },
        inputPayload: undefined,
        currentQuestion: originalQuestion,
      });
    } catch (err: any) {
      console.error(`[恢复] 题目 ID ${questionId} 归一化失败:`, err.message);
      return false;
    }
    
    // 使用数据库中的 options（如果存在），否则使用归一化后的 options
    // 注意：full_pipeline 不应修改源语言的 options，保持原样
    const finalOptions = Array.isArray(originalQuestion.options) && originalQuestion.options.length > 0
      ? originalQuestion.options
      : (normalizedQuestion.options || []);
    
    // 11. 合并多语言内容（只添加翻译，不覆盖源语言）
    let updatedContent: any = {};
    if (typeof originalQuestion.content === "object" && originalQuestion.content !== null) {
      updatedContent = { ...(originalQuestion.content as any) };
    } else if (typeof originalQuestion.content === "string") {
      updatedContent = { [sourceLanguage]: originalQuestion.content };
    }
    
    // 添加翻译内容
    if (dbPayload.content) {
      Object.assign(updatedContent, dbPayload.content);
    }
    
    // 12. 合并 explanation
    let updatedExplanation: any = null;
    if (originalQuestion.explanation) {
      if (typeof originalQuestion.explanation === "object" && originalQuestion.explanation !== null) {
        updatedExplanation = { ...(originalQuestion.explanation as any) };
      } else if (typeof originalQuestion.explanation === "string") {
        updatedExplanation = { [sourceLanguage]: originalQuestion.explanation };
      }
    } else {
      updatedExplanation = {};
    }
    
    // 添加翻译的 explanation（只添加目标语言的翻译，不覆盖源语言）
    if (dbPayload.explanation) {
      for (const [lang, explanation] of Object.entries(dbPayload.explanation)) {
        // 只添加目标语言的翻译，不覆盖源语言
        if (lang !== sourceLanguage && explanation) {
          updatedExplanation[lang] = explanation;
        }
      }
    }
    
    // 13. 使用事务更新题目
    await db.transaction().execute(async (trx) => {
      // 先读取数据库中的 explanation（保留原有内容）
      const dbQuestion = await trx
        .selectFrom("questions")
        .select(["explanation"])
        .where("id", "=", questionId)
        .executeTakeFirst();
      
      // 保存题目主表（使用 updateOnly 模式）
      await saveQuestionToDb({
        id: questionId,
        type: normalizedQuestion.type,
        content: updatedContent,
        options: finalOptions,
        correctAnswer: normalizedQuestion.correctAnswer || normalizeCorrectAnswer(originalQuestion.correct_answer, originalQuestion.type),
        explanation: dbQuestion?.explanation || null,
        license_tags: questionForTags.license_tags,
        stage_tag: questionForTags.stage_tag,
        topic_tags: questionForTags.topic_tags,
        mode: "updateOnly",
      } as any);
      
      // 更新多语言内容
      const safeContent = sanitizeJsonForDb(updatedContent);
      const safeExplanation = sanitizeJsonForDb(updatedExplanation);
      
      await trx
        .updateTable("questions")
        .set({
          content: safeContent as any,
          explanation: safeExplanation as any,
          license_type_tag: questionForTags.license_tags || null,
          stage_tag: questionForTags.stage_tag || null,
          topic_tags: questionForTags.topic_tags || null,
          updated_at: new Date(),
        })
        .where("id", "=", questionId)
        .execute();
    });
    
    console.log(`[恢复] ✅ 题目 ID ${questionId} 恢复成功`);
    return true;
  } catch (error: any) {
    console.error(`[恢复] ❌ 题目 ID ${taskItem.question_id} 恢复失败:`, error.message);
    return false;
  }
}

/**
 * 删除幽灵题
 */
async function deleteGhostQuestions(): Promise<number> {
  try {
    // 查询所有 ID >= 1377 的题目
    const ghostQuestions = await db
      .selectFrom("questions")
      .selectAll()
      .where("id", ">=", 1377)
      .orderBy("id", "asc")
      .execute();
    
    console.log(`\n找到 ${ghostQuestions.length} 个潜在的幽灵题（ID >= 1377）`);
    
    let deletedCount = 0;
    
    for (const ghost of ghostQuestions) {
      // 验证是否为幽灵题：检查是否有对应的 task_item 记录
      const taskItems = await db
        .selectFrom("question_processing_task_items")
        .select(["id", "question_id", "operation", "status"])
        .where("question_id", "=", ghost.id)
        .execute();
      
      // 如果没有 task_item 记录，或者所有记录都是失败的，则认为是幽灵题
      const hasSuccessfulTask = taskItems.some(item => item.status === "succeeded");
      
      if (!hasSuccessfulTask) {
        console.log(`[删除] 删除幽灵题 ID ${ghost.id}（无成功的 task_item 记录）`);
        
        // 删除相关的 AI 回答记录
        await db
          .deleteFrom("question_ai_answers")
          .where("question_hash", "=", ghost.content_hash)
          .execute();
        
        // 删除题目
        await db
          .deleteFrom("questions")
          .where("id", "=", ghost.id)
          .execute();
        
        deletedCount++;
      } else {
        console.log(`[跳过] 题目 ID ${ghost.id} 有成功的 task_item 记录，保留`);
      }
    }
    
    return deletedCount;
  } catch (error: any) {
    console.error(`[删除] 删除幽灵题失败:`, error.message);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("==========================================");
  console.log("开始修复批量处理产生的幽灵题");
  console.log("==========================================\n");
  
  try {
    // 步骤1: 从 ai_response 恢复题目内容
    console.log("步骤1: 从 question_processing_task_items 恢复题目内容...\n");
    
    const taskItems = await db
      .selectFrom("question_processing_task_items")
      .selectAll()
      .where("operation", "=", "full_pipeline")
      .where("status", "=", "succeeded")
      .orderBy("question_id", "asc")
      .execute();
    
    console.log(`找到 ${taskItems.length} 个成功的 full_pipeline 任务项\n`);
    
    let recoveredCount = 0;
    let failedCount = 0;
    
    for (const taskItem of taskItems) {
      const success = await recoverQuestionFromAiResponse(taskItem as TaskItem);
      if (success) {
        recoveredCount++;
      } else {
        failedCount++;
      }
    }
    
    console.log(`\n恢复完成: 成功 ${recoveredCount} 个，失败 ${failedCount} 个\n`);
    
    // 步骤2: 删除幽灵题
    console.log("步骤2: 删除幽灵题（ID >= 1377）...\n");
    
    const deletedCount = await deleteGhostQuestions();
    
    console.log(`\n删除完成: 共删除 ${deletedCount} 个幽灵题\n`);
    
    console.log("==========================================");
    console.log("修复完成！");
    console.log(`- 恢复题目: ${recoveredCount} 个`);
    console.log(`- 删除幽灵题: ${deletedCount} 个`);
    console.log("==========================================");
    
    process.exit(0);
  } catch (error: any) {
    console.error("\n修复失败:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行主函数
main();

