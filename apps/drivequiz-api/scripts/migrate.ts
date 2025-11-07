import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 获取数据库连接字符串
 */
function getConnectionString(): string {
  const connectionString =
    process.env.DRIVEQUIZ_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Please set DRIVEQUIZ_DB_URL, DATABASE_URL, or POSTGRES_URL"
    );
  }

  return connectionString;
}

/**
 * 执行 SQL 迁移文件
 */
async function runMigration(sqlFile: string): Promise<void> {
  const connectionString = getConnectionString();
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("supabase.com")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    const sql = readFileSync(sqlFile, "utf-8");
    await pool.query(sql);
    console.log(`✅ Migration completed: ${sqlFile}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${sqlFile}`, error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * 主函数
 */
async function main() {
  const migrationsDir = join(__dirname, "..", "migrations");
  const migrations = [
    "20251107_rag_documents.sql",
    "20251107_rag_operations.sql",
    "20251107_rag_operation_documents.sql",
  ];

  console.log("🚀 Starting database migrations...\n");

  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration);
    await runMigration(migrationPath);
  }

  console.log("\n✅ All migrations completed successfully!");
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});

