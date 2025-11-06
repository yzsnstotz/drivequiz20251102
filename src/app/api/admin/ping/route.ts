import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { success } from "@/app/api/_lib/errors";

// ✅ 强制动态渲染（防止被静态化）
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

/**
 * 管理后台健康检查端点
 * - 需要 Bearer <ADMIN_TOKEN>
 * - 统一响应：{ ok: true, data: { name, time } }
 * - 401/403 由 withAdminAuth 统一返回
 */
export const GET = withAdminAuth(async () => {
  return success({
    name: "admin-ping",
    time: new Date().toISOString(), // 统一使用 ISO8601 UTC
  });
});
