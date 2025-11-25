// scripts/translate-multilang.ts
// 将 questions_auto_tag.json 扩展为多语言格式，使用AI翻译

import * as fs from "fs/promises";
import * as path from "path";

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");
const BATCH_SIZE = 20; // 每批处理的问题数量

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

// 翻译文本 - 这里需要实际的翻译逻辑
// 在实际使用时，应该调用翻译API或使用AI服务
async function translateText(text: string, targetLang: "en" | "ja"): Promise<string> {
  // TODO: 实现实际的翻译逻辑
  // 可以使用项目中的翻译服务或外部API
  return text; // 占位符
}

async function processQuestions(questions: Question[]): Promise<MultilangQuestion[]> {
  const results: MultilangQuestion[] = [];
  const total = questions.length;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    
    if ((i + 1) % 50 === 0) {
      console.log(`处理进度: ${i + 1}/${total}`);
    }

    // 翻译 content
    const contentEn = await translateText(q.content, "en");
    const contentJa = await translateText(q.content, "ja");

    // 翻译 explanation（如果存在）
    let explanation: { zh: string; en: string; ja: string } | undefined;
    if (q.explanation) {
      const explanationEn = await translateText(q.explanation, "en");
      const explanationJa = await translateText(q.explanation, "ja");
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

    results.push(multilangQ);
  }

  return results;
}

async function main() {
  console.log("开始读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题`);

  console.log("开始翻译...");
  const multilangQuestions = await processQuestions(questions);

  console.log("保存结果...");
  await fs.writeFile(
    INPUT_FILE,
    JSON.stringify(multilangQuestions, null, 2),
    "utf-8"
  );
  
  console.log(`完成！共处理 ${multilangQuestions.length} 个问题`);
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

