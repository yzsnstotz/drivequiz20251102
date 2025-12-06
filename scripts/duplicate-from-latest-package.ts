import "dotenv/config";
import { db } from "@/lib/db";
import { getLatestUnifiedVersionContent } from "@/lib/questionDb";
import { convertQuestionToDbFormat } from "./_lib/convertQuestionToDb";
import { sql } from "kysely";

type AnyQuestion = any;

async function loadLatestQuestions(): Promise<{ version: string; questions: AnyQuestion[] }> {
  const latest = await getLatestUnifiedVersionContent();
  if (latest && Array.isArray(latest.questions) && latest.questions.length > 0) {
    return { version: latest.version, questions: latest.questions as AnyQuestion[] };
  }
  const row = await db
    .selectFrom("question_package_versions")
    .select(["package_content", "version"]) 
    .where("package_name", "=", "__unified__")
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  if (!row || !row.package_content) throw new Error("latest package_content missing");
  const pkg: any = row.package_content;
  if (Array.isArray(pkg.questions) && pkg.questions.length > 0) {
    return { version: row.version as string, questions: pkg.questions };
  }
  if (pkg.questionsByLocale && typeof pkg.questionsByLocale === "object") {
    const preferred = ["zh", "zh-CN", "zh_CN", "ja", "en"];
    for (const loc of preferred) {
      if (Array.isArray(pkg.questionsByLocale[loc]) && pkg.questionsByLocale[loc].length > 0) {
        return { version: row.version as string, questions: pkg.questionsByLocale[loc] };
      }
    }
    const anyLocale = Object.values(pkg.questionsByLocale).find(arr => Array.isArray(arr) && (arr as any[]).length > 0) as AnyQuestion[] | undefined;
    if (anyLocale) return { version: row.version as string, questions: anyLocale };
  }
  return { version: row.version as string, questions: [] };
}

async function run() {
  console.log("[duplicate-latest] start");
  const { version, questions } = await loadLatestQuestions();
  console.log(`[duplicate-latest] latest version=${version}, questions=${questions.length}`);

  // 清空 questions_duplicate
  await db.deleteFrom("questions_duplicate").execute();
  console.log("[duplicate-latest] cleared questions_duplicate");

  let success = 0;
  let failed = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      const raw = convertQuestionToDbFormat(q) as any;
      const payload: any = {
        content_hash: raw.content_hash,
        type: raw.type,
        image: raw.image,
        category: raw.category,
        stage_tag: raw.stage_tag,
        topic_tags: raw.topic_tags,
        version: raw.version,
      };
      if (raw.content != null) payload.content = sql`${JSON.stringify(raw.content)}::jsonb`;
      if (raw.options != null) payload.options = sql`${JSON.stringify(raw.options)}::jsonb`;
      if (raw.correct_answer != null) payload.correct_answer = sql`${JSON.stringify(raw.correct_answer)}::jsonb`;
      if (raw.explanation != null) payload.explanation = sql`${JSON.stringify(raw.explanation)}::jsonb`;
      if (raw.license_type_tag != null) payload.license_type_tag = sql`${JSON.stringify(raw.license_type_tag)}::jsonb`;
      await db.insertInto("questions_duplicate").values(payload).execute();
      success++;
      if ((i + 1) % 200 === 0) console.log(`[duplicate-latest] inserted ${i + 1}/${questions.length}`);
    } catch (err) {
      failed++;
      if (failed <= 10) {
        console.error(`[duplicate-latest] insert error at index ${i}:`, (err as Error)?.message || String(err));
        try {
          console.error("payload debug:", JSON.stringify(raw).slice(0, 500));
        } catch {}
      }
    }
  }
  console.log("[duplicate-latest] done", { version, success, failed });
}

run().catch((err) => {
  console.error("[duplicate-latest] FAILED", err);
  process.exit(1);
});
