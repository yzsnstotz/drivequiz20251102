// scripts/expand-multilang-ai.ts
// 使用AI翻译将 questions_auto_tag.json 扩展为多语言格式

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

// 使用AI翻译文本
async function translateText(text: string, targetLang: "en" | "ja"): Promise<string> {
  // 这里需要调用实际的AI翻译服务
  // 由于我们在脚本中，可以使用项目中的翻译API或直接调用AI服务
  // 暂时返回占位符，实际使用时需要替换为真实的翻译调用
  
  // 示例：可以调用项目中的翻译API
  // const response = await fetch('http://localhost:3000/api/translate', {
  //   method: 'POST',
  //   body: JSON.stringify({ text, from: 'zh', to: targetLang })
  // });
  // return await response.json();
  
  return `[${targetLang.toUpperCase()}] ${text}`;
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
    
    if ((i + 1) % 10 === 0) {
      console.log(`处理进度: ${i + 1}/${questions.length}`);
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

