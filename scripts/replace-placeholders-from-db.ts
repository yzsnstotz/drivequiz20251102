// ============================================================
// 脚本：替换 questions_auto_tag.json 中的占位符为真实翻译
// 功能：
//   1. 从数据库 questions 表的 content 和 explanation JSON 字段读取翻译
//   2. 替换占位符为真实翻译
//   3. 如果没有翻译，删除占位符字段
// ============================================================

import * as fs from "fs/promises";
import * as path from "path";
import { db } from "../src/lib/db";
import { calculateQuestionHash } from "../src/lib/questionHash";

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");

interface Question {
  id: string;
  type: string;
  content: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
  correctAnswer: string | string[];
  explanation?: string | { zh: string; en?: string; ja?: string; [key: string]: string | undefined };
  category?: string;
  hash?: string;
  license_tags?: string[];
  stage_tag?: string;
  topic_tags?: string[];
  image?: string;
  options?: string[];
}

function isPlaceholder(value: string | undefined): boolean {
  return value !== undefined && typeof value === 'string' && 
    (value.trim().startsWith('[EN]') || value.trim().startsWith('[JA]'));
}

async function main() {
  console.log("开始读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个题目`);

  // 从数据库读取所有题目（包含翻译）
  console.log("从数据库读取题目翻译...");
  const dbQuestions = await db
    .selectFrom("questions")
    .select(["content_hash", "content", "explanation"])
    .execute();

  // 构建翻译映射：content_hash -> { content: {...}, explanation: {...} }
  const translationMap = new Map<string, { content: any; explanation: any }>();
  
  for (const q of dbQuestions) {
    translationMap.set(q.content_hash, {
      content: q.content,
      explanation: q.explanation,
    });
  }

  console.log(`从数据库读取到 ${dbQuestions.length} 个题目`);
  console.log(`翻译映射包含 ${translationMap.size} 个唯一的 content_hash`);

  let replacedCount = 0;
  let deletedCount = 0;
  let noTranslationCount = 0;

  // 处理每个题目
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    
    if ((i + 1) % 100 === 0) {
      console.log(`处理进度: ${i + 1}/${questions.length}`);
    }

    // 计算题目hash
    const contentHash = calculateQuestionHash(q);

    // 获取该题目的数据库记录
    const dbQuestion = translationMap.get(contentHash);

    // 处理content字段
    if (typeof q.content === "object" && q.content !== null) {
      const contentObj = q.content as { [key: string]: string | undefined };
      
      // 检查并替换 en 占位符
      if (contentObj.en && isPlaceholder(contentObj.en)) {
        if (dbQuestion?.content && typeof dbQuestion.content === "object" && dbQuestion.content !== null) {
          const dbContent = dbQuestion.content as { [key: string]: string | undefined };
          if (dbContent.en && !isPlaceholder(dbContent.en)) {
            contentObj.en = dbContent.en;
            replacedCount++;
            if (i < 10) {
              console.log(`题目 ${q.id}: 替换 content.en 占位符为真实翻译`);
            }
          } else {
            // 数据库中没有有效翻译，删除占位符字段
            delete contentObj.en;
            deletedCount++;
          }
        } else {
          // 数据库中没有翻译，删除占位符字段
          delete contentObj.en;
          deletedCount++;
        }
      }

      // 检查并替换 ja 占位符
      if (contentObj.ja && isPlaceholder(contentObj.ja)) {
        if (dbQuestion?.content && typeof dbQuestion.content === "object" && dbQuestion.content !== null) {
          const dbContent = dbQuestion.content as { [key: string]: string | undefined };
          if (dbContent.ja && !isPlaceholder(dbContent.ja)) {
            contentObj.ja = dbContent.ja;
            replacedCount++;
            if (i < 10) {
              console.log(`题目 ${q.id}: 替换 content.ja 占位符为真实翻译`);
            }
          } else {
            // 数据库中没有有效翻译，删除占位符字段
            delete contentObj.ja;
            deletedCount++;
          }
        } else {
          // 数据库中没有翻译，删除占位符字段
          delete contentObj.ja;
          deletedCount++;
        }
      }
    }

    // 处理explanation字段
    if (q.explanation && typeof q.explanation === "object" && q.explanation !== null) {
      const expObj = q.explanation as { [key: string]: string | undefined };
      
      // 检查并替换 en 占位符
      if (expObj.en && isPlaceholder(expObj.en)) {
        if (dbQuestion?.explanation && typeof dbQuestion.explanation === "object" && dbQuestion.explanation !== null) {
          const dbExp = dbQuestion.explanation as { [key: string]: string | undefined };
          if (dbExp.en && !isPlaceholder(dbExp.en)) {
            expObj.en = dbExp.en;
            replacedCount++;
            if (i < 10) {
              console.log(`题目 ${q.id}: 替换 explanation.en 占位符为真实翻译`);
            }
          } else {
            // 数据库中没有有效翻译，删除占位符字段
            delete expObj.en;
            deletedCount++;
          }
        } else {
          // 数据库中没有翻译，删除占位符字段
          delete expObj.en;
          deletedCount++;
        }
      }

      // 检查并替换 ja 占位符
      if (expObj.ja && isPlaceholder(expObj.ja)) {
        if (dbQuestion?.explanation && typeof dbQuestion.explanation === "object" && dbQuestion.explanation !== null) {
          const dbExp = dbQuestion.explanation as { [key: string]: string | undefined };
          if (dbExp.ja && !isPlaceholder(dbExp.ja)) {
            expObj.ja = dbExp.ja;
            replacedCount++;
            if (i < 10) {
              console.log(`题目 ${q.id}: 替换 explanation.ja 占位符为真实翻译`);
            }
          } else {
            // 数据库中没有有效翻译，删除占位符字段
            delete expObj.ja;
            deletedCount++;
          }
        } else {
          // 数据库中没有翻译，删除占位符字段
          delete expObj.ja;
          deletedCount++;
        }
      }
    }

    if (!dbQuestion) {
      noTranslationCount++;
    }
  }

  // 保存结果
  console.log("\n保存结果...");
  await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");

  console.log(`\n完成！`);
  console.log(`- 替换占位符为真实翻译: ${replacedCount} 个字段`);
  console.log(`- 删除占位符（无翻译）: ${deletedCount} 个字段`);
  console.log(`- 没有数据库记录的题目数: ${noTranslationCount}`);
  console.log(`- 文件已保存到: ${INPUT_FILE}`);
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

