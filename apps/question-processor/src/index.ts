import Fastify from "fastify";
import dotenv from "dotenv";
import { z } from "zod";
import { createDb } from "./db";
import { translateWithPolish, polishContent } from "./ai";

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
      sourceContent = {
        content: q.content,
        options: Array.isArray(q.options) ? q.options : (q.options ? [String(q.options)] : undefined),
        explanation: q.explanation || undefined
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
      text = {
        content: q.content,
        options: Array.isArray(q.options) ? q.options : (q.options ? [String(q.options)] : undefined),
        explanation: q.explanation || undefined
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
    return reply.send({ ok: true });
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
    oldExplanation = q.explanation;
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

const port = Number(process.env.QUESTION_PROCESSOR_PORT || 8083);
app.listen({ port, host: "0.0.0.0" })
  .then(addr => {
    app.log.info(`question-processor listening at ${addr}`);
  })
  .catch(err => {
    app.log.error(err);
    process.exit(1);
  });


