// 补全所有问题的多语言翻译（处理空字符串）
// 遍历 questions_auto_tag.json，确保每个对象的 content 和 explanation 都有 zh、en 和 ja
// 如果只有 zh，en 和 ja 为空，则基于 zh 来进行翻译

import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const INPUT_FILE = path.resolve(__dirname, "../src/data/questions/zh/questions_auto_tag.json");
const BATCH_SIZE = 3; // 每批处理的问题数量（降低以避免API限流）
const DELAY_BETWEEN_BATCHES = 2000; // 批次之间的延迟（毫秒）
const DELAY_BETWEEN_QUESTIONS = 800; // 问题之间的延迟（毫秒）

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

// 获取主站URL（用于调用API）
function getMainAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

// 调用AI服务翻译文本
async function translateWithAI(text: string, sourceLang: "zh" | "en" | "ja", targetLang: "zh" | "en" | "ja"): Promise<string> {
  const mainAppUrl = getMainAppUrl();
  const url = `${mainAppUrl}/api/ai/ask`;
  
  const langNames: Record<string, string> = {
    zh: "中文",
    en: "英语",
    ja: "日语"
  };
  
  const prompt = `请将以下${langNames[sourceLang]}文本翻译成${langNames[targetLang]}，只返回翻译结果，不要添加任何解释、标记或代码块：

${text}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: prompt,
        locale: targetLang === "en" ? "en-US" : targetLang === "ja" ? "ja-JP" : "zh-CN",
        scene: "question_translation",
        sourceLanguage: sourceLang,
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
    console.error(`翻译失败 (${sourceLang} -> ${targetLang}):`, error.message);
    throw error;
  }
}

// 检查字段是否需要翻译（检查空字符串）
function needsTranslation(field: { zh?: string; en?: string; ja?: string } | undefined): boolean {
  if (!field) return false;
  
  const hasZh = field.zh && field.zh.trim() !== "";
  const hasEn = field.en && field.en.trim() !== "";
  const hasJa = field.ja && field.ja.trim() !== "";
  
  // 如果只有 zh，缺少 en 或 ja，则需要翻译
  if (hasZh && (!hasEn || !hasJa)) {
    return true;
  }
  
  return false;
}

// 获取源文本（优先使用中文）
function getSourceText(field: { zh?: string; en?: string; ja?: string }): { text: string; lang: "zh" | "en" | "ja" } | null {
  // 优先使用中文
  if (field.zh && field.zh.trim() !== "") {
    return { text: field.zh, lang: "zh" };
  }
  // 其次使用英文
  if (field.en && field.en.trim() !== "") {
    return { text: field.en, lang: "en" };
  }
  // 最后使用日文
  if (field.ja && field.ja.trim() !== "") {
    return { text: field.ja, lang: "ja" };
  }
  return null;
}

// 补全单个字段的翻译
async function completeFieldTranslation(
  field: { zh?: string; en?: string; ja?: string },
  fieldName: string,
  questionId: string
): Promise<{ zh?: string; en?: string; ja?: string }> {
  const source = getSourceText(field);
  if (!source) {
    return field;
  }

  const { text: sourceText, lang: sourceLang } = source;
  
  // 检查需要翻译的语言
  const needsEn = !field.en || field.en.trim() === "";
  const needsJa = !field.ja || field.ja.trim() === "";
  
  // 如果源语言是中文，需要翻译 en 和 ja
  if (sourceLang === "zh") {
    const translations: Promise<string>[] = [];
    const targets: Array<{ lang: "en" | "ja"; index: number }> = [];

    if (needsEn) {
      targets.push({ lang: "en", index: translations.length });
      translations.push(translateWithAI(sourceText, "zh", "en"));
    }

    if (needsJa) {
      targets.push({ lang: "ja", index: translations.length });
      translations.push(translateWithAI(sourceText, "zh", "ja"));
    }

    if (translations.length > 0) {
      try {
        const results = await Promise.all(translations);
        targets.forEach((target, i) => {
          field[target.lang] = results[i];
        });
      } catch (error: any) {
        console.error(`  翻译 ${fieldName} 失败:`, error.message);
      }
    }
  }

  // 确保所有字段都存在
  if (!field.zh) field.zh = sourceLang === "zh" ? sourceText : "";
  if (!field.en) field.en = sourceLang === "en" ? sourceText : "";
  if (!field.ja) field.ja = sourceLang === "ja" ? sourceText : "";

  return field;
}

// 补全单个问题的翻译
async function completeQuestionTranslation(q: Question): Promise<Question> {
  // 确保 content 是对象格式
  let content: { zh?: string; en?: string; ja?: string };
  
  if (typeof q.content === "string") {
    content = { zh: q.content };
  } else {
    content = { ...q.content };
  }

  // 处理 content
  if (needsTranslation(content)) {
    console.log(`  处理问题 ${q.id} 的 content...`);
    content = await completeFieldTranslation(content, "content", q.id);
    // 延迟以避免API限流
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_QUESTIONS));
  }

  // 处理 explanation（如果存在）
  let explanation: { zh?: string; en?: string; ja?: string } | undefined;
  if (q.explanation) {
    let explContent: { zh?: string; en?: string; ja?: string };
    
    if (typeof q.explanation === "string") {
      explContent = { zh: q.explanation };
    } else {
      explContent = { ...q.explanation };
    }

    if (needsTranslation(explContent)) {
      console.log(`  处理问题 ${q.id} 的 explanation...`);
      explContent = await completeFieldTranslation(explContent, "explanation", q.id);
      // 延迟以避免API限流
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_QUESTIONS));
    }

    explanation = explContent;
  }

  return {
    ...q,
    content,
    ...(explanation && { explanation }),
  };
}

async function main() {
  console.log("开始补全所有空翻译...");
  console.log(`输入文件: ${INPUT_FILE}`);
  console.log(`批次大小: ${BATCH_SIZE}`);
  console.log(`主站URL: ${getMainAppUrl()}\n`);

  // 读取文件
  console.log("读取文件...");
  const content = await fs.readFile(INPUT_FILE, "utf-8");
  const questions: Question[] = JSON.parse(content);
  console.log(`读取到 ${questions.length} 个问题\n`);

  // 找出需要翻译的问题
  const needsTranslationList: Question[] = [];
  for (const q of questions) {
    let content: { zh?: string; en?: string; ja?: string };
    if (typeof q.content === "string") {
      content = { zh: q.content };
    } else {
      content = q.content;
    }
    
    let explContent: { zh?: string; en?: string; ja?: string } | undefined;
    if (q.explanation) {
      if (typeof q.explanation === "string") {
        explContent = { zh: q.explanation };
      } else {
        explContent = q.explanation;
      }
    }
    
    if (needsTranslation(content) || needsTranslation(explContent)) {
      needsTranslationList.push(q);
    }
  }
  
  console.log(`需要补全翻译的问题: ${needsTranslationList.length}/${questions.length}\n`);

  if (needsTranslationList.length === 0) {
    console.log("所有问题都已完整翻译！");
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
        const completedQ = await completeQuestionTranslation(q);
        questions[index] = completedQ;
        processed++;
        translated++;

        // 每处理3个问题保存一次
        if (processed % 3 === 0) {
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
  console.log(`失败: ${failed}`);

  // 重新统计翻译状态
  let finalNeedsTranslation = 0;
  for (const q of questions) {
    let content: { zh?: string; en?: string; ja?: string };
    if (typeof q.content === "string") {
      content = { zh: q.content };
    } else {
      content = q.content;
    }
    
    let explContent: { zh?: string; en?: string; ja?: string } | undefined;
    if (q.explanation) {
      if (typeof q.explanation === "string") {
        explContent = { zh: q.explanation };
      } else {
        explContent = q.explanation;
      }
    }
    
    if (needsTranslation(content) || needsTranslation(explContent)) {
      finalNeedsTranslation++;
    }
  }
  
  const finalTranslated = questions.length - finalNeedsTranslation;
  console.log(`\n最终状态:`);
  console.log(`  已完整翻译: ${finalTranslated}/${questions.length} (${((finalTranslated / questions.length) * 100).toFixed(2)}%)`);
  console.log(`  待补全: ${finalNeedsTranslation}/${questions.length} (${((finalNeedsTranslation / questions.length) * 100).toFixed(2)}%)`);
  
  if (finalNeedsTranslation > 0) {
    console.log("\n仍有未完成的翻译，请重新运行脚本继续处理。");
  }
}

main().catch((error) => {
  console.error("处理过程中发生错误:", error);
  process.exit(1);
});

