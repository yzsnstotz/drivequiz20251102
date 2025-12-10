import { db } from "../src/lib/db";
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

const stats = {
  scannedQuestions: 0,
  localesChecked: 0,
  inconsistentDetected: 0,
  autoFixable: 0,
  autoFixed: 0,
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
  // 英文
  "this statement is false.": "This statement is true.",
  "this statement is false": "This statement is true.",
};

function toFixedText(text: string, locale: Locale, expected: string): string | null {
  if (expected !== "true") return null;
  const trimmed = text.trim();
  const normalizedKey = trimmed.toLowerCase();
  const replacement = AUTO_FIX_MAP[normalizedKey];
  if (!replacement) return null;

  // 保持原始大小写与末尾标点（中文/日文保留原句的“。”）
  if (locale === "zh" || locale === "ja") {
    // 如果原文本有 "。" 结尾而 replacement 没有，则补齐
    const hasPeriod = trimmed.endsWith("。");
    if (hasPeriod && !replacement.endsWith("。")) {
      return `${replacement}。`;
    }
  }
  return replacement;
}

async function main() {
  console.log(`[fix_explanation_answer_mismatch] start | mode=${APPLY ? "apply" : "dry-run"}`);
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

        const fixedText = toFixedText(value, locale, expected);
        if (!fixedText) {
          stats.needManual += 1;
          console.log(
            `[need-manual] q=${row.id} locale=${locale} expected=${expected} inferred=${consistency.inferred} text="${value}"`,
          );
          continue;
        }

        stats.autoFixable += 1;
        if (!APPLY) {
          console.log(
            `[dry-run] auto-fix q=${row.id} locale=${locale} from="${value}" to="${fixedText}"`,
          );
          continue;
        }

        const newExplanation = { ...expObj, [locale]: fixedText };
        await db
          .updateTable("questions")
          .set({
            explanation: newExplanation as any,
            updated_at: new Date(),
          })
          .where("id", "=", row.id)
          .execute();

        stats.autoFixed += 1;
        console.log(
          `[applied] q=${row.id} locale=${locale} from="${value}" to="${fixedText}"`,
        );
      }
    }
  }

  console.log(`[fix_explanation_answer_mismatch] done`);
  console.log(`Total scanned questions: ${stats.scannedQuestions}`);
  console.log(`Total locales checked: ${stats.localesChecked}`);
  console.log(`Inconsistent explanations detected: ${stats.inconsistentDetected}`);
  console.log(`Auto-fixable items: ${stats.autoFixable}`);
  console.log(`Auto-fixed items${APPLY ? "" : " (dry-run)"}: ${stats.autoFixed}`);
  console.log(`Need manual review: ${stats.needManual}`);
}

main().catch((err) => {
  console.error("[fix_explanation_answer_mismatch] failed", err);
  process.exit(1);
});
