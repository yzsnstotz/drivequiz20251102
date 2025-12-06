import { calculateQuestionHash, type Question } from "@/lib/questionHash";
import { sanitizeJsonForDb } from "@/app/api/admin/question-processing/_lib/jsonUtils";

export function convertQuestionToDbFormat(question: Question): {
  content_hash: string;
  type: "single" | "multiple" | "truefalse";
  content: any;
  options: any | null;
  correct_answer: any | null;
  image: string | null;
  explanation: any | null;
  license_type_tag: any | null;
  category: string | null;
  stage_tag: "both" | "provisional" | "regular" | null;
  topic_tags: string[] | null;
  version: string | null;
} {
  const contentHash = (question as any).content_hash || (question as any).hash || calculateQuestionHash(question);

  let contentMultilang: any = null;
  if (typeof question.content === "string") {
    contentMultilang = { zh: question.content };
  } else if (question.content && typeof question.content === "object") {
    contentMultilang = question.content;
  }
  contentMultilang = sanitizeJsonForDb(contentMultilang);
  if (contentMultilang && typeof contentMultilang === "object" && !Array.isArray(contentMultilang) && Object.keys(contentMultilang).length === 0) {
    contentMultilang = null;
  }

  let explanationMultilang: any = null;
  if (question.explanation) {
    if (typeof question.explanation === "string") {
      explanationMultilang = { zh: question.explanation };
    } else if (typeof question.explanation === "object" && question.explanation !== null) {
      explanationMultilang = question.explanation;
    }
  }
  explanationMultilang = sanitizeJsonForDb(explanationMultilang);
  if (explanationMultilang && typeof explanationMultilang === "object" && !Array.isArray(explanationMultilang) && Object.keys(explanationMultilang).length === 0) {
    explanationMultilang = null;
  }

  let cleanedOptions = sanitizeJsonForDb((question as any).options ?? null);
  if (cleanedOptions && Array.isArray(cleanedOptions)) {
    cleanedOptions = cleanedOptions
      .filter((opt: any) => {
        if (typeof opt !== "string") return false;
        const trimmed = opt.trim();
        return trimmed !== "" && trimmed.toLowerCase() !== "explanation";
      })
      .map((opt: any) => {
        if (typeof opt === "string" && opt.includes("\n")) {
          return opt.split("\n")
            .map((line: string) => line.trim())
            .filter((line: string) => line !== "" && line.toLowerCase() !== "explanation");
        }
        return opt;
      })
      .flat();
    if (cleanedOptions.length === 0) cleanedOptions = null;
  }

  let cleanedCorrectAnswer = sanitizeJsonForDb((question as any).correctAnswer ?? (question as any).correct_answer ?? null);
  if (cleanedCorrectAnswer && Array.isArray(cleanedCorrectAnswer) && cleanedCorrectAnswer.length === 0) {
    cleanedCorrectAnswer = null;
  } else if (cleanedCorrectAnswer && typeof cleanedCorrectAnswer === "object" && !Array.isArray(cleanedCorrectAnswer) && Object.keys(cleanedCorrectAnswer).length === 0) {
    cleanedCorrectAnswer = null;
  }

  let licenseTypeTag: any = null;
  if ((question as any).license_type_tag !== null && (question as any).license_type_tag !== undefined) {
    if (Array.isArray((question as any).license_type_tag)) {
      const cleaned = (question as any).license_type_tag
        .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
        .map((tag: any) => tag.trim());
      licenseTypeTag = cleaned.length > 0 ? cleaned : null;
    }
  } else if ((question as any).license_tags) {
    if (Array.isArray((question as any).license_tags)) {
      const cleaned = (question as any).license_tags
        .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
        .map((tag: any) => tag.trim());
      licenseTypeTag = cleaned.length > 0 ? cleaned : null;
    }
  }

  let topicTags: string[] | null = null;
  if ((question as any).topic_tags !== null && (question as any).topic_tags !== undefined) {
    if (Array.isArray((question as any).topic_tags)) {
      const cleaned = (question as any).topic_tags
        .filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
        .map((tag: any) => tag.trim());
      topicTags = cleaned.length > 0 ? cleaned : null;
    }
  }

  return {
    content_hash: contentHash,
    type: question.type as any,
    content: contentMultilang,
    options: cleanedOptions,
    correct_answer: cleanedCorrectAnswer,
    image: (question as any).image || null,
    explanation: explanationMultilang,
    license_type_tag: licenseTypeTag,
    category: (question as any).category || null,
    stage_tag: (question as any).stage_tag || null,
    topic_tags: topicTags,
    version: null,
  };
}

