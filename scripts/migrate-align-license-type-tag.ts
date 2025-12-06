import "dotenv/config";
import { db } from "@/lib/db";
import { sql } from "kysely";

async function run() {
  console.log("[migrate-align-license] start");
  const countRes = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM questions q
    JOIN questions_duplicate qd ON q.content_hash = qd.content_hash
    WHERE (q.license_type_tag IS DISTINCT FROM qd.license_type_tag)
  `.execute(db);
  const pending = (countRes.rows?.[0]?.cnt as number) ?? 0;
  console.log("[migrate-align-license] pending diffs:", pending);

  const updateRes = await sql`
    UPDATE questions AS q
    SET license_type_tag = qd.license_type_tag
    FROM questions_duplicate AS qd
    WHERE q.content_hash = qd.content_hash
      AND (q.license_type_tag IS DISTINCT FROM qd.license_type_tag)
    RETURNING q.id
  `.execute(db);
  const updated = updateRes.rows?.length ?? 0;
  console.log("[migrate-align-license] updated:", updated);
}

run().catch((err) => {
  console.error("[migrate-align-license] FAILED", err);
  process.exit(1);
});

