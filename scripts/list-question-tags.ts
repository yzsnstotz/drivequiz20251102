import "dotenv/config";
import { db } from "@/lib/db";
import { sql } from "kysely";

async function run() {
  const stageRes = await sql`
    SELECT stage_tag AS tag, COUNT(*)::int AS cnt
    FROM questions
    WHERE stage_tag IS NOT NULL
    GROUP BY stage_tag
    ORDER BY cnt DESC, tag ASC
  `.execute(db);

  const licenseRes = await sql`
    SELECT t.tag AS tag, COUNT(*)::int AS cnt
    FROM questions q
    CROSS JOIN LATERAL jsonb_array_elements_text(q.license_type_tag) AS t(tag)
    GROUP BY t.tag
    ORDER BY cnt DESC, tag ASC
  `.execute(db);

  const stageTags = stageRes.rows.map(r => ({ tag: (r as any).tag, count: (r as any).cnt }));
  const licenseTags = licenseRes.rows.map(r => ({ tag: (r as any).tag, count: (r as any).cnt }));

  console.log("[list-question-tags] stage_tag:", stageTags);
  console.log("[list-question-tags] license_type_tag:", licenseTags);
}

run().catch((err) => {
  console.error("[list-question-tags] FAILED", err);
  process.exit(1);
});

