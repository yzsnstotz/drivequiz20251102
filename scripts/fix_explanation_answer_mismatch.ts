import { db } from "../src/lib/db";
import crypto from "crypto";
import {
  checkExplanationConsistency,
  normalizeCorrectAnswer,
} from "../src/app/api/admin/question-processing/_lib/explanationConsistency";

type QuestionRow = {
  id: number;
  correct_answer: any;
  explanation: any;
};

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 200;

// 为本次脚本生成一个审计任务ID，用于在 question_processing_task_items 中归组
// 如项目中已有 question_processing_tasks 表，可在需要时补充插入一条父任务记录。
const AUDIT_TASK_ID = crypto.randomUUID();

const stats = {
  scannedQuestions: 0,
  localesChecked: 0,
  inconsistentDetected: 0,
  autoFixable: 0,
  queuedForReview: 0,
  needManual: 0,
};

type Locale = "zh" | "ja" | "en" | string;

const AUTO_FIX_MAP: Record<string, string> = {
  // 中文
  "本题是错误的": "本题是正确的",
  "本题是错误的。": "本题是正确的。",
  "该题是错误的": "该题是正确的",
  "该题是错误的。": "该题是正确的。",
  "该说法是错误的": "该说法是正确的",
  "该说法是错误的。": "该说法是正确的。",
  // 日文
  "この記述は誤りです": "この記述は正しいです",
  "この記述は誤りです。": "この記述は正しいです。",
  "この文は誤りです": "この文は正しいです",
  "この文は誤りです。": "この文は正しいです。",
  // 英文（统一用小写 key 做匹配）
  "this statement is false.": "This statement is true.",
  "this statement is false": "This statement is true.",
};

function toFixedText(text: string, locale: Locale, expected: string): string | null {
  // 只对“真实正确但解析写成错误”的情况提供自动修复建议
  if (expected !== "true") return null;

  const trimmed = text.trim();
  const normalizedKey = trimmed.toLowerCase();
  const replacement = AUTO_FIX_MAP[normalizedKey];
  if (!replacement) return null;

  // 保持原始大小写与末尾标点（中文/日文保留原句的“。”）
  if (locale === "zh" || locale === "ja") {
    const hasPeriod = trimmed.endsWith("。");
    if (hasPeriod && !replacement.endsWith("。")) {
      return `${replacement}。`;
    }
  }
  return replacement;
}

async function main() {
  console.log(
    `[fix_explanation_answer_mismatch] start | mode=${APPLY ? "apply-to-task-items" : "dry-run"}`,
  );
  console.log(`[fix_explanation_answer_mismatch] audit task id = ${AUDIT_TASK_ID}`);

  let lastId = 0;

  while (true) {
    const rows = await db
      .selectFrom("questions")
      .select(["id", "correct_answer", "explanation"])
      .where("id", ">", lastId)
      .orderBy("id")
      .limit(BATCH_SIZE)
      .execute();

    if (!rows.length) break;

    for (const row of rows as QuestionRow[]) {
      lastId = row.id;
      stats.scannedQuestions += 1;

      const explanation = row.explanation;
      const correct = row.correct_answer;
      const expected = normalizeCorrectAnswer(
        typeof correct === "string" ? correct : (correct as any)?.toString?.() ?? null,
      );

      if (!explanation) continue;

      const expObj: Record<string, any> =
        typeof explanation === "object" && explanation !== null
          ? { ...explanation }
          : { zh: explanation };

      for (const [locale, value] of Object.entries(expObj)) {
        if (typeof value !== "string") continue;
        stats.localesChecked += 1;

        const consistency = checkExplanationConsistency(value, correct as any, locale);

        if (consistency.status !== "inconsistent") continue;

        stats.inconsistentDetected += 1;

        const fixedText = toFixedText(value, locale as Locale, expected);
        const autoFixable = !!fixedText;

        if (!autoFixable) {
          stats.needManual += 1;
          console.log(
            `[need-manual] q=${row.id} locale=${locale} expected=${expected} inferred=${consistency.inferred} text="${value}"`,
          );
        } else {
          stats.autoFixable += 1;
          console.log(
            `[auto-fix-suggestion] q=${row.id} locale=${locale} expected=${expected} inferred=${consistency.inferred} from="${value}" to="${fixedText}"`,
          );
        }

        if (!APPLY) {
          // dry-run 模式仅打印，不写入数据库
          continue;
        }

        // === APPLY 模式：将本条不一致记录写入 question_processing_task_items，供后台 UI 审核 ===
        // 注意：这里假设 question_processing_task_items 至少包含以下字段：
        // - task_id: string (可为本脚本生成的 AUDIT_TASK_ID)
        // - question_id: number
        // - status: string（例如 "pending_review"）
        // - operation: string（例如 "explanation_consistency_audit"）
        // - target_lang: string | null
        // - error_detail: jsonb（任意结构化诊断信息）
        //
        // 如果你的表结构有所差异，可按实际字段名适当调整。
        await db
          .insertInto("question_processing_task_items")
          .values({
            // @ts-ignore 具体类型以项目中的 Kysely DB 类型定义为准
            task_id: AUDIT_TASK_ID,
            // @ts-ignore
            question_id: row.id,
            // 使用既有状态枚举，插入待处理记录
            // @ts-ignore
            status: "pending",
            // 如果表中有 operation 字段，可使用固定标识本次脚本来源
            // @ts-ignore
            operation: "explanation_consistency_audit",
            // 若表中有 target_lang 字段，则存 locale，便于前端筛选
            // @ts-ignore
            target_lang: locale,
            // 将诊断信息写入 error_detail，供后台页面读取
            // @ts-ignore
            error_detail: {
              explanationConsistency: {
                status: consistency.status,
                expected: consistency.expected ?? expected,
                inferred: consistency.inferred,
                locale,
              },
              autoFixable,
              oldText: value,
              suggestedFix: fixedText ?? null,
              source: "fix_explanation_answer_mismatch_script",
            },
          })
          .execute();

        stats.queuedForReview += 1;
      }
    }
  }

  console.log(`[fix_explanation_answer_mismatch] done`);
  console.log(`Total scanned questions: ${stats.scannedQuestions}`);
  console.log(`Total locales checked: ${stats.localesChecked}`);
  console.log(`Inconsistent explanations detected: ${stats.inconsistentDetected}`);
  console.log(`Auto-fixable items (有建议修复文案): ${stats.autoFixable}`);
  console.log(
    `Queued for review in task_items${
      APPLY ? "" : " (dry-run: not actually inserted)"
    }: ${stats.queuedForReview}`,
  );
  console.log(`Need manual review (无自动建议): ${stats.needManual}`);
}

main().catch((err) => {
  console.error("[fix_explanation_answer_mismatch] failed", err);
  process.exit(1);
});
