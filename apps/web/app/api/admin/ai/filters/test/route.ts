// apps/web/app/api/admin/ai/filters/test/route.ts
/* 功能：测试正则表达式是否匹配文本（后端校验兜底） */
import { NextRequest } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success, badRequest, internalError } from "@/app/api/_lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/ai/filters/test
 * 测试正则表达式是否匹配文本
 * Body: { pattern: string, testText: string }
 */
export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = (await req.json().catch(() => null)) as
      | { pattern?: string; testText?: string }
      | null;

    if (!body) {
      return badRequest("Body is required.");
    }

    const { pattern, testText } = body;

    if (typeof pattern !== "string" || pattern.trim().length === 0) {
      return badRequest("pattern must be a non-empty string.");
    }

    if (typeof testText !== "string") {
      return badRequest("testText must be a string.");
    }

    const trimmedPattern = pattern.trim();

    try {
      // 尝试作为正则表达式
      const regex = new RegExp(trimmedPattern);
      const matches = regex.test(testText);
      return success({ matches });
    } catch (regexError) {
      // 如果不是有效的正则，尝试作为管道分隔的多个模式
      try {
        const parts = trimmedPattern.split("|").map((p) => p.trim()).filter((p) => p.length > 0);
        if (parts.length === 0) {
          return badRequest("Invalid pattern format.");
        }

        const matches = parts.some((part) => {
          try {
            // 尝试作为正则
            return new RegExp(part).test(testText);
          } catch {
            // 作为普通字符串
            return testText.includes(part);
          }
        });

        return success({ matches });
      } catch (err) {
        return badRequest("Invalid pattern format.");
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected server error.";
    return internalError(msg);
  }
});

