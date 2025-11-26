// 共享的二维码token存储（生产环境应使用Redis等）
// 使用全局变量避免 Next.js 热重载时丢失数据
declare global {
  // eslint-disable-next-line no-var
  var __qrTokens: Map<
    string,
    { provider: string; expiresAt: number; status: "pending" | "success" | "expired" }
 > | undefined;
}

// 在开发环境中，使用全局变量；在生产环境中，使用模块级变量
const qrTokens =
  typeof globalThis !== "undefined" && process.env.NODE_ENV === "development"
    ? (globalThis.__qrTokens ??= new Map())
    : new Map<
        string,
        { provider: string; expiresAt: number; status: "pending" | "success" | "expired" }
      >();

export function setQRToken(
  token: string,
  provider: string,
  expiresAt: number
): void {
  // 只在开发环境输出详细日志
  if (process.env.NODE_ENV === "development") {
    console.log("[QRTokenStore] Setting token:", token.substring(0, 8) + "...");
  }
  
  qrTokens.set(token, {
    provider,
    expiresAt,
    status: "pending",
  });
  
  // 自动清理过期 token
  cleanupExpiredTokens();
}

export function getQRToken(token: string) {
  // 减少日志输出，只在 token 不存在时输出警告
  const tokenData = qrTokens.get(token);
  if (!tokenData) {
    // 只在开发环境输出警告
    if (process.env.NODE_ENV === "development") {
      console.warn("[QRTokenStore] Token not found:", token.substring(0, 8) + "...");
    }
  }
  
  return tokenData;
}

export function updateQRTokenStatus(
  token: string,
  status: "pending" | "success" | "expired"
): void {
  const tokenData = qrTokens.get(token);
  if (tokenData) {
    tokenData.status = status;
    // 只在开发环境输出日志
    if (process.env.NODE_ENV === "development") {
      console.log(`[QRTokenStore] Updated token ${token.substring(0, 8)}... status to: ${status}`);
    }
  }
}

export function deleteQRToken(token: string): void {
  const deleted = qrTokens.delete(token);
  // 只在开发环境输出日志
  if (process.env.NODE_ENV === "development" && deleted) {
    console.log(`[QRTokenStore] Deleted token: ${token.substring(0, 8)}...`);
  }
}

// 清理过期token（自动清理）
export function cleanupExpiredTokens(): void {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [token, data] of qrTokens.entries()) {
    if (now > data.expiresAt) {
      qrTokens.delete(token);
      cleanedCount++;
    }
  }
  // 只在清理了 token 时输出日志
  if (cleanedCount > 0 && process.env.NODE_ENV === "development") {
    console.log(`[QRTokenStore] Cleaned up ${cleanedCount} expired token(s). Remaining: ${qrTokens.size}`);
  }
}

