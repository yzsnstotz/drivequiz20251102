import Fastify from "fastify";
import dotenv from "dotenv";
import { z } from "zod";
import { createDb } from "./db";
import { translateWithPolish, polishContent, generateCategoryAndTags, fillMissingContent } from "./ai";

dotenv.config({ path: process.env.QUESTION_PROCESSOR_ENV || ".env.local" });

const app = Fastify({ logger: true });
const db = createDb();

// Health
app.get("/health", async () => {
  return { ok: true, service: "question-processor" };
});

// POST /translate
app.post("/translate", async (req, reply) => {
  const requestId = `translate-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    app.log.info({ requestId, body: req.body }, "[Translate] Request received");
    
    const schema = z.object({
      questionId: z.number().optional(),
      contentHash: z.string().optional(),
      from: z.string(),
      to: z.string()
    }).refine(v => !!(v.questionId || v.contentHash), {
      message: "questionId or contentHash required"
    });
    const input = schema.parse(req.body);
    
    app.log.info({ requestId, input }, "[Translate] Input validated");

    // Load source text (zh or a translation as from)
    app.log.info({ requestId, questionId: input.questionId, contentHash: input.contentHash }, "[Translate] Loading source content");
    const baseHash = input.contentHash || (await (async () => {
      app.log.info({ requestId, questionId: input.questionId }, "[Translate] Querying question by ID");
      const row = await db.selectFrom("questions").select(["content_hash"]).where("id", "=", input.questionId!).executeTakeFirst();
      if (!row) {
        app.log.error({ requestId, questionId: input.questionId }, "[Translate] Question not found");
        throw new Error("Question not found");
      }
      app.log.info({ requestId, contentHash: row.content_hash }, "[Translate] Question found");
      return row.content_hash;
    })());

    let sourceContent: { content: string; options?: string[]; explanation?: string } | null = null;
    if (input.from.toLowerCase().startsWith("zh")) {
      // from base questions
      app.log.info({ requestId, baseHash, from: input.from }, "[Translate] Loading from base questions table");
      const q = await db.selectFrom("questions")
        .select(["content", "options", "explanation"])
        .where("content_hash", "=", baseHash)
        .executeTakeFirst();
      if (!q) {
        app.log.error({ requestId, baseHash }, "[Translate] Base question not found");
        throw new Error("Base question not found");
      }
      app.log.info({ requestId, hasContent: !!q.content, hasOptions: !!q.options, hasExplanation: !!q.explanation }, "[Translate] Base question loaded");
      // 处理 explanation：支持多语言对象或字符串（向后兼容）
      let explanationText: string | undefined = undefined;
      if (q.explanation) {
        if (typeof q.explanation === "string") {
          explanationText = q.explanation;
        } else if (typeof q.explanation === "object" && q.explanation !== null) {
          // 多语言对象，优先使用中文
          explanationText = q.explanation.zh || undefined;
        }
      }
      sourceContent = {
        content: q.content,
        options: Array.isArray(q.options) ? q.options : (q.options ? [String(q.options)] : undefined),
        explanation: explanationText
      };
    } else {
      // from existing translation
      app.log.info({ requestId, baseHash, from: input.from }, "[Translate] Loading from translations table");
      const t = await db.selectFrom("question_translations")
        .select(["content", "options", "explanation"])
        .where("content_hash", "=", baseHash)
        .where("locale", "=", input.from)
        .executeTakeFirst();
      if (!t) {
        app.log.error({ requestId, baseHash, from: input.from }, "[Translate] Source translation not found");
        throw new Error("Source translation not found");
      }
      app.log.info({ requestId, hasContent: !!t.content, hasOptions: !!t.options, hasExplanation: !!t.explanation }, "[Translate] Source translation loaded");
      sourceContent = {
        content: t.content,
        options: Array.isArray(t.options) ? t.options : (t.options ? [String(t.options)] : undefined),
        explanation: t.explanation || undefined
      };
    }

    app.log.info({ requestId, from: input.from, to: input.to }, "[Translate] Calling AI translation service");
    const result = await translateWithPolish({
      source: sourceContent!,
      from: input.from,
      to: input.to
    });
    app.log.info({ requestId, hasContent: !!result.content, hasOptions: !!result.options, hasExplanation: !!result.explanation }, "[Translate] AI translation completed");

    // Upsert translation
    app.log.info({ requestId, baseHash, locale: input.to }, "[Translate] Checking for existing translation");
    const existing = await db.selectFrom("question_translations")
      .select(["id"])
      .where("content_hash", "=", baseHash)
      .where("locale", "=", input.to)
      .executeTakeFirst();

    if (existing) {
      app.log.info({ requestId, translationId: existing.id }, "[Translate] Updating existing translation");
      await db.updateTable("question_translations")
        .set({
          content: result.content,
          options: result.options ? (result.options as any) : null,
          explanation: result.explanation || null,
          updated_at: new Date()
        })
        .where("id", "=", existing.id)
        .execute();
      app.log.info({ requestId, translationId: existing.id }, "[Translate] Translation updated successfully");
    } else {
      app.log.info({ requestId, baseHash, locale: input.to }, "[Translate] Inserting new translation");
      await db.insertInto("question_translations")
        .values({
          content_hash: baseHash,
          locale: input.to,
          content: result.content,
          options: result.options ? (result.options as any) : null,
          explanation: result.explanation || null,
          source: "ai"
        })
        .execute();
      app.log.info({ requestId, baseHash, locale: input.to }, "[Translate] Translation inserted successfully");
    }

    app.log.info({ requestId, baseHash, locale: input.to }, "[Translate] Request completed successfully");
    return reply.send({ ok: true, data: { contentHash: baseHash, locale: input.to } });
  } catch (error: any) {
    app.log.error({ requestId, err: error, message: error?.message, stack: error?.stack }, "[Translate] Error occurred");
    const message = error?.message || "Internal server error";
    const statusCode = error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND" || message.includes("database") || message.includes("connection") ? 503 : 500;
    return reply.code(statusCode).send({ 
      ok: false, 
      message: message,
      error: process.env.NODE_ENV === "development" ? String(error) : undefined
    });
  }
});

// POST /polish
app.post("/polish", async (req, reply) => {
  const requestId = `polish-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    app.log.info({ requestId, body: req.body }, "[Polish] Request received");
    
    const schema = z.object({
      questionId: z.number().optional(),
      contentHash: z.string().optional(),
      locale: z.string()
    }).refine(v => !!(v.questionId || v.contentHash), {
      message: "questionId or contentHash required"
    });
    const input = schema.parse(req.body);
    
    app.log.info({ requestId, input }, "[Polish] Input validated");

    app.log.info({ requestId, questionId: input.questionId, contentHash: input.contentHash }, "[Polish] Loading content hash");
    const baseHash = input.contentHash || (await (async () => {
      app.log.info({ requestId, questionId: input.questionId }, "[Polish] Querying question by ID");
      const row = await db.selectFrom("questions").select(["content_hash"]).where("id", "=", input.questionId!).executeTakeFirst();
      if (!row) {
        app.log.error({ requestId, questionId: input.questionId }, "[Polish] Question not found");
        throw new Error("Question not found");
      }
      app.log.info({ requestId, contentHash: row.content_hash }, "[Polish] Question found");
      return row.content_hash;
    })());

    // Load text in locale
    app.log.info({ requestId, baseHash, locale: input.locale }, "[Polish] Loading text in locale");
    let text: { content: string; options?: string[]; explanation?: string } | null = null;
    if (input.locale.toLowerCase().startsWith("zh")) {
      app.log.info({ requestId, baseHash }, "[Polish] Loading from base questions table");
      const q = await db.selectFrom("questions")
        .select(["content", "options", "explanation"])
        .where("content_hash", "=", baseHash)
        .executeTakeFirst();
      if (!q) {
        app.log.error({ requestId, baseHash }, "[Polish] Base question not found");
        throw new Error("Base question not found");
      }
      app.log.info({ requestId, hasContent: !!q.content, hasOptions: !!q.options, hasExplanation: !!q.explanation }, "[Polish] Base question loaded");
      // 处理 explanation：支持多语言对象或字符串（向后兼容）
      let explanationText: string | undefined = undefined;
      if (q.explanation) {
        if (typeof q.explanation === "string") {
          explanationText = q.explanation;
        } else if (typeof q.explanation === "object" && q.explanation !== null) {
          // 多语言对象，优先使用中文
          explanationText = q.explanation.zh || undefined;
        }
      }
      text = {
        content: q.content,
        options: Array.isArray(q.options) ? q.options : (q.options ? [String(q.options)] : undefined),
        explanation: explanationText
      };
    } else {
      app.log.info({ requestId, baseHash, locale: input.locale }, "[Polish] Loading from translations table");
      const t = await db.selectFrom("question_translations")
        .select(["content", "options", "explanation"])
        .where("content_hash", "=", baseHash)
        .where("locale", "=", input.locale)
        .executeTakeFirst();
      if (!t) {
        app.log.error({ requestId, baseHash, locale: input.locale }, "[Polish] Translation not found");
        throw new Error("Translation not found");
      }
      app.log.info({ requestId, hasContent: !!t.content, hasOptions: !!t.options, hasExplanation: !!t.explanation }, "[Polish] Translation loaded");
      text = {
        content: t.content,
        options: Array.isArray(t.options) ? t.options : (t.options ? [String(t.options)] : undefined),
        explanation: t.explanation || undefined
      };
    }

    app.log.info({ requestId, locale: input.locale }, "[Polish] Calling AI polish service");
    const result = await polishContent({ text: text!, locale: input.locale });
    app.log.info({ requestId, hasContent: !!result.content, hasOptions: !!result.options, hasExplanation: !!result.explanation }, "[Polish] AI polish completed");

    // Insert review as pending
    app.log.info({ requestId, baseHash, locale: input.locale }, "[Polish] Inserting polish review");
    await db.insertInto("question_polish_reviews")
      .values({
        content_hash: baseHash,
        locale: input.locale,
        proposed_content: result.content,
        proposed_options: result.options ? (result.options as any) : null,
        proposed_explanation: result.explanation || null,
        status: "pending"
      })
      .execute();
    app.log.info({ requestId, baseHash, locale: input.locale }, "[Polish] Polish review inserted successfully");

    app.log.info({ requestId, baseHash, locale: input.locale }, "[Polish] Request completed successfully");
    return reply.send({ 
      ok: true,
      data: {
        content: result.content,
        options: result.options,
        explanation: result.explanation
      }
    });
  } catch (error: any) {
    app.log.error({ requestId, err: error, message: error?.message, stack: error?.stack }, "[Polish] Error occurred");
    const message = error?.message || "Internal server error";
    const statusCode = error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND" || message.includes("database") || message.includes("connection") ? 503 : 500;
    return reply.code(statusCode).send({ 
      ok: false, 
      message: message,
      error: process.env.NODE_ENV === "development" ? String(error) : undefined
    });
  }
});

