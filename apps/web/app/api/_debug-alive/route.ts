// apps/web/app/api/_debug-alive/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, where: "apps/web app router" });
}

