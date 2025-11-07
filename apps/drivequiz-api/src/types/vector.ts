import type { LangCode } from "./common.js";

/** 向量化任务请求 */
export interface VectorizeTask {
  docId: string;
  content: string;
  lang: LangCode;
  meta: {
    sourceId: string;
    contentHash: string;
  };
}

/** 向量化任务结果 */
export interface VectorizeResult {
  docId: string;
  status: "completed" | "failed";
  vectorId?: string;
  durationMs: number;
  error?: {
    code: string;
    message: string;
  };
}