// GET /reviews
app.get("/reviews", async (req, reply) => {
  const status = (req.query as any)?.status as string | undefined;
  const qb = db.selectFrom("question_polish_reviews")
    .selectAll()
    .orderBy("created_at", "desc");
  const rows = await (status
    ? qb.where("status", "=", status as any).execute()
    : qb.execute());
  return reply.send({ ok: true, data: rows });
});

// POST /reviews/:id/approve
app.post<{
  Params: { id: string }
}>("/reviews/:id/approve", async (req, reply) => {
  const id = Number(req.params.id);
  const review = await db.selectFrom("question_polish_reviews").selectAll().where("id", "=", id).executeTakeFirst();
  if (!review) return reply.code(404).send({ ok: false, message: "Not found" });

  // Load current text
  const baseHash = review.content_hash;
  const locale = review.locale;
  let oldContent: string | null = null;
  let oldOptions: any | null = null;
  let oldExplanation: string | null = null;

  if (locale.toLowerCase().startsWith("zh")) {
    const q = await db.selectFrom("questions")
      .select(["content", "options", "explanation"])
      .where("content_hash", "=", baseHash)
      .executeTakeFirst();
    if (!q) return reply.code(400).send({ ok: false, message: "Base question not found" });
    oldContent = q.content;
    oldOptions = q.options;
    // 处理 explanation：支持多语言对象或字符串（向后兼容）
    if (q.explanation) {
      if (typeof q.explanation === "string") {
        oldExplanation = q.explanation;
      } else if (typeof q.explanation === "object" && q.explanation !== null) {
        // 多语言对象，优先使用中文
        oldExplanation = q.explanation.zh || null;
      }
    }
    // Apply update to base
    await db.updateTable("questions")
      .set({
        content: review.proposed_content,
        options: review.proposed_options,
        explanation: review.proposed_explanation,
        updated_at: new Date()
      })
      .where("content_hash", "=", baseHash)
      .execute();
  } else {
    const t = await db.selectFrom("question_translations")
      .select(["content", "options", "explanation", "id"])
      .where("content_hash", "=", baseHash)
      .where("locale", "=", locale)
      .executeTakeFirst();
    oldContent = t?.content ?? null;
    oldOptions = t?.options ?? null;
    oldExplanation = t?.explanation ?? null;
    if (t) {
      await db.updateTable("question_translations")
        .set({
          content: review.proposed_content,
          options: review.proposed_options,
          explanation: review.proposed_explanation,
          updated_at: new Date()
        })
        .where("id", "=", t.id)
        .execute();
    } else {
      await db.insertInto("question_translations")
        .values({
          content_hash: baseHash,
          locale,
          content: review.proposed_content,
          options: review.proposed_options,
          explanation: review.proposed_explanation,
          source: "human"
        })
        .execute();
    }
  }

  // Write history
  await db.insertInto("question_polish_history")
    .values({
      content_hash: baseHash,
      locale,
      old_content: oldContent,
      old_options: oldOptions,
      old_explanation: oldExplanation,
      new_content: review.proposed_content,
      new_options: review.proposed_options,
      new_explanation: review.proposed_explanation,
      approved_by: null
    })
    .execute();

  // Update review status
  await db.updateTable("question_polish_reviews")
    .set({ status: "approved", reviewed_at: new Date(), updated_at: new Date() })
    .where("id", "=", id)
    .execute();

  return reply.send({ ok: true });
});

