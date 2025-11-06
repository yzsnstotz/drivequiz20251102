// ============================================================
// 测试文件: tests/api/errors.spec.ts
// 功能: 错误工具函数验证
// ============================================================

import { describe, it, expect } from "vitest";
import {
  success,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  invalidState,
  internalError,
  type ErrorResponse,
} from "@/app/api/_lib/errors";

describe("错误工具函数", () => {
  describe("success()", () => {
    it("应返回成功响应（无分页）", async () => {
      const response = success({ id: 1, name: "test" });
      const body = await response.json();
      
      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        data: { id: 1, name: "test" },
      });
    });

    it("应返回成功响应（带分页）", async () => {
      const pagination = { page: 1, limit: 20, total: 100, totalPages: 5 };
      const response = success({ items: [] }, pagination);
      const body = await response.json();
      
      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        data: { items: [] },
        pagination,
      });
    });
  });

  describe("badRequest()", () => {
    it("应返回400错误（默认消息）", async () => {
      const response = badRequest();
      const body = await response.json();
      
      expect(response.status).toBe(400);
      expect(body).toEqual({
        ok: false,
        errorCode: "VALIDATION_FAILED",
        message: "Validation failed",
      });
    });

    it("应返回400错误（自定义消息）", async () => {
      const response = badRequest("Invalid input parameter");
      const body = await response.json();
      
      expect(response.status).toBe(400);
      expect((body as ErrorResponse).errorCode).toBe("VALIDATION_FAILED");
      expect((body as ErrorResponse).message).toBe("Invalid input parameter");
    });
  });

  describe("unauthorized()", () => {
    it("应返回401错误", async () => {
      const response = unauthorized();
      const body = await response.json();
      
      expect(response.status).toBe(401);
      expect((body as ErrorResponse).errorCode).toBe("AUTH_REQUIRED");
      expect((body as ErrorResponse).message).toBe("Authentication required");
    });

    it("应返回401错误（自定义消息）", async () => {
      const response = unauthorized("Token missing");
      const body = await response.json();
      
      expect(response.status).toBe(401);
      expect((body as ErrorResponse).errorCode).toBe("AUTH_REQUIRED");
      expect((body as ErrorResponse).message).toBe("Token missing");
    });
  });

  describe("forbidden()", () => {
    it("应返回403错误", async () => {
      const response = forbidden();
      const body = await response.json();
      
      expect(response.status).toBe(403);
      expect((body as ErrorResponse).errorCode).toBe("FORBIDDEN");
    });
  });

  describe("notFound()", () => {
    it("应返回404错误", async () => {
      const response = notFound();
      const body = await response.json();
      
      expect(response.status).toBe(404);
      expect((body as ErrorResponse).errorCode).toBe("NOT_FOUND");
      expect((body as ErrorResponse).message).toBe("Resource not found");
    });

    it("应返回404错误（自定义消息）", async () => {
      const response = notFound("Activation code not found");
      const body = await response.json();
      
      expect(response.status).toBe(404);
      expect((body as ErrorResponse).errorCode).toBe("NOT_FOUND");
      expect((body as ErrorResponse).message).toBe("Activation code not found");
    });
  });

  describe("conflict()", () => {
    it("应返回409错误", async () => {
      const response = conflict();
      const body = await response.json();
      
      expect(response.status).toBe(409);
      expect((body as ErrorResponse).errorCode).toBe("CONFLICT");
    });

    it("应返回409错误（自定义消息）", async () => {
      const response = conflict("Code already used");
      const body = await response.json();
      
      expect(response.status).toBe(409);
      expect((body as ErrorResponse).errorCode).toBe("CONFLICT");
      expect((body as ErrorResponse).message).toBe("Code already used");
    });
  });

  describe("invalidState()", () => {
    it("应返回409错误（状态流转）", async () => {
      const response = invalidState();
      const body = await response.json();
      
      expect(response.status).toBe(409);
      expect((body as ErrorResponse).errorCode).toBe("INVALID_STATE_TRANSITION");
    });

    it("应返回409错误（自定义消息）", async () => {
      const response = invalidState("Cannot revert from expired");
      const body = await response.json();
      
      expect(response.status).toBe(409);
      expect((body as ErrorResponse).errorCode).toBe("INVALID_STATE_TRANSITION");
      expect((body as ErrorResponse).message).toBe("Cannot revert from expired");
    });
  });

  describe("internalError()", () => {
    it("应返回500错误", async () => {
      const response = internalError();
      const body = await response.json();
      
      expect(response.status).toBe(500);
      expect((body as ErrorResponse).errorCode).toBe("INTERNAL_ERROR");
    });

    it("应返回500错误（自定义消息）", async () => {
      const response = internalError("Database connection failed");
      const body = await response.json();
      
      expect(response.status).toBe(500);
      expect((body as ErrorResponse).errorCode).toBe("INTERNAL_ERROR");
      expect((body as ErrorResponse).message).toBe("Database connection failed");
    });
  });
});

