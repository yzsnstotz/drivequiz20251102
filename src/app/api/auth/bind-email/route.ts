import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

function isPlaceholder(email: string | null): boolean {
  return !!email && email.endsWith("@oauth.local");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email;
  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    return NextResponse.json({ message: "邮箱不能为空或格式不正确" }, { status: 400 });
  }

  const currentUserId = String(session.user.id);

  const currentUser = await db
    .selectFrom("users")
    .select(["id", "email"])
    .where("id", "=", currentUserId)
    .executeTakeFirst();

  if (!currentUser) {
    return NextResponse.json({ message: "用户不存在" }, { status: 404 });
  }

  const hasRealEmail = !!currentUser.email && !isPlaceholder(currentUser.email);
  if (hasRealEmail && currentUser.email !== email) {
    return NextResponse.json({ message: "邮箱已绑定，暂不支持修改" }, { status: 400 });
  }

  const existingUser = await db
    .selectFrom("users")
    .select(["id", "email"])
    .where("email", "=", email)
    .where("id", "!=", currentUserId)
    .executeTakeFirst();

  if (!existingUser) {
    await db
      .updateTable("users")
      .set({ email, updated_at: new Date() })
      .where("id", "=", currentUserId)
      .execute();
    return NextResponse.json({ ok: true });
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("oauth_accounts")
      .set({ user_id: existingUser.id })
      .where("user_id", "=", currentUserId)
      .execute();

    await trx
      .updateTable("sessions")
      .set({ user_id: existingUser.id })
      .where("user_id", "=", currentUserId)
      .execute();

    await trx
      .updateTable("user_profiles")
      .set({ user_id: existingUser.id })
      .where("user_id", "=", currentUserId)
      .execute();

    await trx
      .updateTable("user_interests")
      .set({ user_id: existingUser.id })
      .where("user_id", "=", currentUserId)
      .execute();

    await trx
      .updateTable("user_behaviors")
      .set({ user_id: existingUser.id })
      .where("user_id", "=", currentUserId)
      .execute();

    await trx
      .updateTable("ad_logs")
      .set({ user_id: existingUser.id })
      .where("user_id", "=", currentUserId)
      .execute();

    await trx
      .updateTable("service_reviews")
      .set({ user_id: existingUser.id })
      .where("user_id", "=", currentUserId)
      .execute();

    await trx
      .updateTable("ai_logs")
      .set({ user_id: existingUser.id })
      .where("user_id", "=", currentUserId)
      .execute();

    await trx.deleteFrom("users").where("id", "=", currentUserId).execute();
  });

  return NextResponse.json({ ok: true });
}
