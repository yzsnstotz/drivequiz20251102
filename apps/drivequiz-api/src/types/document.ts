import type { LangCode } from "./common.js";

/** Datapull 上传的单片文档 */
export interface DocumentInput {
  title: string;
  url: string;
  content: string;
  version: string;
  lang: LangCode;
  meta: {
    sourceId: string;
    type?: "official" | "organization" | "education";
    chunkIndex?: number;
    totalChunks?: number;
    contentHash?: string;
  };
}

/** 存储后的文档结构 */
export interface DocumentRecord {
  docId: string;
  title: string;
  url: string;
  content: string;
  version: string;
  lang: LangCode;
  contentHash: string;
  sourceId: string;
  docType?: string;
  vectorizationStatus: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

/** 文档上传响应 */
export interface DocumentUploadResponse {
  success: boolean;
  docId: string;
  operationId: string;
}

