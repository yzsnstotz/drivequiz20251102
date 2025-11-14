import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { translateWithPolish } from "../_lib/batchProcessUtils";

export const POST = withAdminAuth(async (req: Request) => {
  const requestId = `api-translate-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    console.log(`[API Translate] [${requestId}] Request received`);
    const body = await req.json().catch(() => ({}));
    const { questionId, contentHash, from, to } = body || {};
    console.log(`[API Translate] [${requestId}] Body:`, { questionId, contentHash, from, to });
    
    if ((!questionId && !contentHash) || !from || !to) {
      console.error(`[API Translate] [${requestId}] Missing required fields`);
      return badRequest("questionId/contentHash, from, to are required");
    }

    // 支持 to 为字符串或字符串数组
    const targetLanguages = Array.isArray(to) ? to : [to];
    
    // 获取题目内容
    let question: any = null;
    if (contentHash) {
      question = await db
        .selectFrom("questions")
        .select(["id", "content_hash", "content", "options", "explanation"])
        .where("content_hash", "=", contentHash)
        .executeTakeFirst();
    } else if (questionId) {
      question = await db
        .selectFrom("questions")
        .select(["id", "content_hash", "content", "options", "explanation"])
        .where("id", "=", questionId)
        .executeTakeFirst();
    }

    if (!question) {
      return badRequest("Question not found");
    }

    // 获取源语言内容
    let content: string = "";
    let options: string[] | undefined = undefined;
    let explanation: string | undefined = undefined;

    if (from.toLowerCase().startsWith("zh")) {
      // 从 questions 表获取中文内容
      if (typeof question.content === "object" && question.content !== null) {
        content = question.content.zh || "";
      } else {
        content = String(question.content || "");
      }
      options = Array.isArray(question.options) ? question.options : undefined;
      if (question.explanation) {
        if (typeof question.explanation === "object" && question.explanation !== null) {
          explanation = question.explanation.zh || undefined;
        } else {
          explanation = String(question.explanation || "");
        }
      }
    } else {
      // 从 question_translations 表获取翻译内容
      const translation = await db
        .selectFrom("question_translations")
        .select(["content", "options", "explanation"])
        .where("content_hash", "=", question.content_hash)
        .where("locale", "=", from)
        .executeTakeFirst();
      
      if (translation) {
        content = translation.content || "";
        options = Array.isArray(translation.options) ? translation.options : undefined;
        explanation = translation.explanation || undefined;
      } else {
        return badRequest(`Source language translation not found for locale: ${from}`);
      }
    }

    if (!content) {
      return badRequest("Source content is empty");
    }

    // 为每个目标语言执行翻译
    const results: any[] = [];
    for (const targetLang of targetLanguages) {
      console.log(`[API Translate] [${requestId}] Translating to ${targetLang}`);
      try {
        const result = await translateWithPolish({
          source: {
            content,
            options,
            explanation,
          },
          from,
          to: targetLang,
        });

        // 保存翻译结果
        const existing = await db
          .selectFrom("question_translations")
          .select(["id"])
          .where("content_hash", "=", question.content_hash)
          .where("locale", "=", targetLang)
          .executeTakeFirst();

        if (existing) {
          await db
            .updateTable("question_translations")
            .set({
              content: result.content,
              options: result.options ? (result.options as any) : null,
              explanation: result.explanation || null,
              updated_at: new Date(),
            })
            .where("id", "=", existing.id)
            .execute();
        } else {
          await db
            .insertInto("question_translations")
            .values({
              content_hash: question.content_hash,
              locale: targetLang,
              content: result.content,
              options: result.options ? (result.options as any) : null,
              explanation: result.explanation || null,
              source: "ai",
            })
            .execute();
        }

        results.push({ locale: targetLang, success: true });
        console.log(`[API Translate] [${requestId}] Translation to ${targetLang} completed`);
      } catch (error: any) {
        console.error(`[API Translate] [${requestId}] Translation to ${targetLang} failed:`, error.message);
        results.push({ locale: targetLang, success: false, error: error.message });
      }
    }

    console.log(`[API Translate] [${requestId}] Request completed successfully`);
    return success({ results, ok: true });
  } catch (e: any) {
    console.error(`[API Translate] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Translate failed");
  }
});


