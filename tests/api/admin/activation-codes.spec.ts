// ============================================================
// 测试文件: tests/api/admin/activation-codes.spec.ts
// 功能: 激活码管理接口测试（列表查询 & 批量生成）
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/admin/activation-codes/route";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// Mock 管理员鉴权
vi.mock("@/app/api/_lib/withAdminAuth", () => ({
  withAdminAuth: (handler: any) => handler,
}));

// Mock 数据库
vi.mock("@/lib/db", () => ({
  db: {
    selectFrom: vi.fn(),
  },
}));

describe("激活码管理接口", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/activation-codes (列表查询)", () => {
    it("应使用默认分页参数查询列表", async () => {
      const mockRows = [
        {
          id: 1,
          code: "ABC123",
          status: "enabled",
          usage_limit: 1,
          used_count: 0,
          is_used: false,
          expires_at: null,
          enabled_at: null,
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const mockCount = { count: 1 };
      
      let queryCallCount = 0;
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        execute: vi.fn().mockImplementation(() => {
          queryCallCount++;
          if (queryCallCount === 1) {
            // 计数查询
            return Promise.resolve([mockCount]);
          }
          // 列表查询
          return Promise.resolve(mockRows);
        }),
        executeTakeFirst: vi.fn().mockResolvedValue(mockCount),
      };

      (db.selectFrom as any).mockReturnValue(mockQuery);

      const req = new NextRequest("http://localhost/api/admin/activation-codes");

      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(20);
    });

    it("应支持status筛选", async () => {
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        executeTakeFirst: vi.fn().mockResolvedValue({ count: 0 }),
      };

      (db.selectFrom as any).mockReturnValue(mockQuery);

      const req = new NextRequest(
        "http://localhost/api/admin/activation-codes?status=enabled"
      );

      await GET(req);

      // 验证 where 被调用以筛选状态
      expect(mockQuery.where).toHaveBeenCalled();
    });

    it("应支持code模糊搜索", async () => {
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        executeTakeFirst: vi.fn().mockResolvedValue({ count: 0 }),
      };

      (db.selectFrom as any).mockReturnValue(mockQuery);

      const req = new NextRequest(
        "http://localhost/api/admin/activation-codes?code=ABC"
      );

      await GET(req);

      // 验证 where 被调用以搜索code
      expect(mockQuery.where).toHaveBeenCalled();
    });

    it("应支持分页参数", async () => {
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        executeTakeFirst: vi.fn().mockResolvedValue({ count: 0 }),
      };

      (db.selectFrom as any).mockReturnValue(mockQuery);

      const req = new NextRequest(
        "http://localhost/api/admin/activation-codes?page=2&limit=50"
      );

      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(50);
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
      expect(mockQuery.offset).toHaveBeenCalledWith(50); // (2-1) * 50
    });

    it("应拒绝无效的sortBy参数", async () => {
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        executeTakeFirst: vi.fn().mockResolvedValue({ count: 0 }),
      };

      (db.selectFrom as any).mockReturnValue(mockQuery);

      const req = new NextRequest(
        "http://localhost/api/admin/activation-codes?sortBy=invalidField"
      );

      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("VALIDATION_FAILED");
    });

    it("应支持排序参数", async () => {
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        executeTakeFirst: vi.fn().mockResolvedValue({ count: 0 }),
      };

      (db.selectFrom as any).mockReturnValue(mockQuery);

      const req = new NextRequest(
        "http://localhost/api/admin/activation-codes?sortBy=createdAt&order=asc"
      );

      await GET(req);

      expect(mockQuery.orderBy).toHaveBeenCalled();
    });
  });

  describe("POST /api/admin/activation-codes (批量生成)", () => {
    it("应成功批量生成激活码", async () => {
      const mockInserted = [
        {
          id: 1,
          code: "ABC123",
          status: "disabled",
          usage_limit: 1,
          used_count: 0,
          is_used: false,
          expires_at: null,
          enabled_at: null,
          notes: "Test notes",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const mockQuery = {
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockInserted),
      };

      (db.insertInto as any) = vi.fn().mockReturnValue(mockQuery);

      const req = new NextRequest("http://localhost/api/admin/activation-codes", {
        method: "POST",
        body: JSON.stringify({
          count: 1,
          usageLimit: 1,
          status: "disabled",
          notes: "Test notes",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(1);
      expect(body.data[0].code).toBeDefined();
    });

    it("应拒绝count超出范围", async () => {
      const req = new NextRequest("http://localhost/api/admin/activation-codes", {
        method: "POST",
        body: JSON.stringify({
          count: 10001, // 超出上限
          usageLimit: 1,
          status: "disabled",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("VALIDATION_FAILED");
    });

    it("应拒绝count小于1", async () => {
      const req = new NextRequest("http://localhost/api/admin/activation-codes", {
        method: "POST",
        body: JSON.stringify({
          count: 0,
          usageLimit: 1,
          status: "disabled",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
    });

    it("应拒绝usageLimit小于1", async () => {
      const req = new NextRequest("http://localhost/api/admin/activation-codes", {
        method: "POST",
        body: JSON.stringify({
          count: 10,
          usageLimit: 0,
          status: "disabled",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
    });

    it("应拒绝无效的status值", async () => {
      const req = new NextRequest("http://localhost/api/admin/activation-codes", {
        method: "POST",
        body: JSON.stringify({
          count: 10,
          usageLimit: 1,
          status: "invalid_status",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
    });

    it("应支持expiresAt参数", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const mockInserted = [
        {
          id: 1,
          code: "ABC123",
          status: "disabled",
          usage_limit: 1,
          used_count: 0,
          is_used: false,
          expires_at: new Date(futureDate),
          enabled_at: null,
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const mockQuery = {
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockInserted),
      };

      (db.insertInto as any) = vi.fn().mockReturnValue(mockQuery);

      const req = new NextRequest("http://localhost/api/admin/activation-codes", {
        method: "POST",
        body: JSON.stringify({
          count: 1,
          usageLimit: 1,
          status: "disabled",
          expiresAt: futureDate,
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("应批量生成多个激活码", async () => {
      const mockInserted = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        code: `CODE${i + 1}`,
        status: "disabled",
        usage_limit: 1,
        used_count: 0,
        is_used: false,
        expires_at: null,
        enabled_at: null,
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      const mockQuery = {
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockInserted),
      };

      (db.insertInto as any) = vi.fn().mockReturnValue(mockQuery);

      const req = new NextRequest("http://localhost/api/admin/activation-codes", {
        method: "POST",
        body: JSON.stringify({
          count: 10,
          usageLimit: 1,
          status: "disabled",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.length).toBe(10);
      expect(mockQuery.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            code: expect.any(String),
            status: "disabled",
            usage_limit: 1,
            used_count: 0,
          }),
        ])
      );
    });
  });
});

