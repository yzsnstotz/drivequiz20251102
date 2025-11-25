// 批量翻译所有剩余的问题
// 1. 先确保所有问题都是多语言格式
// 2. 然后批量翻译所有待翻译的问题

import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");
const BATCH_SIZE = 5; // 每批处理的问题数量（减小批次以避免API限流）
const DELAY_BETWEEN_BATCHES = 3000; // 批次之间的延迟（毫秒）
const DELAY_BETWEEN_QUESTIONS = 1000; // 问题之间的延迟（毫秒）

interface Question {
  id: string;
  type: string;
  content: string | {
    zh: string;
    en: string;
    ja: string;
  };
  correctAnswer: string;
  category?: string;
  hash?: string;
  license_tags?: string[];
  stage_tag?: string;
  topic_tags?: string[];
  image?: string;
  explanation?: string | {
    zh: string;
    en: string;
    ja: string;
  };
}

// 获取主站URL（用于调用API）
function getMainAppUrl(): string {
  // 优先使用环境变量
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // 默认使用本地服务
  return "http://localhost:3000";
}

// 调用AI服务翻译文本
async function translateWithAI(text: string, targetLang: "en" | "ja"): Promise<string> {
  const mainAppUrl = getMainAppUrl();
  const url = `${mainAppUrl}/api/ai/ask`;
  
  const prompt = `请将以下中文文本翻译成${targetLang === "en" ? "英语" : "日语"}，只返回翻译结果，不要添加任何解释、标记或代码块：

${text}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: prompt,
        locale: targetLang === "en" ? "en-US" : "ja-JP",
        scene: "question_translation",
        sourceLanguage: "zh",
        targetLanguage: targetLang,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI服务返回错误: ${response.status} ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    
    if (!data.ok || !data.data?.answer) {
      throw new Error(`AI服务返回无效响应: ${JSON.stringify(data).substring(0, 200)}`);
    }

    // 清理翻译结果
    let translated = data.data.answer.trim();
    // 移除可能的代码块标记
    translated = translated.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
    // 移除可能的引号
    if ((translated.startsWith('"') && translated.endsWith('"')) || 
        (translated.startsWith("'") && translated.endsWith("'"))) {
      translated = translated.slice(1, -1);
    }
    // 移除可能的标记
    translated = translated.replace(/^\[EN\]\s*/i, "").replace(/^\[JA\]\s*/i, "").trim();

    return translated;
  } catch (error: any) {
    console.error(`翻译失败 (${targetLang}):`, error.message);
    throw error;
  }
}

// 检查是否需要翻译
function needsTranslation(q: Question): boolean {
  if (typeof q.content === "string") {
    return true; // 字符串格式需要转换和翻译
  }
  
  const content = q.content as { zh: string; en: string; ja: string };
  return (
    !content.en || 
    content.en.startsWith("[EN]") || 
    !content.ja || 
    content.ja.startsWith("[JA]")
  );
}

// 确保问题格式正确（转换为多语言格式）
function ensureMultilangFormat(q: Question): Question {
  let zhContent: string;
  let zhExplanation: string | undefined;

  // 获取中文内容
  if (typeof q.content === "string") {
    zhContent = q.content;
  } else {
    zhContent = q.content.zh;
  }

  if (typeof q.explanation === "string") {
    zhExplanation = q.explanation;
  } else if (q.explanation) {
    zhExplanation = q.explanation.zh;
  }

  // 确保content是多语言格式
  const content = typeof q.content === "string" 
    ? { zh: q.content, en: `[EN] ${q.content}`, ja: `[JA] ${q.content}` }
    : q.content;

  // 确保explanation是多语言格式（如果存在）
  let explanation: { zh: string; en: string; ja: string } | undefined;
  if (zhExplanation) {
    if (typeof q.explanation === "string") {
      explanation = { zh: zhExplanation, en: `[EN] ${zhExplanation}`, ja: `[JA] ${zhExplanation}` };
    } else if (q.explanation) {
      explanation = q.explanation;
    }
  }

  return {
    ...q,
    content,
    ...(explanation && { explanation }),
  };
}

// 翻译单个问题
async function translateQuestion(q: Question): Promise<Question> {
  // 先确保格式正确
  const formattedQ = ensureMultilangFormat(q);
  
  // 检查是否需要翻译
  if (!needsTranslation(formattedQ)) {
    return formattedQ; // 已经翻译过了
  }

  const content = formattedQ.content as { zh: string; en: string; ja: string };
  const zhContent = content.zh;
  const zhExplanation = formattedQ.explanation 
    ? (typeof formattedQ.explanation === "string" 
        ? formattedQ.explanation 
        : formattedQ.explanation.zh)
    : undefined;

  console.log(`  翻译问题 ${q.id}: ${zhContent.substring(0, 50)}...`);

  try {
    // 翻译content
    const [enContent, jaContent] = await Promise.all([
      translateWithAI(zhContent, "en"),
      translateWithAI(zhContent, "ja"),
    ]);

    // 翻译explanation（如果存在）
    let enExplanation: string | undefined;
    let jaExplanation: string | undefined;
    if (zhExplanation) {
      [enExplanation, jaExplanation] = await Promise.all([
        translateWithAI(zhExplanation, "en"),
        translateWithAI(zhExplanation, "ja"),
      ]);
    }

    // 更新问题
    const updated: Question = {
      ...formattedQ,
      content: {
        zh: zhContent,
        en: enContent,
        ja: jaContent,
      },
    };

    if (zhExplanation) {
      updated.explanation = {
        zh: zhExplanation,
        en: enExplanation!,
        ja: jaExplanation!,
      };
    }

    // 延迟以避免API限流
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_QUESTIONS));

    return updated;
  } catch (error: any) {
    console.error(`  翻译问题 ${q.id} 失败:`, error.message);
    // 返回格式化的问题，但保留占位符
    return formattedQ;
  }
}

async function main() {
  console.log("开始批量翻译...");
  console.log(`输入文件: ${INPUT_FILE}`);
  console.log(`批次大小: ${BATCH_SIZE}`);
  console.log(`主站URL: ${getMainAppUrl()}\n`);

  // 读取文件
  console.log("读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题\n`);

  // 先确保所有问题都是多语言格式
  console.log("检查并转换格式...");
  let formatUpdated = 0;
  for (let i = 0; i < questions.length; i++) {
    if (typeof questions[i].content === "string" || 
        (questions[i].explanation && typeof questions[i].explanation === "string")) {
      questions[i] = ensureMultilangFormat(questions[i]);
      formatUpdated++;
    }
  }
  if (formatUpdated > 0) {
    console.log(`已转换 ${formatUpdated} 个问题的格式`);
    await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");
    console.log("格式转换已保存\n");
  }

  // 找出需要翻译的问题
  const needsTranslationList = questions.filter(needsTranslation);
  console.log(`需要翻译的问题: ${needsTranslationList.length}/${questions.length}`);
  console.log(`已翻译的问题: ${questions.length - needsTranslationList.length}/${questions.length}\n`);

  if (needsTranslationList.length === 0) {
    console.log("所有问题都已翻译完成！");
    return;
  }

  // 分批处理
  let processed = 0;
  let translated = 0;
  let failed = 0;

  for (let i = 0; i < needsTranslationList.length; i += BATCH_SIZE) {
    const batch = needsTranslationList.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(needsTranslationList.length / BATCH_SIZE);

    console.log(`\n处理批次 ${batchNum}/${totalBatches} (问题 ${i + 1}-${Math.min(i + BATCH_SIZE, needsTranslationList.length)})`);

    // 处理批次中的每个问题
    for (const q of batch) {
      const index = questions.findIndex(q2 => q2.id === q.id);
      if (index === -1) continue;

      try {
        const translatedQ = await translateQuestion(q);
        questions[index] = translatedQ;
        processed++;
        
        if (!needsTranslation(translatedQ)) {
          translated++;
        } else {
          failed++;
        }

        // 每处理5个问题保存一次
        if (processed % 5 === 0) {
          console.log(`  保存进度... (已处理 ${processed}/${needsTranslationList.length})`);
          await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");
        }
      } catch (error: any) {
        console.error(`  处理问题 ${q.id} 时出错:`, error.message);
        failed++;
      }
    }

    // 批次之间的延迟
    if (i + BATCH_SIZE < needsTranslationList.length) {
      console.log(`  等待 ${DELAY_BETWEEN_BATCHES}ms 后继续下一批次...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  // 最终保存
  console.log("\n保存最终结果...");
  await fs.writeFile(INPUT_FILE, JSON.stringify(questions, null, 2), "utf-8");

  // 统计结果
  console.log("\n翻译完成！");
  console.log(`总问题数: ${questions.length}`);
  console.log(`已处理: ${processed}`);
  console.log(`成功翻译: ${translated}`);
  console.log(`失败/需要重试: ${failed}`);

  // 重新统计翻译状态
  const finalNeedsTranslation = questions.filter(needsTranslation).length;
  const finalTranslated = questions.length - finalNeedsTranslation;
  console.log(`\n最终状态:`);
  console.log(`  已翻译: ${finalTranslated}/${questions.length} (${((finalTranslated / questions.length) * 100).toFixed(2)}%)`);
  console.log(`  待翻译: ${finalNeedsTranslation}/${questions.length} (${((finalNeedsTranslation / questions.length) * 100).toFixed(2)}%)`);
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});




