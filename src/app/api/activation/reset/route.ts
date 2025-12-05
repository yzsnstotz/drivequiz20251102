export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";

function ok<T>(data: T, status = 200) {
  const res = NextResponse.json({ success: true, ...((data as any) || {}) }, { status });
  res.headers.set("Cache-Control", "private, max-age=0, no-store");
  return res;
}

function fail(error: string, status = 400) {
  const res = NextResponse.json({ success: false, error }, { status });
  res.headers.set("Cache-Control", "private, max-age=0, no-store");
  return res;
}

export async function POST(req: NextRequest) {
  const userInfo = await getUserInfo(req);
  const userId = userInfo?.userDbId || userInfo?.userId || null;
  if (!userId) {
    return fail("NO_USER", 401);
  }

  const now = new Date();

  try {
    await db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom("users")
        .selectAll()
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const oldActivationCodeId = user.activation_code_id;

      await trx
        .updateTable("users")
        .set({ activation_code_id: null, status: "pending", updated_at: now })
        .where("id", "=", user.id)
        .execute();

      if (oldActivationCodeId != null) {
        const codeRow = await trx
          .selectFrom("activation_codes")
          .selectAll()
          .where("id", "=", oldActivationCodeId)
          .executeTakeFirst();

        if (codeRow) {
          const newUsedCount = Math.max(0, (codeRow.used_count ?? 0) - 1);
          await trx
            .updateTable("activation_codes")
            .set({ used_count: newUsedCount, updated_at: now })
            .where("id", "=", codeRow.id)
            .execute();
        }
      }
    });

    return ok({}, 200);
  } catch (e: any) {
    const msg = e?.message || "UNKNOWN_ERROR";
    if (msg === "USER_NOT_FOUND") {
      return fail("NO_USER", 404);
    }
    return fail("INTERNAL_ERROR", 500);
  }
}
