import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPatchedKyselyAdapter } from "@/lib/auth-kysely-adapter";
import { getAuthEnvConfig } from "@/lib/env";
import { jwtVerify } from "jose";
import { sql } from "kysely";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, token, provider } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ ok: false, message: "邮箱必填" }, { status: 400 });
    }

    const { secret } = getAuthEnvConfig();
    const enc = new TextEncoder();
    let payload: any;
    try {
      const { payload: pl } = await jwtVerify(String(token || ""), enc.encode(secret || ""));
      payload = pl;
    } catch {
      return NextResponse.json({ ok: false, message: "令牌无效或过期" }, { status: 401 });
    }

    const providerFromToken = payload?.provider;
    const providerAccountId = payload?.providerAccountId;
    if (!providerAccountId) {
      return NextResponse.json({ ok: false, message: "缺少 providerAccountId" }, { status: 400 });
    }
    const finalProvider = String(providerFromToken || provider || "").trim();
    if (!finalProvider) {
      return NextResponse.json({ ok: false, message: "缺少 provider" }, { status: 400 });
    }

    const adapter = createPatchedKyselyAdapter(db as any);
    // 先按 LOWER(email) 走底表查询，避免大小写不一致错过已有用户
    let user = await db
      .selectFrom("users")
      .select(["id", "email"]) 
      .where(sql`LOWER(email) = ${normalizedEmail}` as unknown as any)
      .executeTakeFirst();
    if (!user) {
      const byAdapter = await (adapter as any).getUserByEmail(normalizedEmail);
      if (byAdapter) {
        user = { id: byAdapter.id, email: byAdapter.email } as any;
      }
    }
    if (!user) {
      const created = await (adapter as any).createUser({ email: normalizedEmail, emailVerified: null });
      user = { id: created.id, email: created.email } as any;
    }
    const userId: string = String((user as any).id);

    // 幂等链接：唯一键冲突（23505 / oauth_accounts_provider_provider_account_id_key）视为已绑定成功
    try {
      await (adapter as any).linkAccount({
        userId,
        provider: finalProvider,
        providerAccountId,
        type: "oauth",
      });
    } catch (e: any) {
      const msg = e?.message || "";
      const isUnique = msg.includes("23505") || msg.toLowerCase().includes("duplicate key") || msg.includes("oauth_accounts_provider_provider_account_id_key");
      if (!isUnique) {
        return NextResponse.json({ ok: false, errorCode: "LINK_ACCOUNT_FAILED", message: msg || "绑定账号失败" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || String(err) }, { status: 500 });
  }
}
