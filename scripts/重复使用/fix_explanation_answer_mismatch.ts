import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { db } from "../../src/lib/db";
import crypto from "crypto";
import {
  checkExplanationConsistency,
  normalizeCorrectAnswer,
} from "../../src/app/api/admin/question-processing/_lib/explanationConsistency";
import { sql } from "kysely";

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

async function debugConnectionAndSchema() {
  console.log("========== DB CONNECTION & SCHEMA DIAGNOSTIC ==========");
  const rawUrl =
    process.env.DRIVEQUIZ_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "";
  try {
    const u = new URL(rawUrl);
    u.password = "***";
    console.log("[diagnostic] Using DB =", u.toString());
  } catch (e) {
    console.log("[diagnostic] Using DB =", rawUrl);
  }

  // 1) 检查 questions 表是否存在
  try {
    const exists = await db
      .selectFrom(sql`information_schema.tables`.as("t"))
      .select("t.table_name")
      .where("t.table_name", "=", "questions")
      .execute();
    if (!exists.length) {
      console.log("[diagnostic] ERROR: questions 表不存在！");
      console.log("脚本将停止运行。请检查连接串是否正确指向 DriveQuiz 主库。");
      process.exit(1);
    }
  } catch (err) {
    console.log("[diagnostic] ERROR: 无法访问 information_schema", err);
    process.exit(1);
  }

  // 2) 打印 questions 数量
  const total = await db
    .selectFrom("questions")
    .select(({ fn }) => fn.countAll<number>().as("total"))
    .executeTakeFirst();
  console.log("[diagnostic] questions.total =", total?.total ?? 0);
  if (!total?.total) {
    console.log("[diagnostic] FATAL: 当前数据库中 questions 表为空。");
    console.log("脚本不能继续运行。");
    console.log("请检查驱动的数据库连接是否正确（DRIVEQUIZ_DATABASE_URL）。");
    process.exit(1);
  }

  // 3) 抽样前 3 条题目
  const sample = await db
    .selectFrom("questions")
    .select(["id", "correct_answer", "explanation"])
    .orderBy("id")
    .limit(3)
    .execute();
  console.log("[diagnostic] sample =", JSON.stringify(sample, null, 2));
  if (!sample.length) {
    console.log("[diagnostic] FATAL: 抽样结果为空，请检查数据表。");
    process.exit(1);
  }
  for (const s of sample) {
    const exp = (s as any).explanation;
    const expType = typeof exp;
    if (!(exp === null || expType === "string" || expType === "object")) {
      console.log("[diagnostic] FATAL: sample.explanation 类型异常 =", expType);
      process.exit(1);
    }
  }
  console.log("========================================================");
}

async function main() {
  console.log(
    `[fix_explanation_answer_mismatch] start | mode=${APPLY ? "apply-to-task-items" : "dry-run"}`,
  );
  console.log(`[fix_explanation_answer_mismatch] audit task id = ${AUDIT_TASK_ID}`);
  await debugConnectionAndSchema();

  let lastId = 0;
  let offset = 0;
  let useOffset = false;

  while (true) {
    let query = db
      .selectFrom("questions")
      .select(["id", "correct_answer", "explanation"])
      .orderBy("id");
    if (useOffset) {
      query = query.offset(offset);
    } else {
      query = query.where("id", ">", lastId);
    }
    const rows = await query.limit(BATCH_SIZE).execute();

    if (!rows.length) break;

    // 自动检测 id 是否为数字，不是则切换 offset 模式
    if (!useOffset && rows.length > 0 && typeof (rows[0] as any).id !== "number") {
      useOffset = true;
      offset = 0;
      lastId = 0;
      console.log("[diagnostic] detected non-numeric question id, switch to offset-based scan");
      continue;
    }

    for (const row of rows as QuestionRow[]) {
      lastId = typeof row.id === "number" ? row.id : lastId;
      if (useOffset) {
        offset += 1;
      }
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

  if (stats.scannedQuestions > 0 && stats.inconsistentDetected === 0) {
    console.log("[diagnostic] NOTICE: 已扫描所有题目，但未检测到任何解析不一致。");
    console.log("若你确认存在问题，建议检查 checkExplanationConsistency() 的判断规则。");
  }

  console.log("========== SCRIPT SELF-DIAGNOSTIC REPORT ==========");
  console.log("Database:", process.env.DRIVEQUIZ_DATABASE_URL ? "OK" : "MISSING");
  console.log("Questions table exists: OK");
  console.log("Questions count:", stats.scannedQuestions, "(non-zero expected)");
  console.log("Script mode:", APPLY ? "apply → writing audit task_items" : "dry-run");
  console.log("====================================================");
}

main().catch((err) => {
  console.error("[fix_explanation_answer_mismatch] failed", err);
  process.exit(1);
});
