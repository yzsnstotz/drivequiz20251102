#!/usr/bin/env tsx
// ============================================================
// 脚本：从历史JSON文件中恢复正确答案到数据库
// 功能：读取JSON文件中的正确答案，根据题目hash匹配并更新数据库
// 使用方法: tsx scripts/restore-correct-answers.ts
// ============================================================

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

import { db } from "../src/lib/db";
import { calculateQuestionHash, Question } from "../src/lib/questionHash";
import fs from "fs/promises";
import path from "path";

// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// 获取所有JSON文件
async function getAllJsonFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(QUESTIONS_DIR);
    return files
      .filter((f) => f.endsWith(".json") && f !== "questions.json")
      .map((f) => path.join(QUESTIONS_DIR, f));
  } catch (error) {
    console.error("[getAllJsonFiles] Error:", error);
    return [];
  }
}

// 从JSON文件读取题目
async function loadQuestionsFromFile(filePath: string): Promise<Question[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    
    // 兼容多种格式
    if (Array.isArray(data)) {
      return data;
    }
    
    return data.questions || [];
  } catch (error) {
    console.error(`[loadQuestionsFromFile] Error loading ${filePath}:`, error);
    return [];
  }
}

// 恢复正确答案
async function restoreCorrectAnswers() {
  console.log("开始恢复正确答案...");
  
  // 1. 获取所有JSON文件
  const jsonFiles = await getAllJsonFiles();
  console.log(`找到 ${jsonFiles.length} 个JSON文件`);
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalNotFound = 0;
  let totalErrors = 0;
  const errors: string[] = [];
  
  // 2. 处理每个JSON文件
  for (const filePath of jsonFiles) {
    const fileName = path.basename(filePath);
    console.log(`\n处理文件: ${fileName}`);
    
    try {
      // 加载题目
      const questions = await loadQuestionsFromFile(filePath);
      console.log(`  加载了 ${questions.length} 个题目`);
      
      // 3. 处理每个题目
      for (const question of questions) {
        try {
          totalProcessed++;
          
          // 计算题目hash（用于匹配数据库中的题目）
          const contentHash = calculateQuestionHash(question);
          
          // 检查数据库中是否存在该题目
          const existing = await db
            .selectFrom("questions")
            .select(["id", "content", "correct_answer"])
            .where("content_hash", "=", contentHash)
            .executeTakeFirst();
          
          if (!existing) {
            totalNotFound++;
            console.log(`  [${totalProcessed}] 题目未找到: ${question.content.substring(0, 50)}...`);
            continue;
          }
          
          // 检查正确答案是否需要更新
          // 将正确答案转换为JSONB格式
          let correctAnswerJsonb: any;
          if (Array.isArray(question.correctAnswer)) {
            correctAnswerJsonb = question.correctAnswer;
          } else {
            correctAnswerJsonb = question.correctAnswer;
          }
          
          // 检查当前数据库中的答案
          const currentAnswer = existing.correct_answer;
          
          // 如果答案为空或null，或者格式不正确，则更新
          let needsUpdate = false;
          if (!currentAnswer || currentAnswer === null) {
            needsUpdate = true;
          } else {
            // 比较答案内容
            const currentAnswerStr = JSON.stringify(currentAnswer);
            const newAnswerStr = JSON.stringify(correctAnswerJsonb);
            if (currentAnswerStr !== newAnswerStr) {
              needsUpdate = true;
            }
          }
          
          if (needsUpdate) {
            // 更新正确答案
            await db
              .updateTable("questions")
              .set({
                correct_answer: correctAnswerJsonb as any,
                updated_at: new Date(),
              })
              .where("id", "=", existing.id)
              .execute();
            
            totalUpdated++;
            console.log(`  [${totalProcessed}] ✓ 已更新: ${question.content.substring(0, 50)}... (答案: ${JSON.stringify(correctAnswerJsonb)})`);
          } else {
            console.log(`  [${totalProcessed}] - 无需更新: ${question.content.substring(0, 50)}...`);
          }
        } catch (error: any) {
          totalErrors++;
          const errorMsg = `处理题目失败: ${error.message || String(error)}`;
          errors.push(errorMsg);
          console.error(`  [${totalProcessed}] ✗ ${errorMsg}`);
        }
      }
    } catch (error: any) {
      totalErrors++;
      const errorMsg = `处理文件 ${fileName} 失败: ${error.message || String(error)}`;
      errors.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }
  }
  
  // 4. 输出统计信息
  console.log("\n" + "=".repeat(60));
  console.log("恢复完成！");
  console.log("=".repeat(60));
  console.log(`总处理题目数: ${totalProcessed}`);
  console.log(`成功更新: ${totalUpdated}`);
  console.log(`未找到题目: ${totalNotFound}`);
  console.log(`错误数: ${totalErrors}`);
  
  if (errors.length > 0) {
    console.log("\n错误列表:");
    errors.slice(0, 20).forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err}`);
    });
    if (errors.length > 20) {
      console.log(`  ... 还有 ${errors.length - 20} 个错误`);
    }
  }
}

// 执行恢复
if (require.main === module) {
  restoreCorrectAnswers()
    .then(() => {
      console.log("\n脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n脚本执行失败:", error);
      process.exit(1);
    });
}

export { restoreCorrectAnswers };

