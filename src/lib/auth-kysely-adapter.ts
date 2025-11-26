// ============================================================
// 文件路径: src/lib/auth-kysely-adapter.ts
// 功能: NextAuth KyselyAdapter 适配层，修复 Account 视图字段名不匹配问题
// 更新日期: 2025-11-26
// 更新内容: 新增适配层，重写 linkAccount 方法，直接写入 oauth_accounts 底层表
// ============================================================

import type { Kysely } from 'kysely';
import type { Adapter, AdapterAccount } from '@auth/core/adapters';
import { KyselyAdapter as OriginalKyselyAdapter, type Database as NextAuthDatabase } from '@auth/kysely-adapter';
import type { Database } from './db';

/**
 * 创建修复后的 KyselyAdapter
 * 
 * 问题背景：
 * - KyselyAdapter 的 linkAccount 方法尝试写入 "Account" 视图
 * - 传入的 AdapterAccount 对象使用下划线命名（access_token）
 * - 但 "Account" 视图使用驼峰命名（accessToken）
 * - 导致 PostgreSQL 报错：column "access_token" of relation "Account" does not exist
 * 
 * 解决方案：
 * - 重写 linkAccount 方法，绕过 "Account" 视图
 * - 直接写入 oauth_accounts 底层表（使用下划线命名）
 * - 其他方法（getUserByAccount 等）继续使用原始 KyselyAdapter 的逻辑
 * 
 * @param db - Kysely Database 实例
 * @returns 修复后的 Adapter 实例
 */
export function createPatchedKyselyAdapter(db: Kysely<Database>): Adapter {
  // 使用类型断言将完整的 Database 转换为只包含 NextAuth 表的类型
  // 这样可以满足 @auth/kysely-adapter 的类型要求，同时保持对完整数据库的访问
  const base = OriginalKyselyAdapter(db as unknown as Kysely<NextAuthDatabase>) as Adapter;

  return {
    ...base,

    // 只重写 linkAccount，绕过 "Account" 视图写入问题，直接写 oauth_accounts 底层表
    async linkAccount(account: AdapterAccount) {
      // 1. 从 AdapterAccount 中抽取需要的字段
      const {
        provider,
        providerAccountId,
        userId,
        access_token,
        refresh_token,
        id_token,
        token_type,
        scope,
        expires_at,
        // 某些 provider 可能会带上 session_state
        // @ts-expect-error: session_state 不在 AdapterAccount 类型里，但在实际返回中存在
        session_state,
      } = account as any;

      if (!userId) {
        throw new Error('[auth] linkAccount: missing userId');
      }

      const now = new Date();

      // 2. 直接写入底层表 oauth_accounts（字段全部用下划线命名）
      await db
        .insertInto('oauth_accounts')
        .values({
          user_id: userId,
          provider,
          provider_account_id: providerAccountId,
          access_token: access_token ?? null,
          refresh_token: refresh_token ?? null,
          id_token: id_token ?? null,
          token_type: token_type ?? null,
          scope: scope ?? null,
          session_state: session_state ?? null,
          expires_at: expires_at ? new Date(expires_at * 1000) : null,
          created_at: now,
          updated_at: now,
        })
        .executeTakeFirstOrThrow();

      // 3. 按 NextAuth 约定返回原始 AdapterAccount
      return account;
    },
  };
}

