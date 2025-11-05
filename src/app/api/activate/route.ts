/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 * 原因: 本文件使用了 request.headers / nextUrl.searchParams 等动态上下文
 * 修复策略: 强制动态渲染 + 禁用缓存 + Node.js 运行时
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * 统一成功响应
 */
function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * 统一错误响应
 */
function err(errorCode: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, errorCode, message }, { status });
}

/**
 * POST /api/activate
 * 请求体: { email: string, activationCode: string, userAgent?: string }
 * 响应体:
 *  - 成功: { ok: true, data: { activationId, activatedAt, email } }
 *  - 失败: { ok: false, errorCode, message }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body?.email ?? "").trim();
    const activationCode = (body?.activationCode ?? "").trim();
    const userAgent = (body?.userAgent ?? "").toString();

    // 校验
    if (!email || !activationCode) {
      return err("VALIDATION_FAILED", "email 和 activationCode 不能为空", 400);
    }

    // 简单邮箱格式校验（避免过度严格）
    const emailLike = email.includes("@") && email.includes(".");
    if (!emailLike) {
      return err("VALIDATION_FAILED", "email 格式不正确", 400);
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "unknown";

    // 事务执行：读取 → 校验状态/过期 → 写回/递增 → 记录激活
    const result = await db.transaction().execute(async (trx) => {
      // 1) 读取激活码（包含有效期字段）
      const codeRow = await trx
        .selectFrom("activation_codes")
        .select([
          "id",
          "code",
          "status", // 期望: 'enabled' | 'disabled' | 'suspended' | 'expired'
          "expires_at",
          "usage_limit",
          "used_count",
          "validity_period",
          "validity_unit",
          "activation_started_at",
        ])
        .where("code", "=", activationCode)
        .executeTakeFirst();

      if (!codeRow) {
        // 未找到
        return err("INVALID_CODE", "无效的激活码", 401);
      }

      // 2) 状态检查（suspended/expired/disabled 一律拒绝）
      const status = String(codeRow.status || "").toLowerCase();
      if (status === "suspended" || status === "expired" || status === "disabled") {
        return err("CODE_STATUS_INVALID", `激活码状态不可用: ${status}`, 403);
      }

      // 3) 使用次数限制检查（优先于过期检查，避免已使用的激活码因为过期时间而无法使用）
      const usageLimit = Number(codeRow.usage_limit ?? 0);
      const usedCount = Number(codeRow.used_count ?? 0);
      if (usageLimit > 0 && usedCount >= usageLimit) {
        // 保护：达到上限也视为不可用
        return err("CODE_USAGE_EXCEEDED", "激活码已达到使用上限", 403);
      }

      // 4) 计算实际到期时间（基于激活开始时间和有效期）
      const now = new Date();
      let calculatedExpiresAt: Date | null = null;
      let isFirstActivation = false;

      // 如果是首次激活（activation_started_at 为 null），设置激活开始时间并计算到期时间
      if (!codeRow.activation_started_at && codeRow.validity_period && codeRow.validity_unit) {
        isFirstActivation = true;
        const period = Number(codeRow.validity_period);
        const unit = codeRow.validity_unit;

        calculatedExpiresAt = new Date(now);
        switch (unit) {
          case "day":
            calculatedExpiresAt.setDate(calculatedExpiresAt.getDate() + period);
            break;
          case "month":
            calculatedExpiresAt.setMonth(calculatedExpiresAt.getMonth() + period);
            break;
          case "year":
            calculatedExpiresAt.setFullYear(calculatedExpiresAt.getFullYear() + period);
            break;
        }
      } else if (codeRow.activation_started_at && codeRow.validity_period && codeRow.validity_unit) {
        // 已激活过，基于激活开始时间计算到期时间
        const startDate = new Date(codeRow.activation_started_at as unknown as string);
        if (!isNaN(startDate.getTime())) {
          const period = Number(codeRow.validity_period);
          const unit = codeRow.validity_unit;
          calculatedExpiresAt = new Date(startDate);
          switch (unit) {
            case "day":
              calculatedExpiresAt.setDate(calculatedExpiresAt.getDate() + period);
              break;
            case "month":
              calculatedExpiresAt.setMonth(calculatedExpiresAt.getMonth() + period);
              break;
            case "year":
              calculatedExpiresAt.setFullYear(calculatedExpiresAt.getFullYear() + period);
              break;
          }
        }
      } else if (codeRow.expires_at) {
        // 兼容旧数据（固定到期时间）
        calculatedExpiresAt = new Date(codeRow.expires_at as unknown as string);
      }

      // 检查是否已过期（基于计算后的到期时间）
      if (calculatedExpiresAt && !isNaN(calculatedExpiresAt.getTime())) {
        if (calculatedExpiresAt.getTime() < now.getTime()) {
          // 已过期：写回 expired 状态并拒绝
          await trx
            .updateTable("activation_codes")
            .set({
              status: "expired",
              updated_at: now,
            })
            .where("id", "=", codeRow.id)
            .execute();
          return err(
            "CODE_EXPIRED",
            "激活码已过期（已写回 expired）",
            409,
          );
        }
      }

      // 5) 递增使用次数，如果是首次激活则记录激活开始时间和计算到期时间
      const newUsedCount = usedCount + 1;
      const updateData: Record<string, any> = {
        used_count: newUsedCount,
        updated_at: now,
      };

      if (isFirstActivation && calculatedExpiresAt) {
        // 首次激活：设置激活开始时间和计算后的到期时间
        updateData.activation_started_at = now;
        updateData.expires_at = calculatedExpiresAt;
      }

      await trx
        .updateTable("activation_codes")
        .set(updateData)
        .where("id", "=", codeRow.id)
        .execute();

      // 6) 记录激活（activations 表）
      let inserted;
      try {
        inserted = await trx
          .insertInto("activations")
          .values({
            email,
            activation_code: activationCode,
            ip_address: ipAddress,
            user_agent: userAgent,
          })
          .returning(["id", "activated_at"])
          .executeTakeFirst();
      } catch (insertError: any) {
        // 捕获数据库约束错误
        const errorMessage = insertError?.message || String(insertError || '');
        console.error('[POST /api/activate] Database insert error:', {
          error: errorMessage,
          email,
          activationCode,
        });
        
        // 检查是否是唯一性约束违反（PostgreSQL 错误代码 23505）
        if (errorMessage.includes('unique') || 
            errorMessage.includes('23505') ||
            errorMessage.includes('duplicate key')) {
          return err(
            "DUPLICATE_ACTIVATION",
            "该激活码已被使用（同一邮箱重复激活或数据库约束限制）",
            409
          );
        }
        
        // 其他数据库错误
        throw new Error("INSERT_ACTIVATION_FAILED");
      }

      if (!inserted?.id) {
        // 理论上不应发生，抛出以触发回滚
        throw new Error("INSERT_ACTIVATION_FAILED");
      }

      // 7) 创建或更新用户记录（users 表）
      // 生成userid：使用act-{activationId}格式，与AI日志系统保持一致
      const userid = `act-${inserted.id}`;
      
      let userRecord;
      try {
        // 先尝试查找现有用户
        const existingUser = await trx
          .selectFrom("users")
          .select(["id", "email", "activation_code_id", "userid"])
          .where("email", "=", email)
          .executeTakeFirst();

        if (existingUser) {
          // 如果用户已存在，更新激活码关联和userid（如果还没有）
          const updateData: Record<string, any> = {
            activation_code_id: codeRow.id,
            status: "active",
            updated_at: now,
          };
          
          // 如果用户还没有userid，则设置
          if (!existingUser.userid) {
            updateData.userid = userid;
          }
          
          userRecord = await trx
            .updateTable("users")
            .set(updateData)
            .where("id", "=", existingUser.id)
            .returning(["id", "email", "status", "userid"])
            .executeTakeFirst();
        } else {
          // 如果用户不存在，创建新用户（包含userid）
          userRecord = await trx
            .insertInto("users")
            .values({
              email,
              userid, // 生成并存储userid
              activation_code_id: codeRow.id,
              status: "active",
              registration_info: {
                activation_code: activationCode,
                activation_id: inserted.id,
                activated_at: inserted.activated_at.toISOString(),
              },
            })
            .returning(["id", "email", "status", "userid"])
            .executeTakeFirst();
        }
      } catch (userError: any) {
        console.error('[POST /api/activate] User insert/update error:', {
          error: userError?.message || String(userError || ''),
          email,
          activationCode,
        });
        // 如果用户表操作失败，记录错误但不中断激活流程（向后兼容）
        // 可以选择抛出错误来中断事务，但为了兼容性，我们继续执行
      }

      // 8) 记录用户行为（user_behaviors 表）- 将激活视为登录行为
      if (userRecord?.id) {
        try {
          // 检测客户端类型
          let clientType: "web" | "mobile" | "api" | "desktop" | "other" | null = null;
          if (userAgent) {
            const ua = userAgent.toLowerCase();
            if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone") || ua.includes("ipad")) {
              clientType = "mobile";
            } else if (ua.includes("electron") || ua.includes("desktop")) {
              clientType = "desktop";
            } else if (ua.includes("api") || ua.includes("curl") || ua.includes("postman")) {
              clientType = "api";
            } else {
              clientType = "web";
            }
          }

          await trx
            .insertInto("user_behaviors")
            .values({
              user_id: userRecord.id,
              behavior_type: "login", // 激活视为登录
              ip_address: ipAddress !== "unknown" ? ipAddress : null,
              user_agent: userAgent || null,
              client_type: clientType,
              metadata: {
                activation_code: activationCode,
                activation_id: inserted.id,
                is_first_activation: isFirstActivation,
              },
            })
            .execute();
        } catch (behaviorError: any) {
          console.error('[POST /api/activate] User behavior insert error:', {
            error: behaviorError?.message || String(behaviorError || ''),
            userId: userRecord.id,
            email,
          });
          // 如果行为记录失败，记录错误但不中断激活流程
        }
      }

      // 重新读取激活码以获取最新的有效期信息
      const updatedCodeRow = await trx
        .selectFrom("activation_codes")
        .select(["expires_at", "validity_period", "validity_unit", "activation_started_at"])
        .where("code", "=", activationCode)
        .executeTakeFirst();

      let expiresAt: string | null = null;
      if (updatedCodeRow?.expires_at) {
        expiresAt = new Date(updatedCodeRow.expires_at as unknown as string).toISOString();
      } else if (calculatedExpiresAt) {
        expiresAt = calculatedExpiresAt.toISOString();
      }

      // 生成用户token（基于activationId和激活码，用于后续请求标识用户）
      // 使用简单的哈希函数生成稳定的token（不加密，仅用于标识）
      const tokenData = `${inserted.id}-${activationCode}-${inserted.activated_at.toISOString()}`;
      let tokenHash = 0;
      for (let i = 0; i < tokenData.length; i++) {
        const char = tokenData.charCodeAt(i);
        tokenHash = ((tokenHash << 5) - tokenHash) + char;
        tokenHash = tokenHash & tokenHash;
      }
      const userToken = `act-${Math.abs(tokenHash).toString(16).padStart(8, "0")}-${inserted.id.toString(16).padStart(8, "0")}`;

      // 创建响应，同时设置HTTP cookie（确保移动端也能获取token）
      const response = NextResponse.json(
        {
          ok: true,
          data: {
            activationId: inserted.id,
            activatedAt: inserted.activated_at.toISOString(),
            email,
            expiresAt,
            userToken, // 返回用户token，前端存储用于后续请求
          },
        },
        { status: 200 }
      );

      // 设置HTTP cookie（30天有效期，兼容移动端）
      const cookieExpires = new Date();
      cookieExpires.setTime(cookieExpires.getTime() + 30 * 24 * 60 * 60 * 1000);
      response.cookies.set("USER_TOKEN", userToken, {
        expires: cookieExpires,
        path: "/",
        sameSite: "lax",
        httpOnly: false, // 设置为false，允许前端JavaScript读取（兼容移动端）
        secure: process.env.NODE_ENV === "production", // 生产环境使用HTTPS时启用secure
      });

      return response;
    });

    // 事务返回的已经是 NextResponse（ok/err），直接 return
    return result;
  } catch (e: unknown) {
    // 兜底错误
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : "UNKNOWN";
    
    console.error('[POST /api/activate] Unhandled error:', {
      error: message,
      stack: e instanceof Error ? e.stack : undefined,
    });
    
    // 特判插入失败
    if (message === "INSERT_ACTIVATION_FAILED") {
      return err("INTERNAL_ERROR", "无法记录激活信息，请稍后重试", 500);
    }
    
    // 检查是否是数据库约束错误
    if (message.includes('unique') || 
        message.includes('23505') ||
        message.includes('duplicate key')) {
      return err(
        "DUPLICATE_ACTIVATION",
        "该激活码已被使用",
        409
      );
    }
    
    return err("INTERNAL_ERROR", `服务器内部错误: ${message}`, 500);
  }
}
