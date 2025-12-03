#!/usr/bin/env tsx
/**
 * 列出 license_type_tag 字段为 NULL 的题目
 * 
 * 功能：
 * 1. 查询 questions 表中 license_type_tag 字段为 NULL 的题目
 * 2. 提取这些题目的 content_hash
 * 3. 写入 docs/🔧指令模版/待运行题目.md 文件（每行一个 content_hash）
 * 
 * 使用方法：
 * tsx docs/🔧指令模版/list-questions-without-license-type-tag.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

// 处理 SSL 证书问题（仅用于脚本环境）
if (process.env.DATABASE_URL?.includes('supabase.com') || process.env.POSTGRES_URL?.includes('supabase.com')) {
  // 对于 Supabase 连接，禁用 SSL 证书验证（仅用于脚本环境）
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { db } from "../../src/lib/db";
import fs from "fs/promises";
import path from "path";

interface QuestionWithoutLicenseTypeTag {
  id: number;
  content_hash: string;
}

async function main() {
  try {
    console.log("开始查询 license_type_tag 为 NULL 的题目...");
    
    // 分批查询，避免超时
    const batchSize = 1000;
    let offset = 0;
    const questionsWithoutLicenseTypeTag: QuestionWithoutLicenseTypeTag[] = [];
    
    while (true) {
      console.log(`正在查询第 ${offset + 1} 到 ${offset + batchSize} 条记录...`);
      
      // 分批查询题目，筛选 license_type_tag 为 NULL 的记录
      const batchQuestions = await db
        .selectFrom("questions")
        .select([
          "id",
          "content_hash",
          "license_type_tag",
        ])
        .where("license_type_tag", "is", null) // 筛选 license_type_tag 为 NULL 的题目
        .orderBy("id", "asc")
        .limit(batchSize)
        .offset(offset)
        .execute();
      
      if (batchQuestions.length === 0) {
        break; // 没有更多数据了
      }
      
      // 添加到列表
      for (const q of batchQuestions) {
        questionsWithoutLicenseTypeTag.push({
          id: q.id,
          content_hash: q.content_hash,
        });
      }
      
      console.log(`已找到 ${questionsWithoutLicenseTypeTag.length} 个 license_type_tag 为 NULL 的题目`);
      
      if (batchQuestions.length < batchSize) {
        break; // 这是最后一批
      }
      
      offset += batchSize;
    }

    if (questionsWithoutLicenseTypeTag.length === 0) {
      console.log("没有找到 license_type_tag 为 NULL 的题目");
      return;
    }

    // 按 ID 排序
    questionsWithoutLicenseTypeTag.sort((a, b) => a.id - b.id);

    // 构建 content_hash 列表（每行一个）
    const contentHashList = questionsWithoutLicenseTypeTag.map(q => q.content_hash).join('\n') + '\n';

    // 写入文件
    const outputPath = path.join(process.cwd(), "docs", "🔧指令模版", "待运行题目.md");
    
    // 确保目录存在
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    // 写入文件
    await fs.writeFile(outputPath, contentHashList, 'utf-8');

    console.log(`✅ 已成功将 ${questionsWithoutLicenseTypeTag.length} 个 content_hash 写入文件: ${outputPath}`);
    console.log(`   文件路径: ${outputPath}`);
  } catch (error) {
    console.error("查询失败:", error);
    if (error instanceof Error) {
      console.error("错误信息:", error.message);
      console.error("错误堆栈:", error.stack);
    }
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await db.destroy();
  }
}

// 执行主函数
main().catch((error) => {
  console.error("脚本执行失败:", error);
  process.exit(1);
});

