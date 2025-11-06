/**
 * ✅ Dynamic Route Declaration
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * GET /api/terms-of-service
 * 公开接口，获取服务条款
 */
export async function GET(request: NextRequest) {
  try {
    const row = await db
      .selectFrom("terms_of_service")
      .selectAll()
      .where("status", "=", "active")
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!row) {
      return ok({ title: "", content: "", version: "" });
    }

    return ok({
      title: row.title,
      content: row.content,
      version: row.version || "",
    });
  } catch (err: any) {
    console.error("[GET /api/terms-of-service] Error:", err);
    // 如果表不存在，返回空内容
    if (err.message && err.message.includes("does not exist")) {
      return ok({ title: "", content: "", version: "" });
    }
    return ok({ title: "", content: "", version: "" });
  }
}

