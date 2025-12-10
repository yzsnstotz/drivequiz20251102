export type NormalizedTruthValue = "true" | "false" | "unknown";

const TRUE_KEYWORDS = new Set([
  "对",
  "正确",
  "是",
  "true",
  "t",
  "yes",
  "y",
  "正しい",
  "○",
  "correct",
]);

const FALSE_KEYWORDS = new Set([
  "错",
  "错误",
  "否",
  "不是",
  "false",
  "f",
  "no",
  "n",
  "誤",
  "×",
  "incorrect",
]);

function normalizeText(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase();
}

export function normalizeCorrectAnswer(raw: string | null | undefined): NormalizedTruthValue {
  if (raw === null || raw === undefined) {
    return "unknown";
  }

  const text = normalizeText(String(raw));
  if (!text) return "unknown";

  // 兼容 JSONB 字符串值，如 "true"/"false"
  if (TRUE_KEYWORDS.has(text)) return "true";
  if (FALSE_KEYWORDS.has(text)) return "false";

  // 额外匹配常见写法
  if (["○", "o", "0"].includes(text)) return "true";
  if (["×", "x", "✗"].includes(text)) return "false";

  return "unknown";
}

export type InferredJudgement = NormalizedTruthValue;

const ZH_FALSE_PHRASES = [
  "本题是错误的",
  "该题是错误的",
  "该说法是错误的",
  "此说法错误",
  "上述说法是错误的",
  "说法不正确",
  "答案错误",
  "判断错误",
  "不正确",
];

const ZH_TRUE_PHRASES = [
  "本题是正确的",
  "该题是正确的",
  "该说法是正确的",
  "此说法正确",
  "上述说法是正确的",
  "说法正确",
  "答案正确",
  "判断正确",
];

const JA_FALSE_PHRASES = [
  "この記述は誤りです",
  "この文は誤りです",
  "誤りです",
  "正しくありません",
  "間違いです",
  "誤っています",
];

const JA_TRUE_PHRASES = [
  "この記述は正しいです",
  "この文は正しいです",
  "正しいです",
  "正しいと言えます",
  "正しいといえる",
];

const EN_FALSE_PHRASES = [
  "this statement is false",
  "this statement is incorrect",
  "this is false",
  "this is incorrect",
  "is not correct",
];

const EN_TRUE_PHRASES = [
  "this statement is true",
  "this is correct",
  "is correct",
];

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((p) => text.includes(p));
}

export function inferJudgementFromExplanation(
  text: string | null | undefined,
  locale?: string
): InferredJudgement {
  if (!text || !text.trim()) return "unknown";
  const normalized = normalizeText(text);

  const matchFalse: string[] = [];
  const matchTrue: string[] = [];

  const pushMatches = (arr: string[], phrases: string[]) => {
    if (includesAny(normalized, phrases)) {
      arr.push(...phrases.filter((p) => normalized.includes(p)));
    }
  };

  const lang = (locale ?? "").toLowerCase();
  if (!lang || lang === "zh") {
    pushMatches(matchFalse, ZH_FALSE_PHRASES);
    pushMatches(matchTrue, ZH_TRUE_PHRASES);
  }
  if (!lang || lang === "ja") {
    pushMatches(matchFalse, JA_FALSE_PHRASES);
    pushMatches(matchTrue, JA_TRUE_PHRASES);
  }
  if (!lang || lang === "en") {
    pushMatches(matchFalse, EN_FALSE_PHRASES);
    pushMatches(matchTrue, EN_TRUE_PHRASES);
  }

  const hasFalse = matchFalse.length > 0;
  const hasTrue = matchTrue.length > 0;

  if (hasFalse && hasTrue) return "unknown";
  if (hasFalse) return "false";
  if (hasTrue) return "true";
  return "unknown";
}

export interface ExplanationConsistencyResult {
  status: "consistent" | "inconsistent" | "unknown";
  expected?: NormalizedTruthValue;
  inferred?: NormalizedTruthValue;
}

export function checkExplanationConsistency(
  explanationText: string | null | undefined,
  rawCorrectAnswer: string | null | undefined,
  locale?: string
): ExplanationConsistencyResult {
  const expected = normalizeCorrectAnswer(rawCorrectAnswer);
  const inferred = inferJudgementFromExplanation(explanationText, locale);

  if (expected === "unknown" || inferred === "unknown") {
    return { status: "unknown", expected, inferred };
  }

  if (expected === inferred) {
    return { status: "consistent", expected, inferred };
  }

  return { status: "inconsistent", expected, inferred };
}
