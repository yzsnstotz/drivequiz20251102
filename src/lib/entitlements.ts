import { Kysely } from "kysely";
import type { Database } from "@/lib/db";
import { getStudentBasedEntitlement } from "@/lib/studentVerification";

export type ActivationSource = "code" | "student";

export interface UserEntitlement {
  source: ActivationSource;
  plan: string;
  validFrom: Date | null;
  validUntil: Date | null;
}

export interface EffectiveEntitlementResult {
  entitlement: UserEntitlement | null;
  reasonCode?: string | null;
}

type CodeEntitlementResult = {
  entitlement: UserEntitlement | null;
  reasonCode?: string | null;
};

/**
 * 读取基于激活码的权益（保持现有逻辑，向后兼容）
 */
async function getCodeBasedEntitlement(db: Kysely<Database>, userId: string, now: Date): Promise<CodeEntitlementResult> {
  // 1) 找到用户，优先 id，其次 userid（兼容旧字段）
  let user = await db
    .selectFrom("users")
    .select(["id", "email", "status", "activation_code_id"])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!user) {
    user = await db
      .selectFrom("users")
      .select(["id", "email", "status", "activation_code_id"])
      .where("userid", "=", userId)
      .executeTakeFirst();
  }

  if (!user) return { entitlement: null, reasonCode: "NO_USER" };
  if (user.activation_code_id == null) return { entitlement: null, reasonCode: "NO_ACTIVATION_CODE" };

  const activationCode = await db
    .selectFrom("activation_codes")
    .select([
      "id",
      "status",
      "expires_at",
      "usage_limit",
      "used_count",
      "validity_period",
      "validity_unit",
      "activation_started_at",
    ])
    .where("id", "=", user.activation_code_id)
    .executeTakeFirst();

  if (!activationCode) {
    return { entitlement: null, reasonCode: "CODE_NOT_FOUND" };
  }

  const status = String(activationCode.status || "").toLowerCase();
  if (status === "disabled" || status === "suspended") {
    return { entitlement: null, reasonCode: "ACTIVATION_CODE_STATUS_INVALID" };
  }

  const usageLimit = Number(activationCode.usage_limit ?? 0);
  const usedCount = Number(activationCode.used_count ?? 0);
  if (usageLimit > 0 && usedCount >= usageLimit) {
    return { entitlement: null, reasonCode: "ACTIVATION_CODE_USAGE_EXCEEDED" };
  }

  let expiresAt: Date | null = null;
  if (activationCode.activation_started_at && activationCode.validity_period && activationCode.validity_unit) {
    const start = new Date(activationCode.activation_started_at as unknown as string);
    if (!isNaN(start.getTime())) {
      const period = Number(activationCode.validity_period);
      const unit = activationCode.validity_unit;
      const d = new Date(start);
      switch (unit) {
        case "day":
          d.setDate(d.getDate() + period);
          break;
        case "month":
          d.setMonth(d.getMonth() + period);
          break;
        case "year":
          d.setFullYear(d.getFullYear() + period);
          break;
      }
      expiresAt = d;
    }
  } else if (activationCode.expires_at) {
    const fixed = new Date(activationCode.expires_at as unknown as string);
    if (!isNaN(fixed.getTime())) {
      expiresAt = fixed;
    }
  }

  if (expiresAt && expiresAt <= now) {
    // 按旧逻辑，写回 expired 状态
    await db
      .updateTable("activation_codes")
      .set({ status: "expired", updated_at: now })
      .where("id", "=", activationCode.id)
      .execute();
    return { entitlement: null, reasonCode: "ACTIVATION_CODE_EXPIRED" };
  }

  return {
    entitlement: {
      source: "code",
      plan: "PREMIUM",
      validFrom: activationCode.activation_started_at ?? null,
      validUntil: expiresAt ?? null,
    },
    reasonCode: null,
  };
}

/**
 * 统一计算用户有效权益：激活码优先，其次学生权益
 */
export async function getUserEffectiveEntitlement(db: Kysely<Database>, userId: string, now: Date = new Date()): Promise<EffectiveEntitlementResult> {
  const codeResult = await getCodeBasedEntitlement(db, userId, now);
  if (codeResult.entitlement) {
    return { entitlement: codeResult.entitlement, reasonCode: null };
  }

  const studentEnt = await getStudentBasedEntitlement(db, userId, now);
  if (studentEnt) {
    return { entitlement: studentEnt, reasonCode: null };
  }

  return { entitlement: null, reasonCode: codeResult.reasonCode ?? "NO_ENTITLEMENT" };
}
