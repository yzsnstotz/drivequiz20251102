// scripts/expand-to-multilang-direct.ts
// 直接处理文件，将 questions_auto_tag.json 扩展为多语言格式
// 此脚本会直接修改原文件，请确保有备份

import * as fs from "fs/promises";
import * as path from "path";

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");

interface Question {
  id: string;
  type: string;
  content: string;
  correctAnswer: string;
  category?: string;
  hash?: string;
  license_tags?: string[];
  stage_tag?: string;
  topic_tags?: string[];
  image?: string;
  explanation?: string;
}

interface MultilangQuestion extends Omit<Question, "content" | "explanation"> {
  content: {
    zh: string;
    en: string;
    ja: string;
  };
  explanation?: {
    zh: string;
    en: string;
    ja: string;
  };
}

async function translateContent(text: string, targetLang: "en" | "ja"): Promise<string> {
  // 这里需要实际的翻译逻辑
  // 由于文件很大，我们会在实际处理时使用AI翻译
  // 暂时返回占位符
  return `[${targetLang.toUpperCase()}] ${text}`;
}

async function processFile() {
  console.log("开始读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题`);

  // 创建备份
  const backupFile = INPUT_FILE.replace(".json", "_backup_before_multilang.json");
  await fs.writeFile(backupFile, content, "utf-8");
  console.log(`已创建备份: ${backupFile}`);

  const multilangQuestions: MultilangQuestion[] = [];

  // 处理每个问题
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if ((i + 1) % 50 === 0) {
      console.log(`处理进度: ${i + 1}/${questions.length}`);
    }

    // 翻译 content
    const contentEn = await translateContent(q.content, "en");
    const contentJa = await translateContent(q.content, "ja");

    // 翻译 explanation（如果存在）
    let explanation: { zh: string; en: string; ja: string } | undefined;
    if (q.explanation) {
      const explanationEn = await translateContent(q.explanation, "en");
      const explanationJa = await translateContent(q.explanation, "ja");
      explanation = {
        zh: q.explanation,
        en: explanationEn,
        ja: explanationJa,
      };
    }

    const multilangQ: MultilangQuestion = {
      ...q,
      content: {
        zh: q.content,
        en: contentEn,
        ja: contentJa,
      },
      ...(explanation && { explanation }),
    };

    multilangQuestions.push(multilangQ);
  }

  // 保存结果
  console.log("保存结果...");
  await fs.writeFile(
    INPUT_FILE,
    JSON.stringify(multilangQuestions, null, 2),
    "utf-8"
  );
  console.log("完成！");
}

processFile().catch(console.error);

