// scripts/expand-to-multilang.ts
// 此脚本用于将 questions_auto_tag.json 扩展为多语言格式

import fs from "fs";
import path from "path";

// ---------- 配置区 ----------
const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");
const OUTPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");
const BATCH_SIZE = 50; // 每批处理的问题数量

// ---------- 类型定义 ----------
type Question = {
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
};

type MultilangQuestion = Omit<Question, "content" | "explanation"> & {
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
};

// ---------- 翻译辅助函数 ----------
// 这些函数需要在实际使用时替换为真实的翻译服务调用
// 或者使用项目中的翻译API

// 简单的翻译函数占位符
// 实际使用时应该调用翻译API
function translateText(text: string, targetLang: "en" | "ja"): string {
  // 占位符，实际使用时需要替换
  if (targetLang === "en") {
    return `[EN Translation] ${text}`;
  } else {
    return `[JA Translation] ${text}`;
  }
}

// ---------- 主处理函数 ----------
async function expandToMultilang() {
  console.log(`[ExpandToMultilang] 开始处理文件: ${INPUT_FILE}`);
  
  // 1. 读取原始文件
  const fileContent = await fs.promises.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(fileContent);
  console.log(`[ExpandToMultilang] 读取到 ${questions.length} 个问题`);

  // 2. 转换为多语言格式
  const multilangQuestions: MultilangQuestion[] = [];
  
  // 分批处理
  for (let batchStart = 0; batchStart < questions.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, questions.length);
    const batch = questions.slice(batchStart, batchEnd);
    
    console.log(`[ExpandToMultilang] 处理批次 ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(questions.length / BATCH_SIZE)} (${batchStart + 1}-${batchEnd})`);
    
    for (const q of batch) {
      // 翻译 content
      const contentEn = translateText(q.content, "en");
      const contentJa = translateText(q.content, "ja");
      
      // 翻译 explanation（如果存在）
      let explanation: { zh: string; en: string; ja: string } | undefined;
      if (q.explanation) {
        const explanationEn = translateText(q.explanation, "en");
        const explanationJa = translateText(q.explanation, "ja");
        explanation = {
          zh: q.explanation,
          en: explanationEn,
          ja: explanationJa,
        };
      }
      
      // 构建多语言问题对象
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
    
    // 每批处理后保存一次（作为备份）
    const backupFile = OUTPUT_FILE.replace(".json", `_backup_${batchStart}.json`);
    await fs.promises.writeFile(
      backupFile,
      JSON.stringify(multilangQuestions, null, 2),
      "utf-8"
    );
  }

  // 3. 保存最终结果
  console.log(`[ExpandToMultilang] 保存结果到: ${OUTPUT_FILE}`);
  await fs.promises.writeFile(
    OUTPUT_FILE,
    JSON.stringify(multilangQuestions, null, 2),
    "utf-8"
  );
  
  console.log(`[ExpandToMultilang] 完成！共处理 ${multilangQuestions.length} 个问题`);
}

// 执行
expandToMultilang().catch((error) => {
  console.error("[ExpandToMultilang] 错误:", error);
  process.exit(1);
});
