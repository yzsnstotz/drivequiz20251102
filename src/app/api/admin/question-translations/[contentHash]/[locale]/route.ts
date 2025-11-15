import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, notFound, success, internalError } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";

// DELETE /api/admin/question-translations/:contentHash/:locale
// 删除指定题目的指定语言翻译
export const DELETE = withAdminAuth(async (req: Request, { params }: { params: Promise<{ contentHash: string; locale: string }> }) => {
  try {
    const { contentHash, locale } = await params;
    
    if (!contentHash || !locale) {
      return badRequest("contentHash and locale are required");
    }

    // 检查翻译是否存在
    const existing = await db
      .selectFrom("question_translations")
      .select(["id", "content_hash", "locale"])
      .where("content_hash", "=", contentHash)
      .where("locale", "=", locale)
      .executeTakeFirst();

    if (!existing) {
      return notFound("Translation not found");
    }

    // 删除翻译
    await db
      .deleteFrom("question_translations")
      .where("content_hash", "=", contentHash)
      .where("locale", "=", locale)
      .execute();

    return success({ deleted: 1 });
  } catch (err: any) {
    console.error("[DELETE /api/admin/question-translations/:contentHash/:locale] Error:", err);
    if (err.ok === false) return err;
    return internalError("Failed to delete translation");
  }
});

// PUT /api/admin/question-translations/:contentHash/:locale
// 更新指定题目的指定语言翻译
export const PUT = withAdminAuth(async (req: Request, { params }: { params: Promise<{ contentHash: string; locale: string }> }) => {
  try {
    const { contentHash, locale } = await params;
    
    if (!contentHash || !locale) {
      return badRequest("contentHash and locale are required");
    }

    const body = await req.json().catch(() => ({}));
    const { content, options, explanation } = body;

    // 检查翻译是否存在
    const existing = await db
      .selectFrom("question_translations")
      .select(["id", "content_hash", "locale"])
      .where("content_hash", "=", contentHash)
      .where("locale", "=", locale)
      .executeTakeFirst();

    if (!existing) {
      return notFound("Translation not found");
    }

    // 更新翻译
    const updateData: any = {
      updated_at: new Date(),
    };

    if (content !== undefined) {
      updateData.content = content;
    }

    if (options !== undefined) {
      updateData.options = options ? (options as any) : null;
    }

    if (explanation !== undefined) {
      updateData.explanation = explanation || null;
    }

    await db
      .updateTable("question_translations")
      .set(updateData)
      .where("content_hash", "=", contentHash)
      .where("locale", "=", locale)
      .execute();

    return success({ updated: 1 });
  } catch (err: any) {
    console.error("[PUT /api/admin/question-translations/:contentHash/:locale] Error:", err);
    if (err.ok === false) return err;
    return internalError("Failed to update translation");
  }
});

