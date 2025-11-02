export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/app/api/_lib/withAdminAuth';

export const GET = withAdminAuth(async () => {
  return NextResponse.json({
    ok: true,
    data: { service: 'admin', ts: new Date().toISOString() },
  });
});

