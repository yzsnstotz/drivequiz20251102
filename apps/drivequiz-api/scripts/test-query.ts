#!/usr/bin/env tsx

/**
 * 测试查询 rag_documents 表
 * 验证数据是否真的存在
 */

import dotenv from "dotenv";
import { getDb } from "../src/lib/db.js";

dotenv.config();

async function testQuery() {
  console.log("\n🔍 测试查询 rag_documents 表...\n");

  try {
    const db = getDb();

    // 查询所有文档
    console.log("📋 查询所有文档...");
    const allDocs = await db
      .selectFrom("rag_documents")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(10)
      .execute();

    console.log(`✅ 找到 ${allDocs.length} 条文档\n`);

    if (allDocs.length === 0) {
      console.log("⚠️  表中没有数据\n");
    } else {
      allDocs.forEach((doc, index) => {
        console.log(`${index + 1}. ${doc.title}`);
        console.log(`   - 文档ID: ${doc.doc_id}`);
        console.log(`   - URL: ${doc.url}`);
        console.log(`   - 来源ID: ${doc.source_id}`);
        console.log(`   - 版本: ${doc.version}`);
        console.log(`   - 语言: ${doc.lang}`);
        console.log(`   - 向量化状态: ${doc.vectorization_status}`);
        console.log(`   - 创建时间: ${doc.created_at.toISOString()}`);
        console.log("");
      });
    }

    // 统计信息
    console.log("📊 统计信息：");
    const stats = await db
      .selectFrom("rag_documents")
      .select((eb) => [
        eb.fn.countAll().as("total"),
        eb.fn.count("source_id").distinct().as("sources"),
      ])
      .executeTakeFirst();

    console.log(`   - 总文档数: ${stats?.total || 0}`);
    console.log(`   - 来源数: ${stats?.sources || 0}`);
    console.log("");

    // 查询操作记录
    console.log("📋 查询操作记录...");
    const operations = await db
      .selectFrom("rag_operations")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(5)
      .execute();

    console.log(`✅ 找到 ${operations.length} 条操作记录\n`);

    if (operations.length === 0) {
      console.log("⚠️  没有操作记录\n");
    } else {
      operations.forEach((op, index) => {
        console.log(`${index + 1}. 操作ID: ${op.operation_id}`);
        console.log(`   - 来源ID: ${op.source_id}`);
        console.log(`   - 状态: ${op.status}`);
        console.log(`   - 文档数: ${op.docs_count}`);
        console.log(`   - 失败数: ${op.failed_count}`);
        console.log(`   - 创建时间: ${op.created_at.toISOString()}`);
        console.log("");
      });
    }
  } catch (error) {
    console.error("❌ 查询失败：", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error("\n堆栈跟踪：");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testQuery();

