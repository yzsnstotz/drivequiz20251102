// 批量完成所有翻译任务
// 读取文件，找出所有需要翻译的内容，逐个翻译并更新

import * as fs from "fs/promises";
import * as path from "path";

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");
const BATCH_SIZE = 20; // 每批处理20个翻译任务
const SAVE_INTERVAL = 20; // 每处理20个任务保存一次

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

interface TranslationTask {
  questionIndex: number;
  questionId: string;
  fieldType: "content" | "explanation";
  targetLang: "en" | "ja";
  zhText: string;
}

// 收集所有需要翻译的任务
function collectTranslationTasks(questions: Question[]): TranslationTask[] {
  const tasks: TranslationTask[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // 处理 content
    let content: { zh?: string; en?: string; ja?: string };
    if (typeof q.content === "string") {
      content = { zh: q.content };
    } else {
      content = q.content || {};
    }

    const hasZh = content.zh && content.zh.trim() !== "";
    const needsEn = hasZh && (!content.en || content.en.trim() === "");
    const needsJa = hasZh && (!content.ja || content.ja.trim() === "");

    if (needsEn) {
      tasks.push({
        questionIndex: i,
        questionId: q.id,
        fieldType: "content",
        targetLang: "en",
        zhText: content.zh!,
      });
    }

    if (needsJa) {
      tasks.push({
        questionIndex: i,
        questionId: q.id,
        fieldType: "content",
        targetLang: "ja",
        zhText: content.zh!,
      });
    }

    // 处理 explanation
    if (q.explanation) {
      let explContent: { zh?: string; en?: string; ja?: string };
      if (typeof q.explanation === "string") {
        explContent = { zh: q.explanation };
      } else {
        explContent = q.explanation || {};
      }

      const explHasZh = explContent.zh && explContent.zh.trim() !== "";
      const explNeedsEn = explHasZh && (!explContent.en || explContent.en.trim() === "");
      const explNeedsJa = explHasZh && (!explContent.ja || explContent.ja.trim() === "");

      if (explNeedsEn) {
        tasks.push({
          questionIndex: i,
          questionId: q.id,
          fieldType: "explanation",
          targetLang: "en",
          zhText: explContent.zh!,
        });
      }

      if (explNeedsJa) {
        tasks.push({
          questionIndex: i,
          questionId: q.id,
          fieldType: "explanation",
          targetLang: "ja",
          zhText: explContent.zh!,
        });
      }
    }
  }

  return tasks;
}

async function main() {
  console.log("开始读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题\n`);

  // 收集所有翻译任务
  console.log("收集翻译任务...");
  const tasks = collectTranslationTasks(questions);
  console.log(`找到 ${tasks.length} 个翻译任务\n`);

  if (tasks.length === 0) {
    console.log("所有翻译已完成！");
    return;
  }

  console.log("开始翻译...\n");
  let processed = 0;
  let failed = 0;

  // 分批处理
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(tasks.length / BATCH_SIZE);

    console.log(`处理批次 ${batchNum}/${totalBatches} (任务 ${i + 1}-${Math.min(i + BATCH_SIZE, tasks.length)})`);

    for (const task of batch) {
      try {
        const q = questions[task.questionIndex];
        
        // 获取要更新的字段
        let field: { zh?: string; en?: string; ja?: string };
        if (task.fieldType === "content") {
          if (typeof q.content === "string") {
            field = { zh: q.content };
          } else {
            field = { ...q.content };
          }
        } else {
          if (typeof q.explanation === "string") {
            field = { zh: q.explanation };
          } else {
            field = { ...q.explanation };
          }
        }

        // 这里需要实际进行翻译
        // 由于需要通过AI完成，我们会在实际运行时进行翻译
        // 现在先标记为需要翻译
        console.log(`  [待翻译] 问题 ${task.questionId} - ${task.fieldType} - ${task.targetLang}`);
        console.log(`    原文: ${task.zhText.substring(0, 50)}...`);

        // 占位符：实际翻译会在后续步骤中完成
        // field[task.targetLang] = translatedText;

        // 更新问题
        if (task.fieldType === "content") {
          questions[task.questionIndex] = {
            ...q,
            content: field,
          };
        } else {
          questions[task.questionIndex] = {
            ...q,
            explanation: field,
          };
        }

        processed++;
      } catch (error: any) {
        console.error(`  处理任务失败 (问题 ${task.questionId}):`, error.message);
        failed++;
      }
    }

    // 定期保存
    if (processed % SAVE_INTERVAL === 0 || i + BATCH_SIZE >= tasks.length) {
      console.log(`  保存进度... (已处理 ${processed}/${tasks.length})`);
      await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");
    }
  }

  // 最终保存
  console.log("\n保存最终结果...");
  await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");

  console.log("\n翻译完成！");
  console.log(`总任务数: ${tasks.length}`);
  console.log(`已处理: ${processed}`);
  console.log(`失败: ${failed}`);
  console.log("\n注意：此脚本需要实际的翻译实现。");
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

