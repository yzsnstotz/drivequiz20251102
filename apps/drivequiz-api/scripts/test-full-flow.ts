#!/usr/bin/env tsx

/**
 * 测试完整的 RAG 文档插入流程
 * 模拟 Datapull 推送的完整流程，包括：
 * 1. 创建操作记录（rag_operations）
 * 2. 插入文档（rag_documents）
 * 3. 记录操作文档映射（rag_operation_documents）
 */

import dotenv from "dotenv";
import { getDb } from "../src/lib/db.js";
import { randomUUID } from "crypto";
import {
  createOperation,
  logOperationDocument,
  updateOperationStatus,
} from "../src/services/operation-logger.js";

dotenv.config();

async function testFullFlow() {
  console.log("\n🧪 测试完整的 RAG 文档插入流程...\n");

  try {
    const db = getDb();
    const docId = `doc_full_${randomUUID()}`;
    const operationId = `op_full_${randomUUID()}`;
    const sourceId = "test_source_full";

    const testDoc = {
      doc_id: docId,
      title: "测试文档 - 完整流程测试",
      url: "https://example.com/test-doc-full",
      content: "这是一个测试文档的内容。用于验证完整的插入流程，包括操作记录、文档插入和操作文档映射。内容长度需要满足要求（100-2000字符）。" + " ".repeat(50),
      content_hash: "test_hash_" + randomUUID().substring(0, 32),
      version: "2025Q1",
      lang: "ja",
      source_id: sourceId,
      doc_type: "test",
      vectorization_status: "pending" as const,
    };

    console.log("📝 准备插入测试文档：");
    console.log(`  - 文档ID: ${docId}`);
    console.log(`  - 操作ID: ${operationId}`);
    console.log(`  - 标题: ${testDoc.title}`);
    console.log(`  - 来源ID: ${sourceId}`);
    console.log("");

    // 步骤 1: 创建操作记录
    console.log("📋 步骤 1: 创建操作记录...");
    await createOperation(operationId, sourceId, 1, {
      version: testDoc.version,
      lang: testDoc.lang,
    });
    console.log("✅ 操作记录创建成功\n");

    // 步骤 2: 插入文档
    console.log("📄 步骤 2: 插入文档到 rag_documents...");
    await db
      .insertInto("rag_documents")
      .values(testDoc)
      .execute();
    console.log("✅ 文档插入成功\n");

    // 步骤 3: 记录操作文档映射
    console.log("🔗 步骤 3: 记录操作文档映射...");
    await logOperationDocument(operationId, docId, "success");
    console.log("✅ 操作文档映射记录成功\n");

    // 步骤 4: 更新操作状态
    console.log("✅ 步骤 4: 更新操作状态...");
    await updateOperationStatus(operationId, "success");
    console.log("✅ 操作状态更新成功\n");

    // 验证结果
    console.log("🔍 验证插入结果...\n");

    // 验证操作记录
    const operation = await db
      .selectFrom("rag_operations")
      .selectAll()
      .where("operation_id", "=", operationId)
      .executeTakeFirst();

    if (operation) {
      console.log("✅ 操作记录验证成功：");
      console.log(`  - 操作ID: ${operation.operation_id}`);
      console.log(`  - 来源ID: ${operation.source_id}`);
      console.log(`  - 状态: ${operation.status}`);
      console.log(`  - 文档数: ${operation.docs_count}`);
      console.log(`  - 失败数: ${operation.failed_count}`);
      console.log(`  - 创建时间: ${operation.created_at.toISOString()}`);
      console.log(`  - 完成时间: ${operation.completed_at?.toISOString() || "未完成"}`);
      console.log("");
    } else {
      console.log("❌ 操作记录验证失败：未找到操作记录\n");
    }

    // 验证文档
    const document = await db
      .selectFrom("rag_documents")
      .selectAll()
      .where("doc_id", "=", docId)
      .executeTakeFirst();

    if (document) {
      console.log("✅ 文档验证成功：");
      console.log(`  - 文档ID: ${document.doc_id}`);
      console.log(`  - 标题: ${document.title}`);
      console.log(`  - URL: ${document.url}`);
      console.log(`  - 来源ID: ${document.source_id}`);
      console.log(`  - 版本: ${document.version}`);
      console.log(`  - 语言: ${document.lang}`);
      console.log(`  - 向量化状态: ${document.vectorization_status}`);
      console.log(`  - 创建时间: ${document.created_at.toISOString()}`);
      console.log("");
    } else {
      console.log("❌ 文档验证失败：未找到文档\n");
    }

    // 验证操作文档映射
    const operationDoc = await db
      .selectFrom("rag_operation_documents")
      .selectAll()
      .where("operation_id", "=", operationId)
      .where("doc_id", "=", docId)
      .executeTakeFirst();

    if (operationDoc) {
      console.log("✅ 操作文档映射验证成功：");
      console.log(`  - 操作ID: ${operationDoc.operation_id}`);
      console.log(`  - 文档ID: ${operationDoc.doc_id}`);
      console.log(`  - 状态: ${operationDoc.status}`);
      console.log(`  - 创建时间: ${operationDoc.created_at.toISOString()}`);
      console.log("");
    } else {
      console.log("❌ 操作文档映射验证失败：未找到映射记录\n");
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

    const operationStats = await db
      .selectFrom("rag_operations")
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst();

    const mappingStats = await db
      .selectFrom("rag_operation_documents")
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst();

    console.log(`  - 总文档数: ${stats?.total || 0}`);
    console.log(`  - 来源数: ${stats?.sources || 0}`);
    console.log(`  - 总操作数: ${operationStats?.total || 0}`);
    console.log(`  - 总映射数: ${mappingStats?.total || 0}`);
    console.log("");

    console.log("🎉 完整流程测试完成！所有数据已保留在数据库中\n");
    console.log("💡 提示：可以使用以下 SQL 查询验证：");
    console.log(`   SELECT * FROM rag_operations WHERE operation_id = '${operationId}';`);
    console.log(`   SELECT * FROM rag_documents WHERE doc_id = '${docId}';`);
    console.log(`   SELECT * FROM rag_operation_documents WHERE operation_id = '${operationId}';`);
    console.log("");
  } catch (error) {
    console.error("❌ 测试失败：", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error("\n堆栈跟踪：");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testFullFlow();

