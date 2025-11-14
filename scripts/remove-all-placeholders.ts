// ============================================================
// 脚本：删除 questions_auto_tag.json 中的所有占位符
// 功能：删除所有以 [EN] 或 [JA] 开头的占位符字段
// ============================================================

import * as fs from "fs/promises";
import * as path from "path";

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

  let removedCount = 0;

  // 处理每个题目
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    
    if ((i + 1) % 100 === 0) {
      console.log(`处理进度: ${i + 1}/${questions.length}`);
    }

    // 处理content字段
    if (typeof q.content === "object" && q.content !== null) {
      const contentObj = q.content as { [key: string]: string | undefined };
      
      // 删除 en 占位符
      if (contentObj.en && isPlaceholder(contentObj.en)) {
        delete contentObj.en;
        removedCount++;
      }
      
      // 删除 ja 占位符
      if (contentObj.ja && isPlaceholder(contentObj.ja)) {
        delete contentObj.ja;
        removedCount++;
      }
    }

    // 处理explanation字段
    if (q.explanation && typeof q.explanation === "object" && q.explanation !== null) {
      const expObj = q.explanation as { [key: string]: string | undefined };
      
      // 删除 en 占位符
      if (expObj.en && isPlaceholder(expObj.en)) {
        delete expObj.en;
        removedCount++;
      }
      
      // 删除 ja 占位符
      if (expObj.ja && isPlaceholder(expObj.ja)) {
        delete expObj.ja;
        removedCount++;
      }
    }
  }

  // 保存结果
  console.log("保存结果...");
  await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");

  console.log(`\n完成！`);
  console.log(`- 删除占位符字段数: ${removedCount}`);
  console.log(`- 文件已保存到: ${INPUT_FILE}`);
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

