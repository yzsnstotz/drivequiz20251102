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
  try {
    const schema = z.object({
      questionId: z.number().optional(),
      contentHash: z.string().optional(),
      from: z.string(),
      to: z.string()
    }).refine(v => !!(v.questionId || v.contentHash), {
      message: "questionId or contentHash required"
    });
    const input = schema.parse(req.body);

    // Load source text (zh or a translation as from)
    const baseHash = input.contentHash || (await (async () => {
      const row = await db.selectFrom("questions").select(["content_hash"]).where("id", "=", input.questionId!).executeTakeFirst();
      if (!row) throw new Error("Question not found");
      return row.content_hash;
    })());

    let sourceContent: { content: string; options?: string[]; explanation?: string } | null = null;
    if (input.from.toLowerCase().startsWith("zh")) {
      // from base questions
      const q = await db.selectFrom("questions")
        .select(["content", "options", "explanation"])
        .where("content_hash", "=", baseHash)
        .executeTakeFirst();
      if (!q) throw new Error("Base question not found");
      sourceContent = {
        content: q.content,
        options: Array.isArray(q.options) ? q.options : (q.options ? [String(q.options)] : undefined),
        explanation: q.explanation || undefined
      };
    } else {
      // from existing translation
      const t = await db.selectFrom("question_translations")
        .select(["content", "options", "explanation"])
        .where("content_hash", "=", baseHash)
        .where("locale", "=", input.from)
        .executeTakeFirst();
      if (!t) throw new Error("Source translation not found");
      sourceContent = {
        content: t.content,
        options: Array.isArray(t.options) ? t.options : (t.options ? [String(t.options)] : undefined),
        explanation: t.explanation || undefined
      };
    }

    const result = await translateWithPolish({
      source: sourceContent!,
      from: input.from,
      to: input.to
    });

    // Upsert translation
    const existing = await db.selectFrom("question_translations")
      .select(["id"])
      .where("content_hash", "=", baseHash)
      .where("locale", "=", input.to)
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
          content_hash: baseHash,
          locale: input.to,
          content: result.content,
          options: result.options ? (result.options as any) : null,
          explanation: result.explanation || null,
          source: "ai"
        })
        .execute();
    }

    return reply.send({ ok: true, data: { contentHash: baseHash, locale: input.to } });
  } catch (error: any) {
    app.log.error({ err: error }, "Translate endpoint error");
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
  try {
    const schema = z.object({
      questionId: z.number().optional(),
      contentHash: z.string().optional(),
      locale: z.string()
    }).refine(v => !!(v.questionId || v.contentHash), {
      message: "questionId or contentHash required"
    });
    const input = schema.parse(req.body);

    const baseHash = input.contentHash || (await (async () => {
      const row = await db.selectFrom("questions").select(["content_hash"]).where("id", "=", input.questionId!).executeTakeFirst();
      if (!row) throw new Error("Question not found");
      return row.content_hash;
    })());

    // Load text in locale
    let text: { content: string; options?: string[]; explanation?: string } | null = null;
    if (input.locale.toLowerCase().startsWith("zh")) {
      const q = await db.selectFrom("questions")
        .select(["content", "options", "explanation"])
        .where("content_hash", "=", baseHash)
        .executeTakeFirst();
      if (!q) throw new Error("Base question not found");
      text = {
        content: q.content,
        options: Array.isArray(q.options) ? q.options : (q.options ? [String(q.options)] : undefined),
        explanation: q.explanation || undefined
      };
    } else {
      const t = await db.selectFrom("question_translations")
        .select(["content", "options", "explanation"])
        .where("content_hash", "=", baseHash)
        .where("locale", "=", input.locale)
        .executeTakeFirst();
      if (!t) throw new Error("Translation not found");
      text = {
        content: t.content,
        options: Array.isArray(t.options) ? t.options : (t.options ? [String(t.options)] : undefined),
        explanation: t.explanation || undefined
      };
    }

    const result = await polishContent({ text: text!, locale: input.locale });

    // Insert review as pending
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

    return reply.send({ ok: true });
  } catch (error: any) {
    app.log.error({ err: error }, "Polish endpoint error");
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


