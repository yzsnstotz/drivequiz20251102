// 清除 questions_auto_tag.json 中以 [EN] 和 [JA] 开头的字段值，将其设为空字符串

import * as fs from "fs/promises";
import * as path from "path";

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");

interface Question {
  id: string;
  type: string;
  content: {
    zh?: string;
    en?: string;
    ja?: string;
  };
  explanation?: {
    zh?: string;
    en?: string;
    ja?: string;
  };
  [key: string]: any;
}

async function main() {
  console.log("开始清除 [EN] 和 [JA] 占位符...");
  console.log(`输入文件: ${INPUT_FILE}\n`);

  // 读取文件
  console.log("读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题\n`);

  let clearedCount = 0;

  // 遍历所有问题
  for (const question of questions) {
    // 处理 content 字段
    if (question.content && typeof question.content === "object") {
      // 检查 en 字段
      if (question.content.en && typeof question.content.en === "string" && question.content.en.trim().startsWith("[EN]")) {
        question.content.en = "";
        clearedCount++;
      }

      // 检查 ja 字段
      if (question.content.ja && typeof question.content.ja === "string" && question.content.ja.trim().startsWith("[JA]")) {
        question.content.ja = "";
        clearedCount++;
      }
    }

    // 处理 explanation 字段
    if (question.explanation && typeof question.explanation === "object") {
      // 检查 en 字段
      if (question.explanation.en && typeof question.explanation.en === "string" && question.explanation.en.trim().startsWith("[EN]")) {
        question.explanation.en = "";
        clearedCount++;
      }

      // 检查 ja 字段
      if (question.explanation.ja && typeof question.explanation.ja === "string" && question.explanation.ja.trim().startsWith("[JA]")) {
        question.explanation.ja = "";
        clearedCount++;
      }
    }
  }

  // 保存文件
  console.log(`\n清除了 ${clearedCount} 个占位符字段`);
  console.log("保存文件...");
  await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");

  console.log("完成！");
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

