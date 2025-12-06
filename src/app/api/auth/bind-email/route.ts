import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPatchedKyselyAdapter } from "@/lib/auth-kysely-adapter";
import { getAuthEnvConfig } from "@/lib/env";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, token, provider } = await req.json();
    if (provider !== "line") {
      return NextResponse.json({ ok: false, message: "仅支持 LINE 绑定" }, { status: 400 });
    }
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

    const providerAccountId = payload?.providerAccountId;
    if (!providerAccountId) {
      return NextResponse.json({ ok: false, message: "缺少 providerAccountId" }, { status: 400 });
    }

    const adapter = createPatchedKyselyAdapter(db as any);
    const existingUser = await (adapter as any).getUserByEmail(normalizedEmail);
    let user = existingUser;
    if (!user) {
      user = await (adapter as any).createUser({ email: normalizedEmail });
    }

    await (adapter as any).linkAccount({
      userId: user.id,
      provider: "line",
      providerAccountId,
      type: "oauth",
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || String(err) }, { status: 500 });
  }
}

