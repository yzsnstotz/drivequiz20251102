// ============================================================
// 测试文件: tests/api/activate.spec.ts
// 功能: 激活逻辑测试（正常 / 过期 / 非法状态）
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/activate/route";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// Mock 数据库
vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(() => ({
      execute: vi.fn(),
    })),
  },
}));

describe("激活接口 (POST /api/activate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("参数校验", () => {
    it("应拒绝缺少email的请求", async () => {
      const req = new NextRequest("http://localhost/api/activate", {
        method: "POST",
        body: JSON.stringify({
          activationCode: "ABC123",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("VALIDATION_FAILED");
      expect(body.message).toContain("email");
    });

    it("应拒绝缺少activationCode的请求", async () => {
      const req = new NextRequest("http://localhost/api/activate", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("VALIDATION_FAILED");
      expect(body.message).toContain("activationCode");
    });

    it("应拒绝无效的email格式", async () => {
      const req = new NextRequest("http://localhost/api/activate", {
        method: "POST",
        body: JSON.stringify({
          email: "invalid-email",
          activationCode: "ABC123",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("VALIDATION_FAILED");
      expect(body.message).toContain("email");
    });
  });

  describe("激活码不存在", () => {
    it("应拒绝无效的激活码", async () => {
      const mockExecute = vi.fn().mockImplementation(async (callback) => {
        const trx = {
          selectFrom: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(null), // 未找到激活码
        };
        return callback(trx);
      });

      (db.transaction as any).mockReturnValue({
        execute: mockExecute,
      });

      const req = new NextRequest("http://localhost/api/activate", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          activationCode: "INVALID",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("INVALID_CODE");
    });
  });

  describe("状态检查", () => {
    it("应拒绝disabled状态的激活码", async () => {
      const mockCodeRow = {
        id: 1,
        code: "ABC123",
        status: "disabled",
        expires_at: null,
        usage_limit: 1,
        used_count: 0,
        is_used: false,
      };

      const mockExecute = vi.fn().mockImplementation(async (callback) => {
        const trx = {
          selectFrom: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(mockCodeRow),
        };
        return callback(trx);
      });

      (db.transaction as any).mockReturnValue({
        execute: mockExecute,
      });

      const req = new NextRequest("http://localhost/api/activate", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          activationCode: "ABC123",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("CODE_STATUS_INVALID");
      expect(body.message).toContain("disabled");
    });

    it("应拒绝suspended状态的激活码", async () => {
      const mockCodeRow = {
        id: 1,
        code: "ABC123",
        status: "suspended",
        expires_at: null,
        usage_limit: 1,
        used_count: 0,
        is_used: false,
      };

      const mockExecute = vi.fn().mockImplementation(async (callback) => {
        const trx = {
          selectFrom: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(mockCodeRow),
        };
        return callback(trx);
      });

      (db.transaction as any).mockReturnValue({
        execute: mockExecute,
      });

      const req = new NextRequest("http://localhost/api/activate", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          activationCode: "ABC123",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("CODE_STATUS_INVALID");
      expect(body.message).toContain("suspended");
    });

    it("应拒绝expired状态的激活码", async () => {
      const mockCodeRow = {
        id: 1,
        code: "ABC123",
        status: "expired",
        expires_at: null,
        usage_limit: 1,
        used_count: 0,
        is_used: false,
      };

      const mockExecute = vi.fn().mockImplementation(async (callback) => {
        const trx = {
          selectFrom: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(mockCodeRow),
        };
        return callback(trx);
      });

      (db.transaction as any).mockReturnValue({
        execute: mockExecute,
      });

      const req = new NextRequest("http://localhost/api/activate", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          activationCode: "ABC123",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("CODE_STATUS_INVALID");
      expect(body.message).toContain("expired");
    });
  });

  describe("过期检查", () => {
    it("应拒绝已过期的激活码（自动写回expired状态）", async () => {
      const pastDate = new Date(Date.now() - 86400000); // 昨天
      const mockCodeRow = {
        id: 1,
        code: "ABC123",
        status: "enabled",
        expires_at: pastDate,
        usage_limit: 1,
        used_count: 0,
        is_used: false,
      };

      const mockExecute = vi.fn().mockImplementation(async (callback) => {
        const mockUpdateTable = {
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue(undefined),
        };

        const trx = {
          selectFrom: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(mockCodeRow),
          updateTable: vi.fn().mockReturnValue(mockUpdateTable),
        };
        
        const result = await callback(trx);
        return result;
      });

      (db.transaction as any).mockReturnValue({
        execute: mockExecute,
      });

      const req = new NextRequest("http://localhost/api/activate", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          activationCode: "ABC123",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("CODE_EXPIRED");
      expect(body.message).toContain("过期");
    });
  });

  describe("使用次数检查", () => {
    it("应拒绝已达到使用上限的激活码", async () => {
      const mockCodeRow = {
        id: 1,
        code: "ABC123",
        status: "enabled",
        expires_at: null,
        usage_limit: 1,
        used_count: 1, // 已达到上限
        is_used: false,
      };

      const mockExecute = vi.fn().mockImplementation(async (callback) => {
        const mockUpdateTable = {
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue(undefined),
        };

        const trx = {
          selectFrom: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(mockCodeRow),
          updateTable: vi.fn().mockReturnValue(mockUpdateTable),
        };
        
        const result = await callback(trx);
        return result;
      });

      (db.transaction as any).mockReturnValue({
        execute: mockExecute,
      });

      const req = new NextRequest("http://localhost/api/activate", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          activationCode: "ABC123",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("CODE_USAGE_EXCEEDED");
    });
  });

  describe("正常激活流程", () => {
    it("应成功激活enabled状态的激活码", async () => {
      const mockCodeRow = {
        id: 1,
        code: "ABC123",
        status: "enabled",
        expires_at: null,
        usage_limit: 1,
        used_count: 0,
        is_used: false,
      };

      const mockActivation = {
        id: 100,
        activated_at: new Date(),
      };

      const mockExecute = vi.fn().mockImplementation(async (callback) => {
        const mockUpdateTable = {
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue(undefined),
        };

        const mockInsertInto = {
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(mockActivation),
        };

        const trx = {
          selectFrom: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn().mockResolvedValue(mockCodeRow),
          updateTable: vi.fn().mockReturnValue(mockUpdateTable),
          insertInto: vi.fn().mockReturnValue(mockInsertInto),
        };
        
        const result = await callback(trx);
        return result;
      });

      (db.transaction as any).mockReturnValue({
        execute: mockExecute,
      });

      const req = new NextRequest("http://localhost/api/activate", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          activationCode: "ABC123",
          userAgent: "TestAgent",
        }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data).toHaveProperty("activationId");
      expect(body.data).toHaveProperty("activatedAt");
      expect(body.data.email).toBe("test@example.com");
    });
  });
});

