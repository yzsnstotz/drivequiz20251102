#!/usr/bin/env tsx

/**
 * 测试 RAG 文档插入
 * 模拟插入一条文档到 rag_documents 表，验证数据库连接
 * 
 * 使用方法：
 *   npx tsx scripts/test-insert.ts
 */

import dotenv from "dotenv";
import { getDb } from "../src/lib/db.js";
import { randomUUID } from "crypto";

// 加载环境变量
dotenv.config();

async function testInsert() {
  console.log("\n🧪 测试 RAG 文档插入...\n");

  try {
    const db = getDb();
    const docId = `doc_test_${randomUUID()}`;
    const testDoc = {
      doc_id: docId,
      title: "测试文档 - RAG 插入测试",
      url: "https://example.com/test-doc",
      content: "这是一个测试文档的内容。用于验证数据库连接和插入功能是否正常工作。内容长度需要满足要求（100-2000字符）。" + " ".repeat(50),
      content_hash: "test_hash_" + randomUUID().substring(0, 32),
      version: "2025Q1",
      lang: "ja",
      source_id: "test_source",
      doc_type: "test",
      vectorization_status: "pending" as const,
    };

    console.log("📝 准备插入测试文档：");
    console.log(`  - 文档ID: ${docId}`);
    console.log(`  - 标题: ${testDoc.title}`);
    console.log(`  - URL: ${testDoc.url}`);
    console.log(`  - 来源ID: ${testDoc.source_id}`);
    console.log(`  - 版本: ${testDoc.version}`);
    console.log(`  - 语言: ${testDoc.lang}`);
    console.log("");

    // 插入文档
    console.log("⏳ 正在插入文档...");
    await db
      .insertInto("rag_documents")
      .values(testDoc)
      .execute();

    console.log("✅ 文档插入成功！\n");

    // 验证插入
    console.log("🔍 验证插入结果...");
    const inserted = await db
      .selectFrom("rag_documents")
      .selectAll()
      .where("doc_id", "=", docId)
      .executeTakeFirst();

    if (inserted) {
      console.log("✅ 验证成功！文档已成功存储：");
      console.log(`  - 文档ID: ${inserted.doc_id}`);
      console.log(`  - 标题: ${inserted.title}`);
      console.log(`  - URL: ${inserted.url}`);
      console.log(`  - 内容长度: ${inserted.content.length} 字符`);
      console.log(`  - 来源ID: ${inserted.source_id}`);
      console.log(`  - 版本: ${inserted.version}`);
      console.log(`  - 语言: ${inserted.lang}`);
      console.log(`  - 向量化状态: ${inserted.vectorization_status}`);
      console.log(`  - 创建时间: ${inserted.created_at.toISOString()}`);
      console.log("");

      // 清理测试数据
      console.log("🧹 清理测试数据...");
      await db
        .deleteFrom("rag_documents")
        .where("doc_id", "=", docId)
        .execute();
      console.log("✅ 测试数据已清理\n");

      console.log("🎉 测试完成！数据库连接正常，插入功能正常。\n");
    } else {
      console.log("❌ 验证失败：文档未找到\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ 测试失败：", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error("\n堆栈跟踪：");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
testInsert();

