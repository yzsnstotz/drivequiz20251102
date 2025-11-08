#!/usr/bin/env tsx

/**
 * 查询 Datapull 上传的文档分片
 * 
 * 使用方法：
 *   tsx scripts/query-documents.ts                    # 查看所有文档
 *   tsx scripts/query-documents.ts --sourceId=xxx     # 按来源ID过滤
 *   tsx scripts/query-documents.ts --operationId=xxx # 查看特定操作
 *   tsx scripts/query-documents.ts --limit=10         # 限制数量
 */

import dotenv from "dotenv";
import { getDb } from "../src/lib/db.js";

// 加载环境变量
dotenv.config();

interface QueryOptions {
  sourceId?: string;
  operationId?: string;
  limit?: number;
  showContent?: boolean;
}

async function queryDocuments(options: QueryOptions = {}) {
  const db = getDb();
  const limit = options.limit || 20;

  console.log("\n🔍 查询 Datapull 上传的文档分片...\n");

  // 如果指定了 operationId，查询操作详情
  if (options.operationId) {
    console.log(`📋 查询操作: ${options.operationId}\n`);

    const operation = await db
      .selectFrom("rag_operations")
      .selectAll()
      .where("operation_id", "=", options.operationId)
      .executeTakeFirst();

    if (!operation) {
      console.log("❌ 操作不存在");
      return;
    }

    console.log("操作信息：");
    console.log(`  - 操作ID: ${operation.operation_id}`);
    console.log(`  - 来源ID: ${operation.source_id}`);
    console.log(`  - 状态: ${operation.status}`);
    console.log(`  - 文档数: ${operation.docs_count}`);
    console.log(`  - 失败数: ${operation.failed_count}`);
    console.log(`  - 创建时间: ${operation.created_at.toISOString()}`);
    console.log(`  - 完成时间: ${operation.completed_at?.toISOString() || "未完成"}`);
    console.log(`  - 元数据:`, JSON.stringify(operation.metadata, null, 2));
    console.log("");

    // 查询操作关联的文档
    const documents = await db
      .selectFrom("rag_operation_documents")
      .leftJoin("rag_documents", "rag_operation_documents.doc_id", "rag_documents.doc_id")
      .select([
        "rag_operation_documents.doc_id",
        "rag_documents.title",
        "rag_documents.url",
        "rag_documents.content",
        "rag_documents.content_hash",
        "rag_documents.version",
        "rag_documents.lang",
        "rag_documents.source_id",
        "rag_documents.vectorization_status",
        "rag_operation_documents.status as upload_status",
        "rag_operation_documents.error_code",
        "rag_operation_documents.error_message",
      ])
      .where("rag_operation_documents.operation_id", "=", options.operationId)
      .limit(limit)
      .execute();

    console.log(`📄 文档列表 (${documents.length} 条):\n`);

    documents.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.title || "无标题"}`);
      console.log(`   - 文档ID: ${doc.doc_id || "N/A"}`);
      console.log(`   - URL: ${doc.url || "N/A"}`);
      console.log(`   - 版本: ${doc.version || "N/A"}`);
      console.log(`   - 语言: ${doc.lang || "N/A"}`);
      console.log(`   - 来源: ${doc.source_id || "N/A"}`);
      console.log(`   - 上传状态: ${doc.upload_status}`);
      console.log(`   - 向量化状态: ${doc.vectorization_status || "N/A"}`);
      console.log(`   - 内容哈希: ${doc.content_hash || "N/A"}`);
      if (doc.error_code) {
        console.log(`   - 错误: ${doc.error_code} - ${doc.error_message}`);
      }
      if (options.showContent && doc.content) {
        const preview = doc.content.substring(0, 200);
        console.log(`   - 内容预览: ${preview}${doc.content.length > 200 ? "..." : ""}`);
      }
      console.log("");
    });

    return;
  }

  // 查询文档列表
  let query = db.selectFrom("rag_documents").selectAll();

  if (options.sourceId) {
    query = query.where("source_id", "=", options.sourceId);
    console.log(`📋 按来源ID过滤: ${options.sourceId}\n`);
  }

  const documents = await query
    .orderBy("created_at", "desc")
    .limit(limit)
    .execute();

  console.log(`📄 找到 ${documents.length} 条文档:\n`);

  documents.forEach((doc, index) => {
    console.log(`${index + 1}. ${doc.title}`);
    console.log(`   - 文档ID: ${doc.doc_id}`);
    console.log(`   - URL: ${doc.url}`);
    console.log(`   - 版本: ${doc.version}`);
    console.log(`   - 语言: ${doc.lang}`);
    console.log(`   - 来源: ${doc.source_id}`);
    console.log(`   - 类型: ${doc.doc_type || "N/A"}`);
    console.log(`   - 向量化状态: ${doc.vectorization_status}`);
    console.log(`   - 内容哈希: ${doc.content_hash}`);
    console.log(`   - 创建时间: ${doc.created_at.toISOString()}`);
    if (options.showContent) {
      const preview = doc.content.substring(0, 200);
      console.log(`   - 内容预览: ${preview}${doc.content.length > 200 ? "..." : ""}`);
    }
    console.log("");
  });

  // 显示统计信息
  const stats = await db
    .selectFrom("rag_documents")
    .select((eb) => [
      eb.fn.countAll().as("total"),
      eb.fn.count("source_id").distinct().as("sources"),
    ])
    .$if(!!options.sourceId, (qb) =>
      qb.where("source_id", "=", options.sourceId!)
    )
    .executeTakeFirst();

  console.log("📊 统计信息:");
  console.log(`   - 总文档数: ${stats?.total || 0}`);
  console.log(`   - 来源数: ${stats?.sources || 0}`);
  console.log("");
}

// 查询操作记录
async function queryOperations(sourceId?: string) {
  const db = getDb();

  console.log("\n📋 查询操作记录...\n");

  let query = db.selectFrom("rag_operations").selectAll();

  if (sourceId) {
    query = query.where("source_id", "=", sourceId);
    console.log(`按来源ID过滤: ${sourceId}\n`);
  }

  const operations = await query
    .orderBy("created_at", "desc")
    .limit(10)
    .execute();

  console.log(`找到 ${operations.length} 条操作记录:\n`);

  operations.forEach((op, index) => {
    console.log(`${index + 1}. 操作ID: ${op.operation_id}`);
    console.log(`   - 来源ID: ${op.source_id}`);
    console.log(`   - 状态: ${op.status}`);
    console.log(`   - 文档数: ${op.docs_count}`);
    console.log(`   - 失败数: ${op.failed_count}`);
    console.log(`   - 创建时间: ${op.created_at.toISOString()}`);
    console.log(`   - 完成时间: ${op.completed_at?.toISOString() || "未完成"}`);
    console.log("");
  });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const options: QueryOptions = {};

  // 解析命令行参数
  args.forEach((arg) => {
    if (arg.startsWith("--sourceId=")) {
      options.sourceId = arg.split("=")[1];
    } else if (arg.startsWith("--operationId=")) {
      options.operationId = arg.split("=")[1];
    } else if (arg.startsWith("--limit=")) {
      options.limit = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--show-content") {
      options.showContent = true;
    }
  });

  try {
    if (options.operationId) {
      await queryDocuments(options);
    } else {
      await queryOperations(options.sourceId);
      await queryDocuments(options);
    }
  } catch (error) {
    console.error("❌ 查询失败:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

