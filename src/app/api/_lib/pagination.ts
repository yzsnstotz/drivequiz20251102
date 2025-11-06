// ============================================================
// 文件路径: src/app/api/_lib/pagination.ts
// 功能: 统一的分页与排序解析工具（位置参数版 getPaginationMeta）
// 规范: Zalem 后台管理接口规范 v1.0
// ============================================================

export type SortOrder = "asc" | "desc";

export interface ParsedPagination {
  page: number; // 起始 1
  limit: number; // 每页条数
  offset: number; // (page-1)*limit
  sortBy: string | null; // 透传给白名单映射层
  order: SortOrder; // asc|desc
}

/**
 * 从 URLSearchParams 中解析分页与排序参数。
 * - page: 默认 1，最小 1
 * - limit: 默认 20，范围 1~100
 * - order: 默认 desc，仅允许 asc/desc
 * - sortBy: 透传（在路由内用白名单映射校验）
 */
export function parsePagination(params: URLSearchParams): ParsedPagination {
  // page
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  // limit
  const rawLimit = Number(params.get("limit") ?? "20");
  let limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : 20;
  if (limit > 100) limit = 100;

  // order
  const rawOrder = (params.get("order") || "desc").toLowerCase();
  const order: SortOrder = rawOrder === "asc" ? "asc" : "desc";

  // sortBy 直接透传（后续由路由做白名单映射）
  const sortBy = params.get("sortBy");

  const offset = (page - 1) * limit;

  return { page, limit, offset, sortBy, order };
}

/**
 * 位置参数版：根据 page/limit/total 计算分页元信息。
 * - total: 总条数
 * - totalPages: 总页数（>=1，当 total=0 时为 0）
 * - hasPrev/hasNext: 是否存在上一页/下一页
 */
export function getPaginationMeta(page: number, limit: number, total: number) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / Math.max(1, limit));
  const hasPrev = page > 1 && totalPages > 0;
  const hasNext = totalPages > 0 && page < totalPages;

  return {
    page,
    limit,
    total,
    totalPages,
    hasPrev,
    hasNext,
  };
}
