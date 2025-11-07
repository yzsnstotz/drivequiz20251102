import type { Status, LangCode, ISODate } from "./common.js";

/** 批量上传请求 */
export interface BatchUploadRequest {
  docs: Array<{
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
  }>;
  sourceId: string;
  batchMetadata?: {
    totalDocs: number;
    crawledAt: ISODate;
    crawlerVersion: string;
  };
}

/** 批量处理结果 */
export interface IngestResult {
  success: boolean;
  processed: number;
  failed: number;
  operationId: string;
  results: Array<{
    docId?: string;
    index?: number;
    status: "success" | "failed";
    error?: {
      code: string;
      message: string;
    };
  }>;
}

/** 操作记录 */
export interface OperationRecord {
  operationId: string;
  sourceId: string;
  status: Status;
  docsCount: number;
  failedCount: number;
  createdAt: ISODate;
  completedAt?: ISODate;
  metadata: {
    version: string;
    lang: LangCode;
    crawlerVersion?: string;
  };
}

/** 操作详情（含文档列表） */
export interface OperationDetail extends OperationRecord {
  documents: Array<{
    docId: string;
    url: string;
    title: string;
    status: "success" | "failed";
    error?: {
      code: string;
      message: string;
    };
  }>;
}

