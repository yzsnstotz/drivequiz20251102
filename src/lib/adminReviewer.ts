const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminReviewerInfo {
  id?: string | number | null;
  username?: string | null;
}

/**
 * 解析 reviewerId：只返回合法 UUID，否则返回 null。
 * 不再 fallback "admin"/username 等非 UUID 值，避免 DB uuid 报错。
 */
export function resolveReviewerId(
  explicitReviewerId: string | null | undefined,
  adminInfo: AdminReviewerInfo | null | undefined
): string | null {
  const candidates: Array<string | null | undefined> = [
    explicitReviewerId ?? null,
    adminInfo?.id != null ? String(adminInfo.id) : null,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && UUID_REGEX.test(value)) {
      return value;
    }
  }

  return null;
}
