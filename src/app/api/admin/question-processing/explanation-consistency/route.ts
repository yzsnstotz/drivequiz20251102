import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";
import { db } from "@/lib/db";
import { sql } from "kysely";
import {
  type ExplanationConsistencyEntry,
  type ExplanationConsistencyItem,
} from "@/types/questionProcessing";

const MAX_PAGE_SIZE = 100;

function normalizeConsistency(raw: any): ExplanationConsistencyEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return [raw];
}

export const GET = withAdminAuth(async (req: Request) => {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const sceneParam = url.searchParams.get("scene");
  const pageParam = Number(url.searchParams.get("page") || 1);
  const pageSizeParam = Number(url.searchParams.get("pageSize") || 20);

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSize = Number.isFinite(pageSizeParam)
    ? Math.min(Math.max(pageSizeParam, 1), MAX_PAGE_SIZE)
    : 20;

  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return badRequest("Invalid date format. Use YYYY-MM-DD");
  }

  // 仅包含已完成/部分成功/失败的子任务
  const allowedStatuses = ["succeeded", "partially_succeeded", "failed"];

  // JSONB 过滤：支持对象与数组两种结构
  const inconsistentCondition = sql<boolean>`
    (
      (jsonb_typeof(error_detail->'explanationConsistency') = 'object'
        AND (error_detail->'explanationConsistency'->>'status') = 'inconsistent')
      OR
      (jsonb_typeof(error_detail->'explanationConsistency') = 'array'
        AND (error_detail->'explanationConsistency') @> '[{"status":"inconsistent"}]'::jsonb)
    )
  `;

  try {
    const offset = (page - 1) * pageSize;

    let baseQuery = db
      .selectFrom("question_processing_task_items")
      .leftJoin("questions", "questions.id", "question_processing_task_items.question_id")
      .select([
        "id",
        "task_id",
        "question_id",
        "operation",
        "target_lang",
        "finished_at",
        "error_detail",
        "questions.content_hash as content_hash",
      ])
      .where("status", "in", allowedStatuses as any)
      .where("finished_at", ">=", from)
      .where("finished_at", "<=", to)
      .where(inconsistentCondition)
      .orderBy("finished_at", "desc");

    if (format !== "csv") {
      baseQuery = baseQuery.limit(pageSize).offset(offset);
    }

    if (sceneParam) {
      baseQuery = baseQuery.where("operation", "=", sceneParam);
    }

    let countQuery = db
      .selectFrom("question_processing_task_items")
      .select(({ fn }) => fn.count<number>("id").as("count"))
      .where("status", "in", allowedStatuses as any)
      .where("finished_at", ">=", from)
      .where("finished_at", "<=", to)
      .where(inconsistentCondition);

    if (sceneParam) {
      countQuery = countQuery.where("operation", "=", sceneParam);
    }

    const [rows, totalRow] = await Promise.all([
      baseQuery.execute(),
      format === "csv" ? Promise.resolve(undefined) : countQuery.executeTakeFirst(),
    ]);

    const items: ExplanationConsistencyItem[] = rows.map((row) => {
      let errorDetail: any = null;
      try {
        if (row.error_detail) {
          errorDetail =
            typeof row.error_detail === "string"
              ? JSON.parse(row.error_detail)
              : row.error_detail;
        }
      } catch {
        // ignore parse error, keep raw
        errorDetail = row.error_detail;
      }

      const normalized = normalizeConsistency(errorDetail?.explanationConsistency).filter(
        (c) => !c.status || c.status === "inconsistent" || c.status === "consistent" || c.status === "unknown",
      );

      return {
        id: Number(row.id),
        taskId: row.task_id,
        questionId: Number(row.question_id),
        operation: row.operation,
        targetLang: row.target_lang,
        finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
        explanationConsistency: normalized,
        contentHash: (row as any).content_hash ?? null,
        errorDetail,
      };
    });

    if (format === "csv") {
      const header = [
        "question_id",
        "content_hash",
        "locale",
        "expected",
        "inferred",
        "source",
        "auto_fixable",
      ];
      const escape = (val: any) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const lines: string[] = [header.join(",")];
      items.forEach((item) => {
        const source = item.errorDetail?.source ?? item.errorDetail?.explanationConsistency?.source;
        const autoFixable = item.errorDetail?.autoFixable ?? "";
        const list = item.explanationConsistency?.length ? item.explanationConsistency : [];
        list.forEach((c) => {
          if (c.status !== "inconsistent") return;
          lines.push([
            escape(item.questionId),
            escape(item.contentHash ?? ""),
            escape(c.locale ?? ""),
            escape(c.expected ?? ""),
            escape(c.inferred ?? ""),
            escape(source ?? ""),
            escape(autoFixable),
          ].join(","));
        });
      });

      const csv = lines.join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="explanation_inconsistent_content_hash_${new Date().toISOString().replace(/[:.]/g, "-")}.csv"`,
        },
      });
    }

    const total = Number(totalRow?.count || items.length || 0);
    const hasMore = format === "csv" ? false : offset + items.length < total;

    return success({
      items,
      pagination: {
        page,
        pageSize,
        total,
        hasMore,
      },
      filters: {
        from: from.toISOString(),
        to: to.toISOString(),
        scene: sceneParam || null,
      },
    });
  } catch (e: any) {
    console.error("[explanation-consistency][GET] error:", e?.message || e);
    return internalError(e?.message || "Failed to fetch explanation consistency list");
  }
});