// POST /reviews/:id/reject
app.post<{
  Params: { id: string }
}>("/reviews/:id/reject", async (req, reply) => {
  const id = Number(req.params.id);
  const body = (req.body as any) || {};
  await db.updateTable("question_polish_reviews")
    .set({ status: "rejected", notes: String(body?.notes || ""), reviewed_at: new Date(), updated_at: new Date() })
    .where("id", "=", id)
    .execute();
  return reply.send({ ok: true });
});

// POST /batch-process - 批量处理题目
app.post("/batch-process", async (req, reply) => {
  const requestId = `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  let taskId: string | null = null;
  try {
    app.log.info({ requestId, body: req.body }, "[BatchProcess] Request received");
    
    const schema = z.object({
      questionIds: z.array(z.number()).optional(), // 可选：指定题目ID列表，如果不提供则处理全部
      operations: z.array(z.enum(["translate", "polish", "fill_missing", "category_tags"])), // 要执行的操作
      translateOptions: z.object({
        from: z.string(),
        to: z.string()
      }).optional(), // 翻译选项
      polishOptions: z.object({
        locale: z.string()
      }).optional(), // 润色选项
      batchSize: z.number().optional().default(10), // 每批处理数量
      continueOnError: z.boolean().optional().default(true), // 遇到错误是否继续
      createdBy: z.string().optional() // 创建者
    });
    
    const input = schema.parse(req.body);
    app.log.info({ requestId, input }, "[BatchProcess] Input validated");

    // 检查是否有正在处理的任务（确保顺序执行）
    const processingTask = await db.selectFrom("batch_process_tasks")
      .select(["task_id", "status"])
      .where("status", "in", ["pending", "processing"])
      .orderBy("created_at", "asc")
      .executeTakeFirst();
    
    if (processingTask) {
      app.log.warn({ requestId, existingTask: processingTask.task_id }, "[BatchProcess] Another task is already processing");
      return reply.code(409).send({
        ok: false,
        message: `Another task is already processing: ${processingTask.task_id}. Please wait for it to complete.`,
        existingTaskId: processingTask.task_id
      });
    }

    // 创建任务记录
    taskId = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    app.log.info({ requestId, taskId }, "[BatchProcess] Creating task record");
    
    const taskRecord = await db.insertInto("batch_process_tasks")
      .values({
        task_id: taskId,
        status: "pending",
        operations: input.operations,
        question_ids: input.questionIds && input.questionIds.length > 0 ? input.questionIds : null,
        translate_options: input.translateOptions ? (input.translateOptions as any) : null,
        polish_options: input.polishOptions ? (input.polishOptions as any) : null,
        batch_size: input.batchSize || 10,
        continue_on_error: input.continueOnError !== false,
        total_questions: 0,
        processed_count: 0,
        succeeded_count: 0,
        failed_count: 0,
        current_batch: 0,
        errors: null,
        details: null,
        created_by: input.createdBy || null
      })
      .returning(["id", "task_id"])
      .executeTakeFirst();
    
    app.log.info({ requestId, taskId: taskRecord?.task_id }, "[BatchProcess] Task record created");

    // 获取要处理的题目列表
    let questions: Array<{ 
      id: number; 
      content_hash: string; 
      content: any; 
      options: any; 
      explanation: {
        zh: string;
        en?: string;
        ja?: string;
        [key: string]: string | undefined;
      } | string | null; // 支持多语言对象或字符串（向后兼容）
    }> = [];
    
    if (input.questionIds && input.questionIds.length > 0) {
      app.log.info({ requestId, count: input.questionIds.length }, "[BatchProcess] Loading specified questions");
      questions = await db.selectFrom("questions")
        .select(["id", "content_hash", "content", "options", "explanation"])
        .where("id", "in", input.questionIds)
        .execute();
    } else {
      app.log.info({ requestId }, "[BatchProcess] Loading all questions");
      questions = await db.selectFrom("questions")
        .select(["id", "content_hash", "content", "options", "explanation"])
        .execute();
    }
    
    app.log.info({ requestId, total: questions.length }, "[BatchProcess] Questions loaded");

    // 更新任务状态为处理中，并设置总题目数
    await db.updateTable("batch_process_tasks")
      .set({
        status: "processing",
        total_questions: questions.length,
        started_at: new Date(),
        updated_at: new Date()
      })
      .where("task_id", "=", taskId)
      .execute();

    const results = {
      total: questions.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ questionId: number; error: string }>,
      details: [] as Array<{ questionId: number; operations: string[]; status: string }>
    };

    // 分批处理
    const batchSize = input.batchSize || 10;
    const totalBatches = Math.ceil(questions.length / batchSize);
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;
      app.log.info({ requestId, batch: currentBatch, totalBatches }, "[BatchProcess] Processing batch");
      
      // 更新当前批次
      await db.updateTable("batch_process_tasks")
        .set({
          current_batch: currentBatch,
          updated_at: new Date()
        })
        .where("task_id", "=", taskId)
        .execute();
      
      for (const question of batch) {
        const questionResult = {
          questionId: question.id,
          operations: [] as string[],
          status: "success" as "success" | "failed",
          error: null as string | null
        };

        try {
          // 获取题目内容（支持多语言）
          let content: string;
          if (typeof question.content === "string") {
            content = question.content;
          } else if (question.content && typeof question.content === "object") {
            content = question.content.zh || question.content.en || question.content.ja || "";
          } else {
            content = "";
          }
          
          const options = Array.isArray(question.options) 
            ? question.options 
            : (question.options ? [String(question.options)] : null);
          
          // 处理 explanation：支持多语言对象或字符串（向后兼容）
          let explanation: string | null = null;
          if (question.explanation) {
            if (typeof question.explanation === "string") {
              explanation = question.explanation;
            } else if (typeof question.explanation === "object" && question.explanation !== null) {
              // 多语言对象，优先使用中文
              explanation = question.explanation.zh || null;
            }
          }

          // 执行各种操作
          for (const operation of input.operations) {
            try {
              if (operation === "translate" && input.translateOptions) {
                app.log.info({ requestId, questionId: question.id, from: input.translateOptions.from, to: input.translateOptions.to }, "[BatchProcess] Translating");
                const sourceContent = {
                  content,
                  options: options || undefined,
                  explanation: explanation || undefined
                };
                const result = await translateWithPolish({
                  source: sourceContent,
                  from: input.translateOptions.from,
                  to: input.translateOptions.to
                });
                
                // 保存翻译结果
                const existing = await db.selectFrom("question_translations")
                  .select(["id"])
                  .where("content_hash", "=", question.content_hash)
                  .where("locale", "=", input.translateOptions.to)
                  .executeTakeFirst();
                
                if (existing) {
                  await db.updateTable("question_translations")
                    .set({
                      content: result.content,
                      options: result.options ? (result.options as any) : null,
                      explanation: result.explanation || null,
                      updated_at: new Date()
                    })
                    .where("id", "=", existing.id)
                    .execute();
                } else {
                  await db.insertInto("question_translations")
                    .values({
                      content_hash: question.content_hash,
                      locale: input.translateOptions.to,
                      content: result.content,
                      options: result.options ? (result.options as any) : null,
                      explanation: result.explanation || null,
                      source: "ai"
                    })
                    .execute();
                }
                questionResult.operations.push("translate");
              }
              
              if (operation === "polish" && input.polishOptions) {
                app.log.info({ requestId, questionId: question.id, locale: input.polishOptions.locale }, "[BatchProcess] Polishing");
                const text = {
                  content,
                  options: options || undefined,
                  explanation: explanation || undefined
                };
                const result = await polishContent({
                  text,
                  locale: input.polishOptions.locale
                });
                
                // 创建润色建议（待审核）
                await db.insertInto("question_polish_reviews")
                  .values({
                    content_hash: question.content_hash,
                    locale: input.polishOptions.locale,
                    proposed_content: result.content,
                    proposed_options: result.options ? (result.options as any) : null,
                    proposed_explanation: result.explanation || null,
                    status: "pending"
                  })
                  .execute();
                questionResult.operations.push("polish");
              }
              
              if (operation === "fill_missing") {
                app.log.info({ requestId, questionId: question.id }, "[BatchProcess] Filling missing content");
                const result = await fillMissingContent({
                  content,
                  options: options || null,
                  explanation: explanation || null
                });
                
                // 更新题目内容（如果原内容缺失）
                const needsUpdate = !content || !options || !explanation;
                if (needsUpdate) {
                  let updatedContent: any;
                  if (typeof question.content === "object" && question.content !== null) {
                    updatedContent = { ...question.content, zh: result.content || content };
                  } else {
                    updatedContent = result.content || content;
                  }
                  
                  // 处理 explanation：如果是字符串，转换为多语言对象
                  let updatedExplanation: any = null;
                  if (result.explanation) {
                    updatedExplanation = { zh: result.explanation };
                  } else if (question.explanation) {
                    // 保持原有的 explanation（可能是多语言对象或字符串）
                    if (typeof question.explanation === "string") {
                      updatedExplanation = { zh: question.explanation };
                    } else {
                      updatedExplanation = question.explanation;
                    }
                  }

                  await db.updateTable("questions")
                    .set({
                      content: updatedContent,
                      options: result.options ? (result.options as any) : question.options,
                      explanation: updatedExplanation,
                      updated_at: new Date()
                    })
                    .where("id", "=", question.id)
                    .execute();
                }
                questionResult.operations.push("fill_missing");
              }
              
              if (operation === "category_tags") {
                app.log.info({ requestId, questionId: question.id }, "[BatchProcess] Generating category and tags");
                const result = await generateCategoryAndTags({
                  content,
                  options: options || null,
                  explanation: explanation || null
                });
                
                // 更新题目的标签（只更新非空值）
                const updates: any = {
                  updated_at: new Date()
                };
                
                // 更新 license_type_tag（新字段）
                if (result.license_type_tag) {
                  updates.license_type_tag = result.license_type_tag;
                }
                // 更新 stage_tag
                if (result.stage_tag) {
                  updates.stage_tag = result.stage_tag;
                }
                // 更新 topic_tags
                if (result.topic_tags && Array.isArray(result.topic_tags) && result.topic_tags.length > 0) {
                  updates.topic_tags = result.topic_tags;
                }
                // 不再更新 category（category 是卷类，不是标签）
                
                await db.updateTable("questions")
                  .set(updates)
                  .where("id", "=", question.id)
                  .execute();
                questionResult.operations.push("category_tags");
              }
            } catch (opError: any) {
              app.log.error({ requestId, questionId: question.id, operation, error: opError.message }, "[BatchProcess] Operation failed");
              if (!input.continueOnError) {
                throw opError;
              }
              questionResult.status = "failed";
              questionResult.error = `${operation}: ${opError.message}`;
            }
          }
          
          results.processed++;
          if (questionResult.status === "success") {
            results.succeeded++;
          } else {
            results.failed++;
            results.errors.push({
              questionId: question.id,
              error: questionResult.error || "Unknown error"
            });
          }
          results.details.push(questionResult);
          
          // 实时更新任务进度
          await db.updateTable("batch_process_tasks")
            .set({
              processed_count: results.processed,
              succeeded_count: results.succeeded,
              failed_count: results.failed,
              errors: results.errors as any,
              details: results.details as any,
              updated_at: new Date()
            })
            .where("task_id", "=", taskId)
            .execute();
        } catch (error: any) {
          app.log.error({ requestId, questionId: question.id, error: error.message }, "[BatchProcess] Question processing failed");
          results.processed++;
          results.failed++;
          results.errors.push({
            questionId: question.id,
            error: error.message || "Unknown error"
          });
          results.details.push({
            questionId: question.id,
            operations: [],
            status: "failed"
          });
          
          if (!input.continueOnError) {
            throw error;
          }
        }
      }
    }

    // 更新任务状态为已完成
    await db.updateTable("batch_process_tasks")
      .set({
        status: "completed",
        processed_count: results.processed,
        succeeded_count: results.succeeded,
        failed_count: results.failed,
        errors: results.errors as any,
        details: results.details as any,
        completed_at: new Date(),
        updated_at: new Date()
      })
      .where("task_id", "=", taskId)
      .execute();

    app.log.info({ requestId, taskId, results }, "[BatchProcess] Batch processing completed");
    return reply.send({ 
      ok: true, 
      data: {
        ...results,
        taskId
      }
    });
  } catch (error: any) {
    app.log.error({ requestId, taskId, err: error, message: error?.message, stack: error?.stack }, "[BatchProcess] Error occurred");
    
    // 如果任务已创建，更新状态为失败
    if (taskId) {
      try {
        await db.updateTable("batch_process_tasks")
          .set({
            status: "failed",
            completed_at: new Date(),
            updated_at: new Date()
          })
          .where("task_id", "=", taskId)
          .execute();
      } catch (updateError) {
        app.log.error({ requestId, taskId, error: updateError }, "[BatchProcess] Failed to update task status");
      }
    }
    
    const message = error?.message || "Internal server error";
    const statusCode = error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND" || message.includes("database") || message.includes("connection") ? 503 : 500;
    return reply.code(statusCode).send({ 
      ok: false, 
      message: message,
      taskId: taskId || undefined,
      error: process.env.NODE_ENV === "development" ? String(error) : undefined
    });
  }
});

// GET /batch-process/:taskId - 查询任务状态
app.get<{
  Params: { taskId: string }
}>("/batch-process/:taskId", async (req, reply) => {
  const taskId = req.params.taskId;
  try {
    const task = await db.selectFrom("batch_process_tasks")
      .selectAll()
      .where("task_id", "=", taskId)
      .executeTakeFirst();
    
    if (!task) {
      return reply.code(404).send({ ok: false, message: "Task not found" });
    }
    
    return reply.send({ ok: true, data: task });
  } catch (error: any) {
    app.log.error({ taskId, error: error.message }, "[BatchProcess] Failed to fetch task");
    return reply.code(500).send({ ok: false, message: error.message });
  }
});

// GET /batch-process - 查询所有任务
app.get("/batch-process", async (req, reply) => {
  try {
    const status = (req.query as any)?.status;
    const limit = Number((req.query as any)?.limit) || 50;
    const offset = Number((req.query as any)?.offset) || 0;
    
    let query = db.selectFrom("batch_process_tasks")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset);
    
    if (status) {
      query = query.where("status", "=", status);
    }
    
    const tasks = await query.execute();
    const total = await db.selectFrom("batch_process_tasks")
      .select(db.fn.count<number>("id").as("count"))
      .executeTakeFirst();
    
    return reply.send({ 
      ok: true, 
      data: {
        tasks,
        total: Number(total?.count || 0),
        limit,
        offset
      }
    });
  } catch (error: any) {
    app.log.error({ error: error.message }, "[BatchProcess] Failed to fetch tasks");
    return reply.code(500).send({ ok: false, message: error.message });
  }
});

const port = Number(process.env.QUESTION_PROCESSOR_PORT || 8083);
app.listen({ port, host: "0.0.0.0" })
  .then(addr => {
    app.log.info(`question-processor listening at ${addr}`);
  })
  .catch(err => {
    app.log.error(err);
    process.exit(1);
  });


