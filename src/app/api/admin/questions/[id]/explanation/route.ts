export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, notFound, success } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { sanitizeJsonForDb } from "@/app/api/admin/question-processing/_lib/jsonUtils";

type PatchExplanationBody = {
  explanation?: Record<string, string | null | undefined>;
};

function buildMergedExplanation(
  current: any,
  incoming?: Record<string, string | null | undefined>,
) {
  let base: Record<string, string> = {};
  if (current && typeof current === "object") {
    base = { ...current };
  } else if (typeof current === "string" && current.trim()) {
    base = { zh: current };
  }
  if (!incoming) return base;
  for (const [locale, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (value === null) {
      delete base[locale];
    } else {
      base[locale] = String(value);
    }
  }
  return base;
}

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const questionId = Number(id);
      if (Number.isNaN(questionId)) return badRequest("Invalid question id");

      const body = (await req.json()) as PatchExplanationBody;
      if (!body || typeof body !== "object" || !body.explanation) {
        return badRequest("explanation payload required");
      }

      const current = await db
        .selectFrom("questions")
        .select(["explanation"])
        .where("id", "=", questionId)
        .executeTakeFirst();

      if (!current) return notFound("Question not found");

      const merged = buildMergedExplanation(current.explanation, body.explanation);
      const safeExplanation = sanitizeJsonForDb(merged);

      await db
        .updateTable("questions")
        .set({
          explanation: safeExplanation as any,
          updated_at: new Date(),
        })
        .where("id", "=", questionId)
        .execute();

      return success({
        questionId,
        explanation: merged,
      });
    } catch (e: any) {
      console.error("[PATCH /api/admin/questions/:id/explanation] error:", e?.message || e);
      return internalError("Failed to update explanation");
    }
  },
);
