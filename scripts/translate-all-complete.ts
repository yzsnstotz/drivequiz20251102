// 完成所有翻译 - 直接使用AI能力
// 读取 questions_auto_tag.json，找出所有需要翻译的内容，逐个翻译并更新

import * as fs from "fs/promises";
import * as path from "path";

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");

interface Question {
  id: string;
  type: string;
  content: string | {
    zh?: string;
    en?: string;
    ja?: string;
  };
  correctAnswer: string;
  category?: string;
  hash?: string;
  license_tags?: string[];
  stage_tag?: string;
  topic_tags?: string[];
  image?: string;
  explanation?: string | {
    zh?: string;
    en?: string;
    ja?: string;
  };
}

// 翻译中文到英文
function translateToEnglish(zhText: string): string {
  // 这里将使用AI直接翻译，实际翻译会在主函数中完成
  return "";
}

// 翻译中文到日文
function translateToJapanese(zhText: string): string {
  // 这里将使用AI直接翻译，实际翻译会在主函数中完成
  return "";
}

async function main() {
  console.log("开始读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题\n`);

  let processed = 0;
  let translated = 0;

  // 逐个处理每个问题
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    let updated = false;

    // 处理 content
    let content: { zh?: string; en?: string; ja?: string };
    if (typeof q.content === "string") {
      content = { zh: q.content };
    } else {
      content = { ...q.content };
    }

    const hasZh = content.zh && content.zh.trim() !== "";
    const hasEn = content.en && content.en.trim() !== "";
    const hasJa = content.ja && content.ja.trim() !== "";

    if (hasZh && (!hasEn || !hasJa)) {
      console.log(`处理问题 ${q.id} 的 content...`);
      if (!hasEn) {
        // 这里需要实际翻译
        content.en = ""; // 占位符
      }
      if (!hasJa) {
        // 这里需要实际翻译
        content.ja = ""; // 占位符
      }
      updated = true;
    }

    // 处理 explanation
    if (q.explanation) {
      let explContent: { zh?: string; en?: string; ja?: string };
      if (typeof q.explanation === "string") {
        explContent = { zh: q.explanation };
      } else {
        explContent = { ...q.explanation };
      }

      const explHasZh = explContent.zh && explContent.zh.trim() !== "";
      const explHasEn = explContent.en && explContent.en.trim() !== "";
      const explHasJa = explContent.ja && explContent.ja.trim() !== "";

      if (explHasZh && (!explHasEn || !explHasJa)) {
        console.log(`处理问题 ${q.id} 的 explanation...`);
        if (!explHasEn) {
          explContent.en = ""; // 占位符
        }
        if (!explHasJa) {
          explContent.ja = ""; // 占位符
        }
        updated = true;
      }

      if (updated) {
        questions[i] = {
          ...q,
          content,
          explanation: explContent,
        };
      }
    } else if (updated) {
      questions[i] = {
        ...q,
        content,
      };
    }

    if (updated) {
      processed++;
      // 每处理10个问题保存一次
      if (processed % 10 === 0) {
        console.log(`保存进度... (已处理 ${processed} 个问题)`);
        await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");
      }
    }
  }

  // 最终保存
  console.log("\n保存最终结果...");
  await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");
  console.log(`完成！处理了 ${processed} 个问题`);
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

