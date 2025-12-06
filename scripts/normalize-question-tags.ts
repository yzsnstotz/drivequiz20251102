import "dotenv/config";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { normalizeQuestionTags, type RawQuestionTags } from "@/lib/quizTags";

const BATCH_SIZE = 500;

type QuestionRow = {
  id: number;
  license_type_tag: string[] | null;
  stage_tag: string | null;
  topic_tags: string[] | null;
};

async function normalizeOneRow(row: QuestionRow): Promise<boolean> {
  const raw: RawQuestionTags = {
    license_type_tag: row.license_type_tag ?? undefined,
    stage_tag: row.stage_tag ?? undefined,
    topic_tags: row.topic_tags ?? undefined,
  };
  const normalized = normalizeQuestionTags(raw);

  const sameLicense = JSON.stringify(row.license_type_tag ?? []) === JSON.stringify(normalized.license_type_tag);
  const sameStage = (row.stage_tag ?? null) === normalized.stage_tag;
  const sameTopics = JSON.stringify(row.topic_tags ?? []) === JSON.stringify(normalized.topic_tags);

  if (sameLicense && sameStage && sameTopics) return false;

  const payload: any = {
    stage_tag: normalized.stage_tag,
    topic_tags: normalized.topic_tags,
  };

  if (normalized.license_type_tag && normalized.license_type_tag.length > 0) {
    payload.license_type_tag = sql`${JSON.stringify(normalized.license_type_tag)}::jsonb`;
  } else {
    payload.license_type_tag = sql`null::jsonb`;
  }

  await db.updateTable("questions").set(payload).where("id", "=", row.id).execute();
  return true;
}

async function run() {
  console.log("[normalize-question-tags] start");
  let lastId = 0;
  let total = 0;
  let updated = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await db
      .selectFrom("questions")
      .select(["id", "license_type_tag", "stage_tag", "topic_tags"])
      .where("id", ">", lastId)
      .orderBy("id", "asc")
      .limit(BATCH_SIZE)
      .execute();

    if (rows.length === 0) break;
    for (const r of rows as QuestionRow[]) {
      const changed = await normalizeOneRow(r);
      if (changed) updated++;
      lastId = r.id;
      total++;
    }
    console.log(`[normalize-question-tags] processed: ${total}, updated: ${updated}`);
  }
  console.log("[normalize-question-tags] done", { total, updated });
}

run().catch((err) => {
  console.error("[normalize-question-tags] FAILED", err);
  process.exit(1);
});

