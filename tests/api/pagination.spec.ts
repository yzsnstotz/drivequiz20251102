// ============================================================
// 测试文件: tests/api/pagination.spec.ts
// 功能: 分页逻辑验证
// ============================================================

import { describe, it, expect } from "vitest";
import { parsePagination, getPaginationMeta, type SortOrder } from "@/app/api/_lib/pagination";

describe("分页工具函数", () => {
  describe("parsePagination()", () => {
    it("应使用默认值（空参数）", () => {
      const params = new URLSearchParams();
      const result = parsePagination(params);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(result.sortBy).toBeNull();
      expect(result.order).toBe("desc");
    });

    it("应解析有效的分页参数", () => {
      const params = new URLSearchParams({
        page: "2",
        limit: "50",
        sortBy: "createdAt",
        order: "asc",
      });
      const result = parsePagination(params);
      
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(50); // (2-1) * 50
      expect(result.sortBy).toBe("createdAt");
      expect(result.order).toBe("asc");
    });

    it("应限制limit最大值为100", () => {
      const params = new URLSearchParams({ limit: "200" });
      const result = parsePagination(params);
      
      expect(result.limit).toBe(100);
    });

    it("应处理无效的page值（使用默认值1）", () => {
      const params = new URLSearchParams({ page: "0" });
      const result = parsePagination(params);
      
      expect(result.page).toBe(1);
    });

    it("应处理无效的page值（负数）", () => {
      const params = new URLSearchParams({ page: "-1" });
      const result = parsePagination(params);
      
      expect(result.page).toBe(1);
    });

    it("应处理无效的page值（非数字）", () => {
      const params = new URLSearchParams({ page: "abc" });
      const result = parsePagination(params);
      
      expect(result.page).toBe(1);
    });

    it("应处理无效的limit值（使用默认值20）", () => {
      const params = new URLSearchParams({ limit: "0" });
      const result = parsePagination(params);
      
      expect(result.limit).toBe(20);
    });

    it("应处理无效的order值（使用默认desc）", () => {
      const params = new URLSearchParams({ order: "invalid" });
      const result = parsePagination(params);
      
      expect(result.order).toBe("desc");
    });

    it("应正确计算offset", () => {
      const params = new URLSearchParams({ page: "3", limit: "10" });
      const result = parsePagination(params);
      
      expect(result.offset).toBe(20); // (3-1) * 10
    });

    it("应支持order=asc", () => {
      const params = new URLSearchParams({ order: "asc" });
      const result = parsePagination(params);
      
      expect(result.order).toBe("asc");
    });

    it("应支持order=desc", () => {
      const params = new URLSearchParams({ order: "desc" });
      const result = parsePagination(params);
      
      expect(result.order).toBe("desc");
    });

    it("应处理大小写不敏感的order值", () => {
      const params = new URLSearchParams({ order: "ASC" });
      const result = parsePagination(params);
      
      expect(result.order).toBe("asc");
    });
  });

  describe("getPaginationMeta()", () => {
    it("应计算分页元信息（正常情况）", () => {
      const meta = getPaginationMeta(2, 20, 100);
      
      expect(meta.page).toBe(2);
      expect(meta.limit).toBe(20);
      expect(meta.total).toBe(100);
      expect(meta.totalPages).toBe(5); // ceil(100/20)
      expect(meta.hasPrev).toBe(true);
      expect(meta.hasNext).toBe(true);
    });

    it("应在第一页时hasPrev=false", () => {
      const meta = getPaginationMeta(1, 20, 100);
      
      expect(meta.hasPrev).toBe(false);
      expect(meta.hasNext).toBe(true);
    });

    it("应在最后一页时hasNext=false", () => {
      const meta = getPaginationMeta(5, 20, 100);
      
      expect(meta.hasPrev).toBe(true);
      expect(meta.hasNext).toBe(false);
    });

    it("应处理total=0的情况", () => {
      const meta = getPaginationMeta(1, 20, 0);
      
      expect(meta.total).toBe(0);
      expect(meta.totalPages).toBe(0);
      expect(meta.hasPrev).toBe(false);
      expect(meta.hasNext).toBe(false);
    });

    it("应处理不整除的情况（向上取整）", () => {
      const meta = getPaginationMeta(1, 20, 101);
      
      expect(meta.totalPages).toBe(6); // ceil(101/20) = 6
    });

    it("应在仅有一页时hasPrev和hasNext都为false", () => {
      const meta = getPaginationMeta(1, 20, 15);
      
      expect(meta.totalPages).toBe(1);
      expect(meta.hasPrev).toBe(false);
      expect(meta.hasNext).toBe(false);
    });

    it("应处理单条数据的情况", () => {
      const meta = getPaginationMeta(1, 20, 1);
      
      expect(meta.total).toBe(1);
      expect(meta.totalPages).toBe(1);
      expect(meta.hasPrev).toBe(false);
      expect(meta.hasNext).toBe(false);
    });

    it("应处理limit大于total的情况", () => {
      const meta = getPaginationMeta(1, 100, 50);
      
      expect(meta.total).toBe(50);
      expect(meta.totalPages).toBe(1);
      expect(meta.hasPrev).toBe(false);
      expect(meta.hasNext).toBe(false);
    });

    it("应防止除零错误", () => {
      const meta = getPaginationMeta(1, 0, 100);
      
      // 使用 Math.max(1, limit) 防止除零
      expect(meta.totalPages).toBeGreaterThan(0);
    });
  });

  describe("组合场景", () => {
    it("应正确计算分页链：第3页，每页10条，共45条", () => {
      const params = new URLSearchParams({ page: "3", limit: "10" });
      const parsed = parsePagination(params);
      const meta = getPaginationMeta(parsed.page, parsed.limit, 45);
      
      expect(parsed.offset).toBe(20);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasPrev).toBe(true);
      expect(meta.hasNext).toBe(true);
    });
  });
});

