import { createClient } from "@supabase/supabase-js";

/**
 * Supabase service client（用于后台/Serverless，使用 service role key）
 * 需确保环境变量指向 DriveQuiz 主库对应的 Supabase 项目：
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
export function getSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
