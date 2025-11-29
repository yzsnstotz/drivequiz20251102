#!/usr/bin/env tsx
/**
 * 列出多语言内容不全的题目
 * 
 * 功能：
 * 1. 查询 content 字段中 zh、en、ja 内容不全的（包括为空或 null）
 * 2. 查询 explanation 字段中 zh、en、ja 内容不全的（包括为空或 null）
 * 
 * 使用方法：
 * tsx scripts/list-incomplete-multilang-questions.ts
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

import { db } from "../src/lib/db";
import { sql } from "kysely";
import fs from "fs/promises";
import path from "path";

interface IncompleteQuestion {
  id: number;
  content_hash: string;
  content_zh: string | null;
  content_en: string | null;
  content_ja: string | null;
  explanation_zh: string | null;
  explanation_en: string | null;
  explanation_ja: string | null;
  content_missing_langs: string[];
  explanation_missing_langs: string[];
}

/**
 * 检查 JSONB 字段中指定语言是否存在且不为空
 */
function checkLanguageComplete(
  jsonbField: any,
  languages: string[] = ["zh", "en", "ja"]
): { isComplete: boolean; missingLanguages: string[] } {
  const missing: string[] = [];

  // 如果字段为 null 或 undefined，所有语言都缺失
  if (jsonbField === null || jsonbField === undefined) {
    return { isComplete: false, missingLanguages: languages };
  }

  // 如果字段是字符串（向后兼容格式），只有 zh 有内容，其他语言缺失
  if (typeof jsonbField === "string") {
    const zhValue = jsonbField.trim();
    if (zhValue.length === 0) {
      // 如果字符串为空，所有语言都缺失
      return { isComplete: false, missingLanguages: languages };
    } else {
      // 如果字符串不为空，只有 zh 有内容，其他语言缺失
      return { isComplete: false, missingLanguages: languages.filter(lang => lang !== "zh") };
    }
  }

  // 如果字段不是对象，所有语言都缺失
  if (typeof jsonbField !== "object") {
    return { isComplete: false, missingLanguages: languages };
  }

  // 检查每个语言是否存在且不为空
  for (const lang of languages) {
    const value = jsonbField[lang];
    // 检查是否为 null、undefined 或空字符串
    if (value === null || value === undefined || (typeof value === "string" && value.trim().length === 0)) {
      missing.push(lang);
    }
  }

  return {
    isComplete: missing.length === 0,
    missingLanguages: missing,
  };
}

async function main() {
  try {
    console.log("开始查询多语言内容不全的题目...");
    
    // 分批查询，避免超时
    const batchSize = 1000;
    let offset = 0;
    const incompleteQuestions: IncompleteQuestion[] = [];
    
    while (true) {
      console.log(`正在查询第 ${offset + 1} 到 ${offset + batchSize} 条记录...`);
      
      // 分批查询题目
      const batchQuestions = await db
        .selectFrom("questions")
        .select([
          "id",
          "content_hash",
          // 提取 content 的多语言内容
          sql<string | null>`content->>'zh'`.as("content_zh"),
          sql<string | null>`content->>'en'`.as("content_en"),
          sql<string | null>`content->>'ja'`.as("content_ja"),
          // 提取 explanation 的多语言内容
          sql<string | null>`explanation->>'zh'`.as("explanation_zh"),
          sql<string | null>`explanation->>'en'`.as("explanation_en"),
          sql<string | null>`explanation->>'ja'`.as("explanation_ja"),
          // 原始 JSONB 字段（用于检查）
          "content",
          "explanation",
        ])
        .orderBy("id", "asc")
        .limit(batchSize)
        .offset(offset)
        .execute();
      
      if (batchQuestions.length === 0) {
        break; // 没有更多数据了
      }
      
      // 筛选出内容不全的题目
      for (const q of batchQuestions) {
        const contentCheck = checkLanguageComplete(q.content, ["zh", "en", "ja"]);
        const explanationCheck = checkLanguageComplete(q.explanation, ["zh", "en", "ja"]);
        
        // 如果 content 或 explanation 不全，添加到列表
        if (!contentCheck.isComplete || !explanationCheck.isComplete) {
          incompleteQuestions.push({
            id: q.id,
            content_hash: q.content_hash,
            content_zh: q.content_zh || null,
            content_en: q.content_en || null,
            content_ja: q.content_ja || null,
            explanation_zh: q.explanation_zh || null,
            explanation_en: q.explanation_en || null,
            explanation_ja: q.explanation_ja || null,
            content_missing_langs: contentCheck.missingLanguages,
            explanation_missing_langs: explanationCheck.missingLanguages,
          });
        }
      }
      
      if (batchQuestions.length < batchSize) {
        break; // 这是最后一批
      }
      
      offset += batchSize;
    }


    if (incompleteQuestions.length === 0) {
      // 如果没有不全的题目，不输出任何内容
      return;
    }

    // 按 ID 排序
    incompleteQuestions.sort((a, b) => a.id - b.id);

    // 构建 content_hash 列表
    const contentHashList = incompleteQuestions.map(q => q.content_hash).join('\n');

    // 写入文件
    const outputPath = path.join(process.cwd(), "指令模版", "待运行题目.md");
    await fs.writeFile(outputPath, contentHashList, 'utf-8');

    console.log(`已成功将 ${incompleteQuestions.length} 个 content_hash 写入文件: ${outputPath}`);
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

