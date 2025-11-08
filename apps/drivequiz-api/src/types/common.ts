/** 通用状态枚举 */
export type Status = "pending" | "processing" | "success" | "failed";

/** 时间戳（ISO8601） */
export type ISODate = string;

/** 支持语言 */
export type LangCode = "ja" | "zh" | "en";

/** 通用响应结构 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

