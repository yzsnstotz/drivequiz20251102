// ============================================================
// 脚本：替换 questions_auto_tag.json 中的占位符为真实翻译
// 功能：
//   1. 从数据库 question_translations 表读取翻译
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

  // 从数据库读取所有翻译
  console.log("从数据库读取翻译...");
  const translations = await db
    .selectFrom("question_translations")
    .select(["content_hash", "locale", "content", "explanation"])
    .execute();

  // 构建翻译映射：content_hash -> { en: {...}, ja: {...} }
  const translationMap = new Map<string, { en?: { content: string; explanation?: string | null }; ja?: { content: string; explanation?: string | null } }>();
  
  for (const t of translations) {
    if (!translationMap.has(t.content_hash)) {
      translationMap.set(t.content_hash, {});
    }
    const map = translationMap.get(t.content_hash)!;
    if (t.locale === "en") {
      map.en = { content: t.content, explanation: t.explanation ?? null };
    } else if (t.locale === "ja") {
      map.ja = { content: t.content, explanation: t.explanation ?? null };
    }
  }

  console.log(`从数据库读取到 ${translations.length} 条翻译记录`);
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

    // 获取该题目的翻译
    const translations = translationMap.get(contentHash);

    // 处理content字段
    if (typeof q.content === "object" && q.content !== null) {
      const contentObj = q.content as { [key: string]: string | undefined };
      
      // 检查并替换 en 占位符
      if (contentObj.en && isPlaceholder(contentObj.en)) {
        if (translations?.en?.content) {
          contentObj.en = translations.en.content;
          replacedCount++;
          console.log(`题目 ${q.id}: 替换 content.en 占位符为真实翻译`);
        } else {
          // 如果没有翻译，删除占位符字段
          delete contentObj.en;
          deletedCount++;
          console.log(`题目 ${q.id}: 删除 content.en 占位符（无翻译）`);
        }
      }

      // 检查并替换 ja 占位符
      if (contentObj.ja && isPlaceholder(contentObj.ja)) {
        if (translations?.ja?.content) {
          contentObj.ja = translations.ja.content;
          replacedCount++;
          console.log(`题目 ${q.id}: 替换 content.ja 占位符为真实翻译`);
        } else {
          // 如果没有翻译，删除占位符字段
          delete contentObj.ja;
          deletedCount++;
          console.log(`题目 ${q.id}: 删除 content.ja 占位符（无翻译）`);
        }
      }
    }

    // 处理explanation字段
    if (q.explanation && typeof q.explanation === "object" && q.explanation !== null) {
      const expObj = q.explanation as { [key: string]: string | undefined };
      
      // 检查并替换 en 占位符
      if (expObj.en && isPlaceholder(expObj.en)) {
        if (translations?.en?.explanation) {
          expObj.en = translations.en.explanation;
          replacedCount++;
          console.log(`题目 ${q.id}: 替换 explanation.en 占位符为真实翻译`);
        } else {
          // 如果没有翻译，删除占位符字段
          delete expObj.en;
          deletedCount++;
          console.log(`题目 ${q.id}: 删除 explanation.en 占位符（无翻译）`);
        }
      }

      // 检查并替换 ja 占位符
      if (expObj.ja && isPlaceholder(expObj.ja)) {
        if (translations?.ja?.explanation) {
          expObj.ja = translations.ja.explanation;
          replacedCount++;
          console.log(`题目 ${q.id}: 替换 explanation.ja 占位符为真实翻译`);
        } else {
          // 如果没有翻译，删除占位符字段
          delete expObj.ja;
          deletedCount++;
          console.log(`题目 ${q.id}: 删除 explanation.ja 占位符（无翻译）`);
        }
      }
    }

    if (!translations) {
      noTranslationCount++;
    }
  }

  // 保存结果
  console.log("\n保存结果...");
  await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");

  console.log(`\n完成！`);
  console.log(`- 替换占位符为真实翻译: ${replacedCount} 个字段`);
  console.log(`- 删除占位符（无翻译）: ${deletedCount} 个字段`);
  console.log(`- 没有翻译的题目数: ${noTranslationCount}`);
  console.log(`- 文件已保存到: ${INPUT_FILE}`);
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

