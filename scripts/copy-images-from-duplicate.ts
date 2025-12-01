#!/usr/bin/env tsx
// ============================================================
// 脚本：从 questions_duplicate 表复制 image 字段到 questions 表
// 功能：根据 content_hash 关联，将 questions_duplicate 表的 image 字段复制到 questions 表
// 使用方法: tsx scripts/copy-images-from-duplicate.ts
// ============================================================

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

// 处理 SSL 证书问题（仅用于开发环境）
const isDevelopment = process.env.NODE_ENV === 'development';
const isVercel = !!process.env.VERCEL;
const hasTlsReject = !!process.env.NODE_TLS_REJECT_UNAUTHORIZED;

if ((isDevelopment || !isVercel) && !hasTlsReject) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log("[copyImagesFromDuplicate] 已设置 NODE_TLS_REJECT_UNAUTHORIZED=0 以处理 SSL 证书问题（仅开发环境）");
}

import { db } from "../src/lib/db";

/**
 * 主函数：从 questions_duplicate 表复制 image 字段到 questions 表
 */
async function copyImagesFromDuplicate() {
  try {
    console.log("开始复制 image 字段...");

    // 1. 查询 questions_duplicate 表中所有有 image 的记录
    const duplicateQuestions = await db
      .selectFrom("questions_duplicate")
      .select(["id", "content_hash", "image"])
      .where("image", "is not", null)
      .where("image", "!=", "")
      .execute();

    console.log(`找到 ${duplicateQuestions.length} 条有 image 的记录`);

    if (duplicateQuestions.length === 0) {
      console.log("没有需要复制的记录");
      return;
    }

    // 2. 批量更新 questions 表（使用 content_hash 关联）
    let successCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    const errors: Array<{ content_hash: string; error: string }> = [];

    for (let i = 0; i < duplicateQuestions.length; i++) {
      const duplicate = duplicateQuestions[i];
      try {
        // 检查 questions 表中是否存在对应的 content_hash
        const existing = await db
          .selectFrom("questions")
          .select(["id", "content_hash"])
          .where("content_hash", "=", duplicate.content_hash)
          .executeTakeFirst();

        if (!existing) {
          notFoundCount++;
          if (notFoundCount <= 10) {
            console.warn(`警告: questions 表中不存在 content_hash=${duplicate.content_hash} 的记录`);
          }
          continue;
        }

        // 更新 questions 表的 image 字段（使用 content_hash 匹配）
        await db
          .updateTable("questions")
          .set({
            image: duplicate.image,
            updated_at: new Date(),
          })
          .where("content_hash", "=", duplicate.content_hash)
          .execute();

        successCount++;

        if ((i + 1) % 100 === 0) {
          console.log(`已处理 ${i + 1}/${duplicateQuestions.length} 条记录...`);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ content_hash: duplicate.content_hash, error: errorMsg });
        console.error(`更新 content_hash=${duplicate.content_hash} 失败:`, errorMsg);
      }
    }

    // 3. 输出结果
    console.log("\n复制完成！");
    console.log(`成功: ${successCount} 条记录`);
    console.log(`未找到对应记录: ${notFoundCount} 条记录`);
    console.log(`失败: ${errorCount} 条记录`);

    if (errors.length > 0) {
      console.log("\n错误详情:");
      errors.slice(0, 10).forEach(({ content_hash, error }) => {
        console.log(`  content_hash=${content_hash}: ${error}`);
      });
      if (errors.length > 10) {
        console.log(`  ... 还有 ${errors.length - 10} 个错误`);
      }
    }

  } catch (error) {
    console.error("复制过程中发生错误:", error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await db.destroy();
  }
}

// 执行脚本
copyImagesFromDuplicate();

