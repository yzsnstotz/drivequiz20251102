// scripts/expand-multilang-batch.ts
// 批量处理文件，将 questions_auto_tag.json 扩展为多语言格式

import * as fs from "fs/promises";
import * as path from "path";

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");
const BATCH_SIZE = 10; // 每批处理的问题数量，可以根据需要调整

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

// 翻译函数 - 这里需要实际的翻译逻辑
// 在实际使用时，应该调用翻译API或使用AI服务
async function translateToEnglish(text: string): Promise<string> {
  // TODO: 实现实际的英语翻译
  // 可以使用项目中的翻译服务或外部API
  return text; // 占位符
}

async function translateToJapanese(text: string): Promise<string> {
  // TODO: 实现实际的日语翻译
  // 可以使用项目中的翻译服务或外部API
  return text; // 占位符
}

async function processBatch(questions: Question[], startIdx: number, endIdx: number): Promise<MultilangQuestion[]> {
  const batch = questions.slice(startIdx, endIdx);
  const results: MultilangQuestion[] = [];

  for (const q of batch) {
    // 翻译 content
    const contentEn = await translateToEnglish(q.content);
    const contentJa = await translateToJapanese(q.content);

    // 翻译 explanation（如果存在）
    let explanation: { zh: string; en: string; ja: string } | undefined;
    if (q.explanation) {
      const explanationEn = await translateToEnglish(q.explanation);
      const explanationJa = await translateToJapanese(q.explanation);
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
  console.log("开始处理文件...");
  
  // 读取文件
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题`);

  // 创建备份
  const backupFile = INPUT_FILE.replace(".json", "_backup_before_multilang.json");
  await fs.writeFile(backupFile, content, "utf-8");
  console.log(`已创建备份: ${backupFile}`);

  const multilangQuestions: MultilangQuestion[] = [];
  const totalBatches = Math.ceil(questions.length / BATCH_SIZE);

  // 分批处理
  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const endIdx = Math.min(i + BATCH_SIZE, questions.length);
    
    console.log(`处理批次 ${batchNum}/${totalBatches} (问题 ${i + 1}-${endIdx})`);
    
    const batchResults = await processBatch(questions, i, endIdx);
    multilangQuestions.push(...batchResults);
    
    // 每处理一批后保存中间结果（作为进度保存）
    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      const progressFile = INPUT_FILE.replace(".json", `_progress_${batchNum}.json`);
      await fs.writeFile(
        progressFile,
        JSON.stringify(multilangQuestions, null, 2),
        "utf-8"
      );
      console.log(`已保存进度文件: ${progressFile}`);
    }
  }

  // 保存最终结果
  console.log("保存最终结果...");
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

