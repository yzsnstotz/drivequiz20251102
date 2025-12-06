import "dotenv/config";
import { db } from "@/lib/db";
import { getLatestUnifiedVersionContent, getUnifiedVersionContent } from "@/lib/questionDb";
import { sql } from "kysely";

type PackageQuestion = {
  id: number;
  category?: string | null;
  stage_tag?: string | null;
  license_type_tag?: string[] | null;
  topic_tags?: string[] | null;
  hash?: string | null;
  content_hash?: string | null;
};

async function run() {
  console.log("[restore-tags] start");
  const inputVersion = process.argv[2];
  const latest = inputVersion ? await getUnifiedVersionContent(inputVersion) : await getLatestUnifiedVersionContent();
  let questions: PackageQuestion[] = Array.isArray(latest?.questions) ? (latest!.questions as PackageQuestion[]) : [];
  let version = latest?.version || "unknown";
  if (questions.length === 0) {
    const row = await db
      .selectFrom("question_package_versions")
      .select(["package_content", "version"]) 
      .where("package_name", "=", "__unified__")
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();
    if (!row || !row.package_content) {
      console.error("[restore-tags] no latest package found or package_content missing");
      process.exit(1);
    }
    const pkg: any = row.package_content;
    console.log("[restore-tags] debug package_content keys:", Object.keys(pkg || {}));
    const qLen = Array.isArray(pkg.questions) ? pkg.questions.length : 0;
    const locales = pkg.questionsByLocale && typeof pkg.questionsByLocale === "object" ? Object.keys(pkg.questionsByLocale) : [];
    console.log("[restore-tags] debug questions length:", qLen, "locales:", locales);
    version = row.version as string;
    if (Array.isArray(pkg.questions) && pkg.questions.length > 0) {
      questions = pkg.questions as PackageQuestion[];
    } else if (pkg.questionsByLocale && typeof pkg.questionsByLocale === "object") {
      const preferredLocales = ["zh", "zh-CN", "zh_CN", "ja", "en"];
      let picked: PackageQuestion[] | undefined;
      for (const loc of preferredLocales) {
        if (Array.isArray(pkg.questionsByLocale[loc]) && pkg.questionsByLocale[loc].length > 0) {
          picked = pkg.questionsByLocale[loc];
          break;
        }
      }
      if (!picked) {
        picked = Object.values(pkg.questionsByLocale).find(arr => Array.isArray(arr) && (arr as any[]).length > 0) as PackageQuestion[] | undefined;
      }
      if (picked) {
        questions = picked;
      } else {
        console.error("[restore-tags] questionsByLocale present but no non-empty locale arrays");
        process.exit(1);
      }
    }
  }
  let total = 0;
  let updated = 0;

  for (const q of questions) {
    if (!q) continue;
    const setData: any = {};
    if (typeof q.category === "string") setData.category = q.category;
    if (typeof q.stage_tag === "string" || q.stage_tag === null) setData.stage_tag = q.stage_tag ?? null;
    if (Array.isArray(q.topic_tags)) setData.topic_tags = q.topic_tags;
    if (Array.isArray(q.license_type_tag)) {
      setData.license_type_tag = sql`${JSON.stringify(q.license_type_tag)}::jsonb`;
    }

    const hasId = typeof q.id === "number" && q.id > 0;
    const hash = (q.content_hash || q.hash || undefined) as string | undefined;
    if (Object.keys(setData).length > 0) {
      if (hasId) {
        await db.updateTable("questions").set(setData).where("id", "=", q.id).execute();
      } else if (hash && typeof hash === "string") {
        await db.updateTable("questions").set(setData).where("content_hash", "=", hash).execute();
      } else {
        // 无法定位记录，跳过
        continue;
      }
      updated++;
    }
    total++;
    if (total % 500 === 0) {
      console.log(`[restore-tags] processed: ${total}, updated: ${updated}`);
    }
  }

  console.log("[restore-tags] done", { total, updated, version });
}

run().catch((err) => {
  console.error("[restore-tags] FAILED", err);
  process.exit(1);
});
