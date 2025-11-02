/**
 * ✅ Dynamic Route Declaration
 * 防止 Next.js 静态预渲染报错 (DYNAMIC_SERVER_USAGE)
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Pool } from "pg";

/**
 * GET /api/admin/diagnose
 * 数据库连接诊断端点
 * 用于排查数据库连接和表结构问题
 */
export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      nodeEnv: process.env.NODE_ENV,
    },
    connection: {
      status: "unknown",
      error: null,
      details: null,
    },
    tables: {
      status: "unknown",
      found: [] as string[],
      missing: [] as string[],
    },
  };

  // 检查环境变量
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    diagnostics.connection.status = "error";
    diagnostics.connection.error = "DATABASE_URL 或 POSTGRES_URL 环境变量未设置";
    return NextResponse.json(
      { ok: false, errorCode: "ENV_NOT_SET", message: "环境变量未配置", diagnostics },
      { status: 500 }
    );
  }

  // 测试连接字符串格式
  try {
    const url = new URL(connectionString);
    diagnostics.connection.details = {
      protocol: url.protocol,
      host: url.hostname,
      port: url.port || "5432 (default)",
      database: url.pathname.split("/")[1] || "unknown",
      isSupabase: connectionString.includes("supabase.com"),
      hasSSL: connectionString.includes("sslmode=require"),
    };
  } catch (error) {
    diagnostics.connection.status = "error";
    diagnostics.connection.error = `连接字符串格式错误: ${error instanceof Error ? error.message : String(error)}`;
    return NextResponse.json(
      { ok: false, errorCode: "INVALID_CONNECTION_STRING", message: "连接字符串格式错误", diagnostics },
      { status: 500 }
    );
  }

  // 测试数据库连接
  const isSupabase = connectionString.includes("supabase.com") || connectionString.includes("sslmode=require");
  const pool = new Pool({
    connectionString,
    ssl: isSupabase
      ? {
          rejectUnauthorized: false,
        }
      : false,
  });

  try {
    const client = await pool.connect();
    
    try {
      // 测试基本查询
      const result = await client.query("SELECT NOW() as current_time, version() as pg_version");
      diagnostics.connection.status = "success";
      diagnostics.connection.details.current_time = result.rows[0].current_time;
      diagnostics.connection.details.pg_version = result.rows[0].pg_version.substring(0, 50);

      // 检查表是否存在
      const requiredTables = [
        "activations",
        "activation_codes",
        "admins",
        "operation_logs",
      ];

      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ($1, $2, $3, $4)
        ORDER BY table_name
      `, requiredTables);

      const existingTables = tablesResult.rows.map((row) => row.table_name);
      diagnostics.tables.found = existingTables;
      diagnostics.tables.missing = requiredTables.filter(
        (table) => !existingTables.includes(table)
      );

      if (diagnostics.tables.missing.length > 0) {
        diagnostics.tables.status = "incomplete";
      } else {
        diagnostics.tables.status = "complete";
      }

      // 如果表不完整，提供修复建议
      let message = "数据库连接正常";
      if (diagnostics.tables.missing.length > 0) {
        message = `数据库连接正常，但缺少表: ${diagnostics.tables.missing.join(", ")}`;
      }

      return NextResponse.json(
        {
          ok: true,
          message,
          diagnostics,
          recommendations:
            diagnostics.tables.missing.length > 0
              ? [
                  "运行数据库初始化脚本: npm run db:init 或 tsx scripts/init-cloud-database.ts",
                  "检查 scripts/init-cloud-database.sql 文件是否完整",
                ]
              : [],
        },
        { status: 200 }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    diagnostics.connection.status = "error";
    diagnostics.connection.error =
      error instanceof Error ? error.message : String(error);
    
    let errorCode = "DATABASE_CONNECTION_ERROR";
    let message = "数据库连接失败";

    if (error instanceof Error) {
      if (error.message.includes("password") || error.message.includes("authentication")) {
        errorCode = "DATABASE_AUTH_ERROR";
        message = "数据库认证失败，请检查密码";
      } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
        errorCode = "DATABASE_HOST_ERROR";
        message = "无法解析数据库主机地址";
      } else if (error.message.includes("ECONNREFUSED")) {
        errorCode = "DATABASE_CONNECTION_REFUSED";
        message = "数据库连接被拒绝，请检查主机地址和端口";
      } else if (error.message.includes("SSL") || error.message.includes("ssl")) {
        errorCode = "DATABASE_SSL_ERROR";
        message = "数据库 SSL 连接错误";
      }
    }

    return NextResponse.json(
      { ok: false, errorCode, message, diagnostics },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

