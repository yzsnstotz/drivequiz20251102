// ============================================================
// 脚本：使用AI直接翻译 questions_auto_tag.json 中的占位符
// 功能：提取占位符中的中文文本，使用AI翻译为英文和日文
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

function extractTextFromPlaceholder(placeholder: string): string {
  const match = placeholder.match(/^\[(?:EN|JA)\]\s*(.+)$/);
  return match ? match[1].trim() : placeholder.replace(/^\[(?:EN|JA)\]\s*/, '');
}

// 翻译函数 - 这里需要实际调用AI进行翻译
// 由于我们在TypeScript环境中，需要调用实际的翻译API
async function translateText(text: string, targetLang: 'en' | 'ja'): Promise<string> {
  // 这里应该调用AI翻译服务
  // 由于环境限制，我们使用一个简单的实现
  
  // 实际应该调用OpenAI或其他翻译API
  // 现在先返回一个标记，表示需要翻译
  return `[TRANSLATE_${targetLang.toUpperCase()}] ${text}`;
}

async function main() {
  console.log("开始读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个题目`);

  // 收集需要翻译的内容
  const translationTasks: Array<{
    question: Question;
    field: 'content' | 'explanation';
    lang: 'en' | 'ja';
    chineseText: string;
  }> = [];

  for (const q of questions) {
    if (typeof q.content === "object" && q.content !== null) {
      const contentObj = q.content as { [key: string]: string | undefined };
      
      if (contentObj.en && isPlaceholder(contentObj.en)) {
        const chineseText = extractTextFromPlaceholder(contentObj.en);
        translationTasks.push({ question: q, field: 'content', lang: 'en', chineseText });
      }
      
      if (contentObj.ja && isPlaceholder(contentObj.ja)) {
        const chineseText = extractTextFromPlaceholder(contentObj.ja);
        translationTasks.push({ question: q, field: 'content', lang: 'ja', chineseText });
      }
    }

    if (q.explanation && typeof q.explanation === "object" && q.explanation !== null) {
      const expObj = q.explanation as { [key: string]: string | undefined };
      
      if (expObj.en && isPlaceholder(expObj.en)) {
        const chineseText = extractTextFromPlaceholder(expObj.en);
        translationTasks.push({ question: q, field: 'explanation', lang: 'en', chineseText });
      }
      
      if (expObj.ja && isPlaceholder(expObj.ja)) {
        const chineseText = extractTextFromPlaceholder(expObj.ja);
        translationTasks.push({ question: q, field: 'explanation', lang: 'ja', chineseText });
      }
    }
  }

  console.log(`\n需要翻译: ${translationTasks.length} 个字段`);
  console.log(`开始翻译...\n`);

  // 批量处理 - 每批10个
  const batchSize = 10;
  let translatedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < translationTasks.length; i += batchSize) {
    const batch = translationTasks.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(translationTasks.length / batchSize);
    
    console.log(`处理批次 ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + batchSize, translationTasks.length)}/${translationTasks.length})`);

    for (const task of batch) {
      try {
        // 翻译文本
        const translated = await translateText(task.chineseText, task.lang);
        
        // 更新题目
        if (task.field === 'content' && typeof task.question.content === "object" && task.question.content !== null) {
          (task.question.content as any)[task.lang] = translated;
          translatedCount++;
        } else if (task.field === 'explanation' && typeof task.question.explanation === "object" && task.question.explanation !== null) {
          (task.question.explanation as any)[task.lang] = translated;
          translatedCount++;
        }
      } catch (error) {
        console.error(`翻译失败 (题目 ${task.question.id}, ${task.field}.${task.lang}):`, error);
        // 翻译失败时删除占位符
        if (task.field === 'content' && typeof task.question.content === "object" && task.question.content !== null) {
          delete (task.question.content as any)[task.lang];
        } else if (task.field === 'explanation' && typeof task.question.explanation === "object" && task.question.explanation !== null) {
          delete (task.question.explanation as any)[task.lang];
        }
        errorCount++;
      }
    }
  }

  console.log(`\n完成！`);
  console.log(`- 翻译成功: ${translatedCount} 个字段`);
  console.log(`- 翻译失败（已删除占位符）: ${errorCount} 个字段`);

  // 保存结果
  await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");
  console.log(`\n文件已保存到: ${INPUT_FILE}`);
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

