// scripts/process-multilang.ts
// 处理文件，将 questions_auto_tag.json 扩展为多语言格式
// 此脚本会读取文件，翻译内容，然后更新文件

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

async function main() {
  console.log("开始处理文件...");
  
  // 读取文件
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题`);

  const multilangQuestions: MultilangQuestion[] = [];

  // 处理每个问题
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    
    if ((i + 1) % 100 === 0) {
      console.log(`处理进度: ${i + 1}/${questions.length}`);
    }

    // 这里需要实际的翻译逻辑
    // 由于文件很大，我们需要使用实际的翻译服务
    // 暂时使用占位符
    const contentEn = `[EN] ${q.content}`;
    const contentJa = `[JA] ${q.content}`;

    // 翻译 explanation（如果存在）
    let explanation: { zh: string; en: string; ja: string } | undefined;
    if (q.explanation) {
      const explanationEn = `[EN] ${q.explanation}`;
      const explanationJa = `[JA] ${q.explanation}`;
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
  
  console.log(`完成！共处理 ${multilangQuestions.length} 个问题`);
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

