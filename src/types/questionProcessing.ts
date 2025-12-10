export type ExplanationConsistencyStatus = "consistent" | "inconsistent" | "unknown";

export interface ExplanationConsistencyEntry {
  status?: ExplanationConsistencyStatus;
  expected?: "true" | "false" | "unknown";
  inferred?: "true" | "false" | "unknown";
  locale?: string;
}

export interface ExplanationConsistencyItem {
  id: number;
  taskId: string;
  questionId: number;
  operation: string;
  targetLang: string | null;
  finishedAt: string | null;
  explanationConsistency: ExplanationConsistencyEntry[];
}
